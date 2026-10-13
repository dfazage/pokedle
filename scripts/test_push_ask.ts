import assert from 'node:assert/strict'
import { shouldAskPush, SNOOZE_DAYS } from '../src/game/pushAsk'
const base = { win: true, signedIn: true, configured: true, state: 'off', snoozedAt: null as number | null, now: 1_000_000_000_000 }
const day = 24 * 3600 * 1000
assert.equal(shouldAskPush(base), true, 'première victoire, jamais demandé')
assert.equal(shouldAskPush({ ...base, win: false }), false, 'jamais après une défaite')
assert.equal(shouldAskPush({ ...base, signedIn: false }), false, 'compte requis')
assert.equal(shouldAskPush({ ...base, configured: false }), false, 'push non configuré dans ce build')
for (const s of ['on', 'denied', 'ios-install', 'unsupported']) assert.equal(shouldAskPush({ ...base, state: s }), false, s)
assert.equal(shouldAskPush({ ...base, snoozedAt: base.now - (SNOOZE_DAYS - 1) * day }), false, 'repoussé il y a 6 j')
assert.equal(shouldAskPush({ ...base, snoozedAt: base.now - SNOOZE_DAYS * day }), true, 'repoussé il y a 7 j')
console.log('push ask OK')
