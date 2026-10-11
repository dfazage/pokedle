import csv, json, re, sys
src = sys.argv[1]; out = sys.argv[2]
def ident(s): return re.sub(r"[^a-z0-9]", "", s.lower())
def rows(f): return list(csv.DictReader(open(f"{src}/{f}.csv", encoding="utf-8")))
species_id = {r["id"]: r["identifier"] for r in rows("pokemon_species") if int(r["id"]) <= 493}
moves_id = {r["id"]: r["identifier"] for r in rows("moves") if int(r["id"]) <= 467}
sp, mv = {}, {}
for r in rows("pokemon_species_names"):
    if r["local_language_id"] == "5" and r["pokemon_species_id"] in species_id: sp[ident(species_id[r["pokemon_species_id"]])] = r["name"]
for r in rows("move_names"):
    if r["local_language_id"] == "5" and r["move_id"] in moves_id: mv[ident(moves_id[r["move_id"]])] = r["name"]
# Noms qui diffèrent entre PokéAPI et Showdown
mv.setdefault("faintattack", mv.get("feintattack", "Feinte")) 
json.dump({"species": sp, "moves": mv}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(sp), "espèces,", len(mv), "attaques")
