'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../web/logic.js');

test('windowView: nodata, waiting, idle, ok', () => {
  assert.strictEqual(L.windowView(null, 0, 0, 100).state, 'nodata');
  const w = { pct: 62, resetsAt: 1000 };
  assert.deepStrictEqual(L.windowView(w, 50, 0, 100), { state: 'ok', pct: 62, resetsAt: 1000 });
  assert.strictEqual(L.windowView(w, 50, 60, 100).state, 'waiting'); // reset lebih baru dari data
  assert.strictEqual(L.windowView(w, 70, 60, 100).state, 'ok'); // data baru setelah reset
  const idle = L.windowView(w, 50, 0, 1000);
  assert.strictEqual(idle.state, 'idle');
  assert.strictEqual(idle.pct, 0);
});

test('level thresholds', () => {
  assert.strictEqual(L.level(10), 'ok');
  assert.strictEqual(L.level(75), 'warn');
  assert.strictEqual(L.level(90), 'critical');
  assert.strictEqual(L.level(100), 'full');
});

test('formatRemaining', () => {
  assert.strictEqual(L.formatRemaining(30, 'five'), '<1m');
  assert.strictEqual(L.formatRemaining(48 * 60, 'five'), '48m');
  assert.strictEqual(L.formatRemaining(3600 + 48 * 60, 'five'), '1j 48m');
  assert.strictEqual(L.formatRemaining(3 * 86400 + 6 * 3600, 'week'), '3h 6j');
  assert.strictEqual(L.formatRemaining(86400 + 2 * 3600, 'five'), '26j 0m');
  assert.strictEqual(L.formatRemaining(5 * 3600, 'week'), '5j 0m');
});

test('isNight auto melewati tengah malam', () => {
  const at = (h) => new Date(2026, 10, 12, h, 0, 0);
  assert.strictEqual(L.isNight('auto', at(23)), true);
  assert.strictEqual(L.isNight('auto', at(3)), true);
  assert.strictEqual(L.isNight('auto', at(5)), false);
  assert.strictEqual(L.isNight('auto', at(14)), false);
  assert.strictEqual(L.isNight('night', at(14)), true);
  assert.strictEqual(L.isNight('day', at(23)), false);
});

test('resetLabel', () => {
  const now = Math.floor(new Date(2026, 10, 12, 14, 0, 0).getTime() / 1000);
  const same = Math.floor(new Date(2026, 10, 12, 16, 10, 0).getTime() / 1000);
  const next = Math.floor(new Date(2026, 10, 13, 1, 5, 0).getTime() / 1000);
  assert.strictEqual(L.resetLabel(same, 'five', now), 'pukul 16:10');
  assert.strictEqual(L.resetLabel(next, 'five', now), 'besok pukul 01:05');
  const monday = Math.floor(new Date(2026, 10, 16, 20, 0, 0).getTime() / 1000); // 16 Nov 2026 = Senin
  assert.strictEqual(L.resetLabel(monday, 'week', now), 'Senin, 20:00');
});

test('ageText', () => {
  assert.strictEqual(L.ageText(10), 'baru saja');
  assert.strictEqual(L.ageText(300), '5 mnt lalu');
  assert.strictEqual(L.ageText(7200), '2 jam lalu');
});
