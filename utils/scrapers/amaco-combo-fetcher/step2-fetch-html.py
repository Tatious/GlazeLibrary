#!/usr/bin/env python3
"""
Step 2: Fetch HTML for each discovered combination URL
Reads URLs from step1 output and downloads the full HTML for each valid combination.

Input:  results/all-combination-urls.json
Output: html_cache_valid/{combo-name}.html
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

from config import DEFAULT_HEADERS

RESULTS_DIR = SCRIPT_DIR / "results"
HTML_CACHE_DIR = SCRIPT_DIR / "html_cache_valid"
URLS_FILE = RESULTS_DIR / "all-combination-urls.json"

HTML_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def is_valid_combination_page(html):
    """Check if HTML is a valid combination page (not 404 or bot guard)"""
    if not html:
        return False
    if 'One Moment...' in html and 'verify your request' in html:
        return False
    if 'Page not found' in html:
        return False
    return 'Top Coat Glaze' in html or 'Bottom Coat Glaze' in html


def get_already_fetched():
    """Get set of combo names already downloaded"""
    return {f.stem for f in HTML_CACHE_DIR.glob('*.html')}


async def fetch_combination(page, url, retries=2):
    """Fetch a single combination URL"""
    for attempt in range(retries):
        try:
            response = await page.goto(url, wait_until='networkidle', timeout=30000)
            await page.wait_for_timeout(1000)
            
            content = await page.content()
            
            # Handle guard page
            if 'One Moment...' in content:
                await page.wait_for_timeout(3500)
                content = await page.content()
            
            if response and response.status == 404:
                return (None, 404)
            
            if is_valid_combination_page(content):
                return (content, 200)
            
            if attempt < retries - 1:
                await page.wait_for_timeout(2000)
                
        except Exception as e:
            if attempt < retries - 1:
                await page.wait_for_timeout(2000)
    
    return (None, 0)


async def main():
    print("\n" + "=" * 60)
    print("AMACO Combination HTML Fetcher")
    print("=" * 60)
    
    # Load discovered URLs
    if not URLS_FILE.exists():
        print(f"ERROR: {URLS_FILE} not found!")
        print("Run step1-discover-urls.py first.")
        return
    
    with open(URLS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    combinations = data.get('combinations', [])
    print(f"Loaded {len(combinations)} combination URLs")
    
    # Filter out already fetched
    already_fetched = get_already_fetched()
    print(f"Already fetched: {len(already_fetched)}")
    
    to_fetch = [c for c in combinations if c['name'] not in already_fetched]
    print(f"Need to fetch: {len(to_fetch)}")
    
    if not to_fetch:
        print("\nAll combinations already downloaded!")
        return
    
    stats = {'valid': 0, 'not_found': 0, 'errors': 0}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        page = await context.new_page()
        
        print(f"\nFetching {len(to_fetch)} combinations...")
        print("-" * 60)
        
        for i, combo in enumerate(to_fetch):
            if (i + 1) % 50 == 0:
                print(f"\n--- Progress: {i + 1}/{len(to_fetch)} | Valid: {stats['valid']} | 404s: {stats['not_found']} ---\n")
            
            print(f"  [{i+1:4}/{len(to_fetch)}] {combo['name']}...", end=" ", flush=True)
            
            html, status = await fetch_combination(page, combo['url'])
            
            if status == 404:
                print("404")
                stats['not_found'] += 1
            elif html:
                filepath = HTML_CACHE_DIR / f"{combo['name']}.html"
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(html)
                print("OK")
                stats['valid'] += 1
            else:
                print("ERROR")
                stats['errors'] += 1
            
            await page.wait_for_timeout(250)
        
        await browser.close()
    
    # Save fetch stats
    print("\n" + "=" * 60)
    print("Fetch Complete!")
    print("=" * 60)
    print(f"  Valid HTML downloaded: {stats['valid']}")
    print(f"  Not found (404):       {stats['not_found']}")
    print(f"  Errors:                {stats['errors']}")
    print(f"\nHTML files saved to: {HTML_CACHE_DIR}")
    print("\nNext step: Run step3-parse-and-download.py to extract data and download images.")


if __name__ == '__main__':
    asyncio.run(main())
