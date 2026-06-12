"""
Data Transformer for Glaze Library
Converts scraped Amaco data to unified format for the React app.

Outputs:
- glazes.json - All individual glazes extracted from combinations
- combinations.json - All glaze combinations with metadata
- my-glazes.json - Template admin config file

Also copies photos to the app's public folder.
"""

import json
import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime


# =============================================================================
# CONFIGURATION
# =============================================================================

# Paths relative to this script's location
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Input paths
COMBO_DATA_DIR = PROJECT_ROOT / "fetch glaze combo photos" / "results"
COMBO_HTML_DIR = PROJECT_ROOT / "fetch glaze combo html" / "results"

# Output paths
APP_DIR = PROJECT_ROOT / "app" / "glaze-viewer"
PUBLIC_DIR = APP_DIR / "public"
DATA_OUTPUT_DIR = PUBLIC_DIR / "data"
PHOTOS_OUTPUT_DIR = PUBLIC_DIR / "photos" / "combinations"
ADMIN_CONFIG_DIR = APP_DIR / "src" / "config"


# =============================================================================
# AMACO GLAZE SERIES DETECTION
# =============================================================================

AMACO_SERIES_PATTERNS = {
    'C-': ('Celadon', 'AMACO'),
    'PC-': ("Potter's Choice", 'AMACO'),
    'HF-': ('High Fire', 'AMACO'),
    'SH-': ('Shino', 'AMACO'),
    'SM-': ('Satin Matte', 'AMACO'),
    'TH-': ('Texturizer High Fire', 'AMACO'),
    'TL-': ('Texturizer Low Fire', 'AMACO'),
    'V-': ('Velvet Underglaze', 'AMACO'),
    'O-': ('Opalescent', 'AMACO'),
}


def parse_glaze_code(display_name: str) -> Tuple[str, str, str, str]:
    """
    Parse a glaze display name like "PC-30 Temmoku" into components.
    Returns: (code, name, series, brand)
    """
    display_name = display_name.strip()
    
    # Try to match known series patterns
    for prefix, (series, brand) in AMACO_SERIES_PATTERNS.items():
        if display_name.upper().startswith(prefix.upper()):
            # Extract code and name
            match = re.match(r'^([A-Za-z]+-\d+[A-Za-z]?)\s*(.*)$', display_name, re.IGNORECASE)
            if match:
                code = match.group(1).upper()
                name = match.group(2).strip()
                return code, name, series, brand
    
    # Fallback: treat entire string as name
    return '', display_name, 'Unknown', 'Unknown'


def generate_glaze_id(display_name: str, source: str = 'amaco') -> str:
    """Generate a unique ID for a glaze."""
    code, name, _, _ = parse_glaze_code(display_name)
    
    # Normalize to create ID
    if code:
        normalized = code.lower().replace(' ', '-')
    else:
        normalized = re.sub(r'[^a-z0-9]+', '-', display_name.lower()).strip('-')
    
    return f"{source}-{normalized}"


def generate_combination_id(top_glaze: str, bottom_glaze: str, source: str = 'amaco') -> str:
    """Generate a unique ID for a combination."""
    top_code, _, _, _ = parse_glaze_code(top_glaze)
    bottom_code, _, _, _ = parse_glaze_code(bottom_glaze)
    
    top_normalized = top_code.lower().replace(' ', '-') if top_code else re.sub(r'[^a-z0-9]+', '-', top_glaze.lower()).strip('-')
    bottom_normalized = bottom_code.lower().replace(' ', '-') if bottom_code else re.sub(r'[^a-z0-9]+', '-', bottom_glaze.lower()).strip('-')
    
    return f"{source}-{top_normalized}-over-{bottom_normalized}"


# =============================================================================
# DATA EXTRACTION
# =============================================================================

def extract_glazes_from_combinations(combinations_data: List[dict]) -> Dict[str, dict]:
    """
    Extract unique glazes from combination data.
    Returns a dict of glaze_id -> glaze object.
    """
    glazes: Dict[str, dict] = {}
    
    for combo in combinations_data:
        for glaze_name in [combo.get('top_coat_glaze', ''), combo.get('bottom_coat_glaze', '')]:
            if not glaze_name:
                continue
                
            glaze_id = generate_glaze_id(glaze_name)
            
            if glaze_id not in glazes:
                code, name, series, brand = parse_glaze_code(glaze_name)
                
                # Determine cone range from the series
                cone = ['5', '6']  # Default for most AMACO high-fire
                if series in ['Texturizer Low Fire', 'Opalescent']:
                    cone = ['06', '05']
                elif 'Underglaze' in series:
                    cone = ['06', '6']  # Wide range for underglazes
                
                glazes[glaze_id] = {
                    'id': glaze_id,
                    'brand': brand,
                    'series': series,
                    'code': code,
                    'name': name,
                    'displayName': glaze_name.strip(),
                    'cone': cone,
                    'tags': generate_glaze_tags(code, name, series),
                    'source': 'amaco',
                }
    
    return glazes


