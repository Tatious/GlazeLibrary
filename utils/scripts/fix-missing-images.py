#!/usr/bin/env python3
"""
Remove references to non-existent images from glazes.json
"""

import json
import os

DATA_DIR = "/Users/work/Desktop/GlazeServer/app/glaze-viewer/public"

def main():
    glazes_path = os.path.join(DATA_DIR, "data/glazes.json")
    images_dir = os.path.join(DATA_DIR, "images")
    
    with open(glazes_path, 'r') as f:
        data = json.load(f)
    
    missing = []
    cleaned = 0
    
    for glaze in data:
        if 'images' in glaze:
            original_count = len(glaze['images'])
            valid_images = []
            for img in glaze['images']:
                local_path = img.get('localPath', '')
                # localPath looks like "/images/glazes/amaco/c-11-2.jpg"
                # We need to check if images_dir + path_after_images exists
                if local_path.startswith('/images/'):
                    relative_path = local_path[8:]  # Remove "/images/"
                    full_path = os.path.join(images_dir, relative_path)
                else:
                    full_path = os.path.join(DATA_DIR, local_path.lstrip('/'))
                
                if os.path.exists(full_path):
                    valid_images.append(img)
                else:
                    missing.append(local_path)
            glaze['images'] = valid_images
            cleaned += original_count - len(valid_images)
    
    print(f'Missing images found: {len(missing)}')
    if missing[:15]:
        print('Examples:')
        for m in missing[:15]:
            print(f'  {m}')
    
    print(f'\nRemoved {cleaned} missing image references')
    
    with open(glazes_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print('Saved glazes.json!')

if __name__ == "__main__":
    main()
