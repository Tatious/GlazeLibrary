#!/usr/bin/env python3
"""Fix glaze ID mismatches in combinations.json"""

import json
import os

os.chdir('/Users/work/Desktop/GlazeServer/app/glaze-viewer/public/data')

with open('combinations.json') as f:
    combos = json.load(f)

# Specific fixes - only the ones we know are mismatched
fixes_map = {
    'amaco-cr-01': 'amaco-cr-1',
    'mayco-sc-010': 'mayco-sc-10',
    'mayco-sc-011': 'mayco-sc-11',
    'mayco-sc-040': 'mayco-sc-40',
    'mayco-sc-058': 'mayco-sc-58',
    'mayco-sc-073': 'mayco-sc-73',
    'mayco-sc-077': 'mayco-sc-77',
    'mayco-sc-097': 'mayco-sc-97',
}

fixes = 0
for combo in combos['combinations']:
    for key in ['topGlaze', 'bottomGlaze']:
        old_id = combo[key]['glazeId']
        if old_id in fixes_map:
            combo[key]['glazeId'] = fixes_map[old_id]
            fixes += 1
    
    # Fix combo ID too
    old_cid = combo['id']
    for old, new in fixes_map.items():
        if old in old_cid:
            combo['id'] = old_cid.replace(old, new)
            break

with open('combinations.json', 'w') as f:
    json.dump(combos, f, indent=2)

print(f'Fixed {fixes} glaze ID references')
