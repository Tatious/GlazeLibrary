#!/usr/bin/env python3
"""Download all Mayco glaze images from the processed JSON"""

import os
import json
import requests
import time
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

from config import MAYCO_GLAZE_IMAGES_DIR, DEFAULT_HEADERS, ensure_directories

GLAZES_JSON = SCRIPT_DIR / "results" / "mayco-glazes.json"
OUTPUT_DIR = MAYCO_GLAZE_IMAGES_DIR

# Ensure output directory exists
ensure_directories()

# Session for connection pooling
session = requests.Session()
session.headers.update(DEFAULT_HEADERS)


def download_image(url, local_path):
    """Download a single image, returns (success, url, path, error)"""
    try:
        # Extract just the filename from the local path
        filename = os.path.basename(local_path)
        full_path = OUTPUT_DIR / filename
        
        # Skip if already exists and has content
        if full_path.exists() and full_path.stat().st_size > 1000:
            return (True, url, str(full_path), 'exists')
        
        response = session.get(url, timeout=30)
        response.raise_for_status()
        
        # Check it's actually an image
        content_type = response.headers.get('content-type', '')
        if 'image' not in content_type and len(response.content) < 1000:
            return (False, url, str(full_path), f'not an image: {content_type}')
        
        with open(full_path, 'wb') as f:
            f.write(response.content)
        
        return (True, url, str(full_path), 'downloaded')
    
    except Exception as e:
        return (False, url, local_path, str(e))


def main():
    print("Mayco Image Downloader")
    print("=" * 60)
    
    # Load glazes JSON
    with open(GLAZES_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    glazes = data.get('glazes', [])
    print(f"Loaded {len(glazes)} glazes")
    
    # Collect all images to download
    downloads = []
    for glaze in glazes:
        for img in glaze.get('images', []):
            url = img.get('originalUrl')
            local_path = img.get('localPath')
            if url and local_path:
                downloads.append((url, local_path))
    
    print(f"Total images to process: {len(downloads)}")
    
    # Download with thread pool
    downloaded = 0
    skipped = 0
    failed = 0
    errors = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(download_image, url, path): (url, path) 
                   for url, path in downloads}
        
        for i, future in enumerate(as_completed(futures)):
            success, url, path, status = future.result()
            
            if success:
                if status == 'exists':
                    skipped += 1
                else:
                    downloaded += 1
            else:
                failed += 1
                errors.append((url, status))
            
            # Progress every 50
            if (i + 1) % 50 == 0:
                print(f"Progress: {i + 1}/{len(downloads)} "
                      f"(downloaded: {downloaded}, skipped: {skipped}, failed: {failed})")
    
    print("\n" + "=" * 60)
    print(f"Complete!")
    print(f"  Downloaded: {downloaded}")
    print(f"  Skipped (exists): {skipped}")
    print(f"  Failed: {failed}")
    
    if errors:
        print(f"\nFirst 10 errors:")
        for url, err in errors[:10]:
            print(f"  {url[:50]}... -> {err}")


if __name__ == '__main__':
    main()
