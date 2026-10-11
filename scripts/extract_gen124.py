import re, json, sys, glob, os
SRC = sys.argv[1]; OUT = sys.argv[2]
def ident(s):
    r = re.sub(r"[^a-z0-9]", "", s.lower())
    return {"psychicm": "psychic"}.get(r, r)  # PSYCHIC_M = capacité Psyko dans pokecrystal

# ---------- Gen 1 : pokered (Rouge) ----------
def gen1():
    txt = open(f"{SRC}/pokered/data/trainers/parties.asm", encoding="utf-8").read()
    wanted = [("BrockData","Brock","Gym Leader",1),("MistyData","Misty","Gym Leader",2),("LtSurgeData","Lt. Surge","Gym Leader",3),
      ("ErikaData","Erika","Gym Leader",4),("KogaData","Koga","Gym Leader",5),("SabrinaData","Sabrina","Gym Leader",6),
      ("BlaineData","Blaine","Gym Leader",7),("GiovanniData","Giovanni","Gym Leader",8),
      ("Rival3Data","Blue","Champion",13),("LoreleiData","Lorelei","Elite Four",9),("BrunoData","Bruno","Elite Four",10),("AgathaData","Agatha","Elite Four",11),("LanceData","Lance","Elite Four",12)]
    res = []
    for label, name, cls, order in wanted:
        m = re.search(label + r":\s*\n((?:\s*(?:db|;)[^\n]*\n)+)", txt)
        if not m: print("gen1 MISSING", label); continue
        # Giovanni a plusieurs entrées (Rocket / gym) : on prend la dernière ligne (arène)
        lines = [l for l in m.group(1).strip().split("\n") if l.strip().startswith("db")]
        line = lines[-1] if label == "GiovanniData" else lines[0]
        parts = [p.strip() for p in line.strip()[2:].split(",")]
        parts = [p for p in parts if p not in ("$FF", "0")]
        team = []
        for i in range(0, len(parts), 2):
            team.append({"species": ident(parts[i+1]), "origLevel": int(parts[i]), "item": None, "moves": []})
        res.append({"id": ident(name), "name": name, "class": cls, "order": order, "gen": 1, "game": "red", "team": team})
    return res

# ---------- Gen 2 : pokecrystal (Cristal) ----------
def gen2():
    txt = open(f"{SRC}/pokecrystal/data/trainers/parties.asm", encoding="utf-8").read()
    wanted = {"FALKNER":("Gym Leader",1),"BUGSY":("Gym Leader",2),"WHITNEY":("Gym Leader",3),"MORTY":("Gym Leader",4),"CHUCK":("Gym Leader",5),
      "JASMINE":("Gym Leader",6),"PRYCE":("Gym Leader",7),"CLAIR":("Gym Leader",8),
      "WILL":("Elite Four",9),"KOGA":("Elite Four",10),"BRUNO":("Elite Four",11),"KAREN":("Elite Four",12),"LANCE":("Champion",13),
      "BROCK":("Kanto Gym Leader",14),"MISTY":("Kanto Gym Leader",15),"LT.SURGE":("Kanto Gym Leader",16),"ERIKA":("Kanto Gym Leader",17),
      "JANINE":("Kanto Gym Leader",18),"SABRINA":("Kanto Gym Leader",19),"BLAINE":("Kanto Gym Leader",20),"BLUE":("Kanto Gym Leader",21),"RED":("Champion",22)}
    res = {}
    for m in re.finditer(r'db "([^@]+)@", (TRAINERTYPE_\w+)\n((?:\t(?:db|;)[^\n]*\n)+)', txt):
        name, ttype, body = m.groups()
        key = name.replace(" ", "")
        if key not in wanted or key in res: continue
        team = []
        for line in body.split("\n"):
            line = line.split(";")[0].strip()
            if not line.startswith("db"): continue
            items = [x.strip() for x in line[2:].split(",")]
            if items[0] == "-1": break
            lvl, species, rest = int(items[0]), items[1], items[2:]
            item = None; moves = []
            if ttype in ("TRAINERTYPE_ITEM", "TRAINERTYPE_ITEM_MOVES"): item, rest = rest[0], rest[1:]
            if ttype in ("TRAINERTYPE_MOVES", "TRAINERTYPE_ITEM_MOVES"): moves = [ident(x) for x in rest if x != "NO_MOVE"]
            team.append({"species": ident(species), "origLevel": lvl, "item": None if not item or item == "NO_ITEM" else ident(item), "moves": moves})
        cls, order = wanted[key]
        res[key] = {"id": ident(name), "name": name.title().replace("Lt.Surge","Lt. Surge") if name != "LT.SURGE" else "Lt. Surge", "class": cls, "order": order, "gen": 2, "game": "crystal", "team": team}
    for k in wanted:
        if k not in res: print("gen2 MISSING", k)
    return sorted(res.values(), key=lambda t: t["order"])

# ---------- Gen 4 : pokeplatinum (Platine) ----------
def gen4():
    d = f"{SRC}/pokeplatinum/res/trainers/data"
    files = [("leader_roark","Roark","Gym Leader",1),("leader_gardenia","Gardenia","Gym Leader",2),("leader_maylene","Maylene","Gym Leader",3),
      ("leader_crasher_wake","Crasher Wake","Gym Leader",4),("leader_fantina","Fantina","Gym Leader",5),("leader_byron","Byron","Gym Leader",6),
      ("leader_candice","Candice","Gym Leader",7),("leader_volkner","Volkner","Gym Leader",8),
      ("elite_four_aaron","Aaron","Elite Four",9),("elite_four_bertha","Bertha","Elite Four",10),("elite_four_flint","Flint","Elite Four",11),
      ("elite_four_lucian","Lucian","Elite Four",12),("champion_cynthia","Cynthia","Champion",13)]
    res = []
    for f, name, cls, order in files:
        path = f"{d}/{f}.json"
        if f == "leader_crasher_wake": path = f"{d}/leader_wake.json"
        if not os.path.exists(path): print("gen4 MISSING", f); continue
        j = json.load(open(path, encoding="utf-8"))
        team = []
        for mon in j["party"]:
            sp = mon["species"].replace("SPECIES_", "")
            it = (mon.get("item") or "ITEM_NONE").replace("ITEM_", "")
            team.append({"species": ident(sp), "origLevel": mon["level"], "item": None if it == "NONE" else ident(it),
                         "moves": [ident(x.replace("MOVE_", "")) for x in mon.get("moves", []) if x != "MOVE_NONE"]})
        res.append({"id": ident(name), "name": name, "class": cls, "order": order, "gen": 4, "game": "platinum", "team": team})
    return res

for g, fn in ((1, gen1), (2, gen2), (4, gen4)):
    r = fn()
    json.dump(r, open(f"{OUT}/trainers.gen{g}.json", "w"), indent=1)
    print(f"gen{g}:", len(r), "dresseurs")
    for t in r: print("  ", t["name"], len(t["team"]), [x["species"] for x in t["team"]])