def generate_glaze_tags(code: str, name: str, series: str) -> List[str]:
    """Generate searchable tags for a glaze based on its name and series."""
    tags = []
    name_lower = name.lower()
    
    # Color-based tags
    color_keywords = {
        'blue': ['blue', 'cobalt', 'indigo', 'sapphire', 'turquoise', 'aqua', 'arctic', 'sky', 'lagoon'],
        'green': ['green', 'jade', 'emerald', 'sage', 'celadon', 'seaweed', 'rainforest', 'olive', 'wasabi', 'pear', 'matcha'],
        'brown': ['brown', 'temmoku', 'oatmeal', 'sepia', 'sienna', 'albany', 'ochre', 'cacao', 'chai', 'oolong'],
        'red': ['red', 'firebrick', 'copper', 'merlot', 'tuscany', 'poppy', 'hibiscus', 'cherry'],
        'purple': ['purple', 'plum', 'mulberry', 'lavender', 'acai'],
        'yellow': ['yellow', 'marigold', 'amber', 'gold', 'honey', 'tangelo', 'snapdragon'],
        'black': ['black', 'obsidian', 'charcoal', 'iron', 'midnight'],
        'white': ['white', 'snow', 'glacier', 'ice', 'fog', 'clear'],
        'gray': ['gray', 'grey', 'smoke', 'storm', 'river rock', 'downpour'],
    }
    
    for color, keywords in color_keywords.items():
        if any(kw in name_lower for kw in keywords):
            tags.append(color)
    
    # Texture/effect tags
    effect_keywords = {
        'speckle': ['speckle', 'speck'],
        'textured': ['textured', 'texture'],
        'metallic': ['metallic', 'lustre', 'luster', 'gold', 'copper', 'iron'],
        'matte': ['matte', 'satin'],
        'gloss': ['gloss', 'glossy'],
        'crystal': ['crystal', 'aventurine'],
        'float': ['float'],
        'flux': ['flux'],
    }
    
    for effect, keywords in effect_keywords.items():
        if any(kw in name_lower for kw in keywords):
            tags.append(effect)
    
    # Series-based tags
    series_lower = series.lower()
    if 'shino' in series_lower:
        tags.append('shino')
    if 'celadon' in series_lower:
        tags.append('celadon')
    if 'underglaze' in series_lower:
        tags.append('underglaze')
    
    return list(set(tags))


def transform_combination(
    raw_data: dict,
    photo_filename: Optional[str],
    glazes: Dict[str, dict]
) -> dict:
    """Transform raw scraped combination data to unified format."""
    
    top_glaze_name = raw_data.get('top_coat_glaze', '').strip()
    bottom_glaze_name = raw_data.get('bottom_coat_glaze', '').strip()
    
    top_glaze_id = generate_glaze_id(top_glaze_name)
    bottom_glaze_id = generate_glaze_id(bottom_glaze_name)
    
    combo_id = generate_combination_id(top_glaze_name, bottom_glaze_name)
    
    # Parse coat counts
    try:
        top_coats = int(raw_data.get('number_of_top_coats', '2'))
    except (ValueError, TypeError):
        top_coats = 2
    
    try:
        bottom_coats = int(raw_data.get('number_of_bottom_coats', '2'))
    except (ValueError, TypeError):
        bottom_coats = 2
    
    # Clay body
    clay_body = raw_data.get('clay_type', 'N/A')
    if clay_body in ['N/A', '', None]:
        clay_body = None
    
    # Photos
    photos = []
    if photo_filename:
        photos.append({
            'id': f"{combo_id}-photo-1",
            'url': f"/photos/combinations/{photo_filename}",
            'isCover': True,
            'submittedBy': raw_data.get('submitted_by', 'Unknown'),
        })
    
    # Generate tags from both glazes
    combo_tags = set()
    if top_glaze_id in glazes:
        combo_tags.update(glazes[top_glaze_id].get('tags', []))
    if bottom_glaze_id in glazes:
        combo_tags.update(glazes[bottom_glaze_id].get('tags', []))
    
    return {
        'id': combo_id,
        'source': 'amaco',
        'displayName': raw_data.get('glaze_name', f"{top_glaze_name} over {bottom_glaze_name}"),
        'topGlaze': {
            'glazeId': top_glaze_id,
            'displayName': top_glaze_name,
            'coats': top_coats,
        },
        'bottomGlaze': {
            'glazeId': bottom_glaze_id,
            'displayName': bottom_glaze_name,
            'coats': bottom_coats,
        },
        'clayBody': clay_body,
        'cone': raw_data.get('temperature_cone', '6'),
        'submittedBy': raw_data.get('submitted_by', 'Unknown'),
        'isOfficial': raw_data.get('is_official', False),
        'photos': photos,
        'tags': list(combo_tags),
    }


# =============================================================================
# MAIN PROCESSING
# =============================================================================

