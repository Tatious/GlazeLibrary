#!/usr/bin/env python3
"""
Seattle Pottery Supply Glaze Fetcher
Fetches glaze information from seattlepotterysupply.com
With HTML caching for faster re-processing
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
import sys
from datetime import datetime
from urllib.parse import urljoin

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Add parent directory for shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from html_cache import fetch_with_cache

# Configuration
BASE_URL = "https://seattlepotterysupply.com"
CACHE_DIR = "html_cache"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# Target glaze collections to scrape
TARGET_COLLECTIONS = [
    {
        'name': 'SPS Mid-Range',
        'collection_url': '/collections/sps-mid-range-glaze',
        'series': 'Mid-Range',
        'cone': ['4', '5', '6']
    },
]


def fetch_page(url):
    """Fetch a page with caching"""
    html_content = fetch_with_cache(url, CACHE_DIR, HEADERS)
    if html_content:
        time.sleep(0.3)  # Rate limiting
    return html_content


def fetch_products_from_collection(collection_url, series_name):
    """Fetch all products from a collection page, handling pagination"""
    products = []
    page = 1
    max_pages = 10  # Safety limit
    
    while page <= max_pages:
        url = f"{BASE_URL}{collection_url}?page={page}"
        print(f"  Fetching page {page}: {url}")
        
        html = fetch_page(url)
        if not html:
            print(f"  Failed to fetch page {page}")
            break
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find product links - Shopify stores use various structures
        # Look for product cards/links
        product_links = []
        
        # Try common Shopify selectors
        for selector in [
            'a[href*="/products/"]',
            '.product-card a',
            '.product-item a',
            '.grid-product a',
        ]:
            links = soup.select(selector)
            for link in links:
                href = link.get('href', '')
                if '/products/' in href and href not in [p['url'] for p in product_links]:
                    # Get product name from the link text or title
                    name = link.get_text(strip=True) or link.get('title', '')
                    if name and not name.startswith('$'):
                        # Skip if it's just a price
                        product_links.append({
                            'url': href if href.startswith('http') else f"{BASE_URL}{href}",
                            'name': name
                        })
        
        if not product_links:
            print(f"  No products found on page {page}")
            break
        
        # Deduplicate by URL
        seen_urls = set()
        unique_products = []
        for p in product_links:
            if p['url'] not in seen_urls:
                seen_urls.add(p['url'])
                unique_products.append(p)
        
        products.extend(unique_products)
        print(f"  Found {len(unique_products)} products on page {page}")
        
        # Check for next page
        next_page = soup.select_one('a[rel="next"], .pagination__next, a:contains("Next")')
        if not next_page:
            # Also check if current page number suggests more pages
            pagination = soup.select('.pagination a, .pagination span')
            has_more = any(str(page + 1) in p.get_text() for p in pagination)
            if not has_more:
                break
        
        page += 1
    
    return products


def parse_product_page(url, series_name, cones):
    """Parse a product detail page to extract glaze info"""
    html = fetch_page(url)
    if not html:
        return None
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Get product title (e.g., "SP52 - Shadow Green")
    title_elem = soup.select_one('h1, .product-title, .product__title')
    if not title_elem:
        return None
    
    title = title_elem.get_text(strip=True)
    
    # Skip non-glaze products (flights, bundles, etc.)
    skip_keywords = ['flight', 'bundle', 'kit', 'tool', 'brush', 'test tile']
    if any(kw in title.lower() for kw in skip_keywords):
        print(f"    Skipping non-glaze: {title}")
        return None
    
    # Parse code and name from title (e.g., "SP52 - Shadow Green")
    code_match = re.match(r'^(SP\d+)\s*[-–]\s*(.+)$', title, re.IGNORECASE)
    if code_match:
        code = code_match.group(1).upper()
        name = code_match.group(2).strip()
    else:
        # Try alternate format or use full title
        code_match = re.search(r'(SP\d+)', title, re.IGNORECASE)
        if code_match:
            code = code_match.group(1).upper()
            name = re.sub(r'SP\d+\s*[-–]?\s*', '', title).strip() or title
        else:
            # No code found, skip
            print(f"    Skipping (no code): {title}")
            return None
    
    # Check for discontinued
    is_discontinued = 'discontinued' in title.lower()
    
    # Get description - look for product description content
    description = ''
    desc_selectors = [
        '.product-description',
        '.product__description',
        '[data-product-description]',
        '.rte',  # Common Shopify rich text element
    ]
    for selector in desc_selectors:
        desc_elem = soup.select_one(selector)
        if desc_elem:
            description = desc_elem.get_text(separator=' ', strip=True)
            break
    
    # If no dedicated description, try to extract from page content
    if not description:
        # Look for text mentioning firing range or glaze properties
        for p in soup.find_all(['p', 'div']):
            text = p.get_text(strip=True)
            if 'FIRING RANGE' in text or 'SPS glazes' in text:
                description = text
                break
    
    # Clean up description - remove boilerplate
    if description:
        # Remove common boilerplate patterns
        boilerplate_patterns = [
            r'For CONE \d+\s*-\s*\d+\s*',  # "For CONE 4 - 6"
            r'To apply:.*?Fire to cone \d+\s*-\s*\d+\.',
            r'If the consistency seems.*?evaporate\.',
            r'Note that mixing glazes.*?performs\.',
            r'For a more in-depth.*?Techniques\s*\.?',
            r'Mid-range glazes, such as this.*?\)',
            r'\*Back orders.*?inventory\.',
            r'Check out Pottery Glazing Techniques\s*\.?',
            r'\.\s*\.',  # Double periods
        ]
        for pattern in boilerplate_patterns:
            description = re.sub(pattern, '', description, flags=re.DOTALL | re.IGNORECASE)
        description = ' '.join(description.split()).strip()  # Clean whitespace
        # Remove trailing period if doubled
        if description.endswith('..'):
            description = description[:-1]
        description = description[:500]  # Limit length
    
    # Get images
    images = []
    seen_urls = set()
    
    # Exclusion patterns - social media icons, logos, payment icons
    exclude_patterns = [
        'facebook', 'instagram', 'pinterest', 'youtube', 'twitter',
        'social', 'icon', 'logo', 'payment', 'badge', 'shipping',
        'cdn.shopify.com/s/files/',  # Shared assets CDN (icons, etc.)
    ]
    
    def is_product_image(url):
        """Check if URL is likely a product image, not an icon/logo"""
        url_lower = url.lower()
        # Exclude known non-product patterns
        for pattern in exclude_patterns:
            if pattern in url_lower:
                return False
        # Must be from seattlepotterysupply.com CDN with shop files
        if 'seattlepotterysupply.com/cdn/shop/' in url_lower:
            return True
        # Or a product-specific image (contains SP code or glaze name)
        if re.search(r'/sp\d+|test.*tile|glaze', url_lower):
            return True
        return False
    
    # Look for product images - prioritize specific Shopify selectors
    img_selectors = [
        '.product-gallery img',
        '.product__media img',
        '.product-single__photo img',
        '.product-images img',
        '.product-featured-media img',
        '[data-product-featured-image] img',
        '.product__main-photos img',
    ]
    
    for selector in img_selectors:
        for img in soup.select(selector):
            src = img.get('src', '') or img.get('data-src', '') or img.get('data-srcset', '').split()[0] if img.get('data-srcset') else ''
            if src and is_product_image(src):
                # Get high-res version by removing size suffix
                src = re.sub(r'_\d+x\d*\.', '.', src)
                src = re.sub(r'_\d+x\.', '.', src)
                if src not in seen_urls:
                    seen_urls.add(src)
                    images.append({
                        'url': src if src.startswith('http') else f"https:{src}",
                        'alt': img.get('alt', name),
                        'type': 'product'
                    })
    
    # If no images found with specific selectors, try broader search
    if not images:
        for img in soup.select('img'):
            src = img.get('src', '') or img.get('data-src', '')
            if src and is_product_image(src):
                src = re.sub(r'_\d+x\d*\.', '.', src)
                src = re.sub(r'_\d+x\.', '.', src)
                if src not in seen_urls:
                    seen_urls.add(src)
                    images.append({
                        'url': src if src.startswith('http') else f"https:{src}",
                        'alt': img.get('alt', name),
                        'type': 'product'
                    })
    
    # Mark first image as primary
    if images:
        images[0]['isPrimary'] = True
    
    # Get SKU if available
    sku = ''
    sku_elem = soup.select_one('[data-sku], .product-sku, .sku')
    if sku_elem:
        sku = sku_elem.get_text(strip=True)
    
    product = {
        'code': code,
        'name': name,
        'displayName': f"{code} - {name}",
        'series': series_name,
        'cone': cones,
        'url': url,
        'description': description,
        'images': images,
        'discontinued': is_discontinued,
    }
    
    if sku:
        product['sku'] = sku
    
    return product


def main():
    """Main entry point"""
    print("\n" + "=" * 60)
    print("Seattle Pottery Supply Glaze Fetcher")
    print("=" * 60)
    
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs('results', exist_ok=True)
    
    all_glazes = []
    
    for collection in TARGET_COLLECTIONS:
        print(f"\nFetching {collection['name']}...")
        
        # Get product URLs from collection
        products = fetch_products_from_collection(
            collection['collection_url'],
            collection['series']
        )
        
        print(f"  Found {len(products)} product links")
        
        # Deduplicate
        seen_urls = set()
        unique_products = []
        for p in products:
            if p['url'] not in seen_urls:
                seen_urls.add(p['url'])
                unique_products.append(p)
        
        print(f"  {len(unique_products)} unique products")
        
        # Fetch each product page
        for i, product_info in enumerate(unique_products, 1):
            print(f"  [{i}/{len(unique_products)}] {product_info['name'][:40]}...")
            
            glaze = parse_product_page(
                product_info['url'],
                collection['series'],
                collection['cone']
            )
            
            if glaze:
                all_glazes.append(glaze)
                print(f"    ✓ {glaze['code']} - {glaze['name']}")
    
    # Sort by code
    all_glazes.sort(key=lambda x: (
        int(re.search(r'\d+', x['code']).group()) if re.search(r'\d+', x['code']) else 0
    ))
    
    # Save results
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'seattlepotterysupply.com',
        'totalCount': len(all_glazes),
        'glazes': all_glazes
    }
    
    output_file = 'results/sps-glazes.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(all_glazes)} glazes to {output_file}")
    
    # Summary
    print("\nSummary:")
    print(f"  Total glazes: {len(all_glazes)}")
    print(f"  With images: {sum(1 for g in all_glazes if g.get('images'))}")
    print(f"  Discontinued: {sum(1 for g in all_glazes if g.get('discontinued'))}")


if __name__ == '__main__':
    main()
