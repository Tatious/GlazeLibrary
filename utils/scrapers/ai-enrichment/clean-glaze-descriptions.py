#!/usr/bin/env python3
"""
Clean Glaze Descriptions

Uses AI to clean up glaze descriptions:
- Remove mentions of dipping glazes
- Remove health warnings (Prop 65, etc.)
- Remove irrelevant technical info
- Keep only the artistic/visual description
"""

import json
import argparse
import re
from pathlib import Path
from datetime import datetime
from typing import Optional

from config import GLAZES_JSON, SCRIPT_DIR, OLLAMA_HOST, TEXT_MODEL
from ollama_client import OllamaClient

# Cache for cleaned descriptions
CLEAN_CACHE = SCRIPT_DIR / "cache" / "cleaned_descriptions"
CLEANED_GLAZES_OUTPUT = SCRIPT_DIR / "results" / "cleaned-glazes.json"


def clean_description_with_ai(client: OllamaClient, glaze: dict) -> Optional[str]:
    """Use AI to clean a glaze description."""
    
    original = glaze.get("description", "")
    if not original or len(original.strip()) < 10:
        return None
    
    prompt = f"""Clean up this ceramic glaze description. Extract ONLY the artistic/visual description.

The description may contain multiple sections concatenated together (e.g., "Cone 06 oxidation (larger image):... Cone 6 oxidation (smaller image):..."). These are image captions that got merged with the description. Extract the MAIN product description, not the image-specific notes.

REMOVE completely:
- Image caption prefixes like "Cone X oxidation (larger image):" or "Cone 6 oxidation (smaller image):"
- Duplicate descriptions for different cone temperatures (keep only the most complete one)
- Any mention of "dipping" glazes or dipping buckets
- Health warnings (Prop 65, California, cancer warnings)
- Dry-mix or powder information
- Technical application warnings about layering dipping glazes
- "&nbsp;" or HTML artifacts
- Weight information (like "10# DIPPING")
- URLs or website references
- Boilerplate about "variations in raw materials" or "batch numbers"
- Recommendations to fire test tiles before using new batches
- Firing instructions like "Glaze fire to Cone X" or temperature ranges
- Storage or shelf life information
- Mixing or stirring instructions
- Short notes about how the glaze changes at different cones (like "Color lightens to medium brown. Specks remain.")

KEEP:
- Color descriptions
- Surface finish descriptions (glossy, matte, etc.)
- Visual effects (pooling, breaking, crystalline, etc.)
- Artistic comparisons (like "ancient glazes")
- Opacity information (opaque, translucent)
- Application recommendations (coats needed for opacity)

Return ONLY the cleaned description as a single coherent paragraph, nothing else. If there's nothing meaningful left after cleaning, return "NO_DESCRIPTION".

Original description:
{original}

Cleaned description:"""

    try:
        response = client.generate_text(prompt, model=TEXT_MODEL, temperature=0.3)
        cleaned = response.strip()
        
        # Handle empty or placeholder responses
        if cleaned == "NO_DESCRIPTION" or len(cleaned) < 10:
            return None
        
        # Remove any quotes the AI might have added
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1]
        
        return cleaned
    except Exception as e:
        print(f"  Error cleaning description: {e}")
        return None


def clean_description_regex(description: str) -> str:
    """Fallback regex-based cleaning."""
    if not description:
        return ""
    
    # Remove common patterns
    patterns_to_remove = [
        r"Due to the powdered nature.*?brushing glazes\.",
        r"\*Note that all dry dipping glazes.*?full piece\.",
        r"&nbsp;",
        r"\d+# DIPPING WARNING:.*?P65Warnings\.ca\.gov\.",
        r"This product can expose you to chemicals.*?P65Warnings\.ca\.gov\.",
        r"For more information go to.*",
        r"WARNING:.*cancer\.",
        r"Due to variations in raw materials.*?batch number of glaze\.",
        r"Due to variations in raw materials.*?glaze\.",
        r"we recommend firing glazed test tiles.*?glaze\.",
        r"Glaze fire to Cone \d+(-\d+)?\s*\(\d+.*?°[FC]\)\.",
        r"Glaze fire to Cone \d+(-\d+)?\.",
        r"Apply \d+ even coats?.*?\.",
        r"Allow.*?to dry between coats?\.",
    ]
    
    result = description
    for pattern in patterns_to_remove:
        result = re.sub(pattern, "", result, flags=re.IGNORECASE | re.DOTALL)
    
    # Clean up whitespace
    result = re.sub(r'\n\s*\n', '\n', result)
    result = result.strip()
    
    return result


