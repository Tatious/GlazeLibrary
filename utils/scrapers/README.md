# GlazeServer Scrapers

This directory contains the scraping pipeline for collecting glaze and glaze combination data from various sources.

## Pipeline Overview

The scraping pipeline follows a consistent pattern for each data source:

1. **Discover/Fetch** - Find what exists and download HTML (with caching)
2. **Parse** - Extract structured data from cached HTML
3. **Download Images** - Download and cache product images
4. **Combine** - Merge data into final output files

All data is output to `app/glaze-viewer/public/data/` and images to `app/glaze-viewer/public/images/`.

## Quick Start

Run the complete pipeline:

```bash
cd scrapers
python run_pipeline.py
```

This will:

1. Scrape AMACO glazes (fetch → parse)
2. Scrape Mayco glazes (fetch → parse → download images)
3. Scrape AMACO combinations (discover URLs → fetch HTML → parse & download)
4. Combine all glaze data into `glazes.json`
5. Update glazes with downloaded images

## Directory Structure

```
scrapers/
├── run_pipeline.py              # Master pipeline runner
├── config.py                    # Shared configuration (paths, headers)
├── html_cache.py                # HTML caching utility
├── combine-glazes.py            # Combines AMACO + Mayco into glazes.json
├── download_images.py           # Image download utility
├── update-glazes-with-images.py # Updates glazes with local image paths
├── validate-combo-photos.py     # Validates combination photos
│
├── amaco-glaze-fetcher/
│   ├── step1-fetch-glazes.py    # Step 1: Discover & fetch HTML
│   ├── step2-parse-html.py      # Step 2: Parse HTML to JSON
│   ├── html_cache/              # Cached product HTML
│   └── results/
│       └── glazes.json          # AMACO glaze data
│
├── mayco-glaze-fetcher/
│   ├── step1-fetch-glazes.py    # Step 1: Discover & fetch HTML
│   ├── step2-parse-html.py      # Step 2: Parse HTML to JSON
│   ├── step3-download-images.py # Step 3: Download images
│   ├── html_cache/              # Cached product HTML
│   └── results/
│       └── mayco-glazes.json
│
└── amaco-combo-fetcher/
    ├── step1-discover-urls.py       # Discover all combination URLs
    ├── step2-fetch-html.py          # Fetch HTML for each combination
    ├── step3-parse-and-download.py  # Parse & download images
    ├── html_cache_valid/            # Cached combination HTML
    └── results/
        ├── all-combination-urls.json
        └── combinations-parsed.json
```

## Pipeline Runner Options

```bash
# Run full pipeline
python run_pipeline.py

# Run only glaze scrapers (no combinations)
python run_pipeline.py --glazes

# Run only combination scrapers
python run_pipeline.py --combinations

# Run only AMACO (glazes + combos)
python run_pipeline.py --amaco

# Run only Mayco
python run_pipeline.py --mayco

# Only combine existing data
python run_pipeline.py --combine

# Only run validation
python run_pipeline.py --validate
```

## Running Individual Steps

### AMACO Glazes

```bash
cd amaco-glaze-fetcher

# Step 1: Fetch all glaze pages (caches HTML)
python step1-fetch-glazes.py

# Step 2: Parse cached HTML to JSON
python step2-parse-html.py
```

### Mayco Glazes

```bash
cd mayco-glaze-fetcher

# Step 1: Fetch all glaze pages
python step1-fetch-glazes.py

# Step 2: Parse cached HTML to JSON
python step2-parse-html.py

# Step 3: Download images
python step3-download-images.py
```

### AMACO Combinations

```bash
cd amaco-combo-fetcher

# Step 1: Discover all combination URLs
python step1-discover-urls.py

# Step 2: Fetch HTML for each combination
python step2-fetch-html.py

# Step 3: Parse HTML and download images
python step3-parse-and-download.py
```

## Output Files

### app/glaze-viewer/public/data/glazes.json

Combined glaze data from all sources:

```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-22T...",
  "source": "combined",
  "totalCount": 150,
  "glazes": [
    {
      "id": "amaco-c-1",
      "brand": "AMACO",
      "series": "(C) Celadon",
      "code": "C-1",
      "name": "Obsidian",
      "displayName": "C-1 Obsidian",
      "cone": ["5", "6"],
      "tags": ["amaco", "black"],
      "productUrl": "https://shop.amaco.com/c-1-obsidian/",
      "images": [...],
      "source": "amaco"
    }
  ]
}
```

### app/glaze-viewer/public/data/combinations.json

AMACO glaze combination data (multi-entry structure):

```json
{
  "version": "3.0",
  "dataStructure": "multi-entry",
  "totalCombinations": 500,
  "totalEntries": 600,
  "combinations": [
    {
      "id": "amaco-c-1-over-c-10",
      "topGlaze": {
        "glazeId": "amaco-c-1",
        "code": "C-1",
        "displayName": "C-1 Obsidian"
      },
      "bottomGlaze": {...},
      "entries": [
        {
          "id": "abc123",
          "submittedBy": "AMACO Brent",
          "isOfficial": true,
          "topCoats": 2,
          "bottomCoats": 2,
          "clayBody": "White Stoneware",
          "cone": "6",
          "photos": [...]
        }
      ]
    }
  ]
}
```

## Caching

HTML files are cached locally to avoid redundant network requests:

- Glaze HTML: `{fetcher}/html_cache/`
- Combination HTML: `amaco-combo-fetcher/html_cache_valid/`

To force re-download, delete the relevant cache directories.

## Dependencies

```bash
pip install requests beautifulsoup4 playwright

# For combination scraper (uses browser automation)
playwright install chromium
```

## Configuration

All paths are configured in `config.py` using relative paths from the script location, making the scrapers cross-platform compatible.

Key configuration:

- `APP_DATA_DIR` - Output directory for JSON files
- `AMACO_GLAZE_IMAGES_DIR` - AMACO glaze images
- `MAYCO_GLAZE_IMAGES_DIR` - Mayco glaze images
- `AMACO_COMBO_IMAGES_DIR` - Combination images
- `DEFAULT_HEADERS` - HTTP request headers

## Maintenance

The scrapers are designed to be idempotent and incremental:

- Cached HTML is reused (delete cache to force refresh)
- Existing images are skipped
- Data can be re-parsed without re-downloading

Run the pipeline periodically to catch new products:

```bash
# Weekly update
python run_pipeline.py
python run_pipeline.py --validate
```
