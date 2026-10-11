#!/usr/bin/env python3
"""Régénère src/data/abilities.fr.json (talents gens 1-4, noms + descriptions FR) depuis les CSV de PokéAPI.
Usage : python3 scripts/build_abilities_fr.py   (nécessite l'accès réseau à raw.githubusercontent.com)"""
import csv, io, json, re, urllib.request
BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
FR = 5
def rows(name):
    with urllib.request.urlopen(BASE + name) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode('utf-8'))))
abilities = [a for a in rows('abilities.csv') if int(a['generation_id']) <= 4]
names = {r['ability_id']: r['name'] for r in rows('ability_names.csv') if int(r['local_language_id']) == FR}
flav = {}
for r in rows('ability_flavor_text.csv'):
    if int(r['language_id']) != FR: continue
    vg = int(r['version_group_id']); ok = vg <= 10
    cur = flav.get(r['ability_id'])
    if cur is None or (ok and (not cur[1] or vg > cur[0])):
        flav[r['ability_id']] = (vg, ok, r['flavor_text'].replace('\n', ' '))
out = {}
for a in abilities:
    if a['id'] in names:
        out[re.sub(r'[^a-z0-9]', '', a['identifier'])] = {'n': names[a['id']], 'd': flav.get(a['id'], (0, 0, ''))[2]}
json.dump(out, open('src/data/abilities.fr.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'talents')
