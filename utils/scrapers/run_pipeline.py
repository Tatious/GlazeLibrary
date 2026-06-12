#!/usr/bin/env python3
"""
GlazeServer Scraper Pipeline
============================

Master script to run the complete scraping pipeline for all glaze sources.

Pipeline Steps:
1. AMACO Glazes: step1-fetch-glazes.py → step2-parse-html.py
2. Mayco Glazes: step1-fetch-glazes.py → step2-parse-html.py → step3-download-images.py
3. AMACO Combinations: step1-discover-urls.py → step2-fetch-html.py → step3-parse-and-download.py
4. Mayco Combinations: step1-fetch-pages.py → step2-parse-html.py → step3-download-images.py
5. Combine: combine-glazes.py
6. Update: update-glazes-with-images.py

Usage:
    python run_pipeline.py                 # Run everything
    python run_pipeline.py --glazes        # Only run glaze scrapers
    python run_pipeline.py --combinations  # Only run combination scrapers
    python run_pipeline.py --combine       # Only combine existing data
    python run_pipeline.py --amaco         # Only run AMACO scrapers
    python run_pipeline.py --mayco         # Only run Mayco scrapers
"""

import subprocess
import sys
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent.resolve()


def run_script(script_path, description, cwd=None):
    """Run a Python script and report status"""
    print(f"\n{'='*70}")
    print(f"Running: {description}")
    print(f"Script:  {script_path.name}")
    print('='*70)
    
    work_dir = cwd or script_path.parent
    
    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(work_dir)
    )
    
    if result.returncode != 0:
        print(f"\n❌ FAILED: {description}")
        return False
    
    print(f"\n✓ Completed: {description}")
    return True


def run_amaco_glazes():
    """Run AMACO glaze scraper pipeline"""
    print("\n" + "=" * 70)
    print("AMACO GLAZES PIPELINE")
    print("=" * 70)
    
    # Step 1: Fetch all glazes (discovers + downloads HTML)
    if not run_script(
        SCRIPT_DIR / 'amaco-glaze-fetcher' / 'step1-fetch-glazes.py',
        'AMACO: Step 1 - Fetch glaze pages'
    ):
        return False
    
    # Step 2: Parse cached HTML
    if not run_script(
        SCRIPT_DIR / 'amaco-glaze-fetcher' / 'step2-parse-html.py',
        'AMACO: Step 2 - Parse cached HTML'
    ):
        return False
    
    return True


def run_mayco_glazes():
    """Run Mayco glaze scraper pipeline"""
    print("\n" + "=" * 70)
    print("MAYCO GLAZES PIPELINE")
    print("=" * 70)
    
    # Step 1: Fetch all glazes
    if not run_script(
        SCRIPT_DIR / 'mayco-glaze-fetcher' / 'step1-fetch-glazes.py',
        'Mayco: Step 1 - Fetch glaze pages'
    ):
        return False
    
    # Step 2: Parse cached HTML
    if not run_script(
        SCRIPT_DIR / 'mayco-glaze-fetcher' / 'step2-parse-html.py',
        'Mayco: Step 2 - Parse cached HTML'
    ):
        return False
    
    # Step 3: Download images
    if not run_script(
        SCRIPT_DIR / 'mayco-glaze-fetcher' / 'step3-download-images.py',
        'Mayco: Step 3 - Download images'
    ):
        return False
    
    return True


def run_amaco_combos():
    """Run AMACO combination scraper pipeline"""
    print("\n" + "=" * 70)
    print("AMACO COMBINATIONS PIPELINE")
    print("=" * 70)
    
    # Step 1: Discover URLs
    if not run_script(
        SCRIPT_DIR / 'amaco-combo-fetcher' / 'step1-discover-urls.py',
        'AMACO Combos: Discover URLs'
    ):
        return False
    
    # Step 2: Fetch HTML
    if not run_script(
        SCRIPT_DIR / 'amaco-combo-fetcher' / 'step2-fetch-html.py',
        'AMACO Combos: Fetch HTML'
    ):
        return False
    
    # Step 3: Parse and download images
    if not run_script(
        SCRIPT_DIR / 'amaco-combo-fetcher' / 'step3-parse-and-download.py',
        'AMACO Combos: Parse & download images'
    ):
        return False
    
    return True


