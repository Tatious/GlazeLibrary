#!/usr/bin/env python3
"""
Combine combinations from all sources (AMACO, Mayco) into a single file.

Reads from:
- amaco-combo-fetcher/results/combinations-parsed.json
- mayco-combo-fetcher/results/combinations.json
- app/glaze-viewer/public/data/glazes.json (for name lookups)

Outputs to:
- app/glaze-viewer/public/data/combinations.json
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

from config import COMBINATIONS_JSON, GLAZES_JSON, ensure_directories

# Input files
AMACO_COMBOS = SCRIPT_DIR / 'amaco-combo-fetcher' / 'results' / 'combinations-parsed.json'
MAYCO_COMBOS = SCRIPT_DIR / 'mayco-combo-fetcher' / 'results' / 'combinations-parsed.json'


def normalize_code(code):
    """
    Normalize glaze codes to have leading zeros for single-digit numbers.
    C-1 -> C-01, PC-5 -> PC-05, but C-10 stays C-10
    """
    # Match pattern like C-1, PC-5, etc. (letter(s) + dash + single digit)
    match = re.match(r'^([A-Za-z]+)-(\d)$', code)
    if match:
        prefix, num = match.groups()
        return f"{prefix}-0{num}"
    return code


def normalize_glaze_id(glaze_id):
    """
    Normalize a glaze ID to match the glazes.json format.
    amaco-c-1 -> amaco-c-01
    """
    # Split on the brand prefix
    parts = glaze_id.split('-', 1)
    if len(parts) == 2:
        brand = parts[0]
        code = parts[1]
        normalized_code = normalize_code(code.upper()).lower()
        return f"{brand}-{normalized_code}"
    return glaze_id


def normalize_display_name(display_name):
    """
    Normalize display names to have leading zeros for single-digit codes.
    "C-1 Obsidian" -> "C-01 Obsidian"
    "PC-5 Something" -> "PC-05 Something"
    """
    if not display_name:
        return display_name
    # Match pattern like "C-1 Name" or "PC-5 Name"
    match = re.match(r'^([A-Za-z]+)-(\d)(\s+.*)$', display_name)
    if match:
        prefix, num, rest = match.groups()
        return f"{prefix}-0{num}{rest}"
    # Also handle case with no name after (just code)
    match = re.match(r'^([A-Za-z]+)-(\d)$', display_name)
    if match:
        prefix, num = match.groups()
        return f"{prefix}-0{num}"
    return display_name


def normalize_combination_ids(combinations):
    """Normalize all glaze IDs in combinations to match glazes.json format"""
    for combo in combinations:
        # Normalize top glaze
        top_glaze = combo.get('topGlaze', {})
        if 'glazeId' in top_glaze:
            top_glaze['glazeId'] = normalize_glaze_id(top_glaze['glazeId'])
        if 'code' in top_glaze:
            top_glaze['code'] = normalize_code(top_glaze['code'])
        if 'displayName' in top_glaze:
            top_glaze['displayName'] = normalize_display_name(top_glaze['displayName'])
        
        # Normalize bottom glaze
        bottom_glaze = combo.get('bottomGlaze', {})
        if 'glazeId' in bottom_glaze:
            bottom_glaze['glazeId'] = normalize_glaze_id(bottom_glaze['glazeId'])
        if 'code' in bottom_glaze:
            bottom_glaze['code'] = normalize_code(bottom_glaze['code'])
        if 'displayName' in bottom_glaze:
            bottom_glaze['displayName'] = normalize_display_name(bottom_glaze['displayName'])
        
        # Normalize combination ID (e.g., amaco-c-1-over-c-47 -> amaco-c-01-over-c-47)
        if 'id' in combo:
            combo_id = combo['id']
            # Parse: brand-code1-over-code2
            match = re.match(r'^(\w+)-(.+)-over-(.+)$', combo_id)
            if match:
                brand, top_code, bottom_code = match.groups()
                normalized_top = normalize_code(top_code.upper()).lower()
                normalized_bottom = normalize_code(bottom_code.upper()).lower()
                combo['id'] = f"{brand}-{normalized_top}-over-{normalized_bottom}"
    
    return combinations


def load_glazes_lookup():
    """Load glazes and create a lookup by ID"""
    if not GLAZES_JSON.exists():
        print("  ⚠ Glazes file not found, names won't be enriched")
        return {}
    
    with open(GLAZES_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    glazes = data.get('glazes', [])
    lookup = {g['id']: g for g in glazes}
    print(f"  ✓ Loaded {len(lookup)} glazes for name lookup")
    return lookup


def load_combinations(filepath, source_name):
    """Load combinations from a JSON file"""
    if not filepath.exists():
        print(f"  ⚠ {source_name}: File not found: {filepath}")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    combos = data.get('combinations', [])
    print(f"  ✓ {source_name}: {len(combos)} combinations")
    return combos


def enrich_glaze_names(combinations, glaze_lookup):
    """Add full glaze names from the glazes lookup only if not already present"""
    enriched = 0
    for combo in combinations:
        # Enrich top glaze - only if displayName is just the code
        top_glaze = combo.get('topGlaze', {})
        top_id = top_glaze.get('glazeId')
        top_code = top_glaze.get('code', '')
        top_display = top_glaze.get('displayName', '')
        
        # Only enrich if displayName is missing or equals just the code
        if top_id and top_id in glaze_lookup and (not top_display or top_display == top_code):
            glaze = glaze_lookup[top_id]
            combo['topGlaze']['displayName'] = glaze.get('displayName', top_code)
            enriched += 1
        
        # Enrich bottom glaze - only if displayName is just the code
        bottom_glaze = combo.get('bottomGlaze', {})
        bottom_id = bottom_glaze.get('glazeId')
        bottom_code = bottom_glaze.get('code', '')
        bottom_display = bottom_glaze.get('displayName', '')
        
        if bottom_id and bottom_id in glaze_lookup and (not bottom_display or bottom_display == bottom_code):
            glaze = glaze_lookup[bottom_id]
            combo['bottomGlaze']['displayName'] = glaze.get('displayName', bottom_code)
            enriched += 1
    
    return combinations, enriched


def fix_image_paths(combinations, source):
    """Ensure image paths use the correct format for the app"""
    from config import AMACO_COMBO_IMAGES_DIR, MAYCO_COMBO_IMAGES_DIR
    
    # Determine the image directory for this source
    if source == "amaco":
        image_dir = AMACO_COMBO_IMAGES_DIR
    else:
        image_dir = MAYCO_COMBO_IMAGES_DIR
    
    for combo in combinations:
        combo_id = combo.get('id', '')
        for entry in combo.get('entries', []):
            entry_id = entry.get('id', '')
            for photo in entry.get('photos', []):
                url = photo.get('url', '')
                local_path = photo.get('localPath', '')
                
                # Skip if already a local path
                if url.startswith('/images/'):
                    continue
                
                # Fix AMACO paths: /photos/combinations/xxx -> /images/combinations/amaco/xxx
                if url.startswith('/photos/combinations/'):
                    filename = url.replace('/photos/combinations/', '')
                    photo['url'] = f"/images/combinations/{source}/{filename}"
                # Fix paths from localPath field
                elif local_path and not url.startswith('/images/'):
                    if local_path.startswith('images/'):
                        filename = local_path.replace('images/', '')
                        photo['url'] = f"/images/combinations/{source}/{filename}"
                    else:
                        photo['url'] = f"/images/combinations/{source}/{local_path}"
                # Handle external URLs (e.g., https://www.maycocolors.com/...)
                elif url.startswith('http'):
                    # Try to find local file by entry ID pattern
                    # Files are named like: mayco-sw-402-over-sw-122-mayco-sw-402-over-sw-122-cone10.jpg
                    local_file = _find_local_image(image_dir, combo_id, entry_id)
                    if local_file:
                        photo['url'] = f"/images/combinations/{source}/{local_file.name}"
    
    return combinations


def _find_local_image(image_dir, combo_id, entry_id):
    """Find a local image file matching the combo/entry ID pattern"""
    if not image_dir.exists():
        return None
    
    # Try matching by entry ID first (most specific)
    # Pattern: {combo_id}-{entry_id}.jpg or {entry_id}.jpg
    for pattern in [f"{combo_id}-{entry_id}*", f"{entry_id}*", f"{combo_id}*"]:
        matches = list(image_dir.glob(pattern))
        if matches:
            # Prefer .jpg files
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                for m in matches:
                    if m.suffix.lower() == ext:
                        return m
            return matches[0]
    
    return None


def main():
    print("\n" + "=" * 60)
    print("Combine Combinations from All Sources")
    print("=" * 60)
    
    ensure_directories()
    
    # Load glazes for name lookup
    print("\nLoading glazes lookup:")
    glaze_lookup = load_glazes_lookup()
    
    print("\nLoading combinations:")
    
    all_combinations = []
    
    # Load AMACO combinations
    amaco_combos = load_combinations(AMACO_COMBOS, "AMACO")
    amaco_combos = normalize_combination_ids(amaco_combos)
    amaco_combos = fix_image_paths(amaco_combos, "amaco")
    all_combinations.extend(amaco_combos)
    
    # Load Mayco combinations
    mayco_combos = load_combinations(MAYCO_COMBOS, "Mayco")
    mayco_combos = normalize_combination_ids(mayco_combos)
    mayco_combos = fix_image_paths(mayco_combos, "mayco")
    
    # Enrich Mayco combinations with full glaze names
    if glaze_lookup:
        mayco_combos, enriched = enrich_glaze_names(mayco_combos, glaze_lookup)
        print(f"  ✓ Enriched {enriched} glaze names in Mayco combinations")
    
    all_combinations.extend(mayco_combos)
    
    # Calculate totals
    total_entries = sum(len(c.get('entries', [])) for c in all_combinations)
    
    print(f"\nTotal: {len(all_combinations)} combinations, {total_entries} entries")
    
    # Build output
    output = {
        'version': '3.0',
        'dataStructure': 'multi-entry',
        'lastUpdated': datetime.now().isoformat(),
        'sources': ['amaco', 'mayco'],
        'totalCombinations': len(all_combinations),
        'totalEntries': total_entries,
        'combinations': all_combinations
    }
    
    # Write output
    with open(COMBINATIONS_JSON, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to {COMBINATIONS_JSON}")
    
    # Summary by source
    print("\nBreakdown by source:")
    print(f"  AMACO: {len(amaco_combos)} combinations")
    print(f"  Mayco: {len(mayco_combos)} combinations")


if __name__ == '__main__':
    main()
