#!/usr/bin/env python3
"""Check for missing glazes referenced in combinations"""

import json
import os

os.chdir('/Users/work/Desktop/GlazeServer/app/glaze-viewer/public/data')

with open('glazes.json') as f:
    glazes = json.load(f)

with open('combinations.json') as f:
    combos = json.load(f)

glaze_ids = set(g['id'] for g in glazes['glazes'])

missing = {}
combo_count = {}
for combo in combos['combinations']:
    for key in ['topGlaze', 'bottomGlaze']:
        gid = combo[key]['glazeId']
        if gid not in glaze_ids:
            missing[gid] = combo[key]['displayName']
            combo_count[gid] = combo_count.get(gid, 0) + 1

affected = len([c for c in combos['combinations'] if c['topGlaze']['glazeId'] not in glaze_ids or c['bottomGlaze']['glazeId'] not in glaze_ids])

print(f"=== MISSING GLAZES: {len(missing)} ===")
print(f"(Affects {affected} combinations)")
print()

# Group by brand
amaco = {k:v for k,v in missing.items() if k.startswith('amaco-')}
mayco = {k:v for k,v in missing.items() if k.startswith('mayco-')}

print("AMACO (discontinued):")
for k,v in sorted(amaco.items()):
    print(f"  {v} ({combo_count[k]} combos)")

print()
print("MAYCO (discontinued):")
for k,v in sorted(mayco.items()):
    print(f"  {v} ({combo_count[k]} combos)")
