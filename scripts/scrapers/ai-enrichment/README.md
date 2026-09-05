# AI Enrichment for Glaze Data

Analyzes glaze and combination images using local AI (Ollama) to generate:

- Color tags (pottery-specific: cobalt, tenmoku, celadon, etc.)
- Effect tags (crystalline, flowing, matte, glossy, etc.)
- Style tags (earthy, dramatic, modern, etc.)
- Clay body detection
- Brief descriptions
- Glaze characteristics from product pages
- **Mayco image metadata** (cone, atmosphere, clay body from alt text)

## Scripts

### `enrich-mayco-images.py`

Parses Mayco glaze image alt text to extract structured metadata:

```bash
# Run without Ollama (uses regex parsing only - fast)
python enrich-mayco-images.py

# Run with Ollama for ambiguous cases
python enrich-mayco-images.py --use-ollama
```

Extracts:

- **cone**: Firing cone (06, 6, 10, etc.)
- **atmosphere**: oxidation or reduction
- **clay_body**: speckled-white, dark, porcelain, etc.
- **coats**: Number of coats applied
- **combo_type/combo_glaze**: For combination shots (over/under)

Output: `results/enriched-mayco-images.json`

### Integration

After running enrichment:

```bash
cd /path/to/scrapers
python integrate-mayco-enrichment.py
```

This updates `glazes.json` with structured image metadata.

## Requirements

1. **Ollama** installed and running
2. **Vision model**: `ollama pull llava:13b` (or llava:7b for less VRAM)
3. **Text model**: `ollama pull qwen2.5:7b`
4. Python packages: `pip install requests beautifulsoup4`

## Quick Start

```bash
# 1. Start Ollama (on your Windows PC with GPU)
ollama serve

# 2. Test the connection
python run-enrichment.py --test

# 3. Run analysis (incremental - caches results)
python run-enrichment.py --combinations --limit 100  # Start with 100
python run-enrichment.py --combinations              # Continue all

# 4. Merge results into JSON
python run-enrichment.py --merge
```

## Remote Setup

If running from a different machine than Ollama:

1. Edit `config.py`:

   ```python
   OLLAMA_HOST = "http://192.168.1.XXX:11434"  # Your Windows PC IP
   ```

2. On Windows, ensure Ollama is accessible:
   ```bash
   # Set environment variable before starting Ollama
   set OLLAMA_HOST=0.0.0.0:11434
   ollama serve
   ```

## Scripts

| Script                    | Purpose                                |
| ------------------------- | -------------------------------------- |
| `run-enrichment.py`       | Main runner - start here               |
| `analyze-glazes.py`       | Parse HTML + analyze glaze images      |
| `analyze-combinations.py` | Analyze combination photos             |
| `merge-enrichments.py`    | Merge cached results into JSON         |
| `ollama_client.py`        | Ollama API wrapper                     |
| `config.py`               | Configuration (paths, prompts, models) |

## Usage Examples

```bash
# Test setup
python run-enrichment.py --test

# Analyze combinations only
python run-enrichment.py --combinations

# Analyze Mayco combinations only
python run-enrichment.py --combinations --source mayco

# Analyze with limit (good for testing)
python run-enrichment.py --combinations --limit 50

# Analyze glazes (HTML parsing + images)
python run-enrichment.py --glazes

# Full pipeline
python run-enrichment.py --all

# Merge without applying (preview)
python run-enrichment.py --merge --dry-run

# Merge results to JSON
python run-enrichment.py --merge
```

## Output

Results are cached in `cache/` directory:

- `cache/glazes/{glaze-id}.json`
- `cache/combinations/{combo-id}.json`

Merged results go to `results/`:

- `results/enriched-glazes.json`
- `results/enriched-combinations.json`

## Data Structure

After enrichment, combinations will have an `ai` field:

```json
{
  "id": "amaco-pc-25-over-pc-30",
  "topGlaze": { ... },
  "bottomGlaze": { ... },
  "entries": [ ... ],
  "ai": {
    "colors": ["cobalt blue", "white"],
    "effects": ["flowing", "breaking"],
    "style": ["dramatic", "traditional"],
    "description": "Rich cobalt blue flows over white, creating striking contrast...",
    "clayBody": "white stoneware",
    "tags": ["blue", "cobalt", "flowing", "dramatic"],
    "analyzedAt": "2026-01-22T..."
  }
}
```

## Time Estimates

With a 4070 Super (llava:13b):

- ~2-3 seconds per combination image
- 6,300 combinations ≈ 4-5 hours
- Can stop/resume anytime (results are cached)

## Filtering in the App

Once merged, the frontend can filter by:

- Colors: "Show me blue glazes"
- Effects: "Find crystalline combinations"
- Style: "Browse earthy combinations"
- Clay body: "White stoneware only"
