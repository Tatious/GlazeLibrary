#!/usr/bin/env python3
"""
Analyze Glazes

Parses HTML from glaze product pages and optionally analyzes glaze images
to extract rich metadata about each glaze.

Outputs cached JSON files for each glaze that can be merged later.
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

from config import (
    GLAZES_JSON, GLAZE_CACHE, GLAZE_IMAGES,
    AMACO_GLAZE_HTML, MAYCO_GLAZE_HTML,
    GLAZE_HTML_PROMPT, GLAZE_VISUAL_PROMPT,
    ensure_directories
)
from ollama_client import OllamaClient


def get_cached_analysis(glaze_id: str) -> Optional[dict]:
    """Load cached analysis for a glaze"""
    cache_file = GLAZE_CACHE / f"{glaze_id}.json"
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)
    return None


def save_analysis(glaze_id: str, analysis: dict):
    """Save analysis to cache"""
    cache_file = GLAZE_CACHE / f"{glaze_id}.json"
    analysis["analyzedAt"] = datetime.now().isoformat()
    with open(cache_file, "w") as f:
        json.dump(analysis, f, indent=2)


def find_glaze_html(glaze: dict) -> Optional[Path]:
    """Find the cached HTML file for a glaze"""
    brand = glaze.get("brand", "").lower()
    code = glaze.get("code", "")
    glaze_id = glaze.get("id", "")
    
    if brand == "amaco":
        html_dir = AMACO_GLAZE_HTML
    elif brand == "mayco":
        html_dir = MAYCO_GLAZE_HTML
    else:
        return None
    
    if not html_dir.exists():
        return None
    
    # Try to find matching HTML file
    for html_file in html_dir.glob("*.html"):
        # Check if filename contains the glaze code
        if code.lower().replace("-", "") in html_file.stem.lower().replace("-", ""):
            return html_file
    
    return None


def find_glaze_image(glaze: dict) -> Optional[Path]:
    """Find an image file for a glaze"""
    images = glaze.get("images", [])
    if not images:
        return None
    
    # Get the primary image URL
    primary = images[0].get("url", "")
    if not primary:
        return None
    
    # Convert URL to local path
    if primary.startswith("/images/glazes/"):
        local_path = GLAZE_IMAGES / primary.replace("/images/glazes/", "")
        if local_path.exists():
            return local_path
    
    return None


def extract_html_text(html_content: str, glaze: dict) -> str:
    """Extract relevant text from HTML for analysis"""
    soup = BeautifulSoup(html_content, "html.parser")
    
    # Remove scripts and styles
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    
    # Get text content
    text = soup.get_text(separator="\n", strip=True)
    
    # Limit length to avoid overwhelming the model
    lines = text.split("\n")
    relevant_lines = []
    
    # Include glaze name context
    relevant_lines.append(f"Glaze: {glaze.get('displayName', '')} ({glaze.get('code', '')})")
    relevant_lines.append(f"Brand: {glaze.get('brand', '')}")
    relevant_lines.append(f"Series: {glaze.get('series', '')}")
    relevant_lines.append("")
    
    # Filter for relevant content (skip navigation, etc.)
    skip_phrases = ["cart", "login", "sign in", "menu", "navigation", "subscribe"]
    for line in lines:
        line = line.strip()
        if len(line) < 10:
            continue
        if any(phrase in line.lower() for phrase in skip_phrases):
            continue
        relevant_lines.append(line)
        if len(relevant_lines) > 100:  # Limit context
            break
    
    return "\n".join(relevant_lines)


def analyze_glaze_html(client: OllamaClient, glaze: dict, html_path: Path) -> Optional[dict]:
    """Analyze glaze HTML to extract metadata"""
    try:
        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            html_content = f.read()
        
        text_content = extract_html_text(html_content, glaze)
        prompt = GLAZE_HTML_PROMPT.format(html_content=text_content)
        
        response = client.generate_text(prompt)
        return client.parse_json_response(response)
    
    except Exception as e:
        print(f"    ✗ HTML analysis error: {e}")
        return None


def analyze_glaze_image(client: OllamaClient, image_path: Path) -> Optional[dict]:
    """Analyze glaze image for visual characteristics"""
    try:
        response = client.analyze_image(image_path, GLAZE_VISUAL_PROMPT)
        return client.parse_json_response(response)
    
    except Exception as e:
        print(f"    ✗ Image analysis error: {e}")
        return None


def analyze_glazes(
    limit: int = None,
    skip_cached: bool = True,
    analyze_images: bool = True,
    brands: list[str] = None
):
    """Main function to analyze all glazes"""
    ensure_directories()
    
    print("\n" + "=" * 60)
    print("Glaze Analysis with Ollama")
    print("=" * 60)
    
    # Connect to Ollama
    client = OllamaClient()
    if not client.is_available():
        print("✗ Cannot connect to Ollama. Check config.py OLLAMA_HOST setting.")
        return
    
    print(f"✓ Connected to Ollama at {client.host}")
    
    # Load glazes
    if not GLAZES_JSON.exists():
        print(f"✗ Glazes file not found: {GLAZES_JSON}")
        return
    
    with open(GLAZES_JSON) as f:
        data = json.load(f)
    
    glazes = data.get("glazes", [])
    print(f"✓ Loaded {len(glazes)} glazes")
    
    # Filter by brand if specified
    if brands:
        glazes = [g for g in glazes if g.get("brand", "").lower() in [b.lower() for b in brands]]
        print(f"  Filtered to {len(glazes)} glazes for brands: {brands}")
    
    # Filter out already cached
    if skip_cached:
        to_analyze = [g for g in glazes if not get_cached_analysis(g["id"])]
        print(f"  {len(glazes) - len(to_analyze)} already cached, {len(to_analyze)} to analyze")
    else:
        to_analyze = glazes
    
    # Apply limit
    if limit:
        to_analyze = to_analyze[:limit]
        print(f"  Limited to {limit} glazes")
    
    print(f"\nAnalyzing {len(to_analyze)} glazes...")
    
    analyzed = 0
    errors = 0
    
    for i, glaze in enumerate(to_analyze, 1):
        glaze_id = glaze["id"]
        print(f"\n[{i}/{len(to_analyze)}] {glaze.get('displayName', glaze_id)}")
        
        analysis = {
            "glazeId": glaze_id,
            "brand": glaze.get("brand"),
            "code": glaze.get("code"),
        }
        
        # Try HTML analysis
        html_path = find_glaze_html(glaze)
        if html_path:
            print(f"  📄 Analyzing HTML...")
            html_data = analyze_glaze_html(client, glaze, html_path)
            if html_data:
                # Use "guessed" prefix for AI-generated data (can be overwritten by manual data)
                analysis["guessedHtmlAnalysis"] = html_data
                print(f"    ✓ Extracted description and characteristics")
        else:
            print(f"  ⚠ No HTML file found")
        
        # Try image analysis
        if analyze_images:
            image_path = find_glaze_image(glaze)
            if image_path:
                print(f"  🖼️ Analyzing image...")
                image_data = analyze_glaze_image(client, image_path)
                if image_data:
                    # Use "guessed" prefix for AI-generated data (can be overwritten by manual data)
                    analysis["guessedVisualAnalysis"] = image_data
                    print(f"    ✓ Extracted colors: {image_data.get('colors', [])}")
            else:
                print(f"  ⚠ No image file found")
        
        # Combine into guessed tags
        all_tags = set()
        if "guessedHtmlAnalysis" in analysis:
            all_tags.update(analysis["guessedHtmlAnalysis"].get("characteristics", []))
        if "guessedVisualAnalysis" in analysis:
            all_tags.update(analysis["guessedVisualAnalysis"].get("tags", []))
            all_tags.update(analysis["guessedVisualAnalysis"].get("colors", []))
            all_tags.update(analysis["guessedVisualAnalysis"].get("effects", []))
        
        analysis["guessedTags"] = list(all_tags)
        
        # Save to cache
        save_analysis(glaze_id, analysis)
        analyzed += 1
        print(f"  ✓ Saved ({len(analysis.get('guessedTags', []))} guessed tags)")
    
    print(f"\n" + "=" * 60)
    print(f"Completed: {analyzed} analyzed, {errors} errors")
    print(f"Results cached in: {GLAZE_CACHE}")


def main():
    parser = argparse.ArgumentParser(description="Analyze glazes with Ollama")
    parser.add_argument("--limit", type=int, help="Maximum glazes to analyze")
    parser.add_argument("--force", action="store_true", help="Re-analyze cached glazes")
    parser.add_argument("--no-images", action="store_true", help="Skip image analysis")
    parser.add_argument("--brand", action="append", help="Filter by brand (can specify multiple)")
    
    args = parser.parse_args()
    
    analyze_glazes(
        limit=args.limit,
        skip_cached=not args.force,
        analyze_images=not args.no_images,
        brands=args.brand
    )


if __name__ == "__main__":
    main()
