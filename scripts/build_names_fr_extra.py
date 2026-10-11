"""Ajoute talents / objets / natures (FR) à src/data/names.fr.json.
Usage : python3 scripts/build_names_fr_extra.py <dossier csv PokéAPI> <liste.json> [src/data/names.fr.json]
<liste.json> = {"abilities": [...], "items": [...], "natures": [...]} (noms Showdown gen 4, via @pkmn/sim).
Les espèces/attaques existantes (build_names_fr.py) sont conservées."""
import csv, json, re, sys
src, lst = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else "src/data/names.fr.json"
def ident(s): return re.sub(r"[^a-z0-9]", "", s.lower())
def rows(f): return list(csv.DictReader(open(f"{src}/{f}.csv", encoding="utf-8")))
want = json.load(open(lst, encoding="utf-8"))
def build(table, names, idcol, wanted):
    ids = {r["id"]: ident(r["identifier"]) for r in rows(table)}
    fr = {ids[r[idcol]]: r["name"] for r in rows(names) if r["local_language_id"] == "5" and r[idcol] in ids}
    res, missing = {}, []
    for w in wanted:
        k = ident(w)
        if k in fr: res[k] = fr[k]
        else: missing.append(w)
    return res, missing
data = json.load(open(out, encoding="utf-8"))
for key, table, names, idcol in (("abilities", "abilities", "ability_names", "ability_id"), ("items", "items", "item_names", "item_id"), ("natures", "natures", "nature_names", "nature_id")):
    data[key], miss = build(table, names, idcol, want[key])
    print(key, len(data[key]), "traduits", ("— manquants : " + ", ".join(miss)) if miss else "")
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
