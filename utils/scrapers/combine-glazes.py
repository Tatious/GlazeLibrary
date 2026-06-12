#!/usr/bin/env python3
"""
Combine AMACO and Mayco glazes into a single file
"""

import json
import os
import re
import html
from datetime import datetime
from pathlib import Path

# Anchor all paths to the repo root so the script works regardless of CWD.
# Layout: <repo>/utils/scrapers/combine-glazes.py -> repo root is two parents up.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
IMAGES_DIR = str(REPO_ROOT / 'app/glaze-viewer/public/images')


def clean_description(desc):
    """Clean up description text - decode HTML entities and remove junk"""
    if not desc:
        return desc
    
    # Decode HTML entities
    desc = html.unescape(desc)
    
    # Remove image caption prefixes like "Cone 06 oxidation (large photo):" or "Cone 6 oxidation (small photo):"
    desc = re.sub(r'Cone \d+(-\d+)? oxidation \([^)]+\):\s*', '', desc, flags=re.IGNORECASE)
    
    # Remove WARNING: and everything after it
    desc = re.sub(r'\s*WARNING:.*$', '', desc, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove Prop 65 warnings
    desc = re.sub(r'This product can expose you to chemicals.*?P65Warnings\.ca\.gov\.?', '', desc, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove dipping glaze warnings
    desc = re.sub(r'Due to the powdered nature.*?brushing glazes\.?\s*', '', desc, flags=re.IGNORECASE | re.DOTALL)
    desc = re.sub(r'\*?Note that all dry dipping glazes.*?full piece\.?\s*', '', desc, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove &nbsp; and multiple newlines
    desc = re.sub(r'&nbsp;', ' ', desc)
    desc = re.sub(r'\n\s*\n', '\n', desc)
    
    # Remove weight info like "10# DIPPING"
    desc = re.sub(r'\d+#\s*DIPPING\s*', '', desc, flags=re.IGNORECASE)
    
    # Remove duplicate content (often the description is repeated)
    # Split into sentences and dedupe
    sentences = re.split(r'(?<=[.!?])\s+', desc.strip())
    seen = set()
    unique_sentences = []
    for s in sentences:
        s_normalized = s.lower().strip()
        if s_normalized and s_normalized not in seen:
            seen.add(s_normalized)
            unique_sentences.append(s)
    desc = ' '.join(unique_sentences)
    
    # Remove any trailing whitespace/newlines
    desc = desc.strip()
    
    return desc


def find_additional_images(glaze):
    """Find additional images on disk that match the glaze code pattern.
    Only adds new images that aren't already in the glaze's images list."""
    brand = glaze.get('brand', '').lower()
    code = glaze.get('code', '').lower()
    
    if not brand or not code:
        return glaze
    
    # Determine image directory
    if brand == 'amaco':
        img_dir = os.path.join(IMAGES_DIR, 'glazes', 'amaco')
    elif brand == 'mayco':
        img_dir = os.path.join(IMAGES_DIR, 'glazes', 'mayco')
    else:
        return glaze
    
    if not os.path.exists(img_dir):
        return glaze
    
    # Get existing image paths
    existing_paths = {img.get('localPath') for img in glaze.get('images', [])}
    
    # Look for images matching the code pattern (e.g., cg-1000.jpg, cg-1000-2.jpg, cg-1000-3.jpg).
    # Tolerate two scraper-naming variants: optional dash and optional leading zeros on the numeric
    # portion (e.g. code "HF-01" should also match "hf-1.jpg" left over from older scraper runs).
    m = re.match(r'^([a-z]+)-(\d+)$', code)
    if m:
        prefix = re.escape(m.group(1))
        num = m.group(2).lstrip('0') or '0'
        code_pattern = rf'{prefix}-?0*{re.escape(num)}'
    else:
        code_pattern = re.escape(code).replace(r'\-', r'-?')
    pattern = re.compile(rf'^{code_pattern}(-(\d+))?\.jpg$', re.IGNORECASE)
    
    new_images = []
    for filename in os.listdir(img_dir):
        match = pattern.match(filename)
        if match:
            local_path = f'/images/glazes/{brand}/{filename}'
            # Only add if not already in the list
            if local_path not in existing_paths:
                suffix_num = int(match.group(2)) if match.group(2) else 0
                new_images.append({
                    'localPath': local_path,
                    'type': 'product',
                    '_sort': suffix_num
                })
    
    # Sort new images by suffix number
    new_images.sort(key=lambda x: x['_sort'])
    for img in new_images:
        del img['_sort']
    
    # Append new images to existing ones (don't replace)
    if new_images:
        if 'images' not in glaze:
            glaze['images'] = []
        glaze['images'].extend(new_images)
    
    return glaze


def validate_images(glaze):
    """Filter out image references that don't exist on disk"""
    if 'images' not in glaze:
        return glaze
    
    valid_images = []
    for img in glaze['images']:
        local_path = img.get('localPath', '')
        if local_path.startswith('/images/'):
            # Convert /images/glazes/amaco/foo.jpg to ../app/.../images/glazes/amaco/foo.jpg
            file_path = IMAGES_DIR + local_path[7:]  # Remove '/images' prefix
            if os.path.exists(file_path):
                valid_images.append(img)
            # Silently skip missing images
    
    glaze['images'] = valid_images
    return glaze


def load_cleaned_descriptions():
    """Load cleaned descriptions from AI enrichment - both results file and cache"""
    descriptions = {}
    
    # Load from results file (AMACO/Mayco)
    cleaned_file = 'ai-enrichment/results/cleaned-glazes.json'
    if os.path.exists(cleaned_file):
        with open(cleaned_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for g in data.get('glazes', []):
            if g.get('description'):
                descriptions[g['id']] = g['description']
    
    # Also load from cache directory (includes SPS and any others)
    cache_dir = 'ai-enrichment/cache/cleaned_descriptions'
    if os.path.exists(cache_dir):
        for cache_file in os.listdir(cache_dir):
            if cache_file.endswith('.json'):
                cache_path = os.path.join(cache_dir, cache_file)
                try:
                    with open(cache_path, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    # Handle both old format (id/cleaned) and new format (glazeId/cleanedDescription)
                    glaze_id = cache_data.get('glazeId') or cache_data.get('id')
                    cleaned = cache_data.get('cleanedDescription') or cache_data.get('cleaned', '')
                    if glaze_id and cleaned:
                        descriptions[glaze_id] = cleaned
                except Exception:
                    pass
    
    return descriptions


def combine_glaze_files():
    """Combine all glaze files into one"""
    print("\nCombining glaze files...")
    print("=" * 60)
    
    # Load cleaned descriptions first
    cleaned_descriptions = load_cleaned_descriptions()
    if cleaned_descriptions:
        print(f"  Loaded {len(cleaned_descriptions)} cleaned descriptions")
    
    all_glazes = []
    
    # Load AMACO glazes
    amaco_file = 'amaco-glaze-fetcher/results/glazes.json'
    if os.path.exists(amaco_file):
        with open(amaco_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            amaco_glazes = data.get('glazes', [])
            all_glazes.extend(amaco_glazes)
            print(f"  Loaded {len(amaco_glazes)} AMACO glazes")
    
    # Load Mayco glazes
    mayco_file = 'mayco-glaze-fetcher/results/mayco-glazes.json'
    if os.path.exists(mayco_file):
        with open(mayco_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            mayco_glazes = data.get('glazes', [])
            all_glazes.extend(mayco_glazes)
            print(f"  Loaded {len(mayco_glazes)} Mayco glazes")
    
    # Load Seattle Pottery Supply glazes
    sps_file = 'sps-glaze-fetcher/results/sps-glazes.json'
    if os.path.exists(sps_file):
        with open(sps_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            sps_glazes = data.get('glazes', [])
            # Add brand, update series, and normalize format
            for g in sps_glazes:
                g['brand'] = 'Seattle Pottery Supply'
                g['id'] = f"sps-{g['code'].lower()}"
                g['series'] = 'SPS Midrange'  # Rename series for clarity
                # Map 'url' to 'productUrl' for consistency
                if 'url' in g and 'productUrl' not in g:
                    g['productUrl'] = g['url']
            all_glazes.extend(sps_glazes)
            print(f"  Loaded {len(sps_glazes)} Seattle Pottery Supply glazes")
    
    # Filter out discontinued glazes
    discontinued_count = len([g for g in all_glazes if g.get('discontinued') or 'discontinued' in g.get('name', '').lower() or 'discontinued' in g.get('displayName', '').lower()])
    if discontinued_count > 0:
        all_glazes = [g for g in all_glazes if not g.get('discontinued') and 'discontinued' not in g.get('name', '').lower() and 'discontinued' not in g.get('displayName', '').lower()]
        print(f"  Filtered out {discontinued_count} discontinued glazes")
    
    # Apply cleaned descriptions
    if cleaned_descriptions:
        print("\n  Applying cleaned descriptions...")
        applied = 0
        for glaze in all_glazes:
            glaze_id = glaze.get('id', '')
            if glaze_id in cleaned_descriptions:
                glaze['description'] = clean_description(cleaned_descriptions[glaze_id])
                applied += 1
        print(f"  Applied {applied} cleaned descriptions")
    
    # Also clean any descriptions that weren't in the cleaned set
    print("  Cleaning remaining descriptions...")
    for glaze in all_glazes:
        if 'description' in glaze:
            glaze['description'] = clean_description(glaze['description'])
    
    # Validate images exist on disk
    print("\n  Validating image references...")
    total_images_before = sum(len(g.get('images', [])) for g in all_glazes)
    all_glazes = [validate_images(g) for g in all_glazes]
    total_images_after = sum(len(g.get('images', [])) for g in all_glazes)
    removed = total_images_before - total_images_after
    if removed > 0:
        print(f"  Removed {removed} missing image references")
    else:
        print(f"  All {total_images_after} image references valid")
    
    # Find additional images on disk for each glaze
    print("\n  Scanning for additional images on disk...")
    total_images_before = sum(len(g.get('images', [])) for g in all_glazes)
    all_glazes = [find_additional_images(g) for g in all_glazes]
    total_images_after = sum(len(g.get('images', [])) for g in all_glazes)
    added = total_images_after - total_images_before
    if added > 0:
        print(f"  Found {added} additional images")
    print(f"  Total images: {total_images_after}")
    
    # Create combined output
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'combined',
        'totalCount': len(all_glazes),
        'glazes': all_glazes
    }
    
    # Save to app's public data folder
    output_file = str(REPO_ROOT / 'app/glaze-viewer/public/data/glazes.json')
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Combined {len(all_glazes)} total glazes")
    print(f"✓ Saved to: {output_file}")
    
    # Show breakdown by brand
    brands = {}
    for glaze in all_glazes:
        brand = glaze.get('brand', 'Unknown')
        brands[brand] = brands.get(brand, 0) + 1
    
    print("\nBy brand:")
    for brand, count in sorted(brands.items()):
        print(f"  {brand}: {count}")


if __name__ == '__main__':
    combine_glaze_files()