def run_mayco_combos():
    """Run Mayco combination scraper pipeline"""
    print("\n" + "=" * 70)
    print("MAYCO COMBINATIONS PIPELINE")
    print("=" * 70)
    
    # Step 1: Fetch paginated pages
    if not run_script(
        SCRIPT_DIR / 'mayco-combo-fetcher' / 'step1-fetch-pages.py',
        'Mayco Combos: Fetch paginated pages'
    ):
        return False
    
    # Step 2: Parse HTML
    if not run_script(
        SCRIPT_DIR / 'mayco-combo-fetcher' / 'step2-parse-html.py',
        'Mayco Combos: Parse HTML'
    ):
        return False
    
    # Step 3: Download images
    if not run_script(
        SCRIPT_DIR / 'mayco-combo-fetcher' / 'step3-download-images.py',
        'Mayco Combos: Download images'
    ):
        return False
    
    return True


def run_combine():
    """Run glaze combiner"""
    return run_script(
        SCRIPT_DIR / 'combine-glazes.py',
        'Combine all glazes'
    )


def run_combine_combinations():
    """Run combinations combiner"""
    return run_script(
        SCRIPT_DIR / 'combine-combinations.py',
        'Combine all combinations'
    )


def run_update_images():
    """Run image updater"""
    return run_script(
        SCRIPT_DIR / 'update-glazes-with-images.py',
        'Update glazes with images'
    )


def run_validate():
    """Run validation"""
    return run_script(
        SCRIPT_DIR / 'validate-combo-photos.py',
        'Validate combination photos'
    )


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='GlazeServer Scraper Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_pipeline.py               # Run full pipeline
  python run_pipeline.py --glazes      # Only scrape glazes (no combos)
  python run_pipeline.py --amaco       # Only AMACO (glazes + combos)
  python run_pipeline.py --combine     # Only combine existing data
  python run_pipeline.py --validate    # Only run validation
        """
    )
    parser.add_argument('--glazes', action='store_true', help='Only run glaze scrapers')
    parser.add_argument('--combinations', action='store_true', help='Only run combination scrapers')
    parser.add_argument('--combine', action='store_true', help='Only combine existing data')
    parser.add_argument('--amaco', action='store_true', help='Only run AMACO scrapers')
    parser.add_argument('--mayco', action='store_true', help='Only run Mayco scrapers')
    parser.add_argument('--validate', action='store_true', help='Only run validation')
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("GlazeServer Scraper Pipeline")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)
    
    # Determine what to run
    run_all = not any([args.glazes, args.combinations, args.combine, args.amaco, args.mayco, args.validate])
    
    success = True
    
    # Validation only
    if args.validate:
        run_validate()
        return
    
    # AMACO Glazes
    if run_all or args.glazes or args.amaco:
        if not run_amaco_glazes():
            success = False
    
    # Mayco Glazes
    if run_all or args.glazes or args.mayco:
        if not run_mayco_glazes():
            success = False
    
    # AMACO Combinations
    if run_all or args.combinations or args.amaco:
        if not run_amaco_combos():
            success = False
    
    # Mayco Combinations
    if run_all or args.combinations or args.mayco:
        if not run_mayco_combos():
            success = False
    
    # Combine glazes
    if run_all or args.combine or args.glazes or args.amaco or args.mayco:
        if not run_combine():
            success = False
    
    # Combine combinations
    if run_all or args.combine or args.combinations or args.amaco or args.mayco:
        if not run_combine_combinations():
            success = False
    
    # Update with images
    if run_all or args.glazes or args.amaco or args.mayco:
        if not run_update_images():
            success = False
    
    # Final summary
    print("\n" + "=" * 70)
    print("Pipeline Complete!")
    print(f"Finished: {datetime.now().isoformat()}")
    print("=" * 70)
    
    if success:
        print("\n✓ All steps completed successfully!")
        print("\nOutput files:")
        print("  - app/glaze-viewer/public/data/glazes.json")
        print("  - app/glaze-viewer/public/data/combinations.json")
        print("  - app/glaze-viewer/public/images/glazes/")
        print("  - app/glaze-viewer/public/images/combinations/")
    else:
        print("\n❌ Some steps failed. Check the output above for details.")
        sys.exit(1)


if __name__ == '__main__':
    main()
