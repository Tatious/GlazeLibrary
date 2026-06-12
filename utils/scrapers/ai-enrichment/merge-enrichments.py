#!/usr/bin/env python3
"""
Merge Enrichments

Merges cached AI analysis results into the main JSON data files.
Run this after analyze-glazes.py and analyze-combinations.py.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime

from config import (
    GLAZES_JSON, COMBINATIONS_JSON,
    GLAZE_CACHE, COMBO_CACHE,
    ENRICHED_GLAZES, ENRICHED_COMBOS,
    ensure_directories
)


def merge_glaze_enrichments(dry_run: bool = False):
    """Merge glaze analysis cache into glazes.json"""
    
    print("\n" + "=" * 60)
    print("Merging Glaze Enrichments")
    print("=" * 60)
    
    if not GLAZES_JSON.exists():
        print(f"✗ Glazes file not found: {GLAZES_JSON}")
        return
    
    with open(GLAZES_JSON) as f:
        data = json.load(f)
    
    glazes = data.get("glazes", [])
    print(f"✓ Loaded {len(glazes)} glazes")
    
    # Load all cached analyses
    cache_files = list(GLAZE_CACHE.glob("*.json"))
    print(f"✓ Found {len(cache_files)} cached analyses")
    
    if not cache_files:
        print("  Nothing to merge")
        return
    
    cache_by_id = {}
    for cache_file in cache_files:
        with open(cache_file) as f:
            analysis = json.load(f)
        glaze_id = analysis.get("glazeId", cache_file.stem)
        cache_by_id[glaze_id] = analysis
    
    # Merge into glazes
    merged = 0
    for glaze in glazes:
        glaze_id = glaze["id"]
        if glaze_id not in cache_by_id:
            continue
        
        analysis = cache_by_id[glaze_id]
        
        # Add AI enrichment data
        ai_data = {}
        
        if "htmlAnalysis" in analysis:
            html = analysis["htmlAnalysis"]
            ai_data["description"] = html.get("description")
            ai_data["surfaceFinish"] = html.get("surfaceFinish")
            ai_data["opacity"] = html.get("opacity")
            ai_data["foodSafe"] = html.get("foodSafe")
            ai_data["characteristics"] = html.get("characteristics", [])
            ai_data["bestUsedFor"] = html.get("bestUsedFor", [])
            ai_data["firingNotes"] = html.get("firingNotes")
            ai_data["applicationTips"] = html.get("applicationTips")
        
        if "visualAnalysis" in analysis:
            visual = analysis["visualAnalysis"]
            ai_data["colors"] = visual.get("colors", [])
            ai_data["texture"] = visual.get("texture")
            ai_data["finish"] = visual.get("finish")
            ai_data["effects"] = visual.get("effects", [])
        
        # Combined tags for filtering
        ai_data["aiTags"] = analysis.get("tags", [])
        ai_data["aiAnalyzedAt"] = analysis.get("analyzedAt")
        
        # Only include non-empty values
        glaze["ai"] = {k: v for k, v in ai_data.items() if v}
        merged += 1
    
    print(f"✓ Merged {merged} enrichments")
    
    if dry_run:
        print("\n[DRY RUN] Would save to:")
        print(f"  {ENRICHED_GLAZES}")
        return
    
    # Save enriched data
    ensure_directories()
    data["aiEnrichedAt"] = datetime.now().isoformat()
    
    with open(ENRICHED_GLAZES, "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Saved to {ENRICHED_GLAZES}")
    
    # Also offer to update main file
    print(f"\nTo apply to main data file:")
    print(f"  cp {ENRICHED_GLAZES} {GLAZES_JSON}")


def merge_combination_enrichments(dry_run: bool = False):
    """Merge combination analysis cache into combinations.json"""
    
    print("\n" + "=" * 60)
    print("Merging Combination Enrichments")
    print("=" * 60)
    
    if not COMBINATIONS_JSON.exists():
        print(f"✗ Combinations file not found: {COMBINATIONS_JSON}")
        return
    
    with open(COMBINATIONS_JSON) as f:
        data = json.load(f)
    
    combinations = data.get("combinations", [])
    print(f"✓ Loaded {len(combinations)} combinations")
    
    # Load all cached analyses
    cache_files = list(COMBO_CACHE.glob("*.json"))
    print(f"✓ Found {len(cache_files)} cached analyses")
    
    if not cache_files:
        print("  Nothing to merge")
        return
    
    cache_by_id = {}
    for cache_file in cache_files:
        with open(cache_file) as f:
            analysis = json.load(f)
        combo_id = analysis.get("combinationId", cache_file.stem)
        cache_by_id[combo_id] = analysis
    
    # Collect all unique tags for stats
    all_colors = set()
    all_effects = set()
    all_styles = set()
    all_clay_bodies = set()
    
    # Merge into combinations
    merged = 0
    for combo in combinations:
        combo_id = combo["id"]
        if combo_id not in cache_by_id:
            continue
        
        analysis = cache_by_id[combo_id]
        
        # Add AI enrichment data (cache uses guessed* prefixes)
        ai_data = {
            "colors": analysis.get("guessedColors", analysis.get("colors", [])),
            "finish": analysis.get("guessedFinish", analysis.get("finish")),
            "effects": analysis.get("guessedEffects", analysis.get("effects", [])),
            "style": analysis.get("guessedStyle", analysis.get("style")),
            "description": analysis.get("description"),
            "tags": analysis.get("guessedAllTags", analysis.get("allTags", [])),
            "analyzedAt": analysis.get("analyzedAt"),
        }
        
        # Handle clay body
        clay_body = analysis.get("guessedClayBody", analysis.get("clayBody"))
        if clay_body:
            ai_data["clayBody"] = clay_body
            ai_data["clayBodyConfidence"] = analysis.get("guessedClayBodyConfidence", analysis.get("clayBodyConfidence", "medium"))
            all_clay_bodies.add(clay_body)
        
        # Only include non-empty values
        combo["ai"] = {k: v for k, v in ai_data.items() if v}
        
        # Track tags
        all_colors.update(ai_data.get("colors", []))
        all_effects.update(ai_data.get("effects", []))
        all_styles.update(ai_data.get("style", []))
        
        merged += 1
    
    print(f"✓ Merged {merged} enrichments")
    print(f"\nTag statistics:")
    print(f"  Colors: {len(all_colors)}")
    print(f"  Effects: {len(all_effects)}")
    print(f"  Styles: {len(all_styles)}")
    print(f"  Clay bodies: {len(all_clay_bodies)}")
    
    if dry_run:
        print("\n[DRY RUN] Would save to:")
        print(f"  {ENRICHED_COMBOS}")
        return
    
    # Save enriched data
    ensure_directories()
    data["aiEnrichedAt"] = datetime.now().isoformat()
    data["aiTagStats"] = {
        "colors": sorted(list(all_colors)),
        "effects": sorted(list(all_effects)),
        "styles": sorted(list(all_styles)),
        "clayBodies": sorted(list(all_clay_bodies)),
    }
    
    with open(ENRICHED_COMBOS, "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Saved to {ENRICHED_COMBOS}")
    
    # Also offer to update main file
    print(f"\nTo apply to main data file:")
    print(f"  cp {ENRICHED_COMBOS} {COMBINATIONS_JSON}")


def main():
    parser = argparse.ArgumentParser(description="Merge AI enrichments into data files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without saving")
    parser.add_argument("--glazes", action="store_true", help="Only merge glazes")
    parser.add_argument("--combinations", action="store_true", help="Only merge combinations")
    
    args = parser.parse_args()
    
    do_both = not args.glazes and not args.combinations
    
    if args.glazes or do_both:
        merge_glaze_enrichments(dry_run=args.dry_run)
    
    if args.combinations or do_both:
        merge_combination_enrichments(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
