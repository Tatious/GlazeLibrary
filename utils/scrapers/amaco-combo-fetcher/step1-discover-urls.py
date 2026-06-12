#!/usr/bin/env python3
"""
Step 1: Discover all AMACO glaze combination URLs
Queries the layering page with each glaze as a filter and collects all combination links.
Handles pagination.

Output: results/all-combination-urls.json
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

from config import DEFAULT_HEADERS

RESULTS_DIR = SCRIPT_DIR / "results"
GLAZES_JSON = SCRIPT_DIR.parent / "amaco-glaze-fetcher" / "results" / "glazes.json"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)

LAYERING_BASE = "https://amaco.com/resources/layering/"


def load_glazes():
    """Load glazes from JSON"""
    if not GLAZES_JSON.exists():
        print(f"ERROR: {GLAZES_JSON} not found!")
        print("Run the AMACO glaze scraper first.")
        return []
    with open(GLAZES_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('glazes', [])


def create_slug(glaze):
    """Create URL slug from glaze data - keeps leading zeros"""
    code = glaze.get('code', '').lower()
    name = glaze.get('name', '').lower()
    
    # Keep the code as-is (with leading zeros like c-01)
    slug = f"{code}-{name}".replace(' ', '-')
    slug = slug.replace('(', '').replace(')', '').replace("'", '').replace('&', '').replace('--', '-')
    return slug


async def get_combinations_for_glaze(page, glaze_slug, max_retries=3):
    """
    Query the layering page with a specific top glaze to find all combinations.
    Handles pagination (page=1, page=2, etc.)
    Returns list of combination URLs found.
    """
    all_urls = []
    page_num = 1
    
    while True:
        if page_num == 1:
            url = f"{LAYERING_BASE}?glaze_top={glaze_slug}"
        else:
            url = f"{LAYERING_BASE}?glaze_top={glaze_slug}&page={page_num}"
        
        content = None
        for attempt in range(max_retries):
            try:
                await page.goto(url, timeout=30000)
                
                # Wait for page to fully load
                await page.wait_for_load_state('load', timeout=15000)
                await page.wait_for_timeout(2000)
                
                content = await page.content()
                
                # Handle guard page - wait for redirect
                if 'One Moment...' in content:
                    await page.wait_for_timeout(4000)
                    content = await page.content()
                
                # If we got real content, break retry loop
                if content and len(content) > 5000:
                    break
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    await page.wait_for_timeout(2000)
                else:
                    print(f"    Error on page {page_num}: {e}")
                    return all_urls
        
        if not content:
            break
        
        # Find all combination links on the page
        # Format: href="https://amaco.com/resources/layering/c-1-obsidian-over-c-47-jade"
        pattern = r'href="(https://amaco\.com/resources/layering/[^"?]+over[^"?]+)"'
        matches = re.findall(pattern, content)
        
        unique_urls = list(set(matches))
        
        if not unique_urls:
            break
        
        all_urls.extend(unique_urls)
        
        # Check if there's a next page
        if f'page={page_num + 1}' in content:
            page_num += 1
            await page.wait_for_timeout(500)
        else:
            break
    
    return list(set(all_urls))


async def main():
    print("\n" + "=" * 60)
    print("AMACO Combination URL Discovery")
    print("=" * 60)
    
    # Load glazes
    glazes = load_glazes()
    print(f"Loaded {len(glazes)} glazes to query")
    
    all_combo_urls = set()
    glaze_results = {}  # Track combos found per glaze
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        page = await context.new_page()
        
        print("\nDiscovering combinations by querying each glaze...")
        print("-" * 60)
        
        failed_glazes = []  # Track glazes that returned 0 results for retry
        
        for i, glaze in enumerate(glazes):
            slug = create_slug(glaze)
            code = glaze['code']
            
            print(f"  [{i+1:3}/{len(glazes)}] {code:12} ({slug})...", end=" ", flush=True)
            
            combos = await get_combinations_for_glaze(page, slug)
            new_count = len([c for c in combos if c not in all_combo_urls])
            all_combo_urls.update(combos)
            
            glaze_results[code] = len(combos)
            
            if len(combos) == 0:
                failed_glazes.append(glaze)
                print(f"found   0 combos (will retry)")
            else:
                print(f"found {len(combos):3} combos ({new_count:3} new) | Total: {len(all_combo_urls)}")
            
            await page.wait_for_timeout(300)
        
        # Retry failed glazes
        if failed_glazes:
            print(f"\n--- Retrying {len(failed_glazes)} glazes that returned 0 results ---")
            for glaze in failed_glazes:
                slug = create_slug(glaze)
                code = glaze['code']
                
                print(f"  Retry: {code:12} ({slug})...", end=" ", flush=True)
                
                # Close and reopen browser for fresh session
                await page.wait_for_timeout(2000)
                
                combos = await get_combinations_for_glaze(page, slug)
                new_count = len([c for c in combos if c not in all_combo_urls])
                all_combo_urls.update(combos)
                glaze_results[code] = len(combos)
                
                print(f"found {len(combos):3} combos ({new_count:3} new) | Total: {len(all_combo_urls)}")
        
        await browser.close()
    
    # Process results
    print("\n" + "=" * 60)
    print("Discovery Complete!")
    print("=" * 60)
    print(f"Total unique combination URLs found: {len(all_combo_urls)}")
    
    # Parse URLs to extract combo names
    combinations = []
    for url in sorted(all_combo_urls):
        name = url.split('/')[-1]
        # Parse "top-over-bottom" pattern
        match = re.match(r'(.+)-over-(.+)', name)
        if match:
            combinations.append({
                'url': url,
                'name': name,
                'topSlug': match.group(1),
                'bottomSlug': match.group(2)
            })
    
    # Save results
    output = {
        'discoveredAt': datetime.now().isoformat(),
        'totalUrls': len(combinations),
        'glazesQueried': len(glazes),
        'combinations': combinations
    }
    
    output_file = RESULTS_DIR / 'all-combination-urls.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nSaved {len(combinations)} URLs to: {output_file}")
    print("\nNext step: Run step2-fetch-html.py to download HTML for each combination.")


if __name__ == '__main__':
    asyncio.run(main())
