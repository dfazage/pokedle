// Vérifie les modificateurs de stats (étapes + messages FR) et la table des types affichée au-dessus des PV.
import { formatSteps } from '../src/game/session'
import { matchups, typeMultiplier } from '../src/game/typechart'

let bad = 0
const check = (name: string, ok: boolean) => { if (!ok) bad++; console.log(ok ? 'OK ' : '✗  ', name) }
const run = (...l: string[]) => formatSteps(l)

const b1 = run('|-boost|p1a: Pikachu|atk|2')
check('boost +2 : texte', b1.some((s) => s.text === 'L\'Attaque de Pikachu augmente beaucoup !'))
check('boost +2 : état', b1.some((s) => s.boost?.side === 'player' && s.boost.boosts.atk === 2))
const b2 = run('|-unboost|p2a: Onix|spd|1')
check('baisse adverse', b2.some((s) => s.text === 'La Défense Spéciale de Onix adverse diminue !' && s.boost?.boosts.spd === -1))
const b3 = run('|-boost|p1a: Pikachu|atk|1', '|-boost|p1a: Pikachu|atk|2', '|-unboost|p1a: Pikachu|spe|1')
check('cumul', b3[b3.length - 1].boost?.boosts.atk === 3 && b3[b3.length - 1].boost?.boosts.spe === -1)
check('plafonné à +6', run('|-boost|p1a: Pikachu|atk|6', '|-boost|p1a: Pikachu|atk|2').pop()!.boost?.boosts.atk === 6)
check('retour à 0 : clé retirée', !('atk' in run('|-boost|p1a: Pikachu|atk|1', '|-unboost|p1a: Pikachu|atk|1').pop()!.boost!.boosts))
check('énormément', run('|-boost|p1a: Pikachu|atk|3').some((s) => s.text?.endsWith('augmente énormément !')))
check('réinitialisation (Rafale Statistik)', run('|-boost|p1a: Pikachu|atk|2', '|-clearboost|p1a: Pikachu').pop()!.boost?.boosts.atk === undefined)
check('Brume / Cognobidon : setboost', run('|-setboost|p1a: Pikachu|atk|6|[from] move: Belly Drum').some((s) => s.boost?.boosts.atk === 6))
check('changement de Pokémon : boosts remis à zéro', run('|-boost|p1a: Pikachu|atk|2', '|switch|p1a: Onix|Onix, L100|100/100', '|-boost|p1a: Onix|def|1').pop()!.boost?.boosts.atk === undefined)
check('clearallboost : les deux camps', run('|-boost|p1a: Pikachu|atk|2', '|-clearallboost').filter((s) => s.boost).slice(-2).every((s) => Object.keys(s.boost!.boosts).length === 0))

// Table des types (gen 4)
check('Feu → Plante ×2', typeMultiplier('Fire', ['Grass']) === 2)
check('Roche → Insecte/Vol ×4', typeMultiplier('Rock', ['Bug', 'Flying']) === 4)
check('Sol → Vol immunisé', typeMultiplier('Ground', ['Flying']) === 0)
check('Spectre → Acier ×½ (gen 2-5)', typeMultiplier('Ghost', ['Steel']) === 0.5)
check('Plante → Insecte/Vol ×¼', typeMultiplier('Grass', ['Bug', 'Flying']) === 0.25)
const m = matchups(['Bug', 'Flying'])
check('Apireine : faiblesses', m.weak.map((x) => `${x.type}${x.mult}`).join() === 'Rock4,Fire2,Electric2,Ice2,Flying2')
check('Apireine : résistances', m.resist.map((x) => `${x.type}${x.mult}`).join() === 'Ground0,Grass0.25,Fighting0.25,Bug0.5')
process.exit(bad ? 1 : 0)
