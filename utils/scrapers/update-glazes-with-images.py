#!/usr/bin/env python3
"""
Update glazes with brand tags and download images
"""

import json
import os
import sys
from pathlib import Path

# Add parent directory to path for image download utility
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from download_images import download_glaze_images


def add_brand_tags(glazes, brand):
    """Add brand to tags for each glaze"""
    brand_lower = brand.lower()
    for glaze in glazes:
        tags = glaze.get('tags', [])
        if brand_lower not in tags:
            tags.insert(0, brand_lower)
        glaze['tags'] = tags
    return glazes


def update_glaze_file(file_path, brand, image_dir):
    """Update a glaze JSON file with brand tags and local images"""
    print(f"\nUpdating {file_path}...")
    
    # Load data
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    glazes = data.get('glazes', [])
    print(f"  Found {len(glazes)} glazes")
    
    # Add brand tags
    print("  Adding brand tags...")
    glazes = add_brand_tags(glazes, brand)
    
    # Download images
    print("  Downloading images...")
    glazes = download_glaze_images(glazes, brand, image_dir)
    
    # Update data
    data['glazes'] = glazes
    data['lastUpdated'] = data.get('lastUpdated', '')
    
    # Save back
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"  ✓ Updated {file_path}")


def main():
    print("\nGlaze Data Updater")
    print("=" * 60)
    print("Adding brand tags and downloading images\n")
    
    # Update AMACO glazes
    amaco_file = 'amaco-glaze-fetcher/results/glazes.json'
    amaco_image_dir = '../app/glaze-viewer/public/images/glazes/amaco'
    if os.path.exists(amaco_file):
        update_glaze_file(amaco_file, 'AMACO', amaco_image_dir)
    
    # Update Mayco glazes
    mayco_file = 'mayco-glaze-fetcher/results/mayco-glazes.json'
    mayco_image_dir = '../app/glaze-viewer/public/images/glazes/mayco'
    if os.path.exists(mayco_file):
        update_glaze_file(mayco_file, 'Mayco', mayco_image_dir)
    
    print("\n" + "="*60)
    print("DONE! All glazes updated with brand tags and local images")
    print("="*60)


if __name__ == '__main__':
    main()
