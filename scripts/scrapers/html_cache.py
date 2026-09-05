"""
HTML Cache Utility
Downloads and caches HTML pages for faster re-processing
"""

import os
import hashlib
import requests
from pathlib import Path
import time


def get_cache_path(url, cache_dir):
    """Generate cache file path for a URL"""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return os.path.join(cache_dir, f"{url_hash}.html")


def fetch_with_cache(url, cache_dir, headers=None, force_refresh=False):
    """
    Fetch a page with caching support
    
    Args:
        url: URL to fetch
        cache_dir: Directory to store cached HTML
        headers: Optional headers dict
        force_refresh: Force re-download even if cached
    
    Returns:
        HTML content or None if failed
    """
    # Create cache directory
    Path(cache_dir).mkdir(parents=True, exist_ok=True)
    
    cache_path = get_cache_path(url, cache_dir)
    
    # Return cached version if exists and not forcing refresh
    if os.path.exists(cache_path) and not force_refresh:
        print(f"  [CACHE] {url}")
        with open(cache_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    # Fetch from web
    print(f"  [FETCH] {url}")
    try:
        response = requests.get(url, headers=headers or {}, timeout=30)
        response.raise_for_status()
        html = response.text
        
        # Save to cache
        with open(cache_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        return html
        
    except Exception as e:
        print(f"    Error: {e}")
        return None


def clear_cache(cache_dir):
    """Clear all cached HTML files"""
    if os.path.exists(cache_dir):
        for file in os.listdir(cache_dir):
            if file.endswith('.html'):
                os.remove(os.path.join(cache_dir, file))
        print(f"Cleared cache directory: {cache_dir}")
