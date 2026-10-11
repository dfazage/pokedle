import re, json, sys
src = sys.argv[1]; out = sys.argv[2]
trainers = open(f"{src}/src/data/trainers.h", encoding="utf-8").read()
parties = open(f"{src}/src/data/trainer_parties.h", encoding="utf-8").read()

WANTED = {
 "TRAINER_ROXANNE_1":("Roxanne","Gym Leader",1),"TRAINER_BRAWLY_1":("Brawly","Gym Leader",2),
 "TRAINER_WATTSON_1":("Wattson","Gym Leader",3),"TRAINER_FLANNERY_1":("Flannery","Gym Leader",4),
 "TRAINER_NORMAN_1":("Norman","Gym Leader",5),"TRAINER_WINONA_1":("Winona","Gym Leader",6),
 "TRAINER_JUAN_1":("Juan","Gym Leader",8),
 "TRAINER_SIDNEY":("Sidney","Elite Four",9),"TRAINER_PHOEBE":("Phoebe","Elite Four",10),
 "TRAINER_GLACIA":("Glacia","Elite Four",11),"TRAINER_DRAKE":("Drake","Elite Four",12),
 "TRAINER_WALLACE":("Wallace","Champion",13),
}
def ident(s): return re.sub(r"[^a-z0-9]","",s.lower())

# map party symbol -> list of mons
pm = {}
for m in re.finditer(r"static const struct TrainerMon\w+ (sParty_\w+)\[\] = \{(.*?)\n\};", parties, re.S):
    mons=[]
    for b in re.finditer(r"\{\s*\.iv = (\d+),\s*\.lvl = (\d+),\s*\.species = SPECIES_(\w+),\s*(?:\.heldItem = ITEM_(\w+),\s*)?(?:\.moves = \{([^}]*)\})?", m.group(2)):
        iv,lvl,sp,item,moves = b.groups()
        mv = [ident(x.strip().replace("MOVE_","")) for x in moves.split(",")] if moves else []
        mons.append({"species":ident(sp),"origLevel":int(lvl),"item":None if (not item or item=="NONE") else ident(item),"moves":[x for x in mv if x!="none"]})
    pm[m.group(1)] = mons

res=[]
for key,(name,cls,order) in WANTED.items():
    m = re.search(r"\["+key+r"\] =\s*\{(.*?)\n    \},", trainers, re.S)
    if not m: print("MISSING",key); continue
    p = re.search(r"\.party = \w+\((sParty_\w+)\)", m.group(1)).group(1)
    team = pm[p]
    res.append({"id":ident(name),"name":name,"class":cls,"order":order,"gen":3,"game":"emerald","team":team})
json.dump(res, open(out,"w"), indent=1)
for t in res: print(t["name"], len(t["team"]), [x["species"] for x in t["team"]])
