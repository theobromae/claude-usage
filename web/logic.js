// Logika murni (tanpa DOM) agar bisa dipakai di browser dan diuji di Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UsageLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // Keadaan satu jendela (5 jam / mingguan) pada waktu `nowSec`.
  //  nodata  : belum ada data sama sekali
  //  waiting : baru di-reset dari dashboard, menunggu data resmi berikutnya
  //  idle    : jendela sudah berakhir, jendela baru mulai saat Claude dipakai
  //  ok      : data aktif
  function windowView(win, usageUpdatedAt, localResetAt, nowSec) {
    if (!win) return { state: 'nodata', pct: 0, resetsAt: null };
    if (localResetAt && (usageUpdatedAt || 0) < localResetAt) return { state: 'waiting', pct: 0, resetsAt: null };
    if (win.resetsAt && nowSec >= win.resetsAt) return { state: 'idle', pct: 0, resetsAt: null };
    return { state: 'ok', pct: win.pct, resetsAt: win.resetsAt };
  }

  function level(pct) {
    if (pct >= 100) return 'full';
    if (pct >= 90) return 'critical';
    if (pct >= 75) return 'warn';
    return 'ok';
  }

  // kind 'week' dengan sisa >= 1 hari -> "3h 6j" (hari, jam); selain itu "1j 48m" atau "12m".
  function formatRemaining(sec, kind) {
    if (sec == null) return '—';
    if (sec < 60) return '<1m';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (kind === 'week' && d >= 1) return d + 'h ' + h + 'j';
    var totalH = d * 24 + h;
    return totalH > 0 ? totalH + 'j ' + m + 'm' : m + 'm';
  }

  // Label waktu reset. 5 jam: "pukul 16:10" (tambah "besok" bila beda hari); mingguan: "Senin, 20:00".
  function resetLabel(resetsAt, kind, nowSec) {
    if (resetsAt == null) return '';
    var d = new Date(resetsAt * 1000);
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (kind === 'week') return DAYS[d.getDay()] + ', ' + hm;
    var today = new Date(nowSec * 1000);
    var same = d.toDateString() === today.toDateString();
    return (same ? 'pukul ' : 'besok pukul ') + hm;
  }

  function isNight(mode, date, startHour, endHour) {
    if (mode === 'night') return true;
    if (mode === 'day') return false;
    var s = startHour == null ? 22 : startHour;
    var e = endHour == null ? 5 : endHour;
    var h = date.getHours();
    return s > e ? h >= s || h < e : h >= s && h < e;
  }

  function ageText(ageSec) {
    if (ageSec < 60) return 'baru saja';
    if (ageSec < 3600) return Math.floor(ageSec / 60) + ' mnt lalu';
    if (ageSec < 86400) return Math.floor(ageSec / 3600) + ' jam lalu';
    return Math.floor(ageSec / 86400) + ' hari lalu';
  }

  return {
    windowView: windowView,
    level: level,
    formatRemaining: formatRemaining,
    resetLabel: resetLabel,
    isNight: isNight,
    ageText: ageText,
    pad: pad,
  };
});
