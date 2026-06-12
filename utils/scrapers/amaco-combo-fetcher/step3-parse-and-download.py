#!/usr/bin/env python3
"""
Step 3: Parse HTML files and build extensible glaze combination data structure

Data Structure Design:
- Each combination (e.g., "C-1 over C-47") can have MULTIPLE entries
- Each entry represents a specific firing with: submittedBy, coats, clayBody, cone, photos
- Entries can be official (AMACO Brent) or user-submitted
- This allows the same glaze combo to have different results on different clays/cones

Output:
  - results/combinations-parsed.json (full parsed data with original URLs)
  - app/glaze-viewer/public/data/combinations.json (app-ready data)
"""

import os
import re
import json
import hashlib
import requests
import time
import sys
from pathlib import Path
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

from config import DEFAULT_HEADERS, APP_DATA_DIR, AMACO_COMBO_IMAGES_DIR, ensure_directories

HTML_CACHE_DIR = SCRIPT_DIR / "html_cache_valid"
RESULTS_DIR = SCRIPT_DIR / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
ensure_directories()


def get_url_hash(url):
    """Generate MD5 hash of URL for consistent file naming"""
    return hashlib.md5(url.encode()).hexdigest()


def normalize_glaze_code(code):
    """Normalize glaze code: C-01 -> C-1, PC-05 -> PC-5"""
    match = re.match(r'^([A-Za-z]+)-0*(\d+)$', code)
    if match:
        return f"{match.group(1).upper()}-{match.group(2)}"
    return code.upper()

def extract_glaze_code(text):
    """Extract glaze code from text like 'C-10 Snow' -> 'C-10'"""
    match = re.match(r'^([A-Z]+-\d+)', text.strip(), re.IGNORECASE)
    if match:
        return normalize_glaze_code(match.group(1))
    return None


def is_official_submission(submitted_by):
    """Check if submission is from AMACO (official)"""
    if not submitted_by:
        return True  # Default to official if no submitter listed
    official_names = ['amaco', 'amaco brent', 'n/a', '']
    return submitted_by.lower().strip() in official_names


