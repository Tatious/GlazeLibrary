#!/usr/bin/env python3
"""
Integrate enriched Mayco image metadata into the main glazes.json

This script:
1. Loads the enriched Mayco image data
2. Updates the combined glazes.json with structured image metadata
3. Preserves the primary image but adds cone/atmosphere/clay info to all images
"""

import os
import json
import sys
from datetime import datetime

ENRICHED_FILE = "ai-enrichment/results/enriched-mayco-images.json"
GLAZES_FILE = "../app/glaze-viewer/public/data/glazes.json"
OUTPUT_FILE = "../app/glaze-viewer/public/data/glazes.json"


def main():
    print("=" * 60)
    print("Integrating Enriched Image Metadata")
    print("=" * 60)
    
    # Load enriched data
    enriched_path = os.path.join(os.path.dirname(__file__), ENRICHED_FILE)
    if not os.path.exists(enriched_path):
        print(f"❌ Enriched file not found: {enriched_path}")
        print("Run: python ai-enrichment/enrich-mayco-images.py")
        sys.exit(1)
    
    with open(enriched_path, 'r') as f:
        enriched_data = json.load(f)
    
    enriched_glazes = {g['code']: g for g in enriched_data.get('glazes', [])}
    print(f"Loaded {len(enriched_glazes)} enriched Mayco glazes")
    
    # Load combined glazes
    glazes_path = os.path.join(os.path.dirname(__file__), GLAZES_FILE)
    with open(glazes_path, 'r') as f:
        glazes_data = json.load(f)
    
    glazes = glazes_data.get('glazes', [])
    print(f"Loaded {len(glazes)} total glazes")
    
    # Update Mayco glazes with enriched metadata
    updated = 0
    for glaze in glazes:
        if glaze.get('brand') != 'Mayco':
            continue
        
        code = glaze.get('code', '')
        enriched = enriched_glazes.get(code)
        if not enriched:
            continue
        
        # Update images with enriched metadata
        enriched_images = enriched.get('images', [])
        glaze_images = glaze.get('images', [])
        
        # Match by localPath or index
        for i, img in enumerate(glaze_images):
            local_path = img.get('localPath', '')
            
            # Find matching enriched image
            matching = None
            for e_img in enriched_images:
                if e_img.get('localPath') == local_path:
                    matching = e_img
                    break
            
            # Fallback to index matching
            if not matching and i < len(enriched_images):
                matching = enriched_images[i]
            
            if matching:
                # Add enriched fields
                if matching.get('cone'):
                    img['cone'] = matching['cone']
                if matching.get('atmosphere'):
                    img['atmosphere'] = matching['atmosphere']
                if matching.get('clay_body'):
                    img['clayBody'] = matching['clay_body']
                if matching.get('imageType'):
                    img['imageType'] = matching['imageType']
                if matching.get('coats'):
                    img['coats'] = matching['coats']
                if matching.get('combo_type'):
                    img['comboType'] = matching['combo_type']
                    img['comboGlaze'] = matching.get('combo_glaze', '')
        
        updated += 1
    
    print(f"Updated {updated} Mayco glazes with enriched metadata")
    
    # Save updated glazes
    output_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    with open(output_path, 'w') as f:
        json.dump(glazes_data, f, indent=2)
    
    print(f"✓ Saved to {OUTPUT_FILE}")
    
    # Show sample
    print("\nSample updated glaze:")
    for glaze in glazes:
        if glaze.get('brand') == 'Mayco' and len(glaze.get('images', [])) > 3:
            print(f"  {glaze['displayName']} ({glaze['code']})")
            for img in glaze['images'][:5]:
                print(f"    - cone={img.get('cone', '?')}, atm={img.get('atmosphere', '?')}, type={img.get('imageType', '?')}")
            break


if __name__ == "__main__":
    main()
