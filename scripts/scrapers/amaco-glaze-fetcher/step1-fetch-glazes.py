"""
AMACO Midrange Glaze Fetcher
Dynamically scrapes all midrange (cone 5-6) glazes from the AMACO website.
With HTML caching for faster re-processing

URL Hierarchy:
1. /glazes-underglazes/ - Top level
2. /glazes-underglazes/high-fire-glazes/ - Category level  
3. /glazes-underglazes/high-fire-glazes/c-celadon/ - Series level
4. /c-01-obsidian/ - Individual product
"""

import os
import sys
import json
import requests
from bs4 import BeautifulSoup
import time
import re
from datetime import datetime
from urllib.parse import urljoin

# Add parent directory for shared utilities
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from html_cache import fetch_with_cache

OUTPUT_DIR = "results"
CACHE_DIR = "html_cache"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

BASE_URL = 'https://shop.amaco.com'
GLAZES_URL = 'https://shop.amaco.com/glazes-underglazes/'

# Categories we want (midrange/high fire)
TARGET_CATEGORIES = [
    'high-fire-glazes',
    'mid-high-fire-glazes',
    'underglazes',  # Velvet underglazes work at cone 6
]

# Series prefixes we're interested in for midrange
MIDRANGE_SERIES_PREFIXES = [
    'c-',      # Celadon
    'pc-',     # Potter's Choice
    'pcf-',    # Potter's Choice Flux
    'sm-',     # Satin Matte
    'sh-',     # Shino
    'hf-',     # High Fire
    'cr-',     # Crawls
    'co-',     # Cosmos
    'dl-',     # Dipping & Layering
    'pg-',     # Phase Glazes
    'ki-',     # Kiln Ice
    'v-',      # Velvet Underglaze (works at cone 6)
]

# Legacy - now merged into MIDRANGE_SERIES_PREFIXES
UNDERGLAZE_SERIES = [
    'v-',      # Velvet Underglaze
]


def fetch_page(url):
    """Fetch a page with caching"""
    html_content = fetch_with_cache(url, CACHE_DIR, HEADERS)
    if html_content:
        time.sleep(0.2)  # Rate limiting when making actual requests
    return html_content


def discover_glaze_categories():
    """Discover all glaze category URLs from the main glazes page"""
    print("\n" + "="*60)
    print("Step 1: Discovering glaze categories...")
    print("="*60)
    
    html = fetch_page(GLAZES_URL)
    if not html:
        return []
    
    soup = BeautifulSoup(html, 'html.parser')
    categories = []
    
    # Find all links that match our target categories
    for link in soup.select('a[href]'):
        href = link.get('href', '')
        for target in TARGET_CATEGORIES:
            if target in href and href not in [c['url'] for c in categories]:
                full_url = urljoin(BASE_URL, href)
                # Clean up URL (remove query params)
                full_url = full_url.split('?')[0]
                if not full_url.endswith('/'):
                    full_url += '/'
                categories.append({
                    'name': target.replace('-', ' ').title(),
                    'url': full_url
                })
    
    # Deduplicate
    seen = set()
    unique_categories = []
    for cat in categories:
        if cat['url'] not in seen:
            seen.add(cat['url'])
            unique_categories.append(cat)
            print(f"  Found category: {cat['name']} -> {cat['url']}")
    
    return unique_categories


def discover_series_in_category(category_url):
    """Discover all glaze series within a category"""
    html = fetch_page(category_url)
    if not html:
        return []
    
    soup = BeautifulSoup(html, 'html.parser')
    series = []
    
    # Find subcategory links
    for link in soup.select('a[href]'):
        href = link.get('href', '')
        text = link.get_text(strip=True)
        
        # Check if this is a series page (contains category URL and has another segment)
        if 'glazes-underglazes' in href and href != category_url:
            full_url = urljoin(BASE_URL, href).split('?')[0]
            if not full_url.endswith('/'):
                full_url += '/'
            
            # Check if it's deeper than category (a series page)
            if full_url.count('/') > category_url.count('/') or full_url != category_url:
                # Check if it matches our target series
                url_lower = full_url.lower()
                is_target = any(f'/{prefix}' in url_lower or f'-{prefix}' in url_lower 
                               for prefix in MIDRANGE_SERIES_PREFIXES)
                
                if is_target and full_url not in [s['url'] for s in series]:
                    series.append({
                        'name': text or full_url.split('/')[-2],
                        'url': full_url
                    })
    
    return series


