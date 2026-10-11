"""Dresseurs « hors ligue » : boss et admins des équipes (Rocket, Aqua, Magma, Galaxie), rivaux, Pierre Rochard (Steven)…

Usage : python3 -I scripts/extract_extra.py <dossier des dépôts pret> src/data
Produit src/data/trainers.extra.gen{1,2,3,4}.json (même format que trainers.gen*.json, plus `sprite` = id du sprite
Showdown et `stage` = lieu du combat). Ensuite : node scripts/fill_moves.mjs (validation + attaques manquantes).
"""
import re, json, sys, os

SRC, OUT = sys.argv[1], sys.argv[2]


def ident(s):
    r = re.sub(r"[^a-z0-9]", "", s.lower())
    return {"psychicm": "psychic"}.get(r, r)


def entry(name, cls, order, gen, game, stage, slug, team, sprite=None):
    return {
        "id": f"{ident(name)}-{slug}", "name": name, "class": cls, "order": order, "gen": gen, "game": game,
        "stage": stage, "sprite": sprite or ident(name), "team": team,
    }


# ---------- Gen 1 : pokered ----------
def gen1():
    txt = open(f"{SRC}/pokered/data/trainers/parties.asm", encoding="utf-8").read()

    def block(label):
        m = re.search(r"\n" + label + r":\s*\n(.*?)(?=\n[A-Za-z0-9]+Data:)", txt, re.S)
        return m.group(1)

    def lines(label):
        return [l for l in block(label).split("\n") if l.strip().startswith("db")]

    def team(line):
        parts = [p.strip() for p in line.strip()[2:].split(",")]
        parts = [p for p in parts if p not in ("$FF", "0")]
        return [{"species": ident(parts[i + 1]), "origLevel": int(parts[i]), "item": None, "moves": []} for i in range(0, len(parts), 2)]

    g, r2 = lines("GiovanniData"), lines("Rival2Data")
    # Rival2Data : 3 variantes (starter) par combat ; on prend celle de Dracaufeu (3e) : SS Anne, Tour Pokémon, Sylphe, Route 22
    return [
        entry("Giovanni", "Team Boss", 20, 1, "red", "Repaire Rocket", "rocket", team(g[0])),
        entry("Giovanni", "Team Boss", 21, 1, "red", "Sylphe SARL", "silph", team(g[1])),
        entry("Blue", "Rival", 22, 1, "red", "Sylphe SARL", "silph", team(r2[8])),
        entry("Blue", "Rival", 23, 1, "red", "Route 22", "route22", team(r2[11])),
    ]


# ---------- Gen 2 : pokecrystal ----------
def gen2():
    txt = open(f"{SRC}/pokecrystal/data/trainers/parties.asm", encoding="utf-8").read()

    def group(label):
        m = re.search(label + r"Group:\n(.*?)(?=\n[A-Za-z0-9]+Group:)", txt, re.S)
        return m.group(1)

    def parse(body, n):
        """n-ième dresseur (1-based) d'un groupe."""
        chunks = re.split(r"\n\t; [A-Z0-9_]+ \(\d+\)\n", "\n" + body)[1:]
        chunk = chunks[n - 1]
        head = re.search(r'db "[^@]*@", (TRAINERTYPE_\w+)', chunk).group(1)
        team = []
        for line in chunk.split("\n"):
            line = line.split(";")[0].strip()
            if not line.startswith("db") or '"' in line:
                continue
            items = [x.strip() for x in line[2:].split(",")]
            if items[0] == "-1":
                break
            lvl, species, rest = int(items[0]), items[1], items[2:]
            item = None
            moves = []
            if head in ("TRAINERTYPE_ITEM", "TRAINERTYPE_ITEM_MOVES"):
                item, rest = rest[0], rest[1:]
            if head in ("TRAINERTYPE_MOVES", "TRAINERTYPE_ITEM_MOVES"):
                moves = [ident(x) for x in rest if x != "NO_MOVE"]
            team.append({"species": ident(species), "origLevel": lvl, "item": None if not item or item == "NO_ITEM" else ident(item), "moves": moves})
        return team

    em, ef, r2 = group("ExecutiveM"), group("ExecutiveF"), group("Rival2")
    return [
        entry("Archer", "Team Executive", 20, 2, "crystal", None, "radiotower", parse(em, 1)),
        entry("Ariana", "Team Executive", 21, 2, "crystal", None, "radiotower", parse(ef, 1)),
        entry("Silver", "Rival", 22, 2, "crystal", "Route Victoire", "victoryroad", parse(r2, 3)),
        entry("Silver", "Rival", 23, 2, "crystal", "Mont Argenté", "mtsilver", parse(r2, 6)),
    ]


