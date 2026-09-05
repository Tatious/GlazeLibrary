#!/usr/bin/env python3
"""
Clean SPS Glaze Descriptions using Ollama

Reads from sps-glaze-fetcher/results/sps-glazes.json
Outputs cleaned descriptions to cache/cleaned_descriptions/sps-{code}.json
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import SCRIPT_DIR, OLLAMA_HOST, TEXT_MODEL
from ollama_client import OllamaClient

# Paths
SPS_GLAZES = SCRIPT_DIR.parent / "sps-glaze-fetcher" / "results" / "sps-glazes.json"
CLEAN_CACHE = SCRIPT_DIR / "cache" / "cleaned_descriptions"


def clean_sps_description(client: OllamaClient, glaze: dict) -> str:
    """Use AI to clean an SPS glaze description."""
    
    original = glaze.get("description", "")
    name = glaze.get("displayName", glaze.get("name", ""))
    
    if not original or len(original.strip()) < 10:
        return ""
    
    prompt = f"""Clean up this Seattle Pottery Supply glaze description. Extract ONLY the visual/artistic description.

REMOVE completely:
- "For CONE X - Y" or any cone/temperature info
- "For a more in-depth how-to, check out Pottery Glazing Techniques"
- Any URLs or website references
- Application instructions
- Firing instructions
- Product name at the start if it repeats (e.g., "SP50 - Moss Brown")
- HTML artifacts like "&nbsp;"

KEEP:
- Color descriptions  
- Surface finish (glossy, matte, satin, etc.)
- Visual effects (mottled, speckled, crystalline, pooling, etc.)
- Opacity (opaque, translucent, etc.)

Return ONLY the cleaned description as a single sentence or short paragraph. If there's nothing meaningful, return "NO_DESCRIPTION".

Glaze: {name}
Original: {original}

Cleaned:"""

    try:
        response = client.generate_text(prompt, model=TEXT_MODEL, temperature=0.2)
        cleaned = response.strip()
        
        if cleaned == "NO_DESCRIPTION" or len(cleaned) < 5:
            return ""
        
        # Remove quotes if present
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1]
        
        return cleaned
    except Exception as e:
        print(f"  Error: {e}")
        return ""


def main():
    print("=" * 60)
    print("Cleaning SPS Glaze Descriptions with Ollama")
    print("=" * 60)
    
    # Load SPS glazes
    if not SPS_GLAZES.exists():
        print(f"✗ SPS glazes not found: {SPS_GLAZES}")
        return
    
    with open(SPS_GLAZES) as f:
        data = json.load(f)
    
    glazes = data.get("glazes", [])
    print(f"✓ Loaded {len(glazes)} SPS glazes")
    
    # Connect to Ollama
    try:
        client = OllamaClient(OLLAMA_HOST)
        print(f"✓ Connected to Ollama at {OLLAMA_HOST}")
    except Exception as e:
        print(f"✗ Could not connect to Ollama: {e}")
        return
    
    # Ensure cache directory exists
    CLEAN_CACHE.mkdir(parents=True, exist_ok=True)
    
    # Process each glaze
    cleaned_count = 0
    skipped_count = 0
    
    for i, glaze in enumerate(glazes):
        glaze_id = f"sps-{glaze['code'].lower()}"
        cache_file = CLEAN_CACHE / f"{glaze_id}.json"
        
        # Check cache
        if cache_file.exists():
            skipped_count += 1
            continue
        
        print(f"[{i+1}/{len(glazes)}] {glaze['displayName']}...")
        
        original = glaze.get("description", "")
        if not original or len(original.strip()) < 10:
            print("  (no description)")
            continue
        
        # Clean with AI
        cleaned = clean_sps_description(client, glaze)
        
        if cleaned:
            # Save to cache
            cache_data = {
                "id": glaze_id,
                "original": original,
                "cleaned": cleaned,
                "timestamp": datetime.now().isoformat()
            }
            with open(cache_file, "w") as f:
                json.dump(cache_data, f, indent=2)
            
            print(f"  ✓ {cleaned[:60]}...")
            cleaned_count += 1
        else:
            print("  (no meaningful description)")
    
    print()
    print(f"✓ Cleaned: {cleaned_count}")
    print(f"✓ Skipped (cached): {skipped_count}")
    print(f"\nRun 'python3 combine-glazes.py' to apply cleaned descriptions")


if __name__ == "__main__":
    main()
