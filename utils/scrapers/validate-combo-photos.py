#!/usr/bin/env python3
"""
Validate that all combination photos referenced in combinations.json actually exist
and aren't 404 error pages (by checking file size > threshold)

Updated for v3.0 multi-entry data structure
"""

import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

from config import COMBINATIONS_JSON, AMACO_COMBO_IMAGES_DIR

def validate_photos():
    # Load combinations data
    combinations_path = COMBINATIONS_JSON
    images_dir = AMACO_COMBO_IMAGES_DIR
    
    if not combinations_path.exists():
        print(f"ERROR: {combinations_path} not found!")
        return
    
    with open(combinations_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total_combos = data['totalCombinations']
    total_entries = data['totalEntries']
    combinations = data['combinations']
    
    print(f"Data version: {data.get('version', 'unknown')}")
    print(f"Total combinations: {total_combos}")
    print(f"Total entries: {total_entries}")
    print(f"Actual combinations list length: {len(combinations)}")
    
    # Track issues
    missing_photos = []
    small_photos = []  # potentially 404s
    valid_photos = []
    
    MIN_VALID_SIZE = 10000  # 10KB - anything smaller is suspicious
    
    for combo in combinations:
        combo_id = combo['id']
        display_name = f"{combo['topGlaze']['displayName']} over {combo['bottomGlaze']['displayName']}"
        
        # New structure: entries[] -> photos[]
        for entry in combo.get('entries', []):
            entry_id = entry.get('id', 'unknown')
            
            for photo in entry.get('photos', []):
                photo_url = photo['url']
                # Convert URL to file path
                photo_filename = photo_url.split('/')[-1]
                photo_path = images_dir / photo_filename
                
                if not photo_path.exists():
                    missing_photos.append({
                        'combo_id': combo_id,
                        'entry_id': entry_id,
                        'display_name': display_name,
                        'photo_url': photo_url,
                        'expected_path': str(photo_path)
                    })
                else:
                    size = photo_path.stat().st_size
                    if size < MIN_VALID_SIZE:
                        small_photos.append({
                            'combo_id': combo_id,
                            'entry_id': entry_id,
                            'display_name': display_name,
                            'photo_url': photo_url,
                            'size': size
                        })
                    else:
                        valid_photos.append(photo_url)
    
    print(f"\n=== VALIDATION RESULTS ===")
    print(f"Valid photos: {len(valid_photos)}")
    print(f"Missing photos: {len(missing_photos)}")
    print(f"Suspiciously small photos (<10KB): {len(small_photos)}")
    
    if missing_photos:
        print(f"\n=== MISSING PHOTOS ({len(missing_photos)}) ===")
        for p in missing_photos[:20]:  # Show first 20
            print(f"  - {p['display_name']}: {p['photo_url']}")
        if len(missing_photos) > 20:
            print(f"  ... and {len(missing_photos) - 20} more")
    
    if small_photos:
        print(f"\n=== SMALL PHOTOS ({len(small_photos)}) ===")
        for p in small_photos[:20]:
            print(f"  - {p['display_name']}: {p['photo_url']} ({p['size']} bytes)")
        if len(small_photos) > 20:
            print(f"  ... and {len(small_photos) - 20} more")
    
    # Also check for orphaned files in images dir
    image_files = set(f.name for f in images_dir.iterdir() if f.is_file())
    referenced_files = set(
        p['url'].split('/')[-1] 
        for c in combinations 
        for e in c.get('entries', []) 
        for p in e.get('photos', [])
    )
    
    orphaned = image_files - referenced_files
    if orphaned:
        print(f"\n=== ORPHANED IMAGES (not referenced in JSON): {len(orphaned)} ===")
        for f in sorted(orphaned)[:20]:
            print(f"  - {f}")
        if len(orphaned) > 20:
            print(f"  ... and {len(orphaned) - 20} more")
    
    return {
        'valid': len(valid_photos),
        'missing': missing_photos,
        'small': small_photos,
        'orphaned': list(orphaned)
    }

if __name__ == '__main__':
    validate_photos()
