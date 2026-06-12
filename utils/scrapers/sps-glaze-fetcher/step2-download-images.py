#!/usr/bin/env python3
"""
Step 2: Parse cached HTML and download images for Seattle Pottery Supply glazes
"""

import json
import os
import re
import requests
import time
from datetime import datetime
from urllib.parse import urlparse

RESULTS_FILE = 'results/sps-glazes.json'
IMAGES_DIR = '../../app/glaze-viewer/public/images/glazes/sps'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


def download_image(url, local_path):
    """Download an image if it doesn't exist"""
    if os.path.exists(local_path):
        return True
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(response.content)
            return True
        else:
            print(f"    Failed to download: {response.status_code}")
            return False
    except Exception as e:
        print(f"    Error downloading: {e}")
        return False


def get_image_filename(glaze_code, index):
    """Generate a filename for a glaze image"""
    code_clean = glaze_code.lower().replace(' ', '-')
    if index == 0:
        return f"{code_clean}.jpg"
    else:
        return f"{code_clean}-{index + 1}.jpg"


def main():
    """Download images for all glazes"""
    print("\n" + "=" * 60)
    print("SPS Glaze Image Downloader")
    print("=" * 60)
    
    # Load glazes
    if not os.path.exists(RESULTS_FILE):
        print(f"Error: {RESULTS_FILE} not found. Run step1 first.")
        return
    
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    glazes = data.get('glazes', [])
    print(f"Loaded {len(glazes)} glazes")
    
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    total_downloaded = 0
    total_skipped = 0
    total_failed = 0
    
    for i, glaze in enumerate(glazes, 1):
        code = glaze.get('code', '')
        name = glaze.get('name', '')
        images = glaze.get('images', [])
        
        if not images:
            continue
        
        print(f"[{i}/{len(glazes)}] {code} - {name}")
        
        new_images = []
        for j, img in enumerate(images):
            url = img.get('url', '')
            if not url:
                continue
            
            filename = get_image_filename(code, j)
            local_path = os.path.join(IMAGES_DIR, filename)
            web_path = f"/images/glazes/sps/{filename}"
            
            if os.path.exists(local_path):
                print(f"  [{j+1}] Exists: {filename}")
                total_skipped += 1
            else:
                print(f"  [{j+1}] Downloading: {filename}...")
                if download_image(url, local_path):
                    total_downloaded += 1
                    time.sleep(0.2)  # Rate limiting
                else:
                    total_failed += 1
                    continue
            
            new_images.append({
                'id': f"{code.lower()}-{j+1}",
                'url': url,
                'localPath': web_path,
                'alt': img.get('alt', name),
                'type': img.get('type', 'product'),
                'isPrimary': j == 0
            })
        
        glaze['images'] = new_images
    
    # Save updated glazes with local paths
    data['lastUpdated'] = datetime.now().isoformat()
    
    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Downloaded: {total_downloaded}")
    print(f"✓ Skipped (exists): {total_skipped}")
    print(f"✗ Failed: {total_failed}")
    print(f"\n✓ Updated {RESULTS_FILE}")


if __name__ == '__main__':
    main()
