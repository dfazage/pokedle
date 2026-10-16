// Jour de jeu : reset à 12h Paris jusqu'au 17/10/2026 12h KL, puis 2 combats par jour (12h et 18h Kuala Lumpur, UTC+8 fixe) : clé du jour et compte à rebours, y compris autour des changements d'heure. npx tsx scripts/test_reset.ts
import { battleId, DOUBLE_FROM_MS, gameDayKey, msToNextReset, openSlots, slotsPerDay } from '../src/game/rng'
let bad = 0
const eq = (label: string, got: unknown, want: unknown) => { if (got !== want) { bad++; console.log('ÉCHEC', label, 'obtenu', got, 'attendu', want) } }
const at = (iso: string) => new Date(iso)
const next = (iso: string) => new Date(at(iso).getTime() + msToNextReset(at(iso))).toISOString()
// Été (CEST = UTC+2) : le reset tombe à 10h00 UTC
eq('11h59 Paris le 13/10', gameDayKey(at('2026-10-13T09:59:59Z')), '2026-10-13')
eq('lancement : 10h52 Paris le 12/10 (avant le 1er 12h)', gameDayKey(at('2026-10-12T08:52:00Z')), '2026-10-12')
eq('11h59 Paris le 12/10 (le n°2 a démarré à 17h10 KL)', gameDayKey(at('2026-10-12T09:59:59Z')), '2026-10-13')
eq('12h00 Paris le 12/10 (reset)', gameDayKey(at('2026-10-12T10:00:00Z')), '2026-10-13')
eq('12h00 Paris le 13/10 (reset)', gameDayKey(at('2026-10-13T10:00:00Z')), '2026-10-14')
eq('aujourd\'hui 12h44 Paris', gameDayKey(at('2026-10-12T10:44:00Z')), '2026-10-13')
eq('00h UTC le 13/10', gameDayKey(at('2026-10-13T00:00:00Z')), '2026-10-13')
eq('prochain reset avant le premier (17h10 KL)', next('2026-10-12T08:52:00Z'), '2026-10-12T09:10:00.000Z')
eq('17h10 KL = n°2', gameDayKey(at('2026-10-12T09:10:00Z')), '2026-10-13')
eq('17h09 KL = n°1', gameDayKey(at('2026-10-12T09:09:59Z')), '2026-10-12')
eq('prochain reset depuis 17h44 KL', next('2026-10-12T09:44:00Z'), '2026-10-12T10:00:00.000Z')
eq('prochain reset depuis 11h Paris', next('2026-10-13T09:00:00Z'), '2026-10-13T10:00:00.000Z')
// Bascule : dernier instant de l'ancien régime (11h59 Paris le 17/10 = 09:59:59Z), puis 12h00 KL (04:00Z) le 17/10
eq('ancien régime le 17/10 09h59Z', gameDayKey(at('2026-10-17T03:59:59Z')), '2026-10-17')
eq('12h KL le 17/10 = 1er jour à 2 combats', gameDayKey(at('2026-10-17T04:00:00Z')), '2026-10-18')
eq('18h KL le 17/10 (même jour)', gameDayKey(at('2026-10-17T10:00:00Z')), '2026-10-18')
eq('11h59 KL le 18/10 (fin du jour)', gameDayKey(at('2026-10-18T03:59:59Z')), '2026-10-18')
eq('12h KL le 18/10', gameDayKey(at('2026-10-18T04:00:00Z')), '2026-10-19')
eq('plus de décalage horaire en hiver (25/10, 28/03/2027)', gameDayKey(at('2026-10-25T03:59:59Z')) + gameDayKey(at('2027-03-28T04:00:00Z')), '2026-10-252027-03-29')
eq('DOUBLE_FROM_MS = 17/10 04:00Z', new Date(DOUBLE_FROM_MS).toISOString(), '2026-10-17T04:00:00.000Z')
eq('1 combat avant la bascule', slotsPerDay('2026-10-17'), 1)
eq('2 combats dès la clé 18/10', slotsPerDay('2026-10-18'), 2)
eq('combats publiés avant la bascule', openSlots(at('2026-10-17T03:59:59Z')), 1)
eq('combats publiés à 12h KL', openSlots(at('2026-10-17T04:00:00Z')), 1)
eq('combats publiés à 17h59 KL', openSlots(at('2026-10-17T09:59:59Z')), 1)
eq('combats publiés à 18h KL', openSlots(at('2026-10-17T10:00:00Z')), 2)
eq('combats publiés à 11h59 KL le lendemain', openSlots(at('2026-10-18T03:59:59Z')), 2)
eq('combats publiés à 12h KL le lendemain', openSlots(at('2026-10-18T04:00:00Z')), 1)
eq('prochaine publication avant la bascule', next('2026-10-16T20:00:00Z'), '2026-10-17T04:00:00.000Z')
eq('prochaine publication à 12h KL', next('2026-10-17T04:00:00Z'), '2026-10-17T10:00:00.000Z')
eq('prochaine publication à 18h KL', next('2026-10-17T10:00:00Z'), '2026-10-18T04:00:00.000Z')
eq('prochaine publication à 3h UTC', next('2026-10-18T03:00:00Z'), '2026-10-18T04:00:00.000Z')
eq('identifiant du combat n°1 = clé du jour', battleId('2026-10-18', 1), '2026-10-18')
eq('identifiant du combat n°2', battleId('2026-10-18', 2), '2026-10-18~2')
// Les clés sont consécutives sur 800 jours (aucun jour sauté ni répété)
let prev = gameDayKey(at('2026-10-12T09:44:00Z')); const start = at('2026-10-12T09:44:00Z').getTime()
for (let h = 1; h < 24 * 800; h++) {
  const k = gameDayKey(new Date(start + h * 3600_000))
  const d = (Date.parse(k) - Date.parse(prev)) / 86400000
  if (d !== 0 && d !== 1) { bad++; console.log('SAUT', k, prev) }
  prev = k
}
console.log(bad ? `${bad} échec(s)` : 'OK : jours de jeu cohérents (clés consécutives, bascule 12h Paris → 2 combats 12h/18h KL)')
