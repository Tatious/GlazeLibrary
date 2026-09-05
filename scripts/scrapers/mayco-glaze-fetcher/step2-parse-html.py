#!/usr/bin/env python3
"""
Parse cached Mayco HTML files to extract glaze data
Uses cached HTML to avoid network issues
"""

import os
import json
import re
from datetime import datetime
from bs4 import BeautifulSoup

CACHE_DIR = "html_cache"
OUTPUT_DIR = "results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Product URL patterns from cache
CATEGORY_PAGES = {
    'jungle-gems': ('Jungle Gems', 'CG', ['06', '05', '04', '5', '6']),
    'stoneware': ('Stoneware', 'SW', ['5', '6', '10']),
    'stroke-coat': ('Stroke & Coat', 'SC', ['05', '06']),
    'speckled-stroke-coat': ('Speckled Stroke & Coat', 'SP', ['05', '06']),
    'fundamentals-underglaze': ('Fundamentals Underglaze', 'UG', ['06', '05', '04', '5', '6', '10']),
}

def extract_tags(text):
    """Extract rich tags from description text using word boundary matching"""
    import re
    text = text.lower()
    tags = []
    
    def has_word(keywords):
        """Check if any keyword exists as a whole word (not part of another word)"""
        for kw in keywords:
            # Use word boundary matching to avoid partial matches
            # e.g., 'red' shouldn't match 'textured' or 'colored'
            if re.search(r'\b' + re.escape(kw) + r'\b', text):
                return True
        return False
    
    # Colors - primary colors and ceramic-specific color terms
    colors = {
        # Basic colors
        'black': ['black', 'obsidian', 'ebony'],
        'white': ['white', 'snow', 'ivory', 'cream'],
        'blue': ['blue', 'cobalt', 'sapphire', 'denim', 'azure', 'navy', 'indigo', 'turquoise', 'teal'],
        'red': ['red', 'ruby', 'crimson', 'scarlet', 'burgundy', 'merlot', 'wine'],
        'green': ['green', 'jade', 'emerald', 'sage', 'moss', 'forest', 'olive', 'celadon', 'seafoam'],
        'yellow': ['yellow', 'gold', 'amber', 'honey', 'mustard', 'lemon'],
        'brown': ['brown', 'tan', 'beige', 'caramel', 'chocolate', 'coffee', 'mocha', 'umber', 'sienna', 'oatmeal'],
        'orange': ['orange', 'rust', 'terracotta', 'peach', 'apricot'],
        'purple': ['purple', 'violet', 'plum', 'lavender', 'amethyst', 'grape', 'eggplant'],
        'pink': ['pink', 'rose', 'coral', 'blush', 'magenta', 'fuchsia'],
        'gray': ['gray', 'grey', 'slate', 'pewter', 'ash', 'charcoal', 'smoke'],
        'metallic': ['bronze', 'silver', 'iron', 'copper', 'pewter'],
    }
    
    for color_name, keywords in colors.items():
        if has_word(keywords):
            tags.append(color_name)
    
    # Finishes
    finish_map = {
        'matte': ['matte', 'matt'],
        'satin': ['satin', 'semi-matte', 'semi-gloss', 'eggshell'],
        'gloss': ['gloss', 'glossy', 'shiny'],
        'metallic': ['metallic', 'luster', 'lustre', 'iridescent'],
        'translucent': ['translucent', 'transparent', 'sheer'],
        'opaque': ['opaque'],
    }
    
    for finish_name, keywords in finish_map.items():
        if has_word(keywords):
            tags.append(finish_name)
    
    # Effects/textures
    effects = {
        'speckled': ['speckle', 'speckled', 'spotted', 'flecked'],
        'textured': ['textured', 'texture'],
        'crystalline': ['crystalline', 'crystal', 'crystals'],
        'floating': ['float', 'floating', 'rutile'],
        'breaking': ['break', 'breaks', 'breaking'],
        'flowing': ['flow', 'flowing', 'runs', 'movement'],
        'variegated': ['variegated', 'variation', 'variations'],
        'crawl': ['crawl', 'crawling', 'crawls'],
    }
    
    for effect_name, keywords in effects.items():
        if has_word(keywords):
            tags.append(effect_name)
    
    return list(set(tags))

def get_cached_files():
    """Get list of cached HTML files"""
    if not os.path.exists(CACHE_DIR):
        return []
    return [f for f in os.listdir(CACHE_DIR) if f.endswith('.html')]

