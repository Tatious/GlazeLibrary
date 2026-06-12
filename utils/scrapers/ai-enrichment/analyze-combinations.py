#!/usr/bin/env python3
"""
Analyze Combinations

Uses vision AI to analyze glaze combination images and extract:
- Colors (pottery-specific terms)
- Visual effects (crystalline, flowing, etc.)
- Style tags (earthy, dramatic, etc.)
- Clay body detection
- Brief description

Outputs cached JSON files for each combination that can be merged later.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
import time

from config import (
    COMBINATIONS_JSON, COMBO_CACHE,
    AMACO_COMBO_IMAGES, MAYCO_COMBO_IMAGES,
    COMBINATION_VISUAL_PROMPT, CLAY_BODY_PROMPT,
    ensure_directories
)
from ollama_client import OllamaClient


def format_time(seconds: float) -> str:
    """Format seconds into human-readable time"""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        mins = seconds / 60
        return f"{mins:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"


def get_cached_analysis(combo_id: str) -> Optional[dict]:
    """Load cached analysis for a combination"""
    cache_file = COMBO_CACHE / f"{combo_id}.json"
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)
    return None


def save_analysis(combo_id: str, analysis: dict):
    """Save analysis to cache"""
    cache_file = COMBO_CACHE / f"{combo_id}.json"
    analysis["analyzedAt"] = datetime.now().isoformat()
    with open(cache_file, "w") as f:
        json.dump(analysis, f, indent=2)


def find_combination_image(combo: dict) -> Optional[Path]:
    """Find the cover image for a combination"""
    combo_id = combo.get("id", "")
    
    # Determine the image directory based on combo ID
    if combo_id.startswith("amaco"):
        image_dir = AMACO_COMBO_IMAGES
    elif combo_id.startswith("mayco"):
        image_dir = MAYCO_COMBO_IMAGES
    else:
        return None
    
    # Get all photos from entries
    all_photos = []
    for entry in combo.get("entries", []):
        all_photos.extend(entry.get("photos", []))
    
    if not all_photos:
        # No photos in data, try to find by combo ID pattern
        return _find_image_by_combo_id(combo_id, image_dir)
    
    # Find cover photo or first photo
    cover = next((p for p in all_photos if p.get("isCover")), all_photos[0])
    url = cover.get("url", "")
    
    if not url:
        return _find_image_by_combo_id(combo_id, image_dir)
    
    # Try exact path match for local URLs
    if url.startswith("/images/combinations/amaco/"):
        local_path = AMACO_COMBO_IMAGES / url.replace("/images/combinations/amaco/", "")
        if local_path.exists():
            return local_path
    elif url.startswith("/images/combinations/mayco/"):
        local_path = MAYCO_COMBO_IMAGES / url.replace("/images/combinations/mayco/", "")
        if local_path.exists():
            return local_path
    
    # Try extracting filename from URL (handles external URLs)
    filename = url.split("/")[-1]
    local_path = image_dir / filename
    if local_path.exists():
        return local_path
    
    # Fall back to searching by combo ID pattern
    return _find_image_by_combo_id(combo_id, image_dir)


def _find_image_by_combo_id(combo_id: str, image_dir: Path) -> Optional[Path]:
    """Find an image file that matches the combo ID pattern"""
    if not image_dir.exists():
        return None
    
    # Look for files starting with the combo ID
    # Files are named like: mayco-sw-402-over-sw-122-mayco-sw-402-over-sw-122-cone10.jpg
    pattern = f"{combo_id}*"
    matches = list(image_dir.glob(pattern))
    
    if matches:
        # Prefer .jpg files, then any image
        for ext in ['.jpg', '.jpeg', '.png', '.webp']:
            for m in matches:
                if m.suffix.lower() == ext:
                    return m
        return matches[0]
    
    return None


def analyze_combination_image(client: OllamaClient, image_path: Path, top_glaze: str = "", bottom_glaze: str = "") -> Optional[dict]:
    """Analyze combination image for visual characteristics"""
    try:
        # Prompt no longer uses glaze names (avoids biasing the model)
        response = client.analyze_image(image_path, COMBINATION_VISUAL_PROMPT)
        return client.parse_json_response(response)
    except Exception as e:
        print(f"    ✗ Visual analysis error: {e}")
        return None


def analyze_clay_body(client: OllamaClient, image_path: Path) -> Optional[dict]:
    """Specifically analyze for clay body identification"""
    try:
        response = client.analyze_image(image_path, CLAY_BODY_PROMPT)
        return client.parse_json_response(response)
    except Exception as e:
        print(f"    ✗ Clay body analysis error: {e}")
        return None


def analyze_combinations(
    limit: int = None,
    skip_cached: bool = True,
    detect_clay: bool = True,
    source: str = None
):
    """Main function to analyze all combinations"""
    ensure_directories()
    
    print("\n" + "=" * 60)
    print("Combination Visual Analysis with Ollama")
    print("=" * 60)
    
    # Connect to Ollama
    client = OllamaClient()
    if not client.is_available():
        print("✗ Cannot connect to Ollama. Check config.py OLLAMA_HOST setting.")
        return
    
    print(f"✓ Connected to Ollama at {client.host}")
    
    # Load combinations
    if not COMBINATIONS_JSON.exists():
        print(f"✗ Combinations file not found: {COMBINATIONS_JSON}")
        return
    
    with open(COMBINATIONS_JSON) as f:
        data = json.load(f)
    
    combinations = data.get("combinations", [])
    print(f"✓ Loaded {len(combinations)} combinations")
    
    # Filter by source if specified
    if source:
        source = source.lower()
        combinations = [c for c in combinations if source in c.get("id", "").lower()]
        print(f"  Filtered to {len(combinations)} combinations from {source}")
    
    # Filter out already cached
    if skip_cached:
        to_analyze = [c for c in combinations if not get_cached_analysis(c["id"])]
        print(f"  {len(combinations) - len(to_analyze)} already cached, {len(to_analyze)} to analyze")
    else:
        to_analyze = combinations
    
    # Apply limit
    if limit:
        to_analyze = to_analyze[:limit]
        print(f"  Limited to {limit} combinations")
    
    print(f"\nAnalyzing {len(to_analyze)} combinations...")
    
    analyzed = 0
    no_image = 0
    errors = 0
    start_time = time.time()
    
    for i, combo in enumerate(to_analyze, 1):
        combo_id = combo["id"]
        top = combo.get("topGlaze", {}).get("displayName", "?")
        bottom = combo.get("bottomGlaze", {}).get("displayName", "?")
        
        # Calculate time estimate
        elapsed = time.time() - start_time
        if i > 1:
            avg_per_item = elapsed / (i - 1)
            remaining = (len(to_analyze) - i + 1) * avg_per_item
            eta = f" | ETA: {format_time(remaining)}"
            rate = f" | {avg_per_item:.1f}s/item"
        else:
            eta = ""
            rate = ""
        
        pct = (i / len(to_analyze)) * 100
        print(f"\n[{i}/{len(to_analyze)}] ({pct:.1f}%){rate}{eta}")
        print(f"  {top} over {bottom}")
        
        # Find image
        image_path = find_combination_image(combo)
        if not image_path:
            print(f"  ⚠ No image found")
            no_image += 1
            continue
        
        analysis = {
            "combinationId": combo_id,
            "topGlaze": combo.get("topGlaze", {}).get("code"),
            "bottomGlaze": combo.get("bottomGlaze", {}).get("code"),
        }
        
        # Main visual analysis
        print(f"  🖼️ Analyzing visual characteristics...")
        visual_data = analyze_combination_image(client, image_path, top, bottom)
        
        if visual_data:
            # Use "guessed" prefix for AI-generated data (can be overwritten by manual data)
            analysis["guessedColors"] = visual_data.get("colors", [])
            # Handle finish as string or array
            finish = visual_data.get("finish")
            analysis["guessedFinish"] = finish if isinstance(finish, str) else (finish[0] if finish else None)
            analysis["guessedEffects"] = visual_data.get("effects", [])
            # Handle style as string or array
            style = visual_data.get("style")
            analysis["guessedStyle"] = style if isinstance(style, str) else (style[0] if style else None)
            
            print(f"    ✓ Colors: {analysis['guessedColors']}")
            print(f"    ✓ Finish: {analysis['guessedFinish']}")
            print(f"    ✓ Effects: {analysis['guessedEffects']}")
            print(f"    ✓ Style: {analysis['guessedStyle']}")
        else:
            errors += 1
            continue
        
        # Optional dedicated clay body analysis
        if detect_clay and not analysis.get("guessedClayBody"):
            print(f"  🏺 Detecting clay body...")
            clay_data = analyze_clay_body(client, image_path)
            if clay_data and clay_data.get("clayBody"):
                analysis["guessedClayBody"] = clay_data["clayBody"]
                analysis["guessedClayBodyConfidence"] = clay_data.get("confidence", "low")
                print(f"    ✓ Clay: {analysis['guessedClayBody']} ({analysis['guessedClayBodyConfidence']})")
        
        # Combine all guessed tags (colors, finish, effects, style, clayBody)
        all_tags = set()
        all_tags.update(analysis.get("guessedColors", []))
        if analysis.get("guessedFinish"):
            all_tags.add(analysis["guessedFinish"])
        all_tags.update(analysis.get("guessedEffects", []))
        if analysis.get("guessedStyle"):
            all_tags.add(analysis["guessedStyle"])
        if analysis.get("guessedClayBody"):
            all_tags.add(analysis["guessedClayBody"])
        analysis["guessedAllTags"] = sorted(list(all_tags))
        
        # Save to cache
        save_analysis(combo_id, analysis)
        analyzed += 1
        print(f"  ✓ Saved ({len(analysis['guessedAllTags'])} guessed tags)")
    
    # Final summary
    total_time = time.time() - start_time
    print(f"\n" + "=" * 60)
    print(f"Completed: {analyzed} analyzed, {no_image} no image, {errors} errors")
    print(f"Total time: {format_time(total_time)} ({total_time/max(analyzed,1):.1f}s avg per item)")
    print(f"Results cached in: {COMBO_CACHE}")


def main():
    parser = argparse.ArgumentParser(description="Analyze glaze combinations with Ollama")
    parser.add_argument("--limit", type=int, help="Maximum combinations to analyze")
    parser.add_argument("--force", action="store_true", help="Re-analyze cached combinations")
    parser.add_argument("--no-clay", action="store_true", help="Skip dedicated clay body detection")
    parser.add_argument("--source", choices=["amaco", "mayco"], help="Only analyze from specific source")
    
    args = parser.parse_args()
    
    analyze_combinations(
        limit=args.limit,
        skip_cached=not args.force,
        detect_clay=not args.no_clay,
        source=args.source
    )


if __name__ == "__main__":
    main()
