// Vérifie que les statuts (majeurs et temporaires) produisent bien des étapes avec texte FR et changement d'état.
import { formatSteps } from '../src/game/session'

let bad = 0
const check = (name: string, ok: boolean) => { if (!ok) bad++; console.log(ok ? 'OK ' : '✗  ', name) }
const run = (...l: string[]) => formatSteps(l)

check('sommeil', run('|-status|p2a: Onix|slp').some((s) => s.status?.status === 'slp' && s.status.side === 'opponent' && s.text === 'Onix adverse est endormi !'))
check('réveil', run('|-curestatus|p1a: Pikachu|slp').some((s) => s.status?.status === '' && s.text === 'Pikachu se réveille !'))
check('confusion on', run('|-start|p1a: Pikachu|confusion').some((s) => s.vol?.id === 'confusion' && s.vol.on && s.text === 'Pikachu est confus !'))
check('confusion off', run('|-end|p1a: Pikachu|confusion').some((s) => s.vol?.id === 'confusion' && !s.vol.on))
check('vampigraine', run('|-start|p2a: Onix|move: Leech Seed').some((s) => s.vol?.id === 'leechseed'))
check('amour', run('|-start|p2a: Onix|Attract').some((s) => s.vol?.id === 'attract'))
check('cant slp', run('|cant|p1a: Pikachu|slp').some((s) => s.text === 'Pikachu dort profondément.'))
check('cant par', run('|cant|p1a: Pikachu|par').some((s) => s.text?.includes('paralysé')))
process.exit(bad ? 1 : 0)
