#!/usr/bin/env python3
import json
from analyze_combinations import find_combination_image, analyze_combination_image
from ollama_client import OllamaClient
from config import COMBINATIONS_JSON

client = OllamaClient()

with open(COMBINATIONS_JSON) as f:
    data = json.load(f)
combos = data if isinstance(data, list) else data.get('combinations', [])

targets = ['amaco-pc-31-over-pc-42', 'amaco-pc-31-over-pc-33', 'amaco-pc-31-over-pc-23']
for c in combos:
    if isinstance(c, dict) and c.get('id') in targets:
        cid = c['id']
        img = find_combination_image(c)
        if img and img.exists():
            print(f'\n=== {cid} ===')
            top = c.get('topGlaze',{}).get('displayName','')
            bot = c.get('bottomGlaze',{}).get('displayName','')
            result = analyze_combination_image(client, img, top, bot)
            print(f"  Colors: {result.get('guessedColors',[])}")
            print(f"  Finishes: {result.get('guessedFinishes',[])}")
            print(f"  Effects: {result.get('guessedEffects',[])}")
            print(f"  Style: {result.get('guessedStyle',[])}")
        else:
            print(f'{cid}: no image found')
