#!/usr/bin/env python3
"""
Step 2: Parse Mayco combination HTML pages and extract data

Mayco structure (from the grid):
- Each combination tile shows:
  - Combo image URL (main result photo): /wp-content/uploads/2025/11/sw402_over_sw122_cone10.jpg
  - Cone temperature (e.g., "Cone 06", "Cone 6", "Cone 10")
  - Top glaze code and name: "SW-402 Dark Flux Over"
  - Bottom glaze code and name: "SW-122 Maycoshino"

Output: results/combinations-parsed.json
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

HTML_CACHE_DIR = SCRIPT_DIR / "html_cache"
RESULTS_DIR = SCRIPT_DIR / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def normalize_glaze_code(code):
    """Normalize glaze code: CG-1001 -> CG-1001, SW-402 -> SW-402"""
    if not code:
        return None
    code = code.strip().upper()
    # Handle codes like "CG1001" -> "CG-1001", "SW402" -> "SW-402"
    match = re.match(r'^([A-Z]+)[-\s]?(\d+)$', code)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return code


def extract_glaze_info(text):
    """Extract glaze code and name from text like 'SW-402 Dark Flux'"""
    if not text:
        return None, None
    
    text = text.strip()
    # Pattern: CODE Name (e.g., "SW-402 Dark Flux" or "CG-1015 Cloverfield")
    match = re.match(r'^([A-Z]+-?\d+)\s+(.+)$', text, re.IGNORECASE)
    if match:
        code = normalize_glaze_code(match.group(1))
        name = match.group(2).strip()
        return code, name
    
    return None, text


def parse_combination_from_image_url(url):
    """
    Parse combination info from image URL.
    Example: /wp-content/uploads/2025/11/sw402_over_sw122_cone10.jpg
    Returns: {'topCode': 'SW-402', 'bottomCode': 'SW-122', 'cone': '10'}
    """
    if not url or '_over_' not in url.lower():
        return None
    
    filename = url.split('/')[-1].split('.')[0]  # sw402_over_sw122_cone10
    
    # Pattern: {topcode}_over_{bottomcode}_{cone}
    match = re.match(r'([a-z]+)[-_]?(\d+)_over_([a-z]+)[-_]?(\d+)(?:_cone(\d+))?', filename, re.IGNORECASE)
    if match:
        top_prefix = match.group(1).upper()
        top_num = match.group(2)
        bottom_prefix = match.group(3).upper()
        bottom_num = match.group(4)
        cone = match.group(5) if match.group(5) else None
        
        return {
            'topCode': f"{top_prefix}-{top_num}",
            'bottomCode': f"{bottom_prefix}-{bottom_num}",
            'cone': cone
        }
    
    return None


def parse_page(filepath):
    """Parse a single HTML page and extract all combinations"""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    combinations = []
    seen_combos = set()
    
    # Find combo images by URL pattern - these have "_over_" in the filename
    # The data-caption attribute has full names: "SW-402 Dark Flux over SW-122 Maycoshino"
    combo_images = soup.select('a[href*="_over_"]')
    
    for img_link in combo_images:
        url = img_link.get('href', '')
        caption = img_link.get('data-caption', '')
        
        # Parse codes and cone from URL
        parsed = parse_combination_from_image_url(url)
        if not parsed:
            continue
        
        # Create unique key to avoid duplicates
        combo_key = f"{parsed['topCode']}-{parsed['bottomCode']}-{parsed['cone']}"
        if combo_key in seen_combos:
            continue
        seen_combos.add(combo_key)
        
        # Extract full names from data-caption attribute
        # Format: "SW-402 Dark Flux over SW-122 Maycoshino" or with "on EG-006..." suffix
        top_name = None
        bottom_name = None
        cone = parsed['cone']
        
        if caption:
            # Pattern: "CODE Name over CODE Name" (optionally followed by "on CODE Name")
            caption_match = re.match(
                r'([A-Z]+-?\d+)\s+(.+?)\s+over\s+([A-Z]+-?\d+)\s+(.+?)(?:\s+on\s+|$)',
                caption, re.IGNORECASE
            )
            if caption_match:
                top_name = caption_match.group(2).strip()
                bottom_name = caption_match.group(4).strip()
        
        # Fallback: try surrounding text if caption didn't work
        if not top_name or not bottom_name:
            container = img_link.find_parent(['div', 'article', 'li', 'figure'])
            if container:
                text = container.get_text(separator='|')
                
                # Extract cone if not in URL
                if not cone:
                    cone_match = re.search(r'Cone\s*(\d+)', text, re.IGNORECASE)
                    if cone_match:
                        cone = cone_match.group(1)
        
        combinations.append({
            'topCode': parsed['topCode'],
            'topName': top_name,
            'bottomCode': parsed['bottomCode'],
            'bottomName': bottom_name,
            'cone': cone,
            'comboImageUrl': url if url.startswith('http') else f"https://www.maycocolors.com{url}"
        })
    
    return combinations


def create_combination_id(top_code, bottom_code):
    """Create a unique ID for a combination"""
    top = top_code.lower().replace(' ', '-')
    bottom = bottom_code.lower().replace(' ', '-')
    return f"mayco-{top}-over-{bottom}"


def main():
    print("\n" + "=" * 60)
    print("Mayco Combination Parser")
    print("=" * 60)
    
    html_files = sorted(HTML_CACHE_DIR.glob('page-*.html'), 
                        key=lambda f: int(f.stem.replace('page-', '')))
    
    print(f"Found {len(html_files)} cached pages")
    
    if not html_files:
        print("No HTML files to parse. Run step1-fetch-pages.py first.")
        return
    
    all_combinations = {}
    
    for filepath in html_files:
        page_num = filepath.stem.replace('page-', '')
        combos = parse_page(filepath)
        print(f"  Page {page_num}: found {len(combos)} combinations")
        
        for combo in combos:
            combo_id = create_combination_id(combo['topCode'], combo['bottomCode'])
            cone = combo.get('cone', 'unknown')
            
            # Create or update combination entry
            if combo_id not in all_combinations:
                all_combinations[combo_id] = {
                    'id': combo_id,
                    'topGlaze': {
                        'glazeId': f"mayco-{combo['topCode'].lower()}",
                        'code': combo['topCode'],
                        'displayName': f"{combo['topCode']} {combo['topName']}" if combo['topName'] else combo['topCode']
                    },
                    'bottomGlaze': {
                        'glazeId': f"mayco-{combo['bottomCode'].lower()}",
                        'code': combo['bottomCode'],
                        'displayName': f"{combo['bottomCode']} {combo['bottomName']}" if combo['bottomName'] else combo['bottomCode']
                    },
                    'entries': []
                }
            
            # Add this entry (different cones = different entries)
            entry_id = f"{combo_id}-cone{cone}"
            
            # Check if entry already exists
            existing = [e for e in all_combinations[combo_id]['entries'] if e['id'] == entry_id]
            if not existing:
                all_combinations[combo_id]['entries'].append({
                    'id': entry_id,
                    'submittedBy': 'Mayco',
                    'isOfficial': True,
                    'topCoats': 2,  # Mayco standard is 2 coats
                    'bottomCoats': 2,
                    'clayBody': get_clay_body(cone),
                    'cone': cone,
                    'firingType': get_firing_type(cone),
                    'photos': [{
                        'id': f"{entry_id}-photo-1",
                        'url': combo['comboImageUrl'],
                        'isCover': True
                    }] if combo['comboImageUrl'] else []
                })
    
    # Convert to list
    combinations_list = list(all_combinations.values())
    
    # Calculate totals
    total_entries = sum(len(c['entries']) for c in combinations_list)
    
    print(f"\nParsed {len(combinations_list)} unique combinations")
    print(f"Total entries (across all cones): {total_entries}")
    
    # Save results
    output = {
        'version': '1.0',
        'dataStructure': 'multi-entry',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'mayco',
        'totalCombinations': len(combinations_list),
        'totalEntries': total_entries,
        'combinations': combinations_list
    }
    
    output_path = RESULTS_DIR / 'combinations-parsed.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to {output_path}")


def get_clay_body(cone):
    """Get clay body based on cone temperature"""
    if cone == '06':
        return 'White Earthenware'
    elif cone == '6':
        return 'White Stoneware'
    elif cone == '10':
        return 'White Stoneware'
    return None


def get_firing_type(cone):
    """Get firing type based on cone temperature"""
    if cone == '10':
        return 'reduction'
    return 'oxidation'


if __name__ == '__main__':
    main()
