#!/usr/bin/env node
'use strict';
// Memasang / melepas status line di ~/.claude/settings.json.
//   node src/setup.js install     (default)
//   node src/setup.js uninstall
//   node src/setup.js status
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./lib/store');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CONFIG_DIR, 'settings.json');
const BACKUP = SETTINGS + '.claude-usage.bak';
const SCRIPT = path.join(__dirname, 'statusline.js');
const COMMAND = `node "${SCRIPT}"`;

// Milik kita bila persis sama dengan perintah yang kita pasang (sekarang atau sebelumnya, mis. setelah folder dipindah).
function isOurs(cmd) {
  if (typeof cmd !== 'string') return false;
  const cfg = store.readJSON('config.json', {}) || {};
  return cmd === COMMAND || (cfg.installed && cmd === cfg.installed);
}

function load() {
  if (!fs.existsSync(SETTINGS)) return {};
  const txt = fs.readFileSync(SETTINGS, 'utf8');
  if (!txt.trim()) return {};
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error(`Gagal membaca ${SETTINGS}: ${e.message}\nPerbaiki file itu dulu; tidak ada yang diubah.`);
    process.exit(1);
  }
}

function save(settings) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
}

function install() {
  const settings = load();
  const cur = settings.statusLine;
  const cfg = store.readJSON('config.json', {}) || {};

  if (fs.existsSync(SETTINGS) && !fs.existsSync(BACKUP)) fs.copyFileSync(SETTINGS, BACKUP);

  if (cur && cur.command && !isOurs(cur.command)) {
    cfg.wrap = cur.command;
    console.log('Status line lama disimpan dan tetap ditampilkan:\n  ' + cur.command);
  }
  cfg.installed = COMMAND;
  store.writeJSON('config.json', cfg);

  settings.statusLine = Object.assign({}, cur, { type: 'command', command: COMMAND });
  save(settings);
  console.log('Terpasang di ' + SETTINGS);
  console.log('Buka sesi Claude Code (atau kirim satu pesan) agar data pertama masuk.');
  console.log('Cadangan settings: ' + BACKUP);
}

function uninstall() {
  const settings = load();
  const cfg = store.readJSON('config.json', {}) || {};
  if (cfg.wrap) {
    settings.statusLine = Object.assign({}, settings.statusLine, { type: 'command', command: cfg.wrap });
    delete cfg.wrap;
    delete cfg.installed;
    store.writeJSON('config.json', cfg);
    console.log('Status line lama dikembalikan.');
  } else if (settings.statusLine && isOurs(settings.statusLine.command)) {
    delete settings.statusLine;
    delete cfg.installed;
    store.writeJSON('config.json', cfg);
    console.log('Status line dilepas.');
  } else {
    console.log('Tidak ada yang perlu dilepas.');
    return;
  }
  save(settings);
}

function status() {
  const settings = load();
  const cmd = settings.statusLine && settings.statusLine.command;
  console.log(isOurs(cmd) ? 'Terpasang: ' + cmd : 'Belum terpasang.');
  const usage = store.readJSON('usage.json', null);
  console.log(usage ? 'Data terakhir: ' + new Date(usage.updatedAt * 1000).toLocaleString() : 'Belum ada data masuk.');
}

const action = process.argv[2] || 'install';
if (action === 'install') install();
else if (action === 'uninstall') uninstall();
else if (action === 'status') status();
else {
  console.error('Perintah tidak dikenal: ' + action + ' (install | uninstall | status)');
  process.exit(1);
}