# ---------- Gen 3 : pokeemerald ----------
def gen3():
    trainers = open(f"{SRC}/pokeemerald/src/data/trainers.h", encoding="utf-8").read()
    parties = open(f"{SRC}/pokeemerald/src/data/trainer_parties.h", encoding="utf-8").read()
    pm = {}
    for m in re.finditer(r"static const struct TrainerMon\w+ (sParty_\w+)\[\] = \{(.*?)\n\};", parties, re.S):
        mons = []
        for b in re.finditer(r"\{\s*\.iv = (\d+),\s*\.lvl = (\d+),\s*\.species = SPECIES_(\w+),\s*(?:\.heldItem = ITEM_(\w+),\s*)?(?:\.moves = \{([^}]*)\})?", m.group(2)):
            iv, lvl, sp, item, moves = b.groups()
            mv = [ident(x.strip().replace("MOVE_", "")) for x in moves.split(",")] if moves else []
            mons.append({"species": ident(sp), "origLevel": int(lvl), "item": None if (not item or item == "NONE") else ident(item), "moves": [x for x in mv if x != "none"]})
        pm[m.group(1)] = mons

    def team(key):
        m = re.search(r"\[" + key + r"\] =\s*\{(.*?)\n    \},", trainers, re.S)
        return pm[re.search(r"\.party = \w+\((sParty_\w+)\)", m.group(1)).group(1)]

    return [
        entry("Archie", "Team Boss", 20, 3, "emerald", None, "seafloor", team("TRAINER_ARCHIE")),
        entry("Maxie", "Team Boss", 21, 3, "emerald", None, "mossdeep", team("TRAINER_MAXIE_MOSSDEEP")),
        entry("Tabitha", "Team Executive", 22, 3, "emerald", None, "mossdeep", team("TRAINER_TABITHA_MOSSDEEP")),
        entry("Shelly", "Team Executive", 23, 3, "emerald", None, "seafloor", team("TRAINER_SHELLY_SEAFLOOR_CAVERN")),
        entry("Matt", "Team Executive", 24, 3, "emerald", None, "chimney", team("TRAINER_MATT")),
        entry("Brendan", "Rival", 25, 3, "emerald", None, "lilycove", team("TRAINER_BRENDAN_LILYCOVE_MUDKIP")),
        entry("Wally", "Rival", 26, 3, "emerald", None, "victoryroad", team("TRAINER_WALLY_VR_5")),
        entry("Steven", "Former Champion", 27, 3, "emerald", None, "meteorfalls", team("TRAINER_STEVEN")),
    ]


# ---------- Gen 4 : pokeplatinum ----------
def gen4():
    d = f"{SRC}/pokeplatinum/res/trainers/data"

    def team(f):
        j = json.load(open(f"{d}/{f}.json", encoding="utf-8"))
        out = []
        for mon in j["party"]:
            it = (mon.get("item") or "ITEM_NONE").replace("ITEM_", "")
            out.append({"species": ident(mon["species"].replace("SPECIES_", "")), "origLevel": mon["level"], "item": None if it == "NONE" else ident(it),
                        "moves": [ident(x.replace("MOVE_", "")) for x in mon.get("moves", []) if x != "MOVE_NONE"]})
        return out

    return [
        entry("Cyrus", "Team Boss", 20, 4, "platinum", "Monde Distorsion", "distortion", team("galactic_boss_cyrus_distortion_world")),
        entry("Cyrus", "Team Boss", 21, 4, "platinum", "QG Galaxie", "hq", team("galactic_boss_cyrus_galactic_hq")),
        entry("Mars", "Team Executive", 22, 4, "platinum", None, "spearpillar", team("commander_mars_spear_pillar")),
        entry("Jupiter", "Team Executive", 23, 4, "platinum", None, "spearpillar", team("commander_jupiter_spear_pillar")),
        entry("Saturn", "Team Executive", 24, 4, "platinum", None, "hq", team("commander_saturn_galactic_hq")),
        entry("Barry", "Rival", 25, 4, "platinum", None, "league", team("rival_pokemon_league_turtwig")),
    ]


for g, fn in ((1, gen1), (2, gen2), (3, gen3), (4, gen4)):
    r = fn()
    with open(os.path.join(OUT, f"trainers.extra.gen{g}.json"), "w", encoding="utf-8") as f:
        json.dump(r, f, indent=1, ensure_ascii=False)
    print(f"gen{g}:", len(r), "dresseurs")
    for t in r:
        print("  ", t["id"], t["class"], len(t["team"]), [f'{x["species"]}{x["origLevel"]}' for x in t["team"]])
