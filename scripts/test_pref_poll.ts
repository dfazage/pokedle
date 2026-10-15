import assert from 'node:assert/strict'
import { ASK_DELAY_MS, parsePref, prefKey } from '../src/game/prefPoll'
assert.equal(parsePref('1'), 1)
assert.equal(parsePref('2'), 2)
for (const bad of [null, '', '0', '3', 'abc', '1 ']) assert.equal(parsePref(bad), null, `valeur invalide ${JSON.stringify(bad)}`)
assert.notEqual(prefKey('user-a'), prefKey('user-b'), 'une clé par compte')
assert.equal(prefKey('user-a'), prefKey('user-a'))
assert.ok(ASK_DELAY_MS > 0 && ASK_DELAY_MS <= 5000, 'délai raisonnable')
console.log('pref poll OK')
