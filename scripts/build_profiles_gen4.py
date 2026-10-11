"""Profils compétitifs gen 4 par espèce (natures/EV, talents, objets les plus joués) → src/data/profiles.gen4.json.

Sources (dépôt pkmn/smogon, données Smogon/Pokémon Showdown) :
  - data/stats/gen4{ou,ubers,uu,nu,pu}.json : statistiques d'usage (répartitions d'EV réellement jouées)
  - data/sets/gen4.json : sets d'analyses Smogon, utilisés pour les espèces absentes des stats
Usage : python3 scripts/build_profiles_gen4.py <dossier contenant sets4.json et stats-gen4*.json> [sortie]
Pour chaque espèce, on retient le format où elle est le plus jouée, puis ses 3 répartitions d'EV les plus populaires.
"""
import json, sys
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "src/data/profiles.gen4.json"
FORMATS = ["ou", "ubers", "uu", "nu", "pu"]
SET_FORMATS = ["ou", "ubers", "uu", "nu", "pu", "zu", "anythinggoes"]
STATS = ["hp", "atk", "def", "spa", "spd", "spe"]
NATURES = {"Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax", "Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash", "Calm", "Gentle", "Sassy", "Careful", "Quirky"}

def load(f): return json.load(open(f"{src}/{f}", encoding="utf-8"))
stats = {f: load(f"stats-gen4{f}.json")["pokemon"] for f in FORMATS}
sets = load("sets4.json")

def parse_spread(k):
    try:
        nat, ev = k.split(":")
        e = [int(x) for x in ev.split("/")]
    except ValueError:
        return None
    if nat not in NATURES or len(e) != 6 or max(e) > 252 or sum(e) < 400 or sum(e) > 510: return None
    return [nat, e]

def shape(p):
    """Profil = nature + stats principales (≥ 100 EV) : écarte les variantes qui ne diffèrent que de quelques EV."""
    return (p[0], tuple(i for i, v in enumerate(p[1]) if v >= 100))

def top(d, n, skip=("Other",)):
    return [k for k, _ in sorted(d.items(), key=lambda kv: -kv[1]) if k not in skip][:n]

res, from_stats, from_sets = {}, 0, 0
species = set(sets) | {s for f in FORMATS for s in stats[f]}
for sp in sorted(species):
    cands = [(stats[f][sp]["count"], f) for f in FORMATS if sp in stats[f] and stats[f][sp].get("count", 0) >= 150]
    entry = None
    if cands:
        _, f = max(cands)
        s = stats[f][sp]
        spreads = []
        for k, _w in sorted(s["spreads"].items(), key=lambda kv: -kv[1]):
            p = parse_spread(k)
            if p and shape(p) not in map(shape, spreads): spreads.append(p)
            if len(spreads) == 3: break
        if spreads:
            entry = {"s": spreads, "a": top(s.get("abilities", {}), 2), "i": top(s.get("items", {}), 5)}
            from_stats += 1
    if entry is None and sp in sets:
        spreads, abil, items = [], [], []
        for f in SET_FORMATS:
            for _name, st in sets[sp].get(f, {}).items():
                nat = st.get("nature"); nat = nat[0] if isinstance(nat, list) else nat
                evs = st.get("evs") or {}
                evs = evs[0] if isinstance(evs, list) else evs
                if nat in NATURES and evs:
                    p = [nat, [evs.get(k, 0) for k in STATS]]
                    if shape(p) not in map(shape, spreads): spreads.append(p)
                a = st.get("ability"); a = a[0] if isinstance(a, list) else a
                if a and a not in abil: abil.append(a)
                it = st.get("item"); it = it[0] if isinstance(it, list) else it
                if it and it not in items: items.append(it)
            if spreads: break
        if spreads:
            entry = {"s": spreads[:3], "a": abil[:2], "i": items[:5]}
            from_sets += 1
    if entry: res[sp] = entry
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(res)} espèces (stats: {from_stats}, sets Smogon: {from_sets}) sur {len(species)} ; {len(json.dumps(res, ensure_ascii=False, separators=(',', ':')))//1024} Ko")
