#!/usr/bin/env python3
import json
from pathlib import Path
from ollama_client import OllamaClient
from config import COMBINATION_VISUAL_PROMPT, VISION_MODEL, PROJECT_ROOT

client = OllamaClient()

combos_file = PROJECT_ROOT / 'app/glaze-viewer/public/data/combinations.json'
with open(combos_file) as f:
    data = json.load(f)

targets = ['amaco-pc-31-over-pc-23', 'amaco-pc-31-over-pc-33', 'amaco-pc-31-over-pc-42']

for combo in data['combinations']:
    if combo['id'] in targets:
        top_name = combo['topGlaze']['displayName']
        bottom_name = combo['bottomGlaze']['displayName']
        
        print(f"\n{'='*60}")
        print(f"{top_name} over {bottom_name}")
        print(f"{'='*60}")
        
        entries = combo.get('entries', [])
        photo_url = None
        for e in entries:
            photos = e.get('photos', [])
            if photos:
                photo_url = photos[0].get('url')
                break
        
        if photo_url:
            img_path = PROJECT_ROOT / 'app/glaze-viewer/public' / photo_url.lstrip('/')
            print(f'Image: {img_path.name}')
            
            if img_path.exists():
                # Fill in glaze names for context
                prompt = COMBINATION_VISUAL_PROMPT.format(
                    top_glaze=top_name,
                    bottom_glaze=bottom_name
                )
                response = client.analyze_image(img_path, prompt, VISION_MODEL)
                result = client.parse_json_response(response)
                print(f"Colors: {result.get('colors')}")
                print(f"Effects: {result.get('effects')}")
                print(f"Style: {result.get('style')}")
                print(f"Description: {result.get('description')}")
            else:
                print(f"Image not found: {img_path}")
        else:
            print("No photo URL found")
