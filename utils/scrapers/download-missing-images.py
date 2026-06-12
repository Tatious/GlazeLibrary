#!/usr/bin/env python3
"""
Download missing images from original URLs in glazes.json
Only downloads images that don't already exist locally
"""

import json
import requests
import os
from pathlib import Path
import time
import sys

def download_missing_images(series_filter=None):
    # Load AMACO glazes
    with open('amaco-glaze-fetcher/results/glazes.json') as f:
        data = json.load(f)

    output_dir = '../app/glaze-viewer/public/images/glazes/amaco'
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    failed = 0

    for glaze in data['glazes']:
        code = glaze.get('code', '')
        
        # Filter by series if specified
        if series_filter and not code.startswith(series_filter):
            continue
        
        images = glaze.get('images', [])
        if not images:
            continue
        
        for img in images:
            local_path = img.get('localPath', '')
            original_url = img.get('originalUrl', '')
            
            if not local_path or not original_url:
                continue
            
            # Get filename from localPath
            filename = os.path.basename(local_path)
            full_path = os.path.join(output_dir, filename)
            
            # Skip if exists
            if os.path.exists(full_path):
                skipped += 1
                continue
            
            # Download
            try:
                print(f'Downloading: {filename}')
                response = requests.get(original_url, timeout=30)
                response.raise_for_status()
                
                with open(full_path, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
                time.sleep(0.3)  # Rate limiting
            except Exception as e:
                print(f'Failed: {filename} - {e}')
                failed += 1

    print(f'\nSummary: Downloaded={downloaded}, Skipped={skipped}, Failed={failed}')


if __name__ == '__main__':
    # Optional: pass series prefix as argument (e.g., "V-" for underglazes)
    series_filter = sys.argv[1] if len(sys.argv) > 1 else None
    if series_filter:
        print(f'Filtering to series: {series_filter}')
    download_missing_images(series_filter)
