import { buildShareText, fallbackGrid, gridFor, gridFromTeams } from '../src/game/share'
import { setLang } from '../src/i18n'
import type { DayRecord } from '../src/game/history'
let fail = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`)
}
const rec = (o: Partial<DayRecord> = {}): DayRecord => ({ dayKey: '2026-10-12', trainer: 'Cynthia', gen: 4, result: 'win', turns: 14, survivors: 3, kos: 6, hpLeft: 62, ...o })
const URL = 'https://pokebadle.fun'

// ── Grille depuis les équipes ──
const mon = (hp: number, fainted = false) => ({ hp, maxhp: 100, fainted })
eq('grille : en vie / faible / K.O.', gridFromTeams([mon(100), mon(29), mon(30), mon(0, true), mon(0), mon(80)], [{ fainted: true }, { fainted: false }]), { you: 'gygrrg', foe: 'xo' })
eq('grille : maxhp nul ne plante pas', gridFromTeams([{ hp: 0, maxhp: 0, fainted: false }], []), { you: 'r', foe: '' })

// ── Grille de repli ──
eq('repli victoire 4 survivants', fallbackGrid(rec({ survivors: 4, kos: 6 })), { you: 'ggggrr', foe: 'xxxxxx' })
eq('repli défaite', fallbackGrid(rec({ result: 'loss', survivors: 0, kos: 2 })), { you: 'rrrrrr', foe: 'xxoooo' })
eq('repli sans compteurs (victoire)', fallbackGrid({ result: 'win' }), { you: 'grrrrr', foe: 'xxxxxx' })
eq('repli sans compteurs (défaite)', fallbackGrid({ result: 'loss' }), { you: 'rrrrrr', foe: 'oooooo' })
eq('repli borne les valeurs', fallbackGrid({ result: 'win', survivors: 99, kos: -3 }), { you: 'gggggg', foe: 'oooooo' })

// ── Choix de la grille ──
const stored = { you: 'gygrrr', foe: 'xxxxxx' }
eq('grille locale cohérente → utilisée', gridFor('d', rec(), stored), stored)
eq('grille locale incohérente (survivants) → repli', gridFor('d', rec({ survivors: 5 }), stored), fallbackGrid(rec({ survivors: 5 })))
eq('grille locale incohérente (K.O.) → repli', gridFor('d', rec({ kos: 4 }), stored), fallbackGrid(rec({ kos: 4 })))
eq('pas de grille locale → repli', gridFor('d', rec(), null), fallbackGrid(rec()))

// ── Texte (FR) ──
setLang('fr')
const win = buildShareText({ rec: rec({ attempts: 2 }), dayNo: 142, grid: stored, streak: 7, points: 312, url: URL })
eq(
  'texte FR victoire',
  win,
  ['Pokédle Battle #142 ⚔️', 'Cynthia · Platine · Victoire 🏆', '🟩🟨🟩🟥🟥🟥 ➜ ⬛⬛⬛⬛⬛⬛', '⏱ 14 tours · 💚 62 % PV · 🔥 série de 7', '+312 pts · 💔 essai 2', '', 'Fais mieux que moi 👉 https://pokebadle.fun'].join('\n'),
)
const loss = buildShareText({ rec: rec({ result: 'loss', survivors: 0, kos: 2, turns: 1, hpLeft: 0 }), dayNo: 3, grid: fallbackGrid({ result: 'loss', survivors: 0, kos: 2 }), streak: 4, points: 99, url: URL })
eq(
  'texte FR défaite : ni points ni série, « 1 tour »',
  loss,
  ['Pokédle Battle #3 ⚔️', 'Cynthia · Platine · Défaite 💀', '🟥🟥🟥🟥🟥🟥 ➜ ⬛⬛🟦🟦🟦🟦', '⏱ 1 tour · 💚 0 % PV', '', 'Fais mieux que moi 👉 https://pokebadle.fun'].join('\n'),
)
eq('série de 1 non affichée', buildShareText({ rec: rec(), dayNo: 1, grid: stored, streak: 1, points: 10, url: URL }).includes('🔥'), false)
const old = buildShareText({ rec: rec({ hpLeft: undefined }), dayNo: 1, grid: stored, streak: 1, url: URL })
eq('sans PV ni points : lignes omises, pas de « undefined »', [old.includes('💚'), old.includes('+'), old.includes('undefined'), old.includes('\n\n\n')], [false, false, false, false])
eq('aucun nom de Pokémon / attaque (texte = dresseur + stats seulement)', win.split('\n').length, 7)

// ── Texte (EN) ──
setLang('en')
eq(
  'texte EN victoire',
  buildShareText({ rec: rec(), dayNo: 142, grid: stored, streak: 7, points: 312, url: URL }),
  ['Pokédle Battle #142 ⚔️', 'Cynthia · Platinum · Win 🏆', '🟩🟨🟩🟥🟥🟥 ➜ ⬛⬛⬛⬛⬛⬛', '⏱ 14 turns · 💚 62% HP · 🔥 7-day streak', '+312 pts', '', 'Think you can beat me? 👉 https://pokebadle.fun'].join('\n'),
)
eq('EN : singulier « 1 turn »', buildShareText({ rec: rec({ turns: 1 }), dayNo: 1, grid: stored, streak: 1, url: URL }).includes('⏱ 1 turn ·'), true)
process.exit(fail ? 1 : 0)
