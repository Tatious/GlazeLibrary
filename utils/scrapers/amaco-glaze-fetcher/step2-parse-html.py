#!/usr/bin/env python3
"""
Parse cached AMACO HTML files to extract glaze data with multiple images
Uses cached HTML to avoid network requests
"""

import os
import json
import re
import urllib.parse
from datetime import datetime
from bs4 import BeautifulSoup

CACHE_DIR = "html_cache"
OUTPUT_DIR = "results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Series patterns to detect
SERIES_PATTERNS = {
    'C-': ('(C) Celadon', ['5', '6']),
    'PC-': ("(PC) Potter's Choice", ['5', '6']),
    'PCF-': ("(PCF) Potter's Choice Flux", ['5', '6']),
    'SM-': ('(SM) Satin Matte', ['5', '6']),
    'SH-': ('(SH) Shino', ['5', '6']),
    'HF-': ('(HF) High Fire', ['5', '6', '10']),
    'CR-': ('(CR) Crawls', ['5', '6']),
    'CO-': ('(CO) Cosmos', ['5', '6']),
    'PG-': ('(PG) Phase Glazes', ['5', '6']),
    'KI-': ('(KI) Kiln Ice', ['5', '6']),
    'V-': ('(V) Velvet Underglaze', ['05', '6']),
}

def get_cached_files():
    """Get list of cached HTML files"""
    if not os.path.exists(CACHE_DIR):
        return []
    return [f for f in os.listdir(CACHE_DIR) if f.endswith('.html')]

def detect_series(code):
    """Detect series from product code"""
    code_upper = code.upper()
    for prefix, (series_name, cones) in SERIES_PATTERNS.items():
        if code_upper.startswith(prefix):
            return series_name, cones
    return 'Unknown', ['5', '6']

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

def main():
    print("\nAMACO Cached HTML Parser")
    print("=" * 60)
    
    cached_files = get_cached_files()
    print(f"Found {len(cached_files)} cached HTML files")
    
    # Parse all product pages
    glazes = []
    seen_codes = set()
    
    for filename in cached_files:
        filepath = os.path.join(CACHE_DIR, filename)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Check if this is a product page
        # AMACO structure: .product-view contains h1.h3 with product title
        # Also has img[data-main-image] for product image
        title_elem = soup.select_one('.product-view h1, .product-heading h1, h1.h3')
        if not title_elem:
            continue
        
        full_title = title_elem.get_text(strip=True)
        
        # Extract code from title (e.g., "C-01 Obsidian" -> "C-01")
        code_match = re.match(r'([A-Z]+-\d+)\s*(.*)', full_title)
        if not code_match:
            continue
        
        code = code_match.group(1)
        name = code_match.group(2).strip()
        
        if code in seen_codes:
            continue
        seen_codes.add(code)
        
        # Detect series
        series_name, cones = detect_series(code)
        
        # Collect images
        images = []
        seen_urls = set()
        
        def add_image(url, img_type, alt=''):
            if not url:
                return
            # Clean up URL first before checking duplicates
            if url.startswith('//'):
                url = 'https:' + url
            # Clean up URL - some have " }}" at end
            url = url.split(' ')[0].replace('}}', '').strip()
            # Check for duplicates AFTER cleaning
            if url in seen_urls:
                return
            # Skip tiny/icon images
            if any(x in url.lower() for x in ['stencil/10/', 'stencil/30/', 'icon', 'logo', 'nav', 'attribute_value']):
                return
            seen_urls.add(url)
            images.append({
                'url': url,
                'type': img_type,
                'alt': alt if alt else ''
            })
        
        # 1. Main product image (has data-main-image attribute)
        main_img = soup.select_one('img[data-main-image]')
        if main_img:
            src = main_img.get('src', '')
            alt = main_img.get('alt', '')
            add_image(src, 'primary', alt)
        
        # 2. Product images with matching code in filename
        for img in soup.select('img'):
            src = img.get('src', '') or img.get('data-src', '')
            alt = img.get('alt', '')
            if code.upper().replace('-', '_') in src.upper() or code.upper().replace('-', '-') in src.upper():
                if 'products/' in src and any(x in src for x in ['650x650', '500x500', '1280x1280']):
                    add_image(src, 'product', alt)
        
        # 3. Gallery thumbnails
        for img in soup.select('.productView-thumbnail img, .slick-slide img'):
            src = img.get('data-src') or img.get('src', '')
            alt = img.get('alt', '')
            add_image(src, 'gallery', alt)
        
        # Get canonical URL
        canonical = soup.select_one('link[rel="canonical"]')
        product_url = canonical.get('href', '') if canonical else f"https://shop.amaco.com/{code.lower()}/"
        
        # Get description - prefer JSON-LD data which is more detailed
        description = ''
        
        # Try JSON-LD description first (URL-encoded, more detailed)
        desc_match = re.search(r'"description"\s*:\s*"([^"]+)"', html)
        if desc_match:
            desc_raw = desc_match.group(1)
            try:
                description = urllib.parse.unquote(desc_raw)[:800]
            except:
                description = desc_raw[:800]
        
        # Fallback to HTML element
        if not description:
            desc_elem = soup.select_one('.productView-description, #tab-description')
            description = desc_elem.get_text(strip=True)[:500] if desc_elem else ''
        
        # Build images array
        code_clean = code.lower()
        image_entries = []
        
        # First image (index 0) should always be primary
        for i, img in enumerate(images):
            entry = {
                'id': f"{code_clean}-img-{i+1}",
                'localPath': f"/images/glazes/amaco/{code_clean}.jpg" if i == 0 else f"/images/glazes/amaco/{code_clean}-{i+1}.jpg",
                'originalUrl': img['url'],
                'type': img['type'],
                'isPrimary': i == 0,  # First image is always primary
            }
            if img.get('alt'):
                entry['alt'] = img['alt']
            image_entries.append(entry)
        
        # Fallback if no images
        if not image_entries:
            image_entries = [{
                'id': f"{code_clean}-img-1",
                'localPath': f"/images/glazes/amaco/{code_clean}.jpg",
                'originalUrl': '',
                'type': 'unknown',
                'isPrimary': True,
            }]
        
        # Extract tags
        tags = extract_tags(name + ' ' + description)
        
        glaze = {
            'id': f"amaco-{code_clean}",
            'brand': 'AMACO',
            'series': series_name,
            'code': code,
            'name': name,
            'displayName': f"{code} {name}",
            'cone': cones,
            'tags': tags,
            'productUrl': product_url,
            'images': image_entries,
            'source': 'amaco',
            'description': description
        }
        glazes.append(glaze)
    
    print(f"\nExtracted {len(glazes)} products from cached pages")
    
    # Sort by code
    glazes.sort(key=lambda x: (x['series'], x['code']))
    
    # Save output
    output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'shop.amaco.com (cached)',
        'totalCount': len(glazes),
        'glazes': glazes
    }
    
    output_file = os.path.join(OUTPUT_DIR, 'glazes.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Saved {len(glazes)} glazes to {output_file}")
    
    # Stats by series
    series_counts = {}
    for g in glazes:
        series_counts[g['series']] = series_counts.get(g['series'], 0) + 1
    
    print("\nBy series:")
    for series, count in sorted(series_counts.items()):
        print(f"  {series}: {count}")

if __name__ == '__main__':
    main()
