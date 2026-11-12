'use strict';
// Penyimpanan kecil berbasis file JSON di ~/.claude/claude-usage (bisa diganti lewat CLAUDE_USAGE_DIR).
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.CLAUDE_USAGE_DIR || path.join(os.homedir(), '.claude', 'claude-usage');

function file(name) {
  return path.join(DIR, name);
}

function readJSON(name, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

// Tulis atomik: tulis ke file sementara lalu rename, supaya pembaca tidak pernah melihat file setengah jadi.
function writeJSON(name, data) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = file(name) + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file(name));
}

module.exports = { DIR, readJSON, writeJSON };
