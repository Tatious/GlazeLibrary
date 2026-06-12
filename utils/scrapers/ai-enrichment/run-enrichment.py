#!/usr/bin/env python3
"""
AI Enrichment Runner

Main script to run the full enrichment pipeline.
Designed to be run on a machine with Ollama and a GPU.

Usage:
  python run-enrichment.py --test          # Test connection, analyze 5 items
  python run-enrichment.py --glazes        # Analyze all glazes
  python run-enrichment.py --combinations  # Analyze all combinations
  python run-enrichment.py --all           # Full pipeline
  python run-enrichment.py --merge         # Merge results into JSON
"""

import argparse
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import ensure_directories, OLLAMA_HOST, VISION_MODEL, TEXT_MODEL
from ollama_client import OllamaClient, test_connection


def run_test():
    """Test Ollama connection and analyze a few samples"""
    print("\n" + "=" * 60)
    print("AI Enrichment Test Run")
    print("=" * 60)
    
    if not test_connection():
        return False
    
    client = OllamaClient()
    
    # Test vision model with a simple prompt
    print(f"\nTesting {VISION_MODEL} model...")
    
    # Find a sample image
    from config import AMACO_COMBO_IMAGES, MAYCO_COMBO_IMAGES
    
    sample_image = None
    for images_dir in [AMACO_COMBO_IMAGES, MAYCO_COMBO_IMAGES]:
        if images_dir.exists():
            images = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png"))
            if images:
                sample_image = images[0]
                break
    
    if sample_image:
        print(f"  Testing with: {sample_image.name}")
        try:
            response = client.analyze_image(
                sample_image,
                "Describe this ceramic glaze in 2-3 words."
            )
            print(f"  Response: {response[:100]}...")
            print("  ✓ Vision model working!")
        except Exception as e:
            print(f"  ✗ Vision test failed: {e}")
            return False
    else:
        print("  ⚠ No sample images found to test")
    
    # Run small batch
    print("\n" + "-" * 40)
    print("Running sample analysis (5 combinations)...")
    print("-" * 40)
    
    from analyze_combinations import analyze_combinations
    analyze_combinations(limit=5, skip_cached=False)
    
    return True


def run_glazes(limit: int = None):
    """Analyze all glazes"""
    from analyze_glazes import analyze_glazes
    analyze_glazes(limit=limit)


def run_combinations(limit: int = None, source: str = None):
    """Analyze all combinations"""
    from analyze_combinations import analyze_combinations
    analyze_combinations(limit=limit, source=source)


def run_merge(dry_run: bool = False):
    """Merge cached results into JSON files"""
    from merge_enrichments import merge_glaze_enrichments, merge_combination_enrichments
    merge_glaze_enrichments(dry_run=dry_run)
    merge_combination_enrichments(dry_run=dry_run)


def main():
    parser = argparse.ArgumentParser(
        description="AI Enrichment Pipeline for Glaze Data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run-enrichment.py --test              Test setup, analyze 5 samples
  python run-enrichment.py --combinations      Analyze all combinations
  python run-enrichment.py --combinations --limit 100   
                                               Analyze first 100 combinations
  python run-enrichment.py --combinations --source mayco
                                               Only Mayco combinations
  python run-enrichment.py --glazes            Analyze all glazes
  python run-enrichment.py --merge             Merge results to JSON
  python run-enrichment.py --all               Full pipeline

Before running, ensure:
  1. Ollama is running: ollama serve
  2. Models are installed: ollama pull llava:13b && ollama pull llama3.2
  3. config.py OLLAMA_HOST is set correctly (if remote)
        """
    )
    
    parser.add_argument("--test", action="store_true", 
                       help="Test connection and run sample analysis")
    parser.add_argument("--glazes", action="store_true",
                       help="Analyze glazes (HTML + images)")
    parser.add_argument("--combinations", action="store_true",
                       help="Analyze combination images")
    parser.add_argument("--merge", action="store_true",
                       help="Merge cached results into JSON files")
    parser.add_argument("--all", action="store_true",
                       help="Run full pipeline (glazes + combinations + merge)")
    
    parser.add_argument("--limit", type=int,
                       help="Maximum items to analyze")
    parser.add_argument("--source", choices=["amaco", "mayco"],
                       help="Only process specific source")
    parser.add_argument("--dry-run", action="store_true",
                       help="For merge: show what would be done")
    
    args = parser.parse_args()
    
    ensure_directories()
    
    if args.test:
        success = run_test()
        sys.exit(0 if success else 1)
    
    if args.all:
        print("\n🚀 Running full enrichment pipeline...")
        run_glazes(limit=args.limit)
        run_combinations(limit=args.limit, source=args.source)
        run_merge()
        print("\n✓ Pipeline complete!")
        return
    
    if args.glazes:
        run_glazes(limit=args.limit)
    
    if args.combinations:
        run_combinations(limit=args.limit, source=args.source)
    
    if args.merge:
        run_merge(dry_run=args.dry_run)
    
    if not any([args.test, args.glazes, args.combinations, args.merge, args.all]):
        parser.print_help()


if __name__ == "__main__":
    main()
