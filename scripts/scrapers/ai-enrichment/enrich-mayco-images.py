#!/usr/bin/env python3
"""
Enrich Mayco glaze images with structured metadata
Parses alt text and uses Ollama to fill gaps

Image types found on Mayco site:
- Primary image (Cone 06 oxidation, larger)
- Cone 6 oxidation (smaller)
- Cone 10 reduction
- Different clay bodies (Speckled White, Dark Clay, Speckled Brown)
- Different coat counts (1, 2, 3 coats)
- Combination shots (over/under other glazes)
"""

import os
import json
import re
import sys
from datetime import datetime

# Add parent dir for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ollama_client import OllamaClient
from config import TEXT_MODEL

INPUT_FILE = "../mayco-glaze-fetcher/results/mayco-glazes.json"
OUTPUT_FILE = "results/enriched-mayco-images.json"
CACHE_DIR = "cache/mayco_images"

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs("results", exist_ok=True)


def parse_alt_text(alt_text: str) -> dict:
    """
    Parse structured data from image alt text.
    Returns dict with: cone, atmosphere, clay_body, coats, combo_type, combo_glaze
    """
    if not alt_text:
        return {}
    
    result = {}
    text = alt_text.lower().strip()
    
    # Extract cone temperature
    cone_match = re.search(r'cone\s*(\d+)', text)
    if cone_match:
        result['cone'] = cone_match.group(1)
    
    # Extract atmosphere (oxidation/reduction)
    if 'reduction' in text:
        result['atmosphere'] = 'reduction'
    elif 'oxidation' in text:
        result['atmosphere'] = 'oxidation'
    
    # Extract clay body
    clay_bodies = {
        'speckled white': 'speckled-white',
        'speckled brown': 'speckled-brown', 
        'dark clay': 'dark',
        'white clay': 'white',
        'buff': 'buff',
        'red clay': 'red',
        'porcelain': 'porcelain',
        'stoneware': 'stoneware',
    }
    for name, slug in clay_bodies.items():
        if name in text:
            result['clay_body'] = slug
            break
    
    # Extract coat count
    coat_match = re.search(r'(\d+)\s*coats?', text)
    if coat_match:
        result['coats'] = int(coat_match.group(1))
    
    # Check for combination shots
    if 'over ' in text or 'under ' in text:
        if 'over ' in text:
            result['combo_type'] = 'over'
            # Try to extract the other glaze
            over_match = re.search(r'over\s+([A-Z]{2,3}-\d+|[^,\(\)]+)', text, re.IGNORECASE)
            if over_match:
                result['combo_glaze'] = over_match.group(1).strip()
        elif 'under ' in text:
            result['combo_type'] = 'under'
            under_match = re.search(r'under\s+([A-Z]{2,3}-\d+|[^,\(\)]+)', text, re.IGNORECASE)
            if under_match:
                result['combo_glaze'] = under_match.group(1).strip()
    
    return result


def infer_primary_image_metadata(glaze: dict, image_index: int) -> dict:
    """
    Infer metadata for primary image based on glaze series.
    Primary images (index 0) are typically Cone 06 oxidation for most series.
    """
    series = glaze.get('series', '')
    code = glaze.get('code', '')
    
    # Stoneware (SW) is typically Cone 5-6
    if code.startswith('SW'):
        return {
            'cone': '6',
            'atmosphere': 'oxidation',
            'is_primary': True,
        }
    
    # Stroke & Coat (SC) and Speckled (SP) are typically Cone 06
    if code.startswith('SC') or code.startswith('SP'):
        return {
            'cone': '06',
            'atmosphere': 'oxidation', 
            'is_primary': True,
        }
    
    # Jungle Gems (CG) are typically Cone 06
    if code.startswith('CG'):
        return {
            'cone': '06',
            'atmosphere': 'oxidation',
            'is_primary': True,
        }
    
    return {'is_primary': image_index == 0}


def enrich_image_with_ollama(client: OllamaClient, glaze: dict, image: dict, parsed: dict) -> dict:
    """
    Use Ollama to fill in missing metadata or clarify ambiguous alt text.
    """
    alt_text = image.get('alt', '')
    
    # Skip if we already have good metadata
    if parsed.get('cone') and parsed.get('atmosphere'):
        return parsed
    
    # Skip if no alt text to work with
    if not alt_text or alt_text == 'no alt':
        return parsed
    
    prompt = f"""Analyze this ceramic glaze image description and extract structured data.

Glaze: {glaze.get('name', '')} ({glaze.get('code', '')})
Series: {glaze.get('series', '')}
Image alt text: "{alt_text}"

Extract the following if mentioned:
- cone: The firing cone (e.g., "06", "6", "10")
- atmosphere: "oxidation" or "reduction"
- clay_body: Type of clay (e.g., "speckled-white", "dark", "porcelain")
- coats: Number of coats applied (integer)
- combo_type: If this shows a glaze combination, is this glaze "over" or "under" another?
- combo_glaze: The other glaze in the combination

Respond with ONLY a JSON object, no explanation. If a field cannot be determined, omit it.
Example: {{"cone": "6", "atmosphere": "oxidation", "clay_body": "speckled-white"}}
"""
    
    cache_key = f"{glaze['code']}_{hash(alt_text)}"
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
    
    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            return json.load(f)
    
    try:
        response = client.generate(prompt)
        # Parse JSON from response
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            enriched = json.loads(json_match.group())
            # Merge with parsed data (parsed takes precedence)
            result = {**enriched, **parsed}
            
            # Cache result
            with open(cache_file, 'w') as f:
                json.dump(result, f)
            
            return result
    except Exception as e:
        print(f"  Ollama error: {e}")
    
    return parsed


