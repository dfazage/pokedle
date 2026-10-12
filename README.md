# Pokédle Battle

Un combat Pokémon par jour, identique pour tout le monde (PWA, Vite + React + TS, moteur `@pkmn/sim`).

## Règles
- Clé du jour en UTC (changement à minuit UTC = 8h à Kuala Lumpur) → seed déterministe.
- Génération tirée au sort (1 à 5, une version par génération : Rouge, Cristal, Émeraude, Platine, Noir 2 ; la gen 5 entre dans le tirage à partir du 15/10/2026, `GEN5_FROM` dans `src/game/daily.ts`), puis dresseur canon (arènes, Conseil des 4, champions). Équipe d'origine montée niveau 100 et complétée à 6 avec des Pokémon du thème du dresseur.
- Gen 1 : le jeu d'origine n'a pas d'attaques dans ses données de dresseurs, elles sont générées (`scripts/fill_moves.mjs`) à partir des attaques réellement apprenables dans la génération.
- Moteur de combat : gen 5 (649 espèces, mécaniques Noir/Blanc) à partir de `GEN5_FROM`, gen 4 avant (le défi d'un jour donné ne change jamais). Tous les dresseurs, y compris ceux des gens 1 à 4, s'affrontent avec le moteur du jour. Gen 5 : sprites Noir/Blanc, profils compétitifs gen 5 (`scripts/build_profiles_gen5.py`), dresseurs de Noir 2/Blanc 2 en mode Normal (`trainers.gen5.json`, `trainers.extra.gen5.json`).
- Équipe imposée au joueur (6 Pokémon niveau 100) tirée via `@pkmn/randoms`, filtrée par simulations IA vs IA (cible 35–65 % de victoires).
- 1 tentative par jour, abandon = défaite, reprise après rechargement (les choix sont rejoués, le combat est déterministe).
- Historique : victoires totales, série en cours, meilleure série. En ligne via Supabase (projet `pokedle`, tables `profiles` et `results` avec RLS, fonctions `leaderboard_v2` et `daily_stats`) quand le joueur est connecté ; stockage local pour les invités.

## Interface
- Combat : écran au cadre GBA fidèle (240×160, menus et texte à la machine à écrire), sprites 100 % originaux générés par code (`src/game/sprites.ts`, grille 64×64 : forme tirée de la ligne évolutive, couleurs des types, taille ≈ poids, décors par type ; face et dos). `node` : `npx tsx scripts/sheet.ts <out.json> <n° dex…>` + `python3 scripts/mksheet.py` produisent une planche-contact.
- Le reste (accueil, adversaire, équipe, résultat, historique, classement, profil, générations, onboarding) suit le design Stitch : thèmes clair/sombre/auto, Outfit + Plus Jakarta Sans, barre de navigation basse. Noms de Pokémon/attaques/types en français.
- Non repris du design Stitch : modificateurs d'arène, onglets Pokédex/Devine, mode libre, connexion Google/Apple, XP/niveaux, notifications/audio.

## Commandes
- `npm run dev` / `npm run build` / `npm run preview`
- `START=14 N=40 npx tsx scripts/test_all_gens.ts` (parties complètes sur plusieurs jours) et `npx tsx scripts/test_gen5_balance.ts` (équilibrage gen 5)
- `node scripts/validate_gen3.mjs` : vérifie que les données de dresseurs existent bien en gen 3
- `python3 -I scripts/extract_gen3.py <pokeemerald> src/data/trainers.gen3.json` et `python3 -I scripts/extract_gen124.py <dossier des dépôts pret> src/data` : régénèrent les données (puis `node scripts/fill_moves.mjs` pour valider et compléter)
- `npx tsx scripts/test_daily.ts`, `test_session.ts`, `test_history.ts` : tests rapides
- `node scripts/e2e2.mjs <dossier>` : parcours complet dans Chromium (nécessite `npm run preview`)

## Reste à faire
- Habillage rétro propre à chaque génération ; affiner les sprites générés (ou brancher un pack sous licence ouverte)
- Autres versions par génération (Bleu/Jaune, Or/Argent, Rubis/Saphir/Rouge Feu, Diamant/Perle/HGSS)
- Vérification serveur du combat complet (aujourd'hui seul le résultat est contrôlé : jour, doublon, propriétaire)
- Déplacer le filtre d'équilibrage côté serveur (précalcul) 
- Tate & Liza (double combat) et Steven exclus de la V1
