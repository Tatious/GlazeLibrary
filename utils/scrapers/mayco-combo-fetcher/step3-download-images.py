#!/usr/bin/env python3
"""
Step 3: Download Mayco combination images

Reads from: results/combinations-parsed.json
Downloads to: images/
Updates: results/combinations.json (with local paths)
"""

import json
import sys
import re
import requests
import hashlib
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

RESULTS_DIR = SCRIPT_DIR / "results"
IMAGES_DIR = SCRIPT_DIR / "images"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def sanitize_filename(url, combo_id):
    """Create a clean filename from URL and combo ID"""
    # Extract filename from URL
    url_path = url.split('/')[-1].split('?')[0]
    ext = Path(url_path).suffix or '.jpg'
    
    # Use combo_id as base
    safe_id = re.sub(r'[^\w\-]', '_', combo_id)
    return f"{safe_id}{ext}"


def download_image(url, filepath):
    """Download an image to filepath. Returns True on success."""
    if filepath.exists():
        return True, "exists"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        return True, "downloaded"
    except Exception as e:
        return False, str(e)


def process_combination(combo, images_dir):
    """Process a single combination, downloading its images"""
    results = []
    combo_id = combo['id']
    
    for entry in combo.get('entries', []):
        for photo in entry.get('photos', []):
            url = photo.get('url')
            if not url:
                continue
            
            # Generate local filename
            filename = sanitize_filename(url, f"{combo_id}-{entry['id']}")
            filepath = images_dir / filename
            
            success, status = download_image(url, filepath)
            
            results.append({
                'combo_id': combo_id,
                'entry_id': entry['id'],
                'url': url,
                'local_path': str(filepath.relative_to(SCRIPT_DIR)),
                'filename': filename,
                'success': success,
                'status': status
            })
    
    return results


def main():
    print("\n" + "=" * 60)
    print("Mayco Combination Image Downloader")
    print("=" * 60)
    
    input_path = RESULTS_DIR / 'combinations-parsed.json'
    
    if not input_path.exists():
        print(f"✗ Input file not found: {input_path}")
        print("Run step2-parse-html.py first.")
        return
    
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    combinations = data.get('combinations', [])
    print(f"Found {len(combinations)} combinations to process")
    
    # Count total images
    total_images = sum(
        len(photo)
        for combo in combinations
        for entry in combo.get('entries', [])
        for photo in entry.get('photos', [])
    )
    print(f"Total images to download: {total_images}")
    
    # Download images
    all_results = []
    downloaded = 0
    skipped = 0
    failed = 0
    
    for i, combo in enumerate(combinations, 1):
        results = process_combination(combo, IMAGES_DIR)
        all_results.extend(results)
        
        for r in results:
            if r['success']:
                if r['status'] == 'downloaded':
                    downloaded += 1
                else:
                    skipped += 1
            else:
                failed += 1
        
        if i % 100 == 0:
            print(f"  Processed {i}/{len(combinations)} combinations...")
    
    print(f"\n✓ Downloaded: {downloaded}")
    print(f"  Skipped (already exist): {skipped}")
    print(f"✗ Failed: {failed}")
    
    # Update combinations with local paths
    for combo in combinations:
        for entry in combo.get('entries', []):
            for photo in entry.get('photos', []):
                # Find matching result
                for r in all_results:
                    if r['url'] == photo.get('url') and r['success']:
                        photo['localPath'] = r['local_path']
                        break
    
    # Save updated combinations
    output = {
        'version': '1.0',
        'dataStructure': 'multi-entry',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'mayco',
        'totalCombinations': len(combinations),
        'totalEntries': sum(len(c['entries']) for c in combinations),
        'combinations': combinations
    }
    
    output_path = RESULTS_DIR / 'combinations.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved to {output_path}")
    
    # Save download report
    report = {
        'timestamp': datetime.now().isoformat(),
        'total': len(all_results),
        'downloaded': downloaded,
        'skipped': skipped,
        'failed': failed,
        'failures': [r for r in all_results if not r['success']]
    }
    
    report_path = RESULTS_DIR / 'download-report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Report saved to {report_path}")


if __name__ == '__main__':
    main()
