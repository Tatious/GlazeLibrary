#!/usr/bin/env python3
"""
Mayco Glaze Fetcher
Fetches glaze information from maycocolors.com for specific glaze series
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
from urllib.parse import urljoin, urlparse

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Add parent directory for shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from html_cache import fetch_with_cache

# Configuration
BASE_URL = "https://www.maycocolors.com"
CACHE_DIR = "html_cache"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# Target glaze series to scrape
TARGET_SERIES = [
    {
        'name': 'Jungle Gems',
        'category_url': '/product-category/color/fired/jungle-gems/',
        'code_prefix': 'CG',
        'cone': ['06', '05', '04', '5', '6']
    },
    {
        'name': 'Stoneware',
        'category_url': '/product-category/color/fired/stoneware/',
        'code_prefix': 'SW',
        'cone': ['5', '6', '10']
    },
    {
        'name': 'Stoneware Specialty',
        'category_url': '/product-category/color/fired/stoneware-specialty/',
        'code_prefix': 'SW',
        'cone': ['5', '6', '10']
    },
    {
        'name': 'Stroke & Coat',
        'category_url': '/product-category/color/fired/stroke-coat/',
        'code_prefix': 'SC',
        'cone': ['05', '06']
    },
    {
        'name': 'Speckled Stroke & Coat',
        'category_url': '/product-category/color/fired/speckled-stroke-coat/',
        'code_prefix': 'SP',
        'cone': ['05', '06']
    },
    {
        'name': 'Fundamentals Underglaze',
        'category_url': '/product-category/color/fired/fundamentals-underglaze/',
        'code_prefix': 'UG',
        'cone': ['06', '05', '04', '5', '6', '10']
    }
]


def fetch_page(url):
    """Fetch a page with caching"""
    html_content = fetch_with_cache(url, CACHE_DIR, HEADERS)
    if html_content:
        time.sleep(0.2)  # Rate limiting when making actual requests
    return html_content


def fetch_products_from_series(series_url, series_name, code_prefix):
    """Fetch all products from a series page, handling pagination"""
    products = []
    page = 1
    max_pages = 20  # Safety limit
    
    while page <= max_pages:
        # Mayco uses /page/N/ for pagination
        if page > 1:
            page_url = f"{series_url}page/{page}/"
        else:
            page_url = series_url
            
        html = fetch_page(page_url)
        if not html:
            break
        
        soup = BeautifulSoup(html, 'html.parser')
        page_products = []
        
        # Find product links - Mayco uses product links in the format /product/code-name/
        product_links = soup.select('a[href*="/product/"]')
        
        for link in product_links:
            href = link.get('href', '')
            
            # Extract product code from URL
            # Format: /product/sw-149-crackle-white/ or /product/cg-707-woodland-fantasy/
            match = re.search(r'/product/([a-z]+)-?(\d+)-?([^/]*?)/?$', href, re.IGNORECASE)
            if match:
                code_part = match.group(1).upper()
                number = match.group(2)
                name_slug = match.group(3)
                
                # Only include products matching the series code prefix
                if code_part == code_prefix:
                    full_url = urljoin(BASE_URL, href)
                    if full_url not in [p['url'] for p in products]:
                        # Try to get name from the link text or title
                        name = link.get_text(strip=True)
                        if not name and name_slug:
                            name = name_slug.replace('-', ' ').title()
                        
                        code = f"{code_part}-{number}"
                        page_products.append({
                            'code': code,
                            'name': name,
                            'url': full_url,
                            'series': series_name
                        })
        
        # If no new products found on this page, we've reached the end
        if not page_products:
            break
            
        # Count how many new products were added
        initial_count = len(products)
        for p in page_products:
            if p['url'] not in [x['url'] for x in products]:
                products.append(p)
        
        new_products_added = len(products) - initial_count
        
        # If no new products were added, we've reached the end
        if new_products_added == 0:
            break
        
        # Try next page
        page += 1
        time.sleep(0.3)
    
    return products


def fetch_product_details(product):
    """Fetch detailed info from individual product page"""
    try:
        html = fetch_page(product['url'])
        if not html:
            return product
        
        soup = BeautifulSoup(html, 'html.parser')
        code = product.get('code', '')
        code_pattern = code.lower().replace('-', '[-_]?')
        
        # Get product name from title or h1
        title_elem = soup.select_one('h1.product_title, h1')
        if title_elem:
            title_text = title_elem.get_text(strip=True)
            # Remove code from title if present
            title_text = re.sub(r'^[A-Z]+-?\d+\s*', '', title_text)
            if title_text:
                product['name'] = title_text
        
        # Get main product image - PRIORITY ORDER:
        # 1. Primary image with wp-post-image class and product code in filename
        # 2. Primary image with wp-post-image class
        # 3. Gallery image with product code in filename
        # 4. First gallery image that's not a logo
        
        primary_img = soup.select_one('img.wp-post-image')
        all_images = []
        
        if primary_img:
            # Get the best quality URL from data-large_image or data-src
            img_url = (
                primary_img.get('data-large_image') or 
                primary_img.get('data-src') or 
                primary_img.get('src')
            )
            if img_url:
                filename = os.path.basename(urlparse(img_url).path).lower()
                is_logo = 'logo' in img_url.lower() or 'icon' in img_url.lower()
                has_code = bool(re.search(code_pattern, filename))
                
                if not is_logo:
                    all_images.append({
                        'url': img_url,
                        'type': 'primary',
                        'has_code': has_code,
                        'priority': 1 if has_code else 2
                    })
        
        # Check gallery images (fancybox links)
        gallery_links = soup.select('a[data-fancybox="gallery"]')
        for idx, link in enumerate(gallery_links):
            img_url = link.get('href')
            if not img_url:
                continue
            
            url_lower = img_url.lower()
            if 'logo' in url_lower or 'icon' in url_lower:
                continue
            
            filename = os.path.basename(urlparse(img_url).path).lower()
            has_code = bool(re.search(code_pattern, filename))
            
            # Skip cone variants and special firings for PRIMARY image
            is_variant = bool(re.search(r'cone[_-]?\d+|soda|reduction|raku', filename))
            
            all_images.append({
                'url': img_url,
                'type': 'gallery',
                'has_code': has_code,
                'is_variant': is_variant,
                'priority': 3 if (has_code and not is_variant) else (4 if has_code else 5)
            })
        
        # Sort by priority and pick the best image
        all_images.sort(key=lambda x: x['priority'])
        
        if all_images:
            product['imageUrl'] = all_images[0]['url']
            # Store all image URLs for later detailed scraping
            product['allImageUrls'] = [img['url'] for img in all_images]
        
        # Get description
        desc = soup.select_one('div.woocommerce-product-details__short-description, div.product-short-description')
        if desc:
            product['description'] = desc.get_text(strip=True)[:500]  # Limit length
        
        # Extract cone information from description
        desc_text = soup.get_text()
        cone_matches = re.findall(r'cone\s+(\d+(?:/\d+)?)', desc_text.lower())
        if cone_matches:
            cones = []
            for match in cone_matches[:3]:  # Limit to first 3 matches
                if '/' in match:
                    cones.extend(match.split('/'))
                else:
                    cones.append(match)
            if cones:
                product['cone'] = list(set(cones))  # Remove duplicates
        
        return product
        
    except Exception as e:
        print(f"  Error fetching details for {product['code']}: {e}")
        return product


def main():
    print("\nMayco Glaze Fetcher")
    print("=" * 50)
    print("Fetches glazes from maycocolors.com\n")
    
    all_glazes = []
    series_summary = {}
    
    # Fetch products from each target series
    print("\n" + "="*60)
    print("Fetching products from each series...")
    print("="*60)
    
    for series_info in TARGET_SERIES:
        print(f"\n  Fetching {series_info['name']}...")
        series_url = BASE_URL + series_info['category_url']
        products = fetch_products_from_series(
            series_url, 
            series_info['name'],
            series_info['code_prefix']
        )
        print(f"    Found {len(products)} products")
        series_summary[series_info['name']] = len(products)
        
        # Add cone information from series config
        for product in products:
            product['cone'] = series_info['cone']
        
        all_glazes.extend(products)
        time.sleep(0.5)
    
    print(f"\nTotal products found: {len(all_glazes)}")
    
    # Fetch detailed information for each product
    print("\n" + "="*60)
    print("Fetching product details...")
    print("="*60)
    
    for i, glaze in enumerate(all_glazes, 1):
        print(f"  [{i}/{len(all_glazes)}] {glaze['code']} - {glaze.get('name', 'Unknown')}")
        fetch_product_details(glaze)
        time.sleep(0.5)  # Be respectful
    
    # Transform to output format
    output_glazes = []
    for glaze in all_glazes:
        output_glaze = {
            'id': f"mayco-{glaze['code'].lower().replace(' ', '-')}",
            'brand': 'Mayco',
            'series': glaze['series'],
            'code': glaze['code'],
            'name': glaze.get('name', ''),
            'displayName': f"{glaze['code']} {glaze.get('name', '')}",
            'cone': glaze.get('cone', []),
            'tags': [],
            'productUrl': glaze['url'],
            'imageUrl': glaze.get('imageUrl', ''),
            'source': 'mayco'
        }
        
        # Add description if available
        if 'description' in glaze:
            output_glaze['description'] = glaze['description']
        
        # Extract tags from name (lowercase words)
        if glaze.get('name'):
            tags = [word.lower() for word in re.findall(r'\b[a-z]{4,}\b', glaze['name'].lower())]
            output_glaze['tags'] = tags[:5]  # Limit to 5 tags
        
        output_glazes.append(output_glaze)
    
    # Save results
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'maycocolors.com',
        'totalCount': len(output_glazes),
        'glazes': output_glazes
    }
    
    output_file = 'results/mayco-glazes.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("DONE!")
    print("="*60)
    print(f"Total glazes fetched: {len(output_glazes)}")
    print(f"Output saved to: {output_file}")
    print("\nBy series:")
    for series, count in series_summary.items():
        print(f"  {series}: {count}")


if __name__ == '__main__':
    main()
