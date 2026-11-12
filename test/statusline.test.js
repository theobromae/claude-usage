'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { merge, toEpoch } = require('../src/statusline.js');

const SCRIPT = path.join(__dirname, '..', 'src', 'statusline.js');

function run(input, dir, cfg) {
  if (cfg) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  return spawnSync('node', [SCRIPT], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_USAGE_DIR: dir },
    encoding: 'utf8',
  });
}

test('toEpoch menerima detik, milidetik, dan ISO', () => {
  assert.strictEqual(toEpoch(1786641000), 1786641000);
  assert.strictEqual(toEpoch(1786641000000), 1786641000);
  assert.strictEqual(toEpoch('2026-01-24T13:59:00Z'), Math.round(Date.parse('2026-01-24T13:59:00Z') / 1000));
  assert.strictEqual(toEpoch('bukan tanggal'), null);
});

test('merge: jendela yang absen mempertahankan nilai lama', () => {
  const prev = { updatedAt: 1, fiveHour: { pct: 10, resetsAt: 5 }, sevenDay: { pct: 20, resetsAt: 9 } };
  const next = merge(prev, { rate_limits: { five_hour: { used_percentage: 55.5, resets_at: 7 } } }, 100);
  assert.strictEqual(next.fiveHour.pct, 55.5);
  assert.deepStrictEqual(next.sevenDay, prev.sevenDay);
  assert.strictEqual(next.updatedAt, 100);
});

test('merge: tanpa rate_limits tidak menghasilkan apa-apa', () => {
  assert.strictEqual(merge(null, {}, 1), null);
  assert.strictEqual(merge(null, { rate_limits: { five_hour: { used_percentage: 'x' } } }, 1), null);
});

test('merge: persentase dijepit 0..100', () => {
  const n = merge(null, { rate_limits: { five_hour: { used_percentage: 900, resets_at: 1 } } }, 1);
  assert.strictEqual(n.fiveHour.pct, 100);
});

test('skrip: menulis usage.json dan mencetak satu baris', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cu-'));
  const r = run({ rate_limits: { five_hour: { used_percentage: 62.4, resets_at: 2000000000 }, seven_day: { used_percentage: 38, resets_at: 2000500000 } } }, dir);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '5h 62% · 7d 38%');
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'usage.json'), 'utf8'));
  assert.strictEqual(data.fiveHour.pct, 62.4);
  assert.strictEqual(data.sevenDay.resetsAt, 2000500000);
});

test('skrip: JSON rusak tidak membuat crash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cu-'));
  const r = run('{bukan json', dir);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(fs.existsSync(path.join(dir, 'usage.json')), false);
});

test('skrip: status line lama tetap ditampilkan (wrap)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cu-'));
  const r = run({ rate_limits: { five_hour: { used_percentage: 5, resets_at: 2000000000 } } }, dir, { wrap: 'echo status-lama' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /status-lama/);
  assert.ok(fs.existsSync(path.join(dir, 'usage.json'))); // data tetap tersimpan
});