def parse_combination_html(filepath):
    """
    Parse a combination HTML file and extract all data.
    Returns data for a single ENTRY (one firing result).
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Get title - e.g., "C-10 Snow over C-1 Obsidian"
    title_tag = soup.find('title')
    if not title_tag:
        return None
    
    title = title_tag.text.replace(' | AMACO Brent', '').strip()
    
    # Parse "X over Y" pattern
    match = re.match(r'(.+?)\s+over\s+(.+)', title, re.IGNORECASE)
    if not match:
        return None
    
    top_text = match.group(1).strip()
    bottom_text = match.group(2).strip()
    
    top_code = extract_glaze_code(top_text)
    bottom_code = extract_glaze_code(bottom_text)
    
    if not top_code or not bottom_code:
        return None
    
    # Find ALL images (main combo image)
    image_urls = []
    for img in soup.find_all('img', {'data-src': True}):
        src = img.get('data-src', '')
        if 'asset/' in src and 'amaco.com/themes' not in src:
            # Skip small swatches (140x140)
            if 'w=140' in src and 'h=140' in src:
                continue
            # Skip "similar combinations" thumbnails (270x435)
            if 'w=270' in src:
                continue
            # Get the full-res URL (remove size params)
            clean_url = src.split('?')[0]
            if clean_url not in image_urls:
                image_urls.append(clean_url)
    
    # Extract metadata from the page
    text_content = soup.get_text()
    
    # Temperature (cone)
    cone = None
    cone_match = re.search(r'Temperature \(cone\)[:\s]*(\d+)', text_content, re.IGNORECASE)
    if cone_match:
        cone = cone_match.group(1)
    
    # Clay Type - can be complex like "White Stoneware, Velvet Underglazes, Celadon"
    clay_type = None
    # Try to find it in the structured format first
    clay_section = soup.find(string=re.compile(r'Clay Type', re.IGNORECASE))
    if clay_section:
        parent = clay_section.find_parent()
        if parent:
            # Look for the strong/bold text after "Clay Type"
            strong = parent.find('strong')
            if strong:
                clay_type = strong.get_text().strip()
    
    # Fallback regex
    if not clay_type:
        clay_match = re.search(r'Clay Type[:\s]*([^\n]+?)(?:Temperature|Number|$)', text_content)
        if clay_match:
            clay_type = clay_match.group(1).strip()
    
    # Number of coats
    top_coats = None
    top_coats_match = re.search(r'Number of Top Coats[:\s]*(\d+)', text_content, re.IGNORECASE)
    if top_coats_match:
        top_coats = int(top_coats_match.group(1))
    
    bottom_coats = None
    bottom_coats_match = re.search(r'Number of Bottom Coats[:\s]*(\d+)', text_content, re.IGNORECASE)
    if bottom_coats_match:
        bottom_coats = int(bottom_coats_match.group(1))
    
    # Submitted by - look for attribution
    submitted_by = None
    # Check for "Submitted by" or similar patterns
    submit_match = re.search(r'(?:Submitted by|Photo by|By)[:\s]*([A-Za-z\s]+?)(?:\n|<|$)', text_content, re.IGNORECASE)
    if submit_match:
        submitted_by = submit_match.group(1).strip()
    
    # If not found, check for AMACO Brent in the content (it's official)
    if not submitted_by:
        submitted_by = "AMACO Brent"
    
    # Get source URL
    source_url = None
    og_url = soup.find('meta', property='og:url')
    if og_url:
        source_url = og_url.get('content')
    
    return {
        'title': title,
        'topCode': top_code,
        'topDisplayName': top_text,
        'bottomCode': bottom_code,
        'bottomDisplayName': bottom_text,
        'imageUrls': image_urls,
        'cone': cone,
        'clayBody': clay_type,
        'topCoats': top_coats,
        'bottomCoats': bottom_coats,
        'submittedBy': submitted_by,
        'isOfficial': is_official_submission(submitted_by),
        'sourceUrl': source_url
    }


def download_image(url, filepath):
    """Download an image from URL to filepath"""
    if filepath.exists():
        return True
    
    try:
        response = requests.get(url, timeout=30, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        if response.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"    Error downloading {url}: {e}")
    return False


def main():
    print("\n" + "=" * 70)
    print("AMACO Combination Parser - Extensible Multi-Entry Format")
    print("=" * 70)
    
    # Get all HTML files
    html_files = list(HTML_CACHE_DIR.glob('*.html'))
    print(f"Found {len(html_files)} HTML files to process")
    
    if not html_files:
        print("No HTML files found! Run step2-fetch-html.py first.")
        return
    
    # Dictionary to group entries by combination
    # Key: "topCode-over-bottomCode" -> List of entries
    combinations_map = {}
    images_to_download = []
    
    print("\nPhase 1: Parsing HTML files...")
    print("-" * 70)
    
    for i, filepath in enumerate(html_files):
        if (i + 1) % 500 == 0:
            print(f"  Parsed {i + 1}/{len(html_files)}...")
        
        data = parse_combination_html(filepath)
        if not data:
            continue
        
        # Create combination key (normalized)
        combo_key = f"{data['topCode']}-over-{data['bottomCode']}"
        
        if combo_key not in combinations_map:
            combinations_map[combo_key] = {
                'topGlazeCode': data['topCode'],
                'topGlazeDisplayName': data['topDisplayName'],
                'bottomGlazeCode': data['bottomCode'],
                'bottomGlazeDisplayName': data['bottomDisplayName'],
                'entries': []
            }
        
        # Create entry ID based on hash of source URL for uniqueness
        entry_id = get_url_hash(data['sourceUrl'] or filepath.stem)[:12]
        
        # Process photos for this entry
        photos = []
        for j, img_url in enumerate(data['imageUrls']):
            # Use hash of image URL for consistent naming
            img_hash = get_url_hash(img_url)[:16]
            
            # Determine extension
            ext = 'jpg'
            if '.png' in img_url.lower():
                ext = 'png'
            elif '.jpeg' in img_url.lower():
                ext = 'jpeg'
            
            filename = f"{img_hash}.{ext}"
            local_path = f"/images/combinations/amaco/{filename}"
            
            photos.append({
                'id': f"{entry_id}-photo-{j+1}",
                'url': local_path,
                'originalUrl': img_url,
                'isCover': j == 0
            })
            
            images_to_download.append({
                'url': img_url,
                'filename': filename
            })
        
        # Create the entry
        entry = {
            'id': entry_id,
            'submittedBy': data['submittedBy'],
            'isOfficial': data['isOfficial'],
            'topCoats': data['topCoats'],
            'bottomCoats': data['bottomCoats'],
            'clayBody': data['clayBody'],
            'cone': data['cone'],
            'photos': photos,
            'sourceUrl': data['sourceUrl']
        }
        
        combinations_map[combo_key]['entries'].append(entry)
    
    print(f"\nParsed into {len(combinations_map)} unique combinations")
    
    # Count total entries
    total_entries = sum(len(c['entries']) for c in combinations_map.values())
    print(f"Total entries across all combinations: {total_entries}")
    
    # Show some stats about multi-entry combos
    multi_entry = [k for k, v in combinations_map.items() if len(v['entries']) > 1]
    print(f"Combinations with multiple entries: {len(multi_entry)}")
    
    # Phase 2: Download images
    print("\nPhase 2: Downloading images...")
    print("-" * 70)
    
    # Dedupe images by filename (hash ensures uniqueness)
    unique_images = {img['filename']: img for img in images_to_download}
    print(f"Total unique images: {len(unique_images)}")
    
    # Check existing
    existing = {f.name for f in AMACO_COMBO_IMAGES_DIR.glob('*.*')}
    new_images = [img for img in unique_images.values() if img['filename'] not in existing]
    print(f"Already have: {len(existing)}")
    print(f"Need to download: {len(new_images)}")
    
    downloaded = 0
    failed = 0
    
    for i, img in enumerate(new_images):
        if (i + 1) % 100 == 0:
            print(f"  Downloaded {i + 1}/{len(new_images)}...")
        
        filepath = AMACO_COMBO_IMAGES_DIR / img['filename']
        if download_image(img['url'], filepath):
            downloaded += 1
        else:
            failed += 1
        
        time.sleep(0.05)
    
    print(f"\nDownloaded: {downloaded}, Failed: {failed}")
    
    # Phase 3: Build final data structure
    print("\nPhase 3: Building final data structure...")
    print("-" * 70)
    
    # Convert to list format
    combinations = []
    for combo_key, combo_data in sorted(combinations_map.items()):
        top_code = combo_data['topGlazeCode']
        bottom_code = combo_data['bottomGlazeCode']
        
        combination = {
            'id': f"amaco-{top_code.lower()}-over-{bottom_code.lower()}",
            'topGlaze': {
                'glazeId': f"amaco-{top_code.lower()}",
                'code': top_code,
                'displayName': combo_data['topGlazeDisplayName']
            },
            'bottomGlaze': {
                'glazeId': f"amaco-{bottom_code.lower()}",
                'code': bottom_code,
                'displayName': combo_data['bottomGlazeDisplayName']
            },
            'entries': combo_data['entries']
        }
        combinations.append(combination)
    
    # Save full parsed data (includes originalUrl for debugging)
    full_output = {
        'version': '3.0',
        'dataStructure': 'multi-entry',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'amaco.com/resources/layering',
        'totalCombinations': len(combinations),
        'totalEntries': total_entries,
        'combinations': combinations
    }
    
    parsed_file = RESULTS_DIR / 'combinations-parsed.json'
    with open(parsed_file, 'w', encoding='utf-8') as f:
        json.dump(full_output, f, indent=2)
    print(f"Saved full data to: {parsed_file}")
    
    # Save app-ready data (strip originalUrl from photos)
    app_combinations = []
    for combo in combinations:
        app_combo = {
            'id': combo['id'],
            'topGlaze': combo['topGlaze'],
            'bottomGlaze': combo['bottomGlaze'],
            'entries': []
        }
        
        for entry in combo['entries']:
            app_entry = {
                'id': entry['id'],
                'submittedBy': entry['submittedBy'],
                'isOfficial': entry['isOfficial'],
                'topCoats': entry['topCoats'],
                'bottomCoats': entry['bottomCoats'],
                'clayBody': entry['clayBody'],
                'cone': entry['cone'],
                'photos': [
                    {k: v for k, v in p.items() if k != 'originalUrl'}
                    for p in entry['photos']
                ]
            }
            app_combo['entries'].append(app_entry)
        
        app_combinations.append(app_combo)
    
    app_output = {
        'version': '3.0',
        'dataStructure': 'multi-entry',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'amaco',
        'totalCombinations': len(app_combinations),
        'totalEntries': total_entries,
        'combinations': app_combinations
    }
    
    app_file = APP_DATA_DIR / 'combinations.json'
    with open(app_file, 'w', encoding='utf-8') as f:
        json.dump(app_output, f, indent=2)
    print(f"Saved app data to: {app_file}")
    
    # Print summary
    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)
    print(f"  Unique combinations: {len(combinations)}")
    print(f"  Total entries:       {total_entries}")
    print(f"  Multi-entry combos:  {len(multi_entry)}")
    print(f"  Images downloaded:   {downloaded}")
    print(f"\nData Structure per Combination:")
    print(f"  - id: unique combo identifier")
    print(f"  - topGlaze/bottomGlaze: glaze info")
    print(f"  - entries[]: array of firing results, each with:")
    print(f"      - submittedBy, isOfficial")
    print(f"      - topCoats, bottomCoats")
    print(f"      - clayBody, cone")
    print(f"      - photos[]")


if __name__ == '__main__':
    main()
