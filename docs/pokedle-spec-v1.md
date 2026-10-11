# Pokédle Battle

Un combat Pokémon par jour, identique pour tout le monde (PWA, Vite + React + TS, moteur `@pkmn/sim`).

## Règles
- Clé du jour en UTC (changement à minuit UTC = 8h à Kuala Lumpur) → seed déterministe.
- Dresseur canon tiré au sort parmi les 4 générations (Rouge, Cristal, Émeraude, Platine : arènes, Conseil des 4, champions ; à partir du 2026-10-13 aussi boss et admins des équipes Rocket/Aqua/Magma/Galaxie, rivaux et Pierre Rochard, voir `EXTRA_FROM` dans `daily.ts`) ; sa génération d'origine sert de « ligue » (affichage, historique, classement). Le combat, lui, est **toujours en génération 4** (moteur `@pkmn/sim` gen 4, 493 espèces, `BATTLE_GEN` dans `src/game/daily.ts`) : l'équipe d'origine du dresseur (gens 1-4) est convertie en gen 4, montée niveau 100 et complétée à 6 avec des Pokémon du thème du dresseur ; le joueur tire dans tout le pool gen 4. Combats inter-générations assumés.
- Gen 1 : le jeu d'origine n'a pas d'attaques dans ses données de dresseurs, elles sont générées (`scripts/fill_moves.mjs`) à partir des attaques réellement apprenables dans la génération.
- Équipe imposée au joueur (6 Pokémon niveau 100) tirée via `@pkmn/randoms`, filtrée par simulations IA vs IA (cible 35–65 % de victoires) ; en pratique ~2/3 des jours tombent dans la cible avec les trainers des gens 1-2 plus durs à équilibrer.
- 1 tentative par jour, abandon = défaite, reprise après rechargement (les choix sont rejoués, le combat est déterministe).
- Historique : victoires totales, série en cours, meilleure série. En ligne via Supabase (projet `pokedle`, tables `profiles` et `results` avec RLS, fonctions `leaderboard_v2` et `daily_stats`) quand le joueur est connecté ; stockage local pour les invités.

## Interface
- Combat : écran au cadre GBA fidèle (240×160, menus et texte à la machine à écrire), sprites 100 % originaux générés par code (`src/game/sprites.ts`, grille 64×64 : forme tirée de la ligne évolutive, couleurs des types, taille ≈ poids, décors par type ; face et dos). `node` : `npx tsx scripts/sheet.ts <out.json> <n° dex…>` + `python3 scripts/mksheet.py` produisent une planche-contact.
- Le reste (accueil, adversaire, équipe, résultat, historique, classement, profil, générations, onboarding) suit le design Stitch : thèmes clair/sombre/auto, Outfit + Plus Jakarta Sans, barre de navigation basse. Noms de Pokémon/attaques/types en français.
- Musique de combat : boucles chiptune originales de 16 mesures synthétisées par code (`src/game/music.ts`, aucun fichier ni air officiel), lancées au geste de confirmation du combat, arrêtées en fondu à la fin ou quand on quitte l'écran. Un thème par classe de dresseur (arène, Conseil des 4, Maître, méchants, rival, ancien Maître), timbres/tempo/écho selon la génération ; coupée avec le bouton son du combat.
- Non repris du design Stitch : modificateurs d'arène, onglets Pokédex/Devine, mode libre, connexion Google/Apple, XP/niveaux, notifications/audio.

## Commandes
- `npm run dev` / `npm run build` / `npm run preview`
- `python3 -I scripts/extract_extra.py <dossier des dépôts pret> src/data` : régénère `trainers.extra.gen*.json` (boss d'équipe, admins, rivaux, Pierre Rochard) ; champ `sprite` = id Showdown, `stage` = lieu quand la même personne apparaît plusieurs fois
- `node scripts/validate_gen3.mjs` : vérifie que les données de dresseurs existent bien en gen 3
- `python3 -I scripts/extract_gen3.py <pokeemerald> src/data/trainers.gen3.json` et `python3 -I scripts/extract_gen124.py <dossier des dépôts pret> src/data` : régénèrent les données (puis `node scripts/fill_moves.mjs` pour valider et compléter)
- `npx tsx scripts/test_daily.ts`, `test_session.ts`, `test_history.ts` : tests rapides
- `node scripts/e2e2.mjs <dossier>` : parcours complet dans Chromium (nécessite `npm run preview`)
- `python3 -I scripts/analyze_sprites.py --archives generation-{1,2,3,4}.tar.gz --out-dir out` (nécessite `ANTHROPIC_API_KEY`, `pip install aiohttp pillow`) : envoie les sprites des archives PokéAPI à une API Vision (async, backoff 429/5xx, reprise via `sprite_results.jsonl`) et produit `master_sprite_dataset.json` (`{ "<n° dex>": { "<version>": { primary_colors, anatomy, distinct_features, pose } } }`) ; échecs dans `failed_images.log`. Par défaut : red-blue, crystal, emerald, platinum, sprites de face uniquement (`--versions all` / `--all-variants` pour le reste).
- `node scripts/build_sprite_traits.mjs out/master_sprite_dataset.json` : convertit ces descriptions en traits compacts (`src/data/sprite-traits.json` : silhouette, 3 couleurs, queue, oreilles, nombre de têtes/yeux, détails comme cornes, pinces, ailes…) que `sprites.ts` applique ; les espèces sans traits gardent le rendu généré par type. `scripts/fixtures/master_sprite_sample.json` (6 Pokémon décrits à la main) sert de test en attendant le vrai lancement.
- Illustrations : lues à la volée dans le dépôt PokéAPI/sprites (raw.githubusercontent.com, `src/game/officialSprites.tsx`) — sprite Platine (gen 4, face et dos) pour toutes les générations, pour le combat et les petites vignettes, artwork officiel pour les grandes cartes (fiche, aperçu). Repli sur le sprite généré (`game/sprites.ts`) si l'image est introuvable. `VITE_SPRITES_URL` : miroir PokéAPI/sprites optionnel. Mises en cache à la demande par le service worker. Aucune image n'est hébergée dans le dépôt.

## Reste à faire
- Habillage rétro propre à chaque génération ; affiner les sprites générés (ou brancher un pack sous licence ouverte)
- Lancer `analyze_sprites.py` sur les vraies archives (testé seulement contre une API simulée), puis `build_sprite_traits.mjs` pour remplacer les 6 traits de test par les ~490 espèces
- Autres versions par génération (Bleu/Jaune, Or/Argent, Rubis/Saphir/Rouge Feu, Diamant/Perle/HGSS)
- Vérification serveur du combat complet (aujourd'hui seul le résultat est contrôlé : jour, doublon, propriétaire)
- Déplacer le filtre d'équilibrage côté serveur (précalcul) 
- Tate & Liza (double combat) et Steven exclus de la V1
