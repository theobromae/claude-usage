#!/usr/bin/env node
'use strict';
// Status line Claude Code. Dipanggil Claude Code dengan JSON di stdin.
// Menyimpan rate_limits resmi (sama dengan angka /usage) ke usage.json.
// Skrip ini tidak memanggil Claude sama sekali, jadi tidak memakai token.
// Tidak boleh pernah melempar error: status line yang rusak mengganggu Claude Code.
const { spawnSync } = require('child_process');
const store = require('./lib/store');

function toEpoch(v) {
  if (typeof v === 'number' && isFinite(v)) return v > 1e12 ? Math.round(v / 1000) : Math.round(v);
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return isNaN(t) ? null : Math.round(t / 1000);
  }
  return null;
}

function pickWindow(w) {
  if (!w || typeof w.used_percentage !== 'number' || !isFinite(w.used_percentage)) return null;
  return {
    pct: Math.min(100, Math.max(0, w.used_percentage)),
    resetsAt: toEpoch(w.resets_at),
  };
}

// Setiap jendela bisa saja absen sendiri-sendiri di payload; yang absen mempertahankan nilai lama.
function merge(prev, input, nowSec) {
  const rl = (input && input.rate_limits) || {};
  const five = pickWindow(rl.five_hour);
  const week = pickWindow(rl.seven_day);
  if (!five && !week) return null;
  const old = prev || {};
  return {
    updatedAt: nowSec,
    fiveHour: five || old.fiveHour || null,
    sevenDay: week || old.sevenDay || null,
  };
}

function ownLine(usage) {
  const parts = [];
  if (usage && usage.fiveHour) parts.push('5h ' + Math.round(usage.fiveHour.pct) + '%');
  if (usage && usage.sevenDay) parts.push('7d ' + Math.round(usage.sevenDay.pct) + '%');
  return parts.join(' · ');
}

function main(raw) {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {}

  let usage = store.readJSON('usage.json', null);
  try {
    const next = merge(usage, input, Math.floor(Date.now() / 1000));
    if (next) {
      store.writeJSON('usage.json', next);
      usage = next;
    }
  } catch {}

  // Jika sebelumnya sudah ada status line lain, jalankan itu dan tampilkan hasilnya apa adanya.
  const cfg = store.readJSON('config.json', {}) || {};
  if (cfg.wrap) {
    try {
      const r = spawnSync(cfg.wrap, { input: raw, shell: true, encoding: 'utf8', timeout: 2000 });
      if (r.status === 0 && r.stdout) {
        process.stdout.write(r.stdout);
        return;
      }
    } catch {}
  }
  process.stdout.write(ownLine(usage));
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      main(raw);
    } catch {}
  });
}

module.exports = { merge, pickWindow, toEpoch, ownLine };