def parse_category_page(html_content, series_name, code_prefix):
    """Extract products from a category page"""
    soup = BeautifulSoup(html_content, 'html.parser')
    products = []
    
    # Find product links
    product_links = soup.select('a[href*="/product/"]')
    
    for link in product_links:
        href = link.get('href', '')
        
        # Extract product code from URL
        match = re.search(r'/product/([a-z]+)-?(\d+)-?([^/]*?)/?$', href, re.IGNORECASE)
        if match:
            code_part = match.group(1).upper()
            number = match.group(2)
            name_slug = match.group(3)
            
            if code_part == code_prefix:
                name = link.get_text(strip=True)
                if not name and name_slug:
                    name = name_slug.replace('-', ' ').title()
                
                code = f"{code_part}-{number}"
                products.append({
                    'url': href,
                    'code': code,
                    'name': name
                })
    
    return products

def parse_product_page(html_content, product):
    """Extract details from a product page"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Get product name from title
    title = soup.select_one('h1.product_title, h1.entry-title')
    if title:
        full_name = title.get_text(strip=True)
        # Extract code and name
        match = re.match(r'([A-Z]+-\d+)\s+(.+)', full_name)
        if match:
            product['code'] = match.group(1)
            product['name'] = match.group(2)
    
    # Get description
    desc_elem = soup.select_one('.woocommerce-product-details__short-description, .product-description')
    if desc_elem:
        product['description'] = desc_elem.get_text(strip=True)[:500]
    
    # Find actual glaze images (not logos)
    img_candidates = []
    
    # Gallery images
    for img in soup.select('.woocommerce-product-gallery img'):
        src = img.get('src', '') or img.get('data-src', '')
        alt = img.get('alt', '')
        if src and 'logo' not in src.lower() and 'icon' not in src.lower() and 'logo' not in alt.lower():
            img_candidates.append(src)
    
    # Main product image
    for img in soup.select('img.wp-post-image'):
        src = img.get('src', '') or img.get('data-src', '')
        alt = img.get('alt', '')
        if src and 'logo' not in src.lower() and 'icon' not in src.lower() and 'logo' not in alt.lower():
            img_candidates.append(src)
    
    # Content images
    for img in soup.select('.product-main-image img, .product-image img'):
        src = img.get('src', '') or img.get('data-src', '')
        alt = img.get('alt', '')
        if src and 'logo' not in src.lower() and 'icon' not in src.lower() and 'logo' not in alt.lower():
            img_candidates.append(src)
    
    if img_candidates:
        product['imageUrl'] = img_candidates[0]
    
    return product

def main():
    print("\nMayco Cached HTML Parser")
    print("=" * 60)
    
    cached_files = get_cached_files()
    print(f"Found {len(cached_files)} cached HTML files")
    
    # Separate category pages from product pages
    category_htmls = {}
    product_htmls = {}
    
    for filename in cached_files:
        filepath = os.path.join(CACHE_DIR, filename)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check if it's a product page (has single product markup)
        # Product pages have product_title class or single-product class
        if 'product_title' in content or 'class="product type-product' in content:
            product_htmls[filename] = content
        elif 'product-category' in content or 'woocommerce-products-header' in content:
            # Category listing page
            for cat_key in CATEGORY_PAGES:
                if cat_key in content or cat_key.replace('-', '') in content:
                    if cat_key not in category_htmls:
                        category_htmls[cat_key] = []
                    category_htmls[cat_key].append(content)
                    break
    
    print(f"  Category pages: {sum(len(v) for v in category_htmls.values())}")
    print(f"  Product pages: {len(product_htmls)}")
    
    # Series detection based on code prefix
    SERIES_MAP = {
        'CG': ('Jungle Gems', ['06', '05', '04', '5', '6']),
        'SW': ('Stoneware', ['5', '6', '10']),
        'SC': ('Stroke & Coat', ['05', '06']),
        'SP': ('Speckled Stroke & Coat', ['05', '06']),
        'UG': ('Fundamentals Underglaze', ['06', '05', '04', '5', '6', '10']),
    }
    
    # Extract glazes directly from product pages
    all_products = []
    seen_codes = set()
    
    for filename, html in product_htmls.items():
        soup = BeautifulSoup(html, 'html.parser')
        
        # Try to extract code from various sources
        code = None
        name = None
        
        # Method 1: Look for SKU pattern in the HTML (e.g., "SW-149-1-16679" -> "SW-149")
        sku_match = re.search(r'"sku"\s*:\s*"([A-Z]+-\d+)', html)
        if sku_match:
            code = sku_match.group(1)
        
        # Method 2: Look in canonical URL
        if not code:
            canonical = soup.select_one('link[rel="canonical"]')
            if canonical:
                href = canonical.get('href', '')
                url_match = re.search(r'/product/([a-z]+)-?(\d+)', href, re.IGNORECASE)
                if url_match:
                    code = f"{url_match.group(1).upper()}-{url_match.group(2)}"
        
        # Method 3: Look in og:url
        if not code:
            og_url = soup.select_one('meta[property="og:url"]')
            if og_url:
                href = og_url.get('content', '')
                url_match = re.search(r'/product/([a-z]+)-?(\d+)', href, re.IGNORECASE)
                if url_match:
                    code = f"{url_match.group(1).upper()}-{url_match.group(2)}"
        
        # Method 4: Look in select option text (e.g., "SW-149 Pint")
        if not code:
            for option in soup.select('select option'):
                text = option.get_text(strip=True)
                opt_match = re.match(r'([A-Z]+-\d+)', text)
                if opt_match:
                    code = opt_match.group(1)
                    break
        
        if not code:
            continue
            
        # Skip if we've seen this code
        if code in seen_codes:
            continue
        seen_codes.add(code)
        
        # Extract prefix
        prefix_match = re.match(r'([A-Z]+)-(\d+)', code)
        if not prefix_match:
            continue
        prefix = prefix_match.group(1)
        
        # Get series info
        series_info = SERIES_MAP.get(prefix)
        if not series_info:
            continue
        series_name, cones = series_info
        
        # Get product name from title
        title_elem = soup.select_one('h1.product_title, h1.entry-title, .product-title')
        if title_elem:
            name = title_elem.get_text(strip=True)
        
        # Fallback: og:title
        if not name:
            og_title = soup.select_one('meta[property="og:title"]')
            if og_title:
                name = og_title.get('content', '').replace(' - Mayco', '').strip()
        
        # Fallback: page title
        if not name:
            title_tag = soup.select_one('title')
            if title_tag:
                name = title_tag.get_text(strip=True).replace(' - Mayco', '').strip()
        
        if not name:
            name = "Unknown"
        
        product = {
            'code': code,
            'name': name,
            'series': series_name,
            'cone': cones,
        }
        
        # Get description - prefer the short description which has product-specific cone info
        description = ''
        
        # Try short description first (has product-specific cone 6, cone 10 details)
        desc_elem = soup.select_one('.woocommerce-product-details__short-description')
        if desc_elem:
            description = desc_elem.get_text(strip=True)[:800]
        
        # Fallback to tabs panel (has generic series info)
        if not description:
            tabs_desc = soup.select_one('.woocommerce-Tabs-panel--description, .product-description')
            if tabs_desc:
                description = tabs_desc.get_text(strip=True)[:500]
        
        product['description'] = description
        
        # Collect ALL images with metadata
        images = []
        seen_urls = set()
        
        def add_image(url, img_type, source_elem=None):
            """Add image if not duplicate and not a logo"""
            if not url or url in seen_urls:
                return
            if 'logo' in url.lower() or 'icon' in url.lower() or 'placeholder' in url.lower():
                return
            # Normalize URL (remove size suffix for deduplication)
            base_url = re.sub(r'-\d+x\d+\.', '.', url)
            if base_url in seen_urls:
                return
            seen_urls.add(url)
            seen_urls.add(base_url)
            
            img_data = {
                'url': url,
                'type': img_type,
            }
            if source_elem is not None:
                # Check alt attribute
                alt = source_elem.get('alt', '')
                if alt:
                    img_data['alt'] = alt
                # Check data-caption attribute on parent link
                parent_link = source_elem.find_parent('a')
                if parent_link and parent_link.get('data-caption'):
                    img_data['alt'] = parent_link.get('data-caption')
                # Check for subtitle text after image
                parent_li = source_elem.find_parent('li')
                if parent_li:
                    subtitle = parent_li.select_one('.wc-secondary-image-subtitle')
                    if subtitle:
                        img_data['alt'] = subtitle.get_text(strip=True)
            images.append(img_data)
        
        # Extract cone info from description for primary image
        primary_cone_info = None
        if description:
            # Look for "Cone 06 oxidation (large photo):" pattern
            cone_match = re.search(r'(Cone\s+0?6?\s*oxidation)\s*\(large photo\)', description, re.IGNORECASE)
            if cone_match:
                primary_cone_info = cone_match.group(1)
            else:
                # Try og:description
                og_desc = soup.select_one('meta[property="og:description"]')
                if og_desc:
                    og_content = og_desc.get('content', '')
                    cone_match = re.search(r'(Cone\s+0?6?\s*oxidation)\s*\(large photo\)', og_content, re.IGNORECASE)
                    if cone_match:
                        primary_cone_info = cone_match.group(1)
        
        # 1. Gallery images (multiple views)
        for img in soup.select('.woocommerce-product-gallery__image img, .flex-viewport img'):
            src = img.get('data-large_image') or img.get('data-src') or img.get('src', '')
            add_image(src, 'gallery', img)
        
        # 2. Main product image
        for img in soup.select('img.wp-post-image'):
            src = img.get('src', '') or img.get('data-src', '')
            add_image(src, 'product', img)
        
        # 3. Secondary gallery images (Cone 6, Cone 10, etc.)
        # These are in .product-gallery-images list items
        for li in soup.select('.product-gallery-images li, ul.product-gallery-images li'):
            img = li.select_one('img')
            if not img:
                continue
            src = img.get('src', '') or img.get('data-src', '')
            
            # Try to get alt from various sources
            alt = img.get('alt', '')
            if not alt:
                # Check data-caption on parent link
                link = li.select_one('a[data-caption]')
                if link:
                    alt = link.get('data-caption', '')
            if not alt:
                # Check subtitle
                subtitle = li.select_one('.wc-secondary-image-subtitle')
                if subtitle:
                    alt = subtitle.get_text(strip=True)
            
            img_data = {
                'url': src,
                'type': 'cone-variation',
            }
            if alt:
                img_data['alt'] = alt
            
            if src and src not in seen_urls:
                base_url = re.sub(r'-\d+x\d+\.', '.', src)
                if base_url not in seen_urls:
                    seen_urls.add(src)
                    seen_urls.add(base_url)
                    images.append(img_data)
        
        # 4. Variation images from JSON data
        variation_matches = re.findall(r'"full_src"\s*:\s*"([^"]+)"', html)
        for match in variation_matches:
            url = match.replace('\\/', '/')
            add_image(url, 'variation')
        
        # 5. Additional image URLs in srcset
        for img in soup.select('.woocommerce-product-gallery img'):
            srcset = img.get('srcset', '')
            if srcset:
                # Extract largest image from srcset
                for part in srcset.split(','):
                    url_part = part.strip().split(' ')[0]
                    if url_part and not re.search(r'-\d+x\d+\.', url_part):
                        add_image(url_part, 'srcset', img)
        
        # Add primary cone info to first image if it doesn't have alt
        if images and primary_cone_info and not images[0].get('alt'):
            images[0]['alt'] = primary_cone_info
        
        product['images'] = images
        
        # Get URL
        canonical = soup.select_one('link[rel="canonical"]')
        if canonical:
            product['url'] = canonical.get('href', '')
        else:
            product['url'] = f"https://www.maycocolors.com/product/{code.lower().replace('-', '-')}/"
        
        all_products.append(product)
    
    print(f"\nExtracted {len(all_products)} products from product pages")
    
    # Build final glazes list with proper images array
    glazes = []
    for p in all_products:
        code = p['code']
        
        # Build images array with local paths and original URLs
        images = []
        raw_images = p.get('images', [])
        
        # Primary image (first one or dedicated product image)
        primary_idx = 0
        for i, img in enumerate(raw_images):
            if img.get('type') == 'product':
                primary_idx = i
                break
        
        for i, img in enumerate(raw_images):
            img_entry = {
                'id': f"{code.lower()}-img-{i+1}",
                'localPath': f"/images/glazes/mayco/{code.lower()}-{i+1}.jpg" if i > 0 else f"/images/glazes/mayco/{code.lower()}.jpg",
                'originalUrl': img['url'],
                'type': img.get('type', 'unknown'),
                'isPrimary': i == primary_idx,
            }
            if 'alt' in img:
                img_entry['alt'] = img['alt']
            images.append(img_entry)
        
        # Fallback if no images found
        if not images:
            images = [{
                'id': f"{code.lower()}-img-1",
                'localPath': f"/images/glazes/mayco/{code.lower()}.jpg",
                'originalUrl': '',
                'type': 'unknown',
                'isPrimary': True,
            }]
        
        glaze = {
            'id': f"mayco-{code.lower()}",
            'brand': 'Mayco',
            'series': p['series'],
            'code': code,
            'name': p.get('name', ''),
            'displayName': f"{code} {p.get('name', '')}",
            'cone': p.get('cone', []),
            'tags': extract_tags(p.get('name', '') + ' ' + p.get('description', '')),
            'productUrl': p.get('url', ''),
            'images': images,
            'source': 'mayco',
            'description': p.get('description', '')
        }
        glazes.append(glaze)
    
    # Sort by code
    glazes.sort(key=lambda x: (x['series'], x['code']))
    
    # Save output
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'maycocolors.com (cached)',
        'totalCount': len(glazes),
        'glazes': glazes
    }
    
    output_file = os.path.join(OUTPUT_DIR, 'mayco-glazes.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Saved {len(glazes)} glazes to {output_file}")
    
    # Print stats
    series_counts = {}
    for g in glazes:
        series_counts[g['series']] = series_counts.get(g['series'], 0) + 1
    
    print("\nBy series:")
    for series, count in sorted(series_counts.items()):
        print(f"  {series}: {count}")
    
    # Check for specific codes
    target_codes = ['SC-45', 'SC-78', 'CG-964', 'SW-149']
    print("\nTarget glazes check:")
    for tc in target_codes:
        found = any(g['code'] == tc for g in glazes)
        print(f"  {tc}: {'✓' if found else '✗'}")

if __name__ == '__main__':
    main()
