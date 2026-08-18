# Deploy: Menyamakan Produksi dengan Lokal

Kode sudah ada di GitHub. Yang membuat produksi berbeda dari lokal bukan kodenya
— melainkan **empat hal yang tidak ikut ter-commit**: variabel lingkungan, skema
database, izin redirect OAuth, dan cara frontend menemukan backend.

Dokumen ini menutup keempatnya, berurutan.

---

## Bentuk sistemnya

```
Peramban  ──►  Vercel (frontend)  ──rewrite /api/*──►  Render (backend)
                     │                                        │
                     └────────── Supabase (auth + DB) ◄────────┘
```

Di lokal, Vite mem-proxy `/api` ke `localhost:8000`
([vite.config.ts](../frontend/vite.config.ts)). Di produksi,
[frontend/vercel.json](../frontend/vercel.json) melakukan hal yang persis sama ke
`https://tourcation-api.onrender.com`.

Itulah sebabnya seluruh kode klien memakai jalur relatif `/api/...` dan tidak
punya variabel `VITE_API_URL` sama sekali. **Kalau URL backend berubah, yang
diedit adalah `vercel.json`, bukan kode.**

---

## 1. Skema database — kerjakan ini lebih dulu

Empat migrasi di `backend/sql/` tidak pernah berjalan sendiri. Jalankan
berurutan di **Supabase → SQL Editor**:

```
2026-08-17_umpan_balik_perjalanan.sql
2026-08-17b_simpan_itinerary.sql
2026-08-17c_biodata_profil.sql
2026-08-17d_verifikasi_usaha.sql
```

Semuanya idempoten (`if not exists`), jadi aman dijalankan ulang.

Periksa hasilnya:

```bash
python backend/sql/cek_koneksi.py
```

Melewatkan langkah ini tidak membuat aplikasi mati — `services/migrasi.py`
menangkapnya dan membalas **503 dengan pesan yang menyebut nama berkasnya**.
Tapi fitur yang bergantung padanya akan tampak rusak tanpa sebab yang jelas.

---

## 2. Variabel di Render (backend)

`render.yaml` sudah mencantumkan seluruh kuncinya. Yang bertanda `sync: false`
**tidak tersimpan di repo** dan harus diisi manual sekali di
**Render → Environment**.

### Wajib agar login dan dashboard hidup

| Kunci | Isi |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role`. **Rahasia** — melewati seluruh RLS |
| `ADMIN_EMAILS` | Surel Anda. Tanpa ini tidak ada yang bisa menyetujui klaim UMKM |
| `GOV_EMAILS` | Surel yang berperan GOV saat demo |

### Penting: peran GOV tidak lagi punya domain demo

`GOV_EMAIL_DOMAINS` kini bawaannya **`go.id` saja**. Domain uji coba dicabut
karena peran GOV aktif seketika tanpa persetujuan siapa pun, dan sejak GOV
berwenang memverifikasi usaha UMKM, domain yang bisa didaftarkan siapa saja
menjadi rantai eskalasi.

**Untuk juri, isi `GOV_EMAILS` dengan alamat mereka.** Jangan menambahkan domain
publik ke `GOV_EMAIL_DOMAINS`.

### Opsional

| Kunci | Bila kosong |
|---|---|
| `OPENAI_API_KEY` | AI Search & penerjemah membalas 400 dengan pesan jelas; seluruh angka tetap utuh |
| `SMTP_*`, `GOV_NOTIFIKASI_EMAILS` | Notifikasi verifikasi menetap berstatus ANTRE dan tetap terbaca di dashboard. Surelnya saja yang tidak berangkat |

---

## 3. Variabel di Vercel (frontend)

**Vercel → Settings → Environment Variables.** Keduanya wajib, dan keduanya
memang publik:

| Kunci | Isi |
|---|---|
| `VITE_SUPABASE_URL` | `https://siqdhypesrprbrztucxw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → API Keys → publishable/anon |

Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di sini. Seluruh variabel
`VITE_*` ikut ter-bundel ke JavaScript yang dikirim ke peramban.

