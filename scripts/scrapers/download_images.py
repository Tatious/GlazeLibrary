"""
Image Download Utility
Downloads images from URLs and saves them locally for self-hosting
"""

import requests
import hashlib
import os
from pathlib import Path
from urllib.parse import urlparse
import time


def download_image(url, output_dir, filename=None):
    """
    Download an image from URL and save it locally
    
    Args:
        url: Image URL to download
        output_dir: Directory to save the image
        filename: Optional custom filename (will generate from URL if not provided)
    
    Returns:
        Local file path relative to public folder, or None if download failed
    """
    if not url or url == '':
        return None
    
    try:
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Generate filename if not provided
        if not filename:
            # Use hash of URL + original extension
            url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
            parsed = urlparse(url)
            ext = os.path.splitext(parsed.path)[1] or '.jpg'
            filename = f"{url_hash}{ext}"
        
        output_path = os.path.join(output_dir, filename)
        
        # Skip if already downloaded
        if os.path.exists(output_path):
            # Return relative path from public folder
            rel_path = output_path.replace('\\', '/').split('/public/')[-1]
            return f"/{rel_path}"
        
        # Download image
        print(f"    Downloading image: {filename}")
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Save to file
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Return relative path from public folder
        rel_path = output_path.replace('\\', '/').split('/public/')[-1]
        return f"/{rel_path}"
        
    except Exception as e:
        print(f"    Error downloading image: {e}")
        return None


def download_glaze_images(glazes_data, brand, output_base_dir):
    """
    Download all images for glazes in the dataset
    
    Args:
        glazes_data: List of glaze dictionaries with imageUrl or images array
        brand: Brand name (amaco, mayco, etc.)
        output_base_dir: Base directory for images (relative to script)
    
    Returns:
        Updated glazes_data with local image paths
    """
    total = len(glazes_data)
    downloaded = 0
    skipped = 0
    failed = 0
    
    print(f"\nDownloading images for {brand} ({total} glazes)...")
    
    for i, glaze in enumerate(glazes_data, 1):
        if i % 10 == 0:
            print(f"  Progress: {i}/{total}")
        
        # Handle new format with images array
        images = glaze.get('images', [])
        if images:
            for img in images:
                original_url = img.get('originalUrl', '')
                local_path = img.get('localPath', '')
                
                if not original_url or not local_path:
                    continue
                
                # Get filename from localPath
                filename = os.path.basename(local_path)
                full_path = os.path.join(output_base_dir, filename)
                
                # Skip if exists
                if os.path.exists(full_path):
                    skipped += 1
                    continue
                
                # Download
                result = download_image(original_url, output_base_dir, filename)
                if result:
                    downloaded += 1
                else:
                    failed += 1
                
                time.sleep(0.2)
            continue
        
        # Handle old format with imageUrl
        image_url = glaze.get('imageUrl', '')
        if not image_url or image_url == '':
            skipped += 1
            continue
        
        # Generate filename from glaze code
        code = glaze.get('code', '').lower().replace(' ', '-')
        filename = f"{code}.jpg"
        
        local_path = download_image(image_url, output_base_dir, filename)
        
        if local_path:
            glaze['imageUrl'] = local_path
            downloaded += 1
        else:
            failed += 1
        
        # Rate limiting
        time.sleep(0.2)
    
    print(f"\nImage download summary:")
    print(f"  Downloaded: {downloaded}")
    print(f"  Skipped (existing): {skipped}")
    print(f"  Failed: {failed}")
    
    return glazes_data
