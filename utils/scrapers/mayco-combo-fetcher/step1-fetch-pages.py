#!/usr/bin/env python3
"""
Step 1: Fetch all Mayco glaze combination pages
Mayco displays combinations in a paginated grid - we fetch all pages of the grid.

URL pattern: https://www.maycocolors.com/glaze-combinations/?_paged=N
Total: ~4317 combinations, 63 per page = ~69 pages

Output: html_cache/{page_number}.html
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent))

from config import DEFAULT_HEADERS

HTML_CACHE_DIR = SCRIPT_DIR / "html_cache"
RESULTS_DIR = SCRIPT_DIR / "results"

HTML_CACHE_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://www.maycocolors.com/glaze-combinations/"


def get_already_fetched():
    """Get set of page numbers already downloaded"""
    return {int(f.stem.replace('page-', '')) for f in HTML_CACHE_DIR.glob('page-*.html')}


async def fetch_page(page, page_num, retries=3):
    """Fetch a single page of combinations"""
    if page_num == 1:
        url = BASE_URL
    else:
        url = f"{BASE_URL}?_paged={page_num}"
    
    for attempt in range(retries):
        try:
            response = await page.goto(url, wait_until='networkidle', timeout=60000)
            await page.wait_for_timeout(2000)
            
            content = await page.content()
            
            # Check for valid content
            if response and response.status == 200 and 'Glaze Combinations' in content:
                return content
            
            if attempt < retries - 1:
                await page.wait_for_timeout(3000)
                
        except Exception as e:
            print(f"    Error on attempt {attempt + 1}: {e}")
            if attempt < retries - 1:
                await page.wait_for_timeout(3000)
    
    return None


async def discover_total_pages(page):
    """Find total number of pages by checking the item count"""
    content = await fetch_page(page, 1)
    if not content:
        return 0
    
    # Look for "X of Y items" pattern
    import re
    match = re.search(r'(\d+)\s+of\s+(\d+)\s+items', content)
    if match:
        per_page = int(match.group(1))
        total = int(match.group(2))
        total_pages = (total + per_page - 1) // per_page
        print(f"Found {total} total combinations, {per_page} per page = {total_pages} pages")
        return total_pages, content
    
    return 100, content  # Default fallback


async def main():
    print("\n" + "=" * 60)
    print("Mayco Combination Page Fetcher")
    print("=" * 60)
    
    already_fetched = get_already_fetched()
    print(f"Already fetched: {len(already_fetched)} pages")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=DEFAULT_HEADERS['User-Agent'],
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        
        # Discover total pages
        print("\nDiscovering total pages...")
        total_pages, first_page_content = await discover_total_pages(page)
        
        # Save first page if not already fetched
        if 1 not in already_fetched and first_page_content:
            cache_path = HTML_CACHE_DIR / "page-1.html"
            with open(cache_path, 'w', encoding='utf-8') as f:
                f.write(first_page_content)
            print(f"  Saved page 1")
            already_fetched.add(1)
        
        # Fetch remaining pages
        pages_to_fetch = [p for p in range(2, total_pages + 1) if p not in already_fetched]
        print(f"Need to fetch: {len(pages_to_fetch)} pages")
        
        if not pages_to_fetch:
            print("\nAll pages already downloaded!")
        else:
            fetched = 0
            failed = 0
            
            for page_num in pages_to_fetch:
                print(f"  Fetching page {page_num}/{total_pages}...", end=" ")
                
                content = await fetch_page(page, page_num)
                
                if content:
                    cache_path = HTML_CACHE_DIR / f"page-{page_num}.html"
                    with open(cache_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print("✓")
                    fetched += 1
                else:
                    print("✗ Failed")
                    failed += 1
                
                # Rate limiting
                await page.wait_for_timeout(1000)
            
            print(f"\nFetched: {fetched}, Failed: {failed}")
        
        await browser.close()
    
    # Save summary
    summary = {
        'lastUpdated': datetime.now().isoformat(),
        'totalPages': total_pages,
        'fetchedPages': len(list(HTML_CACHE_DIR.glob('page-*.html')))
    }
    
    with open(RESULTS_DIR / 'fetch-summary.json', 'w') as f:
        import json
        json.dump(summary, f, indent=2)
    
    print(f"\n✓ Done! {summary['fetchedPages']} pages cached")


if __name__ == '__main__':
    asyncio.run(main())
