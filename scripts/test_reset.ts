// Reset à 12h heure de Paris : clé du jour et compte à rebours, y compris autour des changements d'heure. npx tsx scripts/test_reset.ts
import { gameDayKey, msToNextReset } from '../src/game/rng'
let bad = 0
const eq = (label: string, got: unknown, want: unknown) => { if (got !== want) { bad++; console.log('ÉCHEC', label, 'obtenu', got, 'attendu', want) } }
const at = (iso: string) => new Date(iso)
const next = (iso: string) => new Date(at(iso).getTime() + msToNextReset(at(iso))).toISOString()
// Été (CEST = UTC+2) : le reset tombe à 10h00 UTC
eq('11h59 Paris le 13/10', gameDayKey(at('2026-10-13T09:59:59Z')), '2026-10-13')
eq('lancement : 10h52 Paris le 12/10 (avant le 1er 12h)', gameDayKey(at('2026-10-12T08:52:00Z')), '2026-10-12')
eq('11h59 Paris le 12/10 (dernière seconde du n°1)', gameDayKey(at('2026-10-12T09:59:59Z')), '2026-10-12')
eq('12h00 Paris le 12/10 (reset)', gameDayKey(at('2026-10-12T10:00:00Z')), '2026-10-13')
eq('12h00 Paris le 13/10 (reset)', gameDayKey(at('2026-10-13T10:00:00Z')), '2026-10-14')
eq('aujourd\'hui 12h44 Paris', gameDayKey(at('2026-10-12T10:44:00Z')), '2026-10-13')
eq('00h UTC le 13/10', gameDayKey(at('2026-10-13T00:00:00Z')), '2026-10-13')
eq('prochain reset avant le premier (17h10 KL)', next('2026-10-12T08:52:00Z'), '2026-10-12T09:10:00.000Z')
eq('17h10 KL = n°2', gameDayKey(at('2026-10-12T09:10:00Z')), '2026-10-13')
eq('17h09 KL = n°1', gameDayKey(at('2026-10-12T09:09:59Z')), '2026-10-12')
eq('prochain reset depuis 17h44 KL', next('2026-10-12T09:44:00Z'), '2026-10-12T10:00:00.000Z')
eq('prochain reset depuis 11h Paris', next('2026-10-13T09:00:00Z'), '2026-10-13T10:00:00.000Z')
// Heure d'hiver dès le 25/10/2026 à 3h (CET = UTC+1) : le reset de 12h passe à 11h00 UTC
eq('veille du changement', next('2026-10-24T10:30:00Z'), '2026-10-25T11:00:00.000Z')
eq('jour du changement, avant 12h', next('2026-10-25T10:30:00Z'), '2026-10-25T11:00:00.000Z')
eq('jour du changement, après 12h', next('2026-10-25T11:30:00Z'), '2026-10-26T11:00:00.000Z')
eq('11h59 Paris le 25/10', gameDayKey(at('2026-10-25T10:59:59Z')), '2026-10-25')
eq('12h00 Paris le 25/10', gameDayKey(at('2026-10-25T11:00:00Z')), '2026-10-26')
eq('11h59 Paris hiver', gameDayKey(at('2026-10-26T10:59:59Z')), '2026-10-26')
eq('12h00 Paris hiver', gameDayKey(at('2026-10-26T11:00:00Z')), '2026-10-27')
// Passage à l'heure d'été le 29/03/2026 → et en 2027 le 28/03
eq('printemps 2027', next('2027-03-27T12:00:00Z'), '2027-03-28T10:00:00.000Z')
// Les clés sont consécutives sur 800 jours (aucun jour sauté ni répété)
let prev = gameDayKey(at('2026-10-12T09:44:00Z')); const start = at('2026-10-12T09:44:00Z').getTime()
for (let h = 1; h < 24 * 800; h++) {
  const k = gameDayKey(new Date(start + h * 3600_000))
  const d = (Date.parse(k) - Date.parse(prev)) / 86400000
  if (d !== 0 && d !== 1) { bad++; console.log('SAUT', k, prev) }
  prev = k
}
console.log(bad ? `${bad} échec(s)` : 'OK : reset 12h Paris cohérent (clés consécutives, passages à l\'heure d\'été/hiver)')
