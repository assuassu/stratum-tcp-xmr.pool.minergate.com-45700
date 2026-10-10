# SPEC — FTTH Monitor & Traceroute

Aplikasi monitoring jaringan FTTH + tool traceroute (UI Bahasa Indonesia) untuk dipasang di LXC Ubuntu 24.04. Stack: FastAPI + motor/Mongo, Vite + React 19 + TS strict.

## Fitur
- **Login** cookie httpOnly (`ftth_session`), semua route lain diproteksi dependency `get_current_user`.
- **Dashboard NOC** (`/`): KPI (total/online/offline/latensi rata-rata), ribbon offline, tabel status perangkat dengan filter tipe, auto-refresh 5/15/30 detik/manual, tombol "Ping Sekarang" per baris.
- **Inventaris** (`/devices`): CRUD perangkat (nama, host/IP, tipe olt|onu|ont|router|switch|server|other, lokasi ODP/ODC, port PON, catatan, aktif/nonaktif, **perangkat induk**), **impor CSV**, **pindai subnet**, ekspor CSV, dialog konfirmasi hapus.
- **Peta Topologi** (`/topologi`): diagram hierarki Router Core → OLT → ONT dari `parent_id`; tiap node menampilkan status/latensi, badge kesehatan segmen (`n/total gangguan`) dirollup dari anak-anaknya; perangkat dengan induk hilang dikelompokkan "Induk tidak ditemukan".
- **Detail perangkat** (`/devices/:id`): uptime 24 jam + uptime rentang, grafik latensi (recharts, garis ambang kuning), log ping terakhir, ping manual, rentang 6/24/72 jam.
- **Traceroute** (`/traceroute`): eksekusi `traceroute`/`tracepath` sistem asli di backend, visual hop-by-hop + terminal mentah + salin.
- **Pengaturan** (`/settings`): interval ping worker, ambang latensi, timeout ping, ganti password admin, info sistem (ping/traceroute tersedia, monitor loop).

## Data model (Mongo, DB `app`)
- `users`: {id, username(unique), password_hash(pbkdf2_sha256), created_at}
- `sessions`: {token(unique), user_id, created_at, expires_at} — TTL index; cookie `ftth_session`, 7 hari
- `devices`: {id, name, host, type, location, pon_port, notes, enabled, parent_id, created_at, last_status(up|down|unknown), last_latency_ms, last_check_at, last_error} + computed uptime_24h/avg_latency_24h. `parent_id` = "" berarti akar; validasi menolak induk tidak ada / siklus; menghapus induk melepas anak jadi akar.
- `ping_results`: {id, device_id, timestamp, ok, latency_ms, error} — TTL 7 hari
- `settings`: singleton {key:"app", ping_interval_s(30), latency_warn_ms(100), ping_timeout_s(2)}

## Endpoint (semua di api_router /api)
- `/api/auth/status|setup|login|logout|me|password(PUT)`
- `/api/devices` GET/POST; `/api/devices/summary` GET; `/api/devices/import` POST {items:[DeviceCreate]} → {created,skipped,failed,errors}; `/api/devices/scan` POST {cidr,timeout_s} → ping sweep + probe TCP (maks /24); `/api/devices/{id}` GET/PUT/DELETE; `/api/devices/{id}/history?hours=&limit=`; `/api/devices/{id}/ping` POST
- `/api/traceroute` POST {host, max_hops, timeout_s}
- `/api/settings` GET/PUT; `/api/settings/system` GET
- Legacy template: `/api/status` GET/POST, `/api/` root

## Ping worker
`lib/monitor.py` `monitor_loop()` — asyncio task di lifespan; ping sistem asli `ping -c 1 -W <t> -n <host>` via `create_subprocess_exec` (tanpa shell); hasil dicatat ke `ping_results` + update status device. Interval/timeout dibaca dari collection `settings` tiap siklus.

## Kredensial & seed
- Admin: **admin / admin123** (lihat memory/test_credentials.md)
- 7 perangkat contoh FTTH Indonesia (OLT ZTE C320, MikroTik CCR2004, 3 ONT, DNS 8.8.8.8 & 1.1.1.1, satu ONT offline) + riwayat ping sintetis 6 jam (interval 120 dtk)
- Relasi topologi seed: CCR2004 → OLT C320 → 3 ONT (ditetapkan idempoten oleh `link_topology()`)
- Seed idempoten: `cd /app/backend && python seed.py`

## Catatan lingkungan (pod preview)
ICMP DIBLOKIR di pod preview (ping EPERM, raw socket diblokir seccomp) → semua perangkat tampil "down" dengan pesan "Ping diblokir lingkungan…". Ini keterbatasan pod, BUKAN bug. Di LXC Ubuntu 24.04 pengguna ping berfungsi normal; `traceroute` perlu `sudo apt install traceroute`. traceroute UDP probe jalan sebagian di pod (hop 1 merespons).

## Deviasi spesifikasi
- Impor CSV: parsing dilakukan di frontend (`lib/csv.ts`), backend menerima JSON hasil parse (maks 500 baris/permintaan); duplikat (nama+host sama) dilewati, bukan diperbarui.
- Pemindaian subnet: maksimum /24 (256 alamat). Di lingkungan yang memblokir ICMP, deteksi bergantung pada probe TCP sehingga host tanpa port terbuka tidak terdeteksi.
- Peta topologi: diagram pohon berbasis `parent_id` (bukan kanvas tarik-lepas / koordinat geografis).
- Grafik "bandwidth" tidak diimplementasikan (user memilih paket ping+traceroute+inventaris tanpa alert/bandwidth).
