(function () {
  'use strict';
  var L = window.UsageLogic;
  var C = 578.05; // keliling cincin (2πr, r=92)
  var POLL_MS = 60000;
  var SNOOZE_MS = 30 * 60 * 1000;

  var params = new URLSearchParams(location.search);
  var API = (params.get('server') || '').replace(/\/$/, '');
  var demo = params.get('demo'); // ?demo=1 | offer | night | full

  var LS_KEY = 'claude-usage.settings';
  var settings = { night: 'auto', anim: true, wake: true, snoozeUntil: 0 };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(LS_KEY) || '{}'));
  } catch (e) {}
  if (demo === 'night') settings.night = 'night';
  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  var $ = function (id) { return document.getElementById(id); };
  var cols = {
    five: { el: $('colFive'), kind: 'five', shown: null },
    week: { el: $('colWeek'), kind: 'week', shown: null },
  };
  var snap = null;
  var connected = false;
  var skew = 0; // selisih jam server - jam perangkat (detik)
  var reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animOn() {
    return settings.anim && !reducedMotion;
  }
  function nowSec() {
    return Math.floor(Date.now() / 1000) + skew;
  }

  /* ---------- data ---------- */
  function demoSnap() {
    var n = Math.floor(Date.now() / 1000);
    var full = demo === 'offer' || demo === 'full';
    return {
      serverTime: n,
      usage: {
        updatedAt: n - 180,
        fiveHour: { pct: full ? 100 : 62, resetsAt: n + (full ? 2 * 3600 + 14 * 60 : 3600 + 48 * 60) },
        sevenDay: { pct: full ? 71 : 38, resetsAt: n + 3 * 86400 + 6 * 3600 },
      },
      offer: { active: demo === 'offer', note: 'Berlaku sampai 15:00.' },
      localResetAt: 0,
    };
  }

  function fetchSnap() {
    if (demo) {
      snap = demoSnap();
      connected = true;
      return Promise.resolve();
    }
    return fetch(API + '/usage.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (j) {
        snap = j;
        connected = true;
        skew = j.serverTime - Math.floor(Date.now() / 1000);
      })
      .catch(function () {
        connected = false;
      });
  }

  function post(path, body) {
    if (demo) return Promise.resolve();
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'claude-usage' },
      body: JSON.stringify(body || {}),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { snap = j; connected = true; })
      .catch(function () {});
  }

  /* ---------- tampilan ---------- */
  function tweenNumber(el, from, to) {
    if (!animOn()) { el.textContent = Math.round(to); return; }
    var t0 = performance.now();
    var dur = 900;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function setRing(col, pct, hasData) {
    var arc = col.el.querySelector('.arc');
    var num = col.el.querySelector('.num');
    var target = hasData ? Math.round(pct) : null;
    arc.style.strokeDashoffset = String(hasData ? C * (1 - pct / 100) : C);
    if (target === col.shown) return;
    if (target === null) num.textContent = '--';
    else tweenNumber(num, col.shown == null ? 0 : col.shown, target);
    col.shown = target;
  }

  function renderColumn(col, v) {
    var el = col.el;
    var lvl = v.state === 'ok' ? L.level(v.pct) : 'ok';
    el.className = 'col lvl-' + lvl;

    var hasData = v.state === 'ok' || v.state === 'idle';
    setRing(col, v.pct, hasData);

    var cap = el.querySelector('.cap');
    var big = el.querySelector('.big');
    var sub = el.querySelector('.sub');
    var five = col.kind === 'five';
    var ring = el.querySelector('.ring');

    if (v.state === 'ok') {
      var remain = v.resetsAt ? v.resetsAt - nowSec() : null;
      cap.textContent = lvl === 'full' ? 'LIMIT HABIS' : 'TERPAKAI';
      big.textContent = L.formatRemaining(remain, col.kind);
      sub.innerHTML = 'lagi sampai reset<br>' + L.resetLabel(v.resetsAt, col.kind, nowSec());
      ring.setAttribute('aria-label', (five ? 'Sesi 5 jam: ' : 'Mingguan: ') + Math.round(v.pct) + '% terpakai');
    } else if (v.state === 'idle') {
      cap.textContent = 'TERPAKAI';
      big.textContent = '—';
      sub.textContent = five ? 'sesi baru mulai saat Claude dipakai' : 'pekan baru mulai saat Claude dipakai';
      ring.setAttribute('aria-label', (five ? 'Sesi 5 jam' : 'Mingguan') + ': 0% terpakai');
    } else if (v.state === 'waiting') {
      cap.textContent = 'MENUNGGU DATA';
      big.textContent = '—';
      sub.textContent = 'setelah reset, menunggu data baru';
      ring.setAttribute('aria-label', (five ? 'Sesi 5 jam' : 'Mingguan') + ': menunggu data');
    } else {
      cap.textContent = 'MENUNGGU DATA';
      big.textContent = '—';
      sub.textContent = connected ? 'kirim satu pesan di Claude Code' : 'server tidak terjangkau';
      ring.setAttribute('aria-label', (five ? 'Sesi 5 jam' : 'Mingguan') + ': belum ada data');
    }
  }

  function render() {
    var n = nowSec();
    var usage = snap && snap.usage;
    var upd = usage ? usage.updatedAt : 0;
    var lr = snap ? snap.localResetAt : 0;

    var vFive = L.windowView(usage && usage.fiveHour, upd, lr, n);
    var vWeek = L.windowView(usage && usage.sevenDay, upd, lr, n);
    renderColumn(cols.five, vFive);
    renderColumn(cols.week, vWeek);

    // Penawaran
    var offer = snap && snap.offer;
    var snoozed = Date.now() < settings.snoozeUntil;
    var showOffer = !!(offer && offer.active && !snoozed);
    $('grid').classList.toggle('has-offer', showOffer);
    $('offer').hidden = !showOffer;
    var mini = cols.five.el.querySelector('.mini');
    mini.hidden = !showOffer;
    if (showOffer) {
      mini.textContent = vWeek.state === 'ok' ? 'Mingguan: ' + Math.round(vWeek.pct) + '%' : '';
      var remain = vFive.state === 'ok' && vFive.resetsAt ? vFive.resetsAt - n : null;
      $('offerTitle').textContent =
        remain != null && remain >= 60
          ? 'Reset limit sekarang, tanpa menunggu ' + L.formatRemaining(remain, 'five') + '.'
          : 'Ada penawaran reset limit dari Claude.';
      var note = (offer.note || '').trim();
      $('offerNote').textContent =
        (note ? note + ' ' : '') + 'Tekan setelah limit di Claude direset: tampilan kembali ke 0% sampai data baru masuk.';
    }

    // Mode malam
    document.body.classList.toggle('night', L.isNight(settings.night, new Date()));
    document.documentElement.classList.toggle('no-anim', !settings.anim);

    // Cap waktu
    var stamp = $('stamp');
    var parts = [];
    if (document.body.classList.contains('night')) parts.push('mode malam');
    if (!connected) parts.push('server tidak terhubung');
    else if (usage) {
      var d = new Date(usage.updatedAt * 1000);
      var age = n - usage.updatedAt;
      parts.push('diperbarui ' + L.pad(d.getHours()) + ':' + L.pad(d.getMinutes()) + ' · ' + L.ageText(age) + (age > 1800 ? ' · data lama' : ''));
    }
    stamp.textContent = parts.join(' · ');
  }

  /* ---------- geser kecil anti burn-in (OLED) ---------- */
  function drift() {
    var s = $('stage').style;
    s.setProperty('--sx', Math.round((Math.random() * 2 - 1) * 4) + 'px');
    s.setProperty('--sy', Math.round((Math.random() * 2 - 1) * 4) + 'px');
  }

  /* ---------- layar tetap menyala ---------- */
  // Cara utama: Screen Wake Lock API (hanya di koneksi aman: https atau localhost).
  // Cadangan: video hitam kecil yang diputar berulang (perlu satu ketukan), jalan juga lewat http://IP-LAN.
  var wakeLock = null;
  var sleepVideo = null;
  var armed = false;
  function wakeSupported() {
    return 'wakeLock' in navigator;
  }
  function stopFallback() {
    if (sleepVideo) {
      sleepVideo.pause();
      sleepVideo.remove();
      sleepVideo = null;
    }
  }
  function startFallback() {
    if (sleepVideo || !window.NOSLEEP_MP4) return;
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.muted = true;
    v.loop = true;
    v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none';
    v.src = window.NOSLEEP_MP4;
    document.body.appendChild(v);
    v.play().then(function () { sleepVideo = v; }).catch(function () { v.remove(); });
  }
  function armFallback() {
    if (armed) return;
    armed = true;
    var go = function () {
      armed = false;
      document.removeEventListener('pointerdown', go, true);
      if (settings.wake) startFallback();
    };
    document.addEventListener('pointerdown', go, true);
  }
  function applyWake() {
    if (!settings.wake) {
      if (wakeLock) { wakeLock.release(); wakeLock = null; }
      stopFallback();
      return;
    }
    if (wakeSupported()) {
      if (!wakeLock && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(function (l) {
          wakeLock = l;
          l.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () { armFallback(); });
      }
    } else if (!sleepVideo) {
      armFallback();
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      applyWake();
      fetchSnap().then(render);
    }
  });

  /* ---------- pengaturan ---------- */
  var dlg = $('settings');
  function openSettings() {
    $('optNight').value = settings.night;
    $('optAnim').checked = settings.anim;
    $('optWake').checked = settings.wake;
    var offer = (snap && snap.offer) || { active: false, note: '' };
    $('optOffer').checked = !!offer.active;
    $('optNote').value = offer.note || '';
    $('wakeHint').textContent = wakeSupported()
      ? ''
      : 'Mode cadangan: ketuk layar sekali setelah halaman dibuka agar layar tetap menyala. Jika tetap padam, atur Auto-Lock perangkat ke "Tidak pernah".';
    dlg.showModal();
  }
  $('gear').addEventListener('click', openSettings);
  $('optNight').addEventListener('change', function (e) { settings.night = e.target.value; saveSettings(); render(); });
  $('optAnim').addEventListener('change', function (e) { settings.anim = e.target.checked; saveSettings(); render(); });
  $('optWake').addEventListener('change', function (e) {
    settings.wake = e.target.checked;
    saveSettings();
    applyWake();
    if (settings.wake && !wakeSupported()) startFallback(); // perubahan ini sendiri adalah ketukan pengguna
  });
  function pushOffer() {
    settings.snoozeUntil = 0;
    saveSettings();
    post('/offer', { active: $('optOffer').checked, note: $('optNote').value }).then(render);
  }
  $('optOffer').addEventListener('change', pushOffer);
  $('optNote').addEventListener('change', pushOffer);

  $('btnReset').addEventListener('click', function () {
    post('/reset', {}).then(function () {
      if (demo) { snap.localResetAt = Math.floor(Date.now() / 1000) + 1; snap.offer.active = false; }
      render();
    });
  });
  $('btnLater').addEventListener('click', function () {
    settings.snoozeUntil = Date.now() + SNOOZE_MS;
    saveSettings();
    render();
  });

  // Ketuk dua kali di mana saja: layar penuh (jika didukung)
  $('stage').addEventListener('dblclick', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });

  /* ---------- mulai ---------- */
  render(); // gambar awal: cincin kosong
  fetchSnap().then(function () {
    // beri satu frame supaya transisi cincin terlihat menggambar dari kosong
    requestAnimationFrame(function () { requestAnimationFrame(render); });
    applyWake();
  });
  setInterval(function () { fetchSnap().then(render); }, POLL_MS);
  setInterval(render, 1000);
  setInterval(drift, 60000);
})();
