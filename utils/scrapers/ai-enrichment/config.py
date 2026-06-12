#!/usr/bin/env python3
"""
AI Enrichment Configuration

Set OLLAMA_HOST to your Windows PC's IP address when running remotely.
Example: OLLAMA_HOST = "http://192.168.1.189:11434"
"""

from pathlib import Path

# =============================================================================
# OLLAMA CONFIGURATION
# =============================================================================

# Set this to your Windows PC's IP address
# Find it on Windows: ipconfig | findstr IPv4
# Example: "http://192.168.1.100:11434"
OLLAMA_HOST = "http://192.168.1.189:11434"

# Vision model for image analysis
VISION_MODEL = "qwen2.5vl:7b"

# Text model for HTML parsing and summaries
TEXT_MODEL = "qwen2.5:7b"

# =============================================================================
# PATHS
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()
SCRAPERS_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = SCRAPERS_DIR.parent

# Input data
GLAZES_JSON = PROJECT_ROOT / "app" / "glaze-viewer" / "public" / "data" / "glazes.json"
COMBINATIONS_JSON = PROJECT_ROOT / "app" / "glaze-viewer" / "public" / "data" / "combinations.json"

# Image directories
AMACO_COMBO_IMAGES = PROJECT_ROOT / "app" / "glaze-viewer" / "public" / "images" / "combinations" / "amaco"
MAYCO_COMBO_IMAGES = PROJECT_ROOT / "app" / "glaze-viewer" / "public" / "images" / "combinations" / "mayco"
GLAZE_IMAGES = PROJECT_ROOT / "app" / "glaze-viewer" / "public" / "images" / "glazes"

# HTML cache for re-parsing
AMACO_GLAZE_HTML = SCRAPERS_DIR / "amaco-glaze-fetcher" / "html_cache"
MAYCO_GLAZE_HTML = SCRAPERS_DIR / "mayco-glaze-fetcher" / "html_cache"

# Cache directories for incremental processing
CACHE_DIR = SCRIPT_DIR / "cache"
GLAZE_CACHE = CACHE_DIR / "glazes"
COMBO_CACHE = CACHE_DIR / "combinations"

# Output files
ENRICHED_GLAZES = SCRIPT_DIR / "results" / "enriched-glazes.json"
ENRICHED_COMBOS = SCRIPT_DIR / "results" / "enriched-combinations.json"

# =============================================================================
# ANALYSIS PROMPTS
# =============================================================================

# =============================================================================
# CONTROLLED VOCABULARY - Canonical tags only
# =============================================================================

# Core colors (always allowed)
ALLOWED_COLORS_CORE = [
    "white", "cream", "beige", "tan", "brown", "black", "gray",
    "blue", "green", "red", "orange", "yellow", "purple", "pink"
]

# Extended ceramics-useful colors
ALLOWED_COLORS_EXTENDED = [
    "turquoise", "teal", "cobalt", "navy", "sage", "olive",
    "rust", "amber", "ochre", "charcoal"
]

# Special descriptors (only when clearly present)
ALLOWED_COLORS_SPECIAL = [
    "multicolor", "translucent", "opalescent", "smoky"
]

ALLOWED_COLORS = ALLOWED_COLORS_CORE + ALLOWED_COLORS_EXTENDED + ALLOWED_COLORS_SPECIAL

# Finish tags (sheen) - single choice
ALLOWED_FINISHES = [
    "matte", "satin", "semi-gloss", "gloss", "high-gloss", "metallic", "iridescent", "waxy", "dry"
]

# Effect tags - surface texture
ALLOWED_EFFECTS_TEXTURE = [
    "smooth", "textured", "pitted", "pinholed", "crystalline", "speckled", "spotted", "oil-spot"
]

# Effect tags - movement
ALLOWED_EFFECTS_MOVEMENT = [
    "runny", "flowing", "dripping", "pooling", "breaking", "layered", "bleeding"
]

# Effect tags - pattern/variation
ALLOWED_EFFECTS_PATTERN = [
    "variegated", "mottled", "streaked", "gradient", "banded", "halo", "uniform"
]

# Effect tags - defects (useful for search)
ALLOWED_EFFECTS_DEFECT = [
    "crawling", "crazing", "cracking", "blistered"
]

ALLOWED_EFFECTS = ALLOWED_EFFECTS_TEXTURE + ALLOWED_EFFECTS_MOVEMENT + ALLOWED_EFFECTS_PATTERN + ALLOWED_EFFECTS_DEFECT

# Glaze family tags (NOT colors - these are "looks people search for")
ALLOWED_GLAZE_FAMILIES = [
    "celadon", "tenmoku", "shino", "chun", "ash-glaze", "copper-red", "iron-red", "oribe"
]

# Style tags (keep minimal)
ALLOWED_STYLES = [
    "earthy", "rustic", "refined", "vibrant", "subtle", "dramatic", "modern", "traditional"
]

# Clay body tags (normalized)
ALLOWED_CLAY_BODIES = [
    "porcelain", "white stoneware", "buff stoneware", "speckled stoneware",
    "dark stoneware", "red earthenware", "terracotta", "black clay"
]

