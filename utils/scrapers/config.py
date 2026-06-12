#!/usr/bin/env python3
"""
Central configuration for all scrapers
Uses relative paths from this file's location for cross-platform compatibility
"""

from pathlib import Path

# Base directories (relative to this file)
SCRAPERS_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRAPERS_DIR.parent
APP_DIR = PROJECT_ROOT / "app" / "glaze-viewer"
APP_PUBLIC_DIR = APP_DIR / "public"
APP_DATA_DIR = APP_PUBLIC_DIR / "data"
APP_IMAGES_DIR = APP_PUBLIC_DIR / "images"

# Glaze image directories
AMACO_GLAZE_IMAGES_DIR = APP_IMAGES_DIR / "glazes" / "amaco"
MAYCO_GLAZE_IMAGES_DIR = APP_IMAGES_DIR / "glazes" / "mayco"

# Combination image directories
AMACO_COMBO_IMAGES_DIR = APP_IMAGES_DIR / "combinations" / "amaco"
MAYCO_COMBO_IMAGES_DIR = APP_IMAGES_DIR / "combinations" / "mayco"

# Output data files
GLAZES_JSON = APP_DATA_DIR / "glazes.json"
COMBINATIONS_JSON = APP_DATA_DIR / "combinations.json"

# Request headers
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Ensure directories exist
def ensure_directories():
    """Create all required directories"""
    dirs = [
        APP_DATA_DIR,
        AMACO_GLAZE_IMAGES_DIR,
        MAYCO_GLAZE_IMAGES_DIR,
        AMACO_COMBO_IMAGES_DIR,
        MAYCO_COMBO_IMAGES_DIR,
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
