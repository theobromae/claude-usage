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

### Tampil di HP / tablet (nightstand)

```bash
node src/server.js --lan
```

Server mencetak alamat seperti `http://192.168.x.x:4747`. Buka di HP/tablet yang sama wifinya. Ketuk dua kali untuk layar penuh (jika didukung). Di iPhone, pilih Bagikan, lalu Tambah ke Layar Utama, supaya tampil tanpa bilah Safari, dan atur Auto-Lock ke "Tidak pernah".

Mode `--lan` membuka server ke seluruh jaringan wifi Anda (tanpa login). Isinya hanya persentase pemakaian, tetapi pakai hanya di jaringan yang Anda percaya.

## Fitur

- **Dua cincin**: sesi 5 jam (oranye) dan mingguan (biru). Warna berubah kuning di 75% dan merah di 90%; di 100% tampil "LIMIT HABIS".
- **Mode malam**: merah redup, otomatis 22:00–05:00 (bisa dipaksa normal/malam di pengaturan).
- **Penawaran reset**: nyalakan di pengaturan (ikon gigi di kiri atas) atau dengan `curl`. Kartu penawaran menggantikan cincin mingguan. Tombol **Reset sekarang** hanya mengosongkan *tampilan* dashboard sampai data resmi berikutnya masuk. Tombol ini tidak mereset limit di Claude. **Nanti** menyembunyikan kartu 30 menit.
- **Animasi sederhana**: cincin menggambar dari kosong, angka menghitung naik, cincin berdenyut halus saat kritis, kartu penawaran muncul meluncur. Mati otomatis bila perangkat memakai "kurangi gerakan"; bisa dimatikan di pengaturan.
- **Anti burn-in OLED**: tampilan bergeser beberapa piksel tiap menit.

```bash
# nyalakan / matikan penawaran dari terminal
curl -X POST localhost:4747/offer -H 'X-Requested-With: claude-usage' \
  -H 'Content-Type: application/json' -d '{"active":true,"note":"Berlaku sampai 15:00"}'
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
