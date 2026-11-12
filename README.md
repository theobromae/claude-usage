# claude-usage

Dashboard ala mode nightstand (StandBy) iPhone untuk memantau limit **sesi 5 jam** dan **mingguan** Claude. Dua cincin progres, hitung mundur reset, mode malam merah otomatis, dan tombol reset saat ada penawaran dari Claude.

Tanpa dependensi (hanya Node 18+) dan **tidak memakai token Claude sama sekali**.

## Cara kerja

```
Claude Code ──(JSON via stdin)──▶ src/statusline.js ──▶ ~/.claude/claude-usage/usage.json
                                                              │
                                              src/server.js ◀─┘──▶ dashboard (web/) di browser
```

Claude Code mengirim `rate_limits` (persentase terpakai dan waktu reset untuk jendela 5 jam dan 7 hari) ke skrip status line. Angkanya sama dengan yang ditampilkan `/usage`, jadi bukan perkiraan dari log. Skrip hanya menyimpan angka itu ke file; server lokal kecil menyajikannya ke dashboard.

Limit dipakai bersama oleh claude.ai, Claude Desktop, dan Claude Code, sehingga persentasenya sudah mencakup semuanya. Data hanya diperbarui saat Claude Code aktif; di antara pembaruan, hitung mundur tetap berjalan dari waktu reset. Dashboard menandai umur data di pojok kanan atas.

## Pasang

```bash
git clone https://github.com/<username>/claude-usage.git
cd claude-usage

node src/setup.js        # pasang status line di ~/.claude/settings.json
node src/server.js       # jalankan dashboard di http://localhost:4747
```

Lalu kirim satu pesan di Claude Code agar data pertama masuk.

- Status line lama Anda tidak hilang: disimpan dan tetap ditampilkan. Cadangan settings: `~/.claude/settings.json.claude-usage.bak`.
- Lepas kapan saja: `node src/setup.js uninstall`.
- Cek keadaan: `node src/setup.js status`.

### Windows (PowerShell)

Semua perintah di atas sama persis di PowerShell, karena yang dijalankan adalah Node (butuh Node 18+ dan Git):

```powershell
git clone https://github.com/<username>/claude-usage.git
cd claude-usage
node src/setup.js
node src/server.js --lan
```

Saat pertama kali dengan `--lan`, Windows Defender Firewall akan bertanya apakah Node boleh menerima koneksi. Pilih **Jaringan pribadi** agar HP/tablet bisa membuka dashboard. Pengaturan Claude Code ada di `%USERPROFILE%\.claude\settings.json`, dan data dashboard di `%USERPROFILE%\.claude\claude-usage\`.

### Tampil di HP / tablet (nightstand)

```bash
node src/server.js --lan
```

Server mencetak alamat seperti `http://192.168.x.x:4747`. Buka di HP/tablet yang sama wifinya. Ketuk dua kali untuk layar penuh (jika didukung). Di iPhone, pilih Bagikan, lalu Tambah ke Layar Utama, supaya tampil tanpa bilah Safari. Lihat bagian "Layar tetap menyala" di bawah.

Mode `--lan` membuka server ke seluruh jaringan wifi Anda (tanpa login). Isinya hanya persentase pemakaian, tetapi pakai hanya di jaringan yang Anda percaya.

### Jalan otomatis saat Windows menyala

Agar server tidak perlu dijalankan manual, pasang sebagai tugas Task Scheduler untuk akun Anda (tanpa hak administrator):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-autostart.ps1 -Action Install
# tambahkan -Lan bila HP/tablet membuka lewat IP wifi (tidak perlu jika memakai Tailscale Serve di bawah)
```

Tugas `ClaudeUsageServer` jalan tersembunyi setiap login, restart otomatis bila berhenti, dan tidak dibatasi 72 jam bawaan Task Scheduler. Perintah lain: `-Action Status` (cek keadaan) dan `-Action Uninstall` (hapus). Via npm: `npm run autostart`, `npm run autostart:status`, `npm run autostart:remove` (tambahan opsi: `npm run autostart -- -Lan`).

`-ExecutionPolicy Bypass` hanya berlaku untuk satu perintah itu, jadi kebijakan skrip PowerShell Anda tidak diubah. Server baru jalan setelah Anda login, bukan sebelum.

### HP tidak harus satu wifi: pakai Tailscale

HP hanya perlu **punya jalur ke komputer**: wifi yang sama, atau [Tailscale](https://tailscale.com). Tailscale membuat jaringan pribadi (*tailnet*) antar perangkat Anda lewat internet, sehingga HP di data seluler atau wifi lain tetap bisa membuka dashboard seolah satu jaringan. Pasang aplikasi Tailscale di komputer dan HP, lalu login dengan akun yang sama.

Ada dua cara:

**A. Sederhana (HTTP).** Jalankan server dengan `--lan`, lalu buka `http://<IP-Tailscale-komputer>:4747` (IP berawalan `100.`, tampil di aplikasi Tailscale dan dicetak server) atau `http://<nama-komputer>:4747` bila MagicDNS aktif. Layar tetap menyala memakai mode cadangan (perlu satu ketukan).

