'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.CLAUDE_USAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cu-srv-'));
const store = require('../src/lib/store');
const { createServer } = require('../src/server.js');

function listen(opts) {
  return new Promise((resolve) => {
    const s = createServer(opts).listen(0, '127.0.0.1', () => resolve({ s, base: `http://127.0.0.1:${s.address().port}` }));
  });
}
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'claude-usage' };

test('GET /usage.json: tanpa data, dengan data', async () => {
  const { s, base } = await listen();
  let j = await (await fetch(base + '/usage.json')).json();
  assert.strictEqual(j.usage, null);
  assert.strictEqual(j.offer.active, false);

  store.writeJSON('usage.json', { updatedAt: 1, fiveHour: { pct: 10, resetsAt: 5 }, sevenDay: null });
  j = await (await fetch(base + '/usage.json')).json();
  assert.strictEqual(j.usage.fiveHour.pct, 10);
  assert.ok(j.serverTime > 0);
  s.close();
});

test('POST /offer dan /reset', async () => {
  const { s, base } = await listen();
  let r = await fetch(base + '/offer', { method: 'POST', headers: H, body: JSON.stringify({ active: true, note: 'Sampai 15:00' }) });
  let j = await r.json();
  assert.strictEqual(j.offer.active, true);
  assert.strictEqual(j.offer.note, 'Sampai 15:00');

  r = await fetch(base + '/reset', { method: 'POST', headers: H, body: '{}' });
  j = await r.json();
  assert.strictEqual(j.offer.active, false);
  assert.ok(j.localResetAt > 0);
  s.close();
});

test('POST tanpa header kustom ditolak', async () => {
  const { s, base } = await listen();
  const r = await fetch(base + '/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.strictEqual(r.status, 403);
  s.close();
});

test('CORS hanya aktif dengan opsi cors', async () => {
  let { s, base } = await listen();
  assert.strictEqual((await fetch(base + '/usage.json')).headers.get('access-control-allow-origin'), null);
  s.close();
  ({ s, base } = await listen({ cors: true }));
  assert.strictEqual((await fetch(base + '/usage.json')).headers.get('access-control-allow-origin'), '*');
  s.close();
});

test('statis: index.html disajikan, path traversal ditolak', async () => {
  const { s, base } = await listen();
  const r = await fetch(base + '/');
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /Claude Usage/);
  const bad = await fetch(base + '/%2e%2e/package.json');
  assert.ok(bad.status === 403 || bad.status === 404);
  s.close();
});