# Alias map for search (canonical <- aliases)
COLOR_ALIASES = {
    "cream": ["ivory", "bone"],
    "beige": ["oatmeal", "buff"],
    "turquoise": ["seafoam", "mint", "aqua"],
    "green": ["jade"],
    "navy": ["indigo"],
    "purple": ["wine", "plum", "burgundy", "mauve"],
    "brown": ["caramel", "chocolate", "sienna", "umber"],
    "gray": ["slate", "graphite", "stone", "ash"],
}

GLAZE_HTML_PROMPT = """Analyze this ceramic glaze product page and extract ALL meaningful information.

HTML Content:
{html_content}

Extract and return as JSON:
{{
  "description": "2-3 sentence description of the glaze's visual characteristics, how it behaves when fired, and what makes it unique",
  "surfaceFinish": "matte" | "satin" | "gloss" | "varies",
  "opacity": "opaque" | "translucent" | "transparent" | "varies",
  "foodSafe": true | false | null,
  "dinnerwareSafe": true | false | null,
  "leadFree": true | false | null,
  "coneRange": "cone range like 05-6 or 6-10",
  "characteristics": ["list", "unique", "traits", "from", "page"],
  "colorFamily": ["primary", "colors"],
  "bestUsedFor": ["functional", "decorative", "sculpture", "tiles"],
  "applicationMethod": "brush | dip | spray | pour",
  "coatsRecommended": number or null,
  "specialNotes": "Any warnings, tips, or unique behaviors mentioned"
}}

Extract everything relevant. If info is not present, use null.
Return ONLY valid JSON, no other text."""

GLAZE_VISUAL_PROMPT = """Analyze this ceramic glaze sample image.

ONLY use these allowed values:

COLORS (pick 1-4): blue, green, red, orange, yellow, brown, black, white, gray, purple, pink, cream, tan, cobalt, tenmoku, celadon, shino, iron red, copper green, ash, oatmeal, rust, amber, turquoise, teal

EFFECTS (pick all that apply): matte, satin, gloss, metallic, iridescent, flowing, breaking, pooling, crawling, dripping, running, crystalline, speckled, spotted, pitted, smooth, textured, crackling, variegated, gradient, mottled, streaked, uniform, layered

Return as JSON:
{{
  "colors": ["color1", "color2"],
  "finish": "matte" | "satin" | "gloss",
  "effects": ["effect1", "effect2"],
  "texture": "brief texture description"
}}

Return ONLY valid JSON, no other text."""

COMBINATION_VISUAL_PROMPT = """Analyze this ceramic glaze COMBINATION test tile image.

IMPORTANT: Many combination test photos show MULTIPLE tiles or sections:
- Individual glaze swatches (showing each glaze alone) - IGNORE THESE
- The COMBINED result where both glazes are layered together - ANALYZE THIS ONLY

The combined/layered area typically shows:
- Where one glaze overlaps another (often in the center or on a separate tile)
- A gradient from top glaze to bottom glaze
- Visual effects from the glazes interacting

Focus ONLY on the area where the two glazes are COMBINED/LAYERED together. Ignore any swatches showing individual glazes by themselves.

RULES:
- Tag ONLY what you clearly see in the COMBINED area. If uncertain, use the more general term (e.g., "blue" not "cobalt").
- Do NOT guess. If lighting makes color ambiguous, pick the safer option or omit.

COLORS (pick 1-3 max, from this list only):
white, cream, beige, tan, brown, black, gray, blue, green, red, orange, yellow, purple, pink, turquoise, teal, cobalt, navy, sage, olive, rust, amber, ochre, charcoal

FINISH (pick exactly 1):
matte, satin, semi-gloss, gloss, metallic, iridescent

EFFECTS (pick 0-4, only if clearly visible):
smooth, textured, pitted, crystalline, speckled, spotted, oil-spot, runny, flowing, dripping, pooling, breaking, layered, variegated, mottled, streaked, gradient, banded, halo, uniform, crawling, crazing

STYLE (pick exactly 1):
earthy, rustic, refined, vibrant, subtle, dramatic, modern, traditional

Return ONLY this JSON, no other text:
{{
  "colors": ["color1"],
  "finish": "finish",
  "effects": ["effect1"],
  "style": "style"
}}"""

CLAY_BODY_PROMPT = """Identify the clay body visible in this ceramic image.

Look at: unglazed areas (foot ring, rim where glaze breaks), color through translucent glaze, texture at edges.

ONLY choose from:
- porcelain (bright white, very smooth)
- white stoneware (off-white, cream colored)
- buff stoneware (tan, beige)
- speckled stoneware (visible specks/grog)
- dark stoneware (gray, brown, chocolate)
- red earthenware (terra cotta, orange-red)
- terracotta (unglazed red clay)
- black clay (dark gray to black)

If no clay is visible, return null.

Return ONLY this JSON:
{{
  "clayBody": "name from list" or null,
  "confidence": "high" | "medium" | "low"
}}"""

# =============================================================================
# ENSURE DIRECTORIES
# =============================================================================

def ensure_directories():
    """Create all necessary directories"""
    for dir_path in [CACHE_DIR, GLAZE_CACHE, COMBO_CACHE, SCRIPT_DIR / "results"]:
        dir_path.mkdir(parents=True, exist_ok=True)