Tanpa keduanya aplikasi tetap tampil — [lib/supabase.ts](../frontend/src/lib/supabase.ts)
sengaja dibuat malas dan boleh null — tetapi tombol masuk mati.

**Variabel Vite dibaca saat build, bukan saat jalan.** Setelah mengisinya, Anda
harus **redeploy**; menyimpannya saja tidak mengubah bundle yang sudah terlanjur
dibangun. Ini penyebab paling sering "sudah saya isi tapi tetap tidak bisa login".

---

## 4. Redirect OAuth di Supabase

[auth.tsx:162](../frontend/src/auth.tsx:162) memakai
`${window.location.origin}/auth/callback`. Di lokal itu
`http://localhost:5173/auth/callback`; di produksi berubah mengikuti domain
Vercel.

**Supabase → Authentication → URL Configuration**, tambahkan **keduanya** ke
*Redirect URLs*:

```
http://localhost:5173/auth/callback
https://<domain-vercel-anda>/auth/callback
```

Isi juga *Site URL* dengan domain Vercel.

Gejala kalau terlewat: Google menerima login, lalu memantulkan kembali ke
localhost atau ke halaman galat — bukan ke aplikasi Anda.

---

## 5. Setelah deploy: urutan verifikasi

Jalankan berurutan. Kalau satu gagal, jangan lanjut — penyebabnya hampir selalu
ada di langkah sebelumnya.

**a. Backend hidup**

```bash
curl -s https://tourcation-api.onrender.com/api/health
```

**b. Inti produk jalan tanpa akun**

```bash
curl -s -X POST https://tourcation-api.onrender.com/api/itinerary \
  -H "Content-Type: application/json" \
  -d '{"budget_total":3000000,"n_days":3,"n_orang":2,"n_nights":2,"minat":["Alam"],"moda":"mobil"}' \
  | head -c 200
```

**c. Rewrite Vercel bekerja** — buka `https://<domain-anda>/api/health` di
peramban. Harus membalas JSON yang sama dengan (a). Kalau muncul halaman React,
rewrite-nya tidak jalan.

**d. Login** — masuk lewat Google, lalu buka `/akun`. Perannya harus benar.

**e. Peran GOV** — dashboard `/gov` terbuka untuk surel yang terdaftar di
`GOV_EMAILS`.

**f. Verifikasi usaha** — `/gov/verifikasi`. Kalau membalas 503, migrasi
`2026-08-17d` belum dijalankan. Kalau **403 "belum ditetapkan wilayah kerjanya"**,
itu benar dan disengaja — tetapkan dulu:

```bash
curl -s -X POST https://tourcation-api.onrender.com/api/admin/gov/wilayah \
  -H "Authorization: Bearer TOKEN_ADMIN" -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid-petugas>","kabupaten":"Samosir"}'
```

Untuk uji fungsional selengkapnya, lanjutkan ke [CARA_TES.md](CARA_TES.md).

---

## Perbedaan yang tetap ada, dan tidak bisa dihilangkan

**Render paket gratis tidur setelah ~15 menit menganggur.** Permintaan pertama
sesudahnya memakan **30–60 detik**, dan itu bukan bug. Pembangunan solver memang
sudah dibuat malas supaya `/api/health` tetap cepat, tetapi permintaan
`/api/itinerary` pertama tetap menanggung ongkos baca 14 berkas CSV.

Untuk demo: **buka aplikasinya beberapa menit sebelum tampil**, atau panggil
`/api/health` lebih dulu agar instansnya sudah bangun.

Ini juga alasan angka di dashboard bisa terasa lambat pada pemuatan pertama lalu
seketika sesudahnya — cache proses sudah panas.

---

## Ringkasan daftar periksa

- [ ] Empat migrasi SQL dijalankan di Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `GOV_EMAILS` diisi di Render
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` diisi di Vercel, **lalu redeploy**
- [ ] Redirect URL Vercel didaftarkan di Supabase Auth
- [ ] `GOV_EMAIL_DOMAINS` tetap `go.id` — tidak ada domain publik
- [ ] `/api/health` lewat domain Vercel membalas JSON, bukan halaman React
- [ ] Instans Render dibangunkan sebelum demo