def process_amaco_data():
    """Process all Amaco scraped data and output unified format."""
    
    print("=" * 60)
    print("Glaze Data Transformer")
    print("=" * 60)
    
    # Ensure output directories exist
    DATA_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PHOTOS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ADMIN_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Find all JSON data files
    data_files = list(COMBO_DATA_DIR.glob("*-data.json"))
    print(f"\nFound {len(data_files)} combination data files")
    
    # First pass: collect all raw data
    raw_combinations = []
    photo_mapping = {}  # combo base name -> photo filename
    
    for data_file in data_files:
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            # Find corresponding photo
            base_name = data_file.stem.replace('-data', '')
            photo_file = None
            
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                potential_photo = COMBO_DATA_DIR / f"{base_name}-photo{ext}"
                if potential_photo.exists():
                    photo_file = potential_photo
                    break
            
            raw_combinations.append({
                'data': raw_data,
                'base_name': base_name,
                'photo_file': photo_file,
            })
            
        except Exception as e:
            print(f"  Error reading {data_file.name}: {e}")
    
    print(f"Loaded {len(raw_combinations)} combinations")
    
    # Extract all unique glazes
    print("\nExtracting unique glazes...")
    glazes = extract_glazes_from_combinations([c['data'] for c in raw_combinations])
    print(f"Found {len(glazes)} unique glazes")
    
    # Transform combinations and copy photos
    print("\nTransforming combinations and copying photos...")
    combinations = []
    photos_copied = 0
    
    for combo_raw in raw_combinations:
        photo_filename = None
        
        # Copy photo if it exists
        if combo_raw['photo_file']:
            photo_filename = combo_raw['photo_file'].name.replace('-photo', '')
            dest_path = PHOTOS_OUTPUT_DIR / photo_filename
            
            if not dest_path.exists():
                shutil.copy2(combo_raw['photo_file'], dest_path)
                photos_copied += 1
            
            photo_filename = photo_filename  # Use just the filename
        
        # Transform the combination
        transformed = transform_combination(
            combo_raw['data'],
            photo_filename,
            glazes
        )
        combinations.append(transformed)
    
    print(f"Copied {photos_copied} photos to public folder")
    
    # Sort outputs
    glazes_list = sorted(glazes.values(), key=lambda g: g['displayName'])
    combinations = sorted(combinations, key=lambda c: c['displayName'])
    
    # Write glazes.json
    glazes_output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'amaco',
        'totalCount': len(glazes_list),
        'glazes': glazes_list,
    }
    
    glazes_path = DATA_OUTPUT_DIR / 'glazes.json'
    with open(glazes_path, 'w', encoding='utf-8') as f:
        json.dump(glazes_output, f, indent=2)
    print(f"\nWrote {glazes_path}")
    
    # Write combinations.json
    combinations_output = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'source': 'amaco',
        'totalCount': len(combinations),
        'combinations': combinations,
    }
    
    combos_path = DATA_OUTPUT_DIR / 'combinations.json'
    with open(combos_path, 'w', encoding='utf-8') as f:
        json.dump(combinations_output, f, indent=2)
    print(f"Wrote {combos_path}")
    
    # Write my-glazes.json template (admin config)
    my_glazes_template = {
        'version': '1.0',
        'lastUpdated': datetime.now().isoformat(),
        'ownedGlazes': [],
        'favoriteGlazes': [],
        'notes': {},
    }
    
    my_glazes_path = ADMIN_CONFIG_DIR / 'my-glazes.json'
    if not my_glazes_path.exists():
        with open(my_glazes_path, 'w', encoding='utf-8') as f:
            json.dump(my_glazes_template, f, indent=2)
        print(f"Wrote {my_glazes_path} (template)")
    else:
        print(f"Skipped {my_glazes_path} (already exists)")
    
    # Write all-glazes-reference.json (for easy admin editing)
    all_glazes_ref = {
        'description': 'Reference file listing all glaze IDs for use in my-glazes.json',
        'lastUpdated': datetime.now().isoformat(),
        'glazes': [
            {
                'id': g['id'],
                'displayName': g['displayName'],
                'series': g['series'],
            }
            for g in glazes_list
        ]
    }
    
    ref_path = ADMIN_CONFIG_DIR / 'all-glazes-reference.json'
    with open(ref_path, 'w', encoding='utf-8') as f:
        json.dump(all_glazes_ref, f, indent=2)
    print(f"Wrote {ref_path}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Glazes:       {len(glazes_list)}")
    print(f"Combinations: {len(combinations)}")
    print(f"Photos:       {photos_copied} copied")
    print(f"\nOutput files:")
    print(f"  {glazes_path}")
    print(f"  {combos_path}")
    print(f"  {my_glazes_path}")
    print(f"  {ref_path}")
    print(f"  {PHOTOS_OUTPUT_DIR}/")


if __name__ == '__main__':
    process_amaco_data()