def discover_all_series():
    """Discover all glaze series from all categories"""
    print("\n" + "="*60)
    print("Step 2: Discovering glaze series...")
    print("="*60)
    
    categories = discover_glaze_categories()
    all_series = []
    
    for category in categories:
        print(f"\n  Scanning {category['name']}...")
        series = discover_series_in_category(category['url'])
        for s in series:
            if s['url'] not in [x['url'] for x in all_series]:
                all_series.append(s)
                print(f"    Found series: {s['name']} -> {s['url']}")
        time.sleep(0.3)
    
    return all_series


def fetch_products_from_series(series_url, series_name):
    """Fetch all products from a series page, handling pagination"""
    products = []
    page = 1
    max_pages = 10  # Safety limit to avoid infinite loops
    
    while page <= max_pages:
        page_url = f"{series_url}?page={page}" if page > 1 else series_url
        html = fetch_page(page_url)
        if not html:
            break
        
        soup = BeautifulSoup(html, 'html.parser')
        page_products = []
        
        # Find product links - they go directly to product pages like /c-01-obsidian/
        for link in soup.select('a[href]'):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Product URLs are at root level: /c-01-obsidian/, /pc-23-indigo-float/
            # They match pattern: /{code}-{number}-{name}/
            # Also handle ug-liq-v-315-pt-peach format (legacy underglaze URLs)
            is_product_url = (
                re.match(r'^https?://shop\.amaco\.com/[a-z]+-\d+', href) or
                re.match(r'^/[a-z]+-\d+', href) or
                # Handle ug-liq-v-XXX pattern for legacy underglaze URLs
                re.match(r'^https?://shop\.amaco\.com/ug-liq-[a-z]+-\d+', href) or
                re.match(r'^/ug-liq-[a-z]+-\d+', href)
            )
            
            if is_product_url:
                full_url = urljoin(BASE_URL, href).split('?')[0]
                if not full_url.endswith('/'):
                    full_url += '/'
                
                # Extract code from URL
                # Handle both /v-309-name/ and /ug-liq-v-315-pt-name/ formats
                match = re.search(r'/ug-liq-([a-z]+)-(\d+)', full_url, re.IGNORECASE)
                if not match:
                    match = re.search(r'/([a-z]+)-(\d+)-?([^/]*)', full_url, re.IGNORECASE)
                
                if match and full_url not in [p['url'] for p in products]:
                    code = f"{match.group(1).upper()}-{match.group(2)}"
                    # Extract name from text or URL
                    if len(match.groups()) >= 3 and match.group(3):
                        name_from_url = match.group(3).replace('-', ' ').title()
                    else:
                        # For ug-liq URLs, extract name from after the number
                        name_match = re.search(r'/ug-liq-[a-z]+-\d+-pt-([^/]+)', full_url, re.IGNORECASE)
                        name_from_url = name_match.group(1).replace('-', ' ').title() if name_match else ''
                    
                    page_products.append({
                        'code': code,
                        'name': text or name_from_url,
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
        
        # If no new products were added, we've reached the end (all were duplicates)
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
        
        # Collect ALL images with metadata
        images = []
        seen_urls = set()
        product_code = product['code']
        
        def add_image(url, img_type, alt=''):
            """Add image if not duplicate and valid"""
            if not url or url in seen_urls:
                return
            # Normalize URL
            if url.startswith('//'):
                url = 'https:' + url
            # Clean srcset suffix
            if ' ' in url:
                url = url.split(' ')[0]
            # Skip small thumbnails and navigation images
            if any(x in url for x in ['stencil/10/', 'stencil/30/', 'icon', 'logo', 'nav']):
                return
            if url in seen_urls:
                return
            seen_urls.add(url)
            
            img_data = {
                'url': url,
                'type': img_type,
            }
            if alt:
                img_data['alt'] = alt
            images.append(img_data)
        
        imgs = soup.select('img')
        
        # 1. Product images matching the code (highest priority)
        for img in imgs:
            alt = img.get('alt', '')
            src = img.get('src', '') or img.get('data-src', '')
            if product_code.lower().replace('-', ' ') in alt.lower().replace('-', ' '):
                if 'stencil/65' in src or 'stencil/50' in src or 'stencil/100' in src:
                    add_image(src, 'product', alt)
        
        # 2. Gallery/carousel images
        for img in soup.select('.productView-thumbnail img, .slick-slide img, [data-image-gallery] img'):
            src = img.get('data-src') or img.get('src', '')
            alt = img.get('alt', '')
            add_image(src, 'gallery', alt)
        
        # 3. Main large product images
        for img in soup.select('.productView-image img, .product-main-image img'):
            src = img.get('src', '') or img.get('data-src', '')
            alt = img.get('alt', '')
            add_image(src, 'main', alt)
        
        # 4. Fallback: any large stencil images
        for img in imgs:
            src = img.get('src', '')
            alt = img.get('alt', '')
            if 'stencil/65' in src or 'stencil/50' in src:
                add_image(src, 'stencil', alt)
        
        product['images'] = images
        
        # Get product title (more accurate than link text)
        title = soup.select_one('.productView-title, h1.productView-title, h1')
        if title:
            title_text = title.get_text(strip=True)
            # Extract name after code
            name_match = re.sub(r'^[A-Z]+-\d+\s*', '', title_text)
            if name_match:
                product['name'] = name_match.strip()
        
        # Get description
        desc = soup.select_one('.productView-description, #tab-description, [data-content-region="product_below_content"]')
        if desc:
            product['description'] = desc.get_text(strip=True)[:500]
        
        # Extract tags
        product['tags'] = extract_color_tags(product.get('name', '') + ' ' + product.get('description', ''))
    except Exception as e:
        print(f"    Error fetching details: {e}")
    
    return product


def extract_color_tags(text):
    """Extract color and finish tags from text"""
    text = text.lower()
    colors = [
        'black', 'white', 'blue', 'red', 'green', 'yellow', 'brown', 
        'purple', 'orange', 'pink', 'gray', 'grey', 'turquoise', 'teal',
        'gold', 'silver', 'copper', 'bronze', 'iron', 'amber', 'honey',
        'jade', 'emerald', 'sapphire', 'ruby', 'cobalt', 'rust', 'cream',
        'ivory', 'tan', 'beige', 'olive', 'sage', 'moss', 'forest',
        'midnight', 'sky', 'ocean', 'sea', 'storm', 'snow', 'obsidian',
        'celadon', 'ash', 'oatmeal', 'speckle', 'merlot', 'jasper'
    ]
    
    tags = []
    for color in colors:
        if color in text:
            tags.append(color)
    
    # Add finish tags
    finishes = ['matte', 'satin', 'glossy', 'gloss', 'metallic', 'speckle', 
                'textured', 'crystalline', 'opalescent', 'translucent']
    for finish in finishes:
        if finish in text:
            tags.append(finish)
    
    return list(set(tags))


def determine_cone(series_name, code):
    """Determine cone range based on series"""
    series_lower = series_name.lower()
    code_upper = code.upper()
    
    # Most mid-high fire glazes are cone 5-6
    if any(x in series_lower for x in ['celadon', 'potter', 'satin', 'shino', 'cosmos', 'phase', 'crawl', 'kiln ice']):
        return ['5', '6']
    if any(x in series_lower for x in ['high fire', 'hf-']):
        return ['5', '6', '10']
    if 'velvet' in series_lower or code_upper.startswith('V-'):
        return ['05', '6']  # Underglazes work across range
    
    return ['5', '6']


def normalize_glazes(glazes):
    """Convert to final format matching the app's Glaze type"""
    normalized = []
    seen_ids = set()
    
    for glaze in glazes:
        # Create ID
        code_clean = glaze['code'].lower().replace(' ', '-')
        glaze_id = f"amaco-{code_clean}"
        
        # Skip duplicates
        if glaze_id in seen_ids:
            continue
        seen_ids.add(glaze_id)
        
        # Clean up name
        name = glaze.get('name', '')
        # Remove code prefix if it got included
        name = re.sub(r'^[A-Z]+-\d+\s*', '', name).strip()
        # Remove price if accidentally included
        name = re.sub(r'\s*\$[\d.]+.*$', '', name).strip()
        
        # Build images array with local paths and original URLs
        images = []
        raw_images = glaze.get('images', [])
        
        # Find primary image (product type has priority)
        primary_idx = 0
        for i, img in enumerate(raw_images):
            if img.get('type') == 'product':
                primary_idx = i
                break
        
        code = glaze['code']
        for i, img in enumerate(raw_images):
            img_entry = {
                'id': f"{code_clean}-img-{i+1}",
                'localPath': f"/images/glazes/amaco/{code_clean}-{i+1}.jpg" if i > 0 else f"/images/glazes/amaco/{code_clean}.jpg",
                'originalUrl': img['url'],
                'type': img.get('type', 'unknown'),
                'isPrimary': i == primary_idx,
            }
            if 'alt' in img:
                img_entry['alt'] = img['alt']
            images.append(img_entry)
        
        # Fallback if no images found (use old single image field)
        if not images and glaze.get('image'):
            images = [{
                'id': f"{code_clean}-img-1",
                'localPath': f"/images/glazes/amaco/{code_clean}.jpg",
                'originalUrl': glaze.get('image', ''),
                'type': 'product',
                'isPrimary': True,
            }]
        
        normalized.append({
            'id': glaze_id,
            'brand': 'AMACO',
            'series': glaze.get('series', 'Unknown'),
            'code': code,
            'name': name,
            'displayName': f"{code} {name}",
            'cone': determine_cone(glaze.get('series', ''), code),
            'tags': glaze.get('tags', []),
            'productUrl': glaze.get('url'),
            'images': images,
            'source': 'amaco'
        })
    
    return normalized


def main():
    print("AMACO Midrange Glaze Fetcher")
    print("============================")
    print("Dynamically discovers and fetches all midrange glazes\n")
    
    # Step 1 & 2: Discover all series
    all_series = discover_all_series()
    print(f"\nFound {len(all_series)} glaze series total")
    
    # Step 3: Fetch products from each series
    print("\n" + "="*60)
    print("Step 3: Fetching products from each series...")
    print("="*60)
    
    all_products = []
    for series in all_series:
        print(f"\n  Fetching {series['name']}...")
        products = fetch_products_from_series(series['url'], series['name'])
        print(f"    Found {len(products)} products")
        all_products.extend(products)
        time.sleep(0.3)
    
    print(f"\nTotal products found: {len(all_products)}")
    
    # Step 4: Fetch details for each product
    print("\n" + "="*60)
    print("Step 4: Fetching product details...")
    print("="*60)
    
    for i, product in enumerate(all_products):
        print(f"  [{i+1}/{len(all_products)}] {product['code']} - {product.get('name', 'Unknown')}")
        fetch_product_details(product)
        time.sleep(0.2)
    
    # Normalize and save
    normalized = normalize_glazes(all_products)
    normalized.sort(key=lambda g: (g['series'], g['code']))
    
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'shop.amaco.com',
        'totalCount': len(normalized),
        'glazes': normalized
    }
    
    output_path = os.path.join(OUTPUT_DIR, 'glazes.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n\n{'='*60}")
    print("DONE!")
    print(f"{'='*60}")
    print(f"Total glazes fetched: {len(normalized)}")
    print(f"Output saved to: {output_path}")
    
    # Print summary by series
    print(f"\nBy series:")
    series_counts = {}
    for g in normalized:
        series_counts[g['series']] = series_counts.get(g['series'], 0) + 1
    for series, count in sorted(series_counts.items()):
        print(f"  {series}: {count}")


if __name__ == '__main__':
    main()