def main():
    parser = argparse.ArgumentParser(description="Clean glaze descriptions using AI")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--no-ai", action="store_true", help="Use regex only, no AI")
    parser.add_argument("--limit", type=int, help="Limit number of glazes to process")
    parser.add_argument("--force", action="store_true", help="Reprocess even if cached")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Cleaning Glaze Descriptions")
    print("=" * 60)
    
    # Load glazes
    if not GLAZES_JSON.exists():
        print(f"✗ Glazes file not found: {GLAZES_JSON}")
        return
    
    with open(GLAZES_JSON) as f:
        data = json.load(f)
    
    glazes = data.get("glazes", [])
    print(f"✓ Loaded {len(glazes)} glazes")
    
    # Initialize AI client if needed
    client = None
    if not args.no_ai:
        try:
            client = OllamaClient(OLLAMA_HOST)
            print(f"✓ Connected to Ollama at {OLLAMA_HOST}")
        except Exception as e:
            print(f"⚠ Could not connect to Ollama: {e}")
            print("  Falling back to regex-only mode")
            args.no_ai = True
    
    # Ensure cache directory exists
    CLEAN_CACHE.mkdir(parents=True, exist_ok=True)
    
    # Process glazes
    cleaned_count = 0
    skipped_count = 0
    
    glazes_to_process = glazes[:args.limit] if args.limit else glazes
    
    for i, glaze in enumerate(glazes_to_process):
        glaze_id = glaze["id"]
        original = glaze.get("description", "")
        
        # Skip if no description
        if not original or len(original.strip()) < 10:
            skipped_count += 1
            continue
        
        # Check cache
        cache_file = CLEAN_CACHE / f"{glaze_id}.json"
        if cache_file.exists() and not args.force:
            skipped_count += 1
            continue
        
        print(f"\n[{i+1}/{len(glazes_to_process)}] {glaze['displayName']}")
        
        # Clean the description
        if args.no_ai:
            cleaned = clean_description_regex(original)
        else:
            cleaned = clean_description_with_ai(client, glaze)
            if not cleaned:
                cleaned = clean_description_regex(original)
        
        if cleaned and cleaned != original:
            print(f"  Original: {original[:80]}...")
            print(f"  Cleaned:  {cleaned[:80]}...")
            
            # Cache the result
            if not args.dry_run:
                cache_data = {
                    "glazeId": glaze_id,
                    "originalDescription": original,
                    "cleanedDescription": cleaned,
                    "cleanedAt": datetime.now().isoformat(),
                    "method": "regex" if args.no_ai else "ai"
                }
                with open(cache_file, "w") as f:
                    json.dump(cache_data, f, indent=2)
            
            cleaned_count += 1
        else:
            print(f"  No changes needed")
            skipped_count += 1
    
    print(f"\n✓ Cleaned {cleaned_count} descriptions")
    print(f"✓ Skipped {skipped_count} (no change needed or cached)")
    
    if args.dry_run:
        print("\n[DRY RUN] No files were modified")
        return
    
    # Now merge cached cleanings into the glazes
    print("\n" + "=" * 60)
    print("Merging Cleaned Descriptions")
    print("=" * 60)
    
    cache_files = list(CLEAN_CACHE.glob("*.json"))
    print(f"✓ Found {len(cache_files)} cached cleaned descriptions")
    
    cache_by_id = {}
    for cache_file in cache_files:
        with open(cache_file) as f:
            cached = json.load(f)
        # Handle both old format (id) and new format (glazeId)
        glaze_id = cached.get("glazeId") or cached.get("id")
        if glaze_id:
            cache_by_id[glaze_id] = cached
    
    merged = 0
    for glaze in glazes:
        if glaze["id"] in cache_by_id:
            cached = cache_by_id[glaze["id"]]
            glaze["description"] = cached.get("cleanedDescription") or cached.get("cleaned", "")
            glaze["originalDescription"] = cached.get("originalDescription", "")
            merged += 1
    
    print(f"✓ Merged {merged} cleaned descriptions")
    
    # Save output
    CLEANED_GLAZES_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data["descriptionsCleanedAt"] = datetime.now().isoformat()
    
    with open(CLEANED_GLAZES_OUTPUT, "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Saved to {CLEANED_GLAZES_OUTPUT}")
    print(f"\nTo apply to main data file:")
    print(f"  cp {CLEANED_GLAZES_OUTPUT} {GLAZES_JSON}")


if __name__ == "__main__":
    main()
