#!/usr/bin/env node
'use strict';
// Server lokal kecil: menyajikan dashboard (web/) dan data (usage.json) dari status line.
//   node src/server.js [--port 4747] [--lan] [--cors]
//   --lan   dengarkan di jaringan (agar HP/tablet bisa buka); default hanya 127.0.0.1
//   --cors  izinkan situs lain (mis. GitHub Pages) membaca /usage.json; default mati
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./lib/store');

const WEB = path.join(__dirname, '..', 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function snapshot() {
  const st = store.readJSON('state.json', {}) || {};
  return {
    serverTime: Math.floor(Date.now() / 1000),
    usage: store.readJSON('usage.json', null),
    offer: st.offer || { active: false, note: '' },
    localResetAt: st.localResetAt || 0,
  };
}

function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    try {
      cb(null, body ? JSON.parse(body) : {});
    } catch (e) {
      cb(e);
    }
  });
}

function send(res, code, obj, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}

function createServer(opts = {}) {
  return http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return send(res, 400, { error: 'bad url' });
    }

    if (req.method === 'GET' && url.pathname === '/usage.json') {
      return send(res, 200, snapshot(), opts.cors ? { 'Access-Control-Allow-Origin': '*' } : {});
    }

    if (req.method === 'POST' && (url.pathname === '/offer' || url.pathname === '/reset')) {
      // Header kustom memblokir form lintas-situs; fetch lintas-situs butuh preflight yang tidak kita jawab.
      if (req.headers['x-requested-with'] !== 'claude-usage') return send(res, 403, { error: 'forbidden' });
      return readBody(req, (err, body) => {
        if (err) return send(res, 400, { error: 'bad json' });
        const st = store.readJSON('state.json', {}) || {};
        if (url.pathname === '/offer') {
          st.offer = {
            active: body.active === true,
            note: typeof body.note === 'string' ? body.note.slice(0, 200) : '',
          };
        } else {
          st.localResetAt = Math.floor(Date.now() / 1000);
          st.offer = { active: false, note: (st.offer && st.offer.note) || '' };
        }
        store.writeJSON('state.json', st);
        send(res, 200, snapshot());
      });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });

    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, { error: 'bad path' });
    }
    if (rel === '/') rel = '/index.html';
    const full = path.join(WEB, rel);
    if (full !== WEB && !full.startsWith(WEB + path.sep)) return send(res, 403, { error: 'forbidden' });
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const pi = args.indexOf('--port');
  const port = pi >= 0 ? Number(args[pi + 1]) : Number(process.env.PORT) || 4747;
  const lan = args.includes('--lan');
  const host = lan ? '0.0.0.0' : '127.0.0.1';
  createServer({ cors: args.includes('--cors') }).listen(port, host, () => {
    console.log(`Claude Usage berjalan: http://localhost:${port}`);
    if (lan) for (const ip of lanAddresses()) console.log(`  Dari HP/tablet di wifi yang sama: http://${ip}:${port}`);
    else console.log('  Tambahkan --lan agar bisa dibuka dari HP/tablet.');
  });
}

module.exports = { createServer, snapshot };