def process_glaze(glaze: dict, client: OllamaClient, use_ollama: bool = False) -> dict:
    """Process a single glaze and enrich its image metadata."""
    images = glaze.get('images', [])
    enriched_images = []
    
    for i, image in enumerate(images):
        alt_text = image.get('alt', '')
        
        # First, parse the alt text
        parsed = parse_alt_text(alt_text)
        
        # For primary image, infer from series if no alt text
        if i == 0 and not parsed:
            parsed = infer_primary_image_metadata(glaze, i)
        
        # Optionally use Ollama for ambiguous cases
        if use_ollama and alt_text and not (parsed.get('cone') and parsed.get('atmosphere')):
            parsed = enrich_image_with_ollama(client, glaze, image, parsed)
        
        # Build enriched image entry
        enriched_image = {
            'url': image.get('url', ''),
            'localPath': image.get('localPath', ''),
            'originalAlt': alt_text,
            **parsed,
        }
        
        # Add image type classification
        if i == 0:
            enriched_image['imageType'] = 'primary'
        elif parsed.get('combo_type'):
            enriched_image['imageType'] = 'combination'
        elif parsed.get('cone'):
            enriched_image['imageType'] = 'cone-variation'
        elif parsed.get('clay_body'):
            enriched_image['imageType'] = 'clay-variation'
        elif parsed.get('coats'):
            enriched_image['imageType'] = 'coat-variation'
        else:
            enriched_image['imageType'] = 'variation'
        
        enriched_images.append(enriched_image)
    
    return {
        **glaze,
        'images': enriched_images,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Enrich Mayco glaze images with metadata')
    parser.add_argument('--use-ollama', action='store_true', help='Use Ollama for ambiguous cases')
    parser.add_argument('--limit', type=int, help='Limit number of glazes to process')
    args = parser.parse_args()
    
    print("=" * 60)
    print("Mayco Image Enrichment Pipeline")
    print("=" * 60)
    
    # Load input
    input_path = os.path.join(os.path.dirname(__file__), INPUT_FILE)
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    glazes = data.get('glazes', [])
    print(f"Loaded {len(glazes)} glazes")
    
    if args.limit:
        glazes = glazes[:args.limit]
        print(f"Processing {len(glazes)} glazes (limited)")
    
    # Initialize Ollama client if needed
    client = None
    if args.use_ollama:
        client = OllamaClient(model=TEXT_MODEL)
        print(f"Using Ollama model: {TEXT_MODEL}")
    
    # Process glazes
    enriched_glazes = []
    stats = {
        'total_images': 0,
        'with_cone': 0,
        'with_atmosphere': 0,
        'with_clay_body': 0,
        'combinations': 0,
        'by_type': {},
    }
    
    for i, glaze in enumerate(glazes):
        if (i + 1) % 50 == 0:
            print(f"  Processing {i + 1}/{len(glazes)}...")
        
        enriched = process_glaze(glaze, client, args.use_ollama)
        enriched_glazes.append(enriched)
        
        # Collect stats
        for img in enriched.get('images', []):
            stats['total_images'] += 1
            if img.get('cone'):
                stats['with_cone'] += 1
            if img.get('atmosphere'):
                stats['with_atmosphere'] += 1
            if img.get('clay_body'):
                stats['with_clay_body'] += 1
            if img.get('combo_type'):
                stats['combinations'] += 1
            
            img_type = img.get('imageType', 'unknown')
            stats['by_type'][img_type] = stats['by_type'].get(img_type, 0) + 1
    
    # Save output
    output_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    output_data = {
        'metadata': {
            'source': 'mayco-glaze-fetcher',
            'enrichedAt': datetime.now().isoformat(),
            'glazeCount': len(enriched_glazes),
            'imageCount': stats['total_images'],
            'usedOllama': args.use_ollama,
        },
        'glazes': enriched_glazes,
    }
    
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"\n✓ Saved {len(enriched_glazes)} enriched glazes to {OUTPUT_FILE}")
    
    # Print stats
    print("\n" + "=" * 40)
    print("Enrichment Statistics")
    print("=" * 40)
    print(f"Total images: {stats['total_images']}")
    print(f"With cone info: {stats['with_cone']} ({100*stats['with_cone']//stats['total_images']}%)")
    print(f"With atmosphere: {stats['with_atmosphere']} ({100*stats['with_atmosphere']//stats['total_images']}%)")
    print(f"With clay body: {stats['with_clay_body']} ({100*stats['with_clay_body']//stats['total_images']}%)")
    print(f"Combination shots: {stats['combinations']}")
    
    print("\nBy image type:")
    for img_type, count in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
        print(f"  {img_type}: {count}")


if __name__ == "__main__":
    main()