**B. Disarankan (HTTPS, hanya tailnet).** Biarkan server hanya di `localhost` (tanpa `--lan`), lalu di PowerShell:

```powershell
tailscale serve --bg 4747
tailscale serve status    # menampilkan alamat https://<komputer>.<tailnet>.ts.net
```

Buka alamat itu di HP. Selain tidak membuka server ke wifi, alamat HTTPS membuat Wake Lock API bekerja penuh, jadi layar tetap menyala tanpa mode cadangan. Perlu sekali saja: di [admin console Tailscale](https://login.tailscale.com/admin/dns), halaman DNS, aktifkan **MagicDNS** dan **HTTPS Certificates** (jika belum, perintah `tailscale serve` akan menampilkan tautan untuk mengaktifkan). Konfigurasi ini bertahan setelah restart; lepas dengan `tailscale serve reset`.

Catatan keamanan:

- **Jangan** pakai `tailscale funnel`: itu membuka dashboard ke seluruh internet. `serve` hanya untuk perangkat dalam tailnet Anda.
- Mengaktifkan HTTPS Certificates membuat nama mesin tercantum di daftar sertifikat publik. Jangan beri komputer nama yang sensitif.
- Dashboard tidak punya login; batas aksesnya adalah tailnet (atau wifi, bila memakai `--lan`).

## Fitur

- **Dua cincin**: sesi 5 jam (oranye) dan mingguan (biru). Warna berubah kuning di 75% dan merah di 90%; di 100% tampil "LIMIT HABIS".
- **Mode malam**: merah redup, otomatis 22:00–05:00 (bisa dipaksa normal/malam di pengaturan).
- **Penawaran reset**: nyalakan di pengaturan (ikon gigi di kiri atas) atau dengan `curl`. Kartu penawaran menggantikan cincin mingguan. Tombol **Reset sekarang** hanya mengosongkan *tampilan* dashboard sampai data resmi berikutnya masuk. Tombol ini tidak mereset limit di Claude. **Nanti** menyembunyikan kartu 30 menit.
- **Animasi sederhana**: cincin menggambar dari kosong, angka menghitung naik, cincin berdenyut halus saat kritis, kartu penawaran muncul meluncur. Mati otomatis bila perangkat memakai "kurangi gerakan"; bisa dimatikan di pengaturan.
- **Anti burn-in OLED**: tampilan bergeser beberapa piksel tiap menit.
- **Layar tetap menyala**: aktif secara default (bisa dimatikan di pengaturan). Memakai Screen Wake Lock API bila tersedia, yaitu di `localhost` atau https. Di `http://IP-LAN` (cara umum membuka dari HP) API itu diblokir browser, sehingga dipakai mode cadangan berupa video hitam kecil yang diputar berulang. Mode cadangan perlu **satu ketukan** di layar setelah halaman dibuka, dan hasilnya bergantung pada perangkat. Jika layar tetap padam, atur Auto-Lock/waktu layar mati perangkat ke "Tidak pernah".

```bash
# nyalakan / matikan penawaran dari terminal (macOS/Linux)
curl -X POST localhost:4747/offer -H 'X-Requested-With: claude-usage' \
  -H 'Content-Type: application/json' -d '{"active":true,"note":"Berlaku sampai 15:00"}'
```

```powershell
# versi PowerShell (di PowerShell, curl adalah alias Invoke-WebRequest, jadi pakai ini)
Invoke-RestMethod -Method Post -Uri http://localhost:4747/offer `
  -Headers @{ 'X-Requested-With' = 'claude-usage' } -ContentType 'application/json' `
  -Body '{"active":true,"note":"Berlaku sampai 15:00"}'
```

Penawaran dari Claude tidak bisa dideteksi otomatis, jadi penandanya dinyalakan manual.

## Pratinjau tanpa data

Tambahkan `?demo=1`, `?demo=offer`, atau `?demo=night` ke alamat dashboard untuk melihat contoh tampilan.

## Opsi lain

| Opsi | Fungsi |
|---|---|
| `--port 4747` | ganti port (atau env `PORT`) |
| `--lan` | dengarkan di jaringan (default hanya `127.0.0.1`) |
| `--cors` | izinkan situs lain membaca `/usage.json` (mis. dashboard di GitHub Pages dengan `?server=http://localhost:4747`); default mati |
| env `CLAUDE_USAGE_DIR` | folder data (default `~/.claude/claude-usage`) |
| env `CLAUDE_CONFIG_DIR` | folder konfigurasi Claude Code untuk `setup.js` |

## Uji

```bash
npm test
```

## Batasan

- Memerlukan Claude Code versi yang mengirim `rate_limits` ke status line (v2.1.80 ke atas). Pada akun tanpa batas langganan (mis. memakai API key), field ini kemungkinan tidak dikirim, sehingga dashboard tetap menampilkan "Menunggu data".
- Persentase tidak bergerak selama Claude Code tidak dipakai (misalnya seharian hanya di claude.ai web), sampai Claude Code dibuka lagi.
