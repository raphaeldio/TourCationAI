# Model Bisnis — TourCation AI

**Status dokumen:** analisis berbasis asumsi yang dinyatakan terbuka, bukan proyeksi terverifikasi.
**Terakhir diperbarui:** 16 Agustus 2026

---

## Catatan kejujuran di depan

Setiap angka pendapatan di dokumen ini adalah **model berbasis asumsi**, bukan hasil pengukuran. Asumsinya ditulis eksplisit di setiap tabel supaya bisa dibantah — itu memang tujuannya.

Basis pasar awalnya juga perlu disebut apa adanya: dataset yang menjadi fondasi produk ini memuat **148 restoran, 139 destinasi, dan 35 hotel di 8 kabupaten**. Itu *serviceable market* awal yang kecil, dan pertumbuhannya bergantung pada akuisisi UMKM di luar dataset — pekerjaan lapangan, bukan pekerjaan teknis.

Menyajikan kurva hoki tanpa dasar akan melemahkan pitch. Menyajikan asumsi eksplisit yang bisa diperdebatkan jauh lebih kuat, dan itu yang dipilih di sini.

---

## Ringkasan lima lini

| | Lini | Pelanggan | Status implementasi |
|---|---|---|---|
| **M1** | Langganan UMKM Premium | Pemilik usaha kuliner | **Dibangun** — tier, gating 402, kuota |
| **M2** | Government Tourism Intelligence SaaS | Dinas pariwisata, BUMD | Produk teknisnya siap; penjualannya belum |
| **M3** | Sponsored Recommendation | UMKM yang ingin visibilitas | **Dicabut** dari lingkup saat ini |
| **M4** | Tourism Intelligence Report | Investor, pengelola destinasi | Tahun 3 — terhalang syarat volume |
| **M5** | Marketplace & Commission | Hotel, operator aktivitas | Tahap scale-up |

---

## M1 — UMKM Premium Subscription

### Tier

| | **Gratis** | **Growth — Rp 49.000/bln** | **Pro — Rp 149.000/bln** |
|---|---|---|---|
| Terdaftar & muncul di itinerary | ✅ | ✅ | ✅ |
| Statistik dasar | 1 bulan | 12 bulan | 24 bulan + ekspor CSV |
| Kelola produk | 5 produk | 25 produk | Tak terbatas |
| AI UMKM Advisor | — | 1×/30 hari | 8×/30 hari |
| Analisis harga vs UMKM sejenis | — | ✅ | ✅ |
| Analisis kompetitor sekabupaten | — | Ringkas (anonim) | Lengkap (anonim) |
| Promo terjadwal | — | 1 aktif | 5 aktif |
| Badge "Terverifikasi" | bila skor ≥ 0,7 | ✅ | ✅ |

### Penentuan harga

Rp 49.000 ≈ **dua porsi makan pada harga median dataset** (~Rp 25.000). Cukup rendah untuk keputusan spontan pemilik warung, cukup tinggi untuk menutup biaya. Diskon tahunan: bayar 10 bulan untuk 12.

**Biaya marginal per pelanggan didominasi panggilan LLM.** Advisor Pro ~8 generasi per 30 hari × ~Rp 300 (gpt-4o-mini, konteks sudah dipadatkan di Python, hasil di-cache berdasarkan sidik jari angkanya) ≈ **Rp 2.400/bulan** — margin kotor > 98%.

Biaya sesungguhnya bukan komputasi, melainkan **akuisisi dan pendampingan**. Pemilik warung di Balige tidak akan mendaftar sendiri dari iklan; ia butuh orang yang datang, menjelaskan, dan membantu mengisi produk pertamanya. Itu biaya per-UMKM yang nyata dan tidak ikut turun seiring skala.

### Model pendapatan — dengan asumsinya

| Asumsi | Nilai | Dasar |
|---|---|---|
| UMKM terdaftar akhir Tahun 1 | 300 | Target akuisisi, **belum tervalidasi** |
| Konversi ke berbayar | 8% | Angka umum SaaS SMB; belum diuji di segmen ini |
| Bauran Growth : Pro | 80 : 20 | Asumsi; Pro menyasar usaha dengan >10 produk |
| Retensi bulanan | 85% | Asumsi; churn UMKM mikro biasanya lebih tinggi |

Dengan asumsi di atas: 300 × 8% = 24 pelanggan → 19 Growth + 5 Pro → **≈ Rp 1,68 juta/bulan**. Angka ini **tidak menutup biaya operasional**, dan itu memang temuannya: M1 sendirian bukan bisnis. Ia adalah mesin retensi sisi pasokan yang membuat M2 punya data untuk dijual.

### Aturan integritas yang tidak bisa ditawar

> **Langganan Premium TIDAK membeli peringkat.**

Premium membeli *insight*, bukan *visibilitas*. Semua tier muncul di itinerary lewat ILP yang sama. Begitu langganan bisa membeli peringkat, kualitas rekomendasi runtuh dan nilai produk pemerintah ikut hilang — dua lini pendapatan mati demi satu.

Aturan ini **ditegakkan struktur kode, bukan kebijakan**: `services/langganan.py` hanya diimpor oleh router UMKM dan router admin. Ia tidak pernah menyentuh `engine.py` maupun `services/solver_state.py`. Cara memeriksanya satu baris:

```bash
grep -rn "langganan" backend/app/services/solver_state.py engine.py
```

Hasil kosong = aturan masih utuh.

---

## M2 — Government Tourism Intelligence SaaS

| Lisensi | Cakupan | Estimasi harga/tahun |
|---|---|---|
| **Kabupaten/Kota** | 1 wilayah: Dashboard GOV, Gap Analysis, Impact Simulator, ekspor laporan, 5 akun | Rp 45–90 juta |
| **Provinsi** | Seluruh kabupaten/kota + perbandingan antarwilayah, 25 akun, akses API | Rp 250–450 juta |
| **Badan Otorita / BUMD** (mis. BPODT) | Lintas kabupaten kawasan, kustomisasi indikator, laporan kuartalan | Negosiasi, mulai Rp 150 juta |
| **Pilot** | 6 bulan, 1 kabupaten, fitur penuh, tanpa biaya | Rp 0 → konversi |

### Pertimbangan pengadaan yang membentuk harga

Belanja barang/jasa pemerintah di Indonesia di bawah ambang tertentu dapat ditempuh lewat **pengadaan langsung** tanpa tender; sisanya lewat **e-Katalog LKPP**. Tier Kabupaten sengaja dipatok di bawah ambang tersebut supaya siklus penjualannya jadi hitungan minggu, bukan satu tahun anggaran.

> ⚠ **Ambang nominalnya berubah antar-Perpres.** Verifikasi angka yang berlaku saat ini di LKPP sebelum mencantumkannya di pitch deck, dan sesuaikan tier bila perlu.

Jalur lain yang realistis: masuk sebagai komponen dalam **DAK/DAU pariwisata**, atau kerja sama riset dengan perguruan tinggi — relevan, karena dataset ini berasal dari lingkungan IT Del.

### Value proposition, dinyatakan sebagai perbandingan biaya

Satu survei kepariwisataan konvensional bersifat sekali jalan, mahal, dan hasilnya usang dalam hitungan bulan. Lisensi tahunan memberi indikator yang diperbarui terus-menerus, **plus dua kemampuan yang tidak dimiliki survei sama sekali**:

1. **Mensimulasikan dampak kebijakan sebelum anggaran dikeluarkan** (Impact Simulator) — lima skenario dengan panel asumsi terbuka.
2. **Menunjuk kesenjangan wilayah secara terukur** (Gap Analysis) — tujuh sumbu, ternormalisasi lintas 8 kabupaten.

Bukti konkret untuk demo: **Karo dengan 2,3 juta kunjungan tetapi nol destinasi terdata**, dan **Dairi serta Humbang Hasundutan yang punya wisata tetapi nol UMKM kuliner terdata**. Ini bukan kelemahan dataset yang disembunyikan — ini justru temuan yang dijual.

---

## M3 — Sponsored Recommendation

Lini paling sensitif secara teknis. Ia bukan sekadar kebijakan; ia **harus ditegakkan kode**, dengan disiplin yang sama seperti validasi harga.

### Larangan arsitektural

> **Status sponsor tidak pernah masuk ke fungsi objektif `engine.py`.**

Itinerary inti — kelayakan, budget, rute, waktu operasional — dihitung tanpa mengetahui siapa yang membayar. Kalau sponsor bisa mengubah ILP, ia bisa membuat rencana yang lebih mahal atau lebih jauh demi uang. Itu garis yang tidak dilewati.

### Di mana sponsor boleh muncul

Hanya dua permukaan yang **sudah ada** di payload dan sifatnya alternatif, bukan keputusan utama:

1. `days[].nearby[]` — saran "di sekitar sini"
2. `agenda[].options[]` — pilihan rumah makan pengganti pada slot makan

### Mekanisme, berurutan

1. **Gerbang kelayakan lebih dulu.** Kandidat harus lolos *tanpa* melihat sponsor: relevan secara geografis terhadap rute hari itu, masuk pita budget pengguna, `verification_score ≥ 0,7`, `price_flag.status = 'OK'`, rating ≥ median kabupaten. **Sponsor tidak pernah membeli kelayakan.**
2. **Pengaruh peringkat dibatasi keras:** `skor_tampil = skor_relevansi × (1 + β·sponsor)` dengan `β ≤ 0,15`, plus aturan mutlak: **item bersponsor tidak boleh menggeser item yang relevansinya > 20% lebih tinggi.**
3. **Kuota:** maksimal 1 item bersponsor per hari, tidak pernah pada agenda pertama, tidak pernah > 20% dari total item yang ditampilkan.
4. **Lelang harga kedua** atas bid yang di-cap, plus rotasi berbobot agar bukan pemenang yang sama setiap kali.

### Aturan transparansi

- Badge **"Bersponsor"** yang terlihat jelas, bukan tanda kecil samar.
- Field `disponsori: true` di respons API — bisa diaudit siapa pun.
- Halaman publik yang menjelaskan mekanismenya apa adanya, **termasuk nilai β**.
- **Item bersponsor dikeluarkan dari seluruh peringkat analitik GOV dan Tourism Intelligence Report.** Kalau penempatan berbayar bocor ke insight pemerintah, M2 dan M4 kehilangan keabsahannya.
- Pengguna dapat mematikan tampilan bersponsor di pengaturan.

**Status: DICABUT dari lingkup saat ini.** Kode penegakannya sempat dibangun lalu dihapus beserta tabel `sponsorship` dan kolom `disponsori`.

Alasan mencabutnya masuk akal secara produk: penempatan berbayar hanya bernilai kalau sudah ada volume wisatawan yang berarti, sedangkan pada tahap ini belum. Sementara itu ia menambah permukaan yang harus dijaga terus-menerus — setiap kueri analitik baru wajib ingat menyaring `disponsori`, dan satu yang lupa sudah cukup untuk mencemari angka kebijakan.

Aturan di atas tetap diterbitkan supaya bisa dinilai lebih dulu bila lini ini dihidupkan kembali. Urutan yang tidak boleh ditempuh tetap sama: menayangkan slot bersponsor sebelum pagar kelayakan dan badge transparansi ada.

---

## M4 — Tourism Intelligence Report

Produk: laporan regional kuartalan (Rp 5–15 juta), laporan tahunan (Rp 25–50 juta), analisis kustom (mulai Rp 50 juta), dan *data room* untuk investor/pengelola destinasi.

### Aturan anonimitas — ditegakkan di query, bukan di kebijakan

- **k-anonymity, k = 10**: setiap sel agregat dengan `n < 10` itinerary **disupresi**, bukan ditampilkan kecil.
- Tidak pernah mengekspor baris tingkat itinerary, `user_id`, `session_id`, IP, atau kombinasi atribut yang bisa mempersempit ke satu perjalanan.
- Pembulatan hitungan ke kelipatan 5 pada sel kecil, mencegah serangan diferensial antar-edisi laporan.
- Rentang tanggal minimum satu bulan — tidak ada agregat harian per tempat.

Basis hukumnya sejalan dengan **UU PDP**, dan datanya memang tidak pernah memuat data pribadi: `itinerary_log` dirancang tanpa PII sejak awal, sehingga anonimisasi adalah **properti skema**, bukan tambalan di ujung.

### Syarat kelayakan produk

Laporan baru layak dijual pada volume **≥ 5.000 itinerary/kuartal/kabupaten**. Di bawah itu, k-anonymity menyupresi begitu banyak sel sehingga laporannya tidak bernilai.

> **Karena itu M4 adalah produk Tahun 3.** Menjualnya lebih awal berarti menjual sesuatu yang belum ada. Sampai ambang itu tercapai, laporan berbasis agregat CSV tetap bisa dijual — tetapi harus dinyatakan sebagai *baseline study*, bukan data perilaku pengguna.

---

## M5 — Marketplace & Commission (Tahap Scale-Up)

Skema komisi: hotel/homestay 8–12% · paket & aktivitas wisata 10–15% · tiket transportasi/ferry 3–5% · **UMKM kuliner 0%** — sengaja, untuk menjaga sisi pasokan lokal tetap tumbuh.

Titik integrasinya sudah ada di payload: `hotel_kandidat[]` adalah daftar penginapan siap-booking, dan `agenda[].options[]` adalah slot aktivitas/makan. Alurnya: itinerary → "Pesan" per item → keranjang lintas-item → pembayaran → voucher masuk ke itinerary dan ikut ter-ekspor ke PDF.

### Realitas regulasi yang menentukan urutan

**Jangan menahan dana pengguna sendiri** — gunakan agregator berlisensi (Midtrans/Xendit) sehingga lisensi pembayaran ada di pihak mereka. Yang tetap dibutuhkan: badan hukum, pendaftaran **PSE Kominfo**, kemungkinan **TDUP** bila menjual paket wisata, kebijakan pembatalan/refund, dan penyelesaian dana ke mitra (T+7).

Ditambah satu hal operasional yang sering diremehkan: **manajemen inventaris dan ketersediaan kamar real-time**, yang di kawasan Toba sebagian besar belum terdigitalisasi. Karena itu mulai dari model **reservasi-dengan-konfirmasi**, bukan instant booking — jangan menjanjikan ketersediaan yang tidak bisa dijamin.

---

## Yang benar-benar dibangun pada tahap ini

| Kebutuhan | Perubahan | Status |
|---|---|---|
| Tier langganan | Tabel `subscription` (`business_id` unik, `plan`, `status`, `mulai`, `selesai`, kuota) | ✅ |
| Gating fitur | `wajib_paket()` di `core/security.py` → **402 Payment Required** + `upgrade_url` | ✅ |
| Kuota advisor | Kolom kuota + pemeriksaan di router advisor, dipotong hanya saat model benar-benar dipanggil | ✅ |
| Batas produk | 5 / 25 / tak terbatas, dibalas 402 | ✅ |
| Katalog publik | `GET /api/paket`, tanpa autentikasi | ✅ |
| Penetapan paket | `POST /api/admin/langganan` (ADMIN) | ✅ |
| Halaman harga | `/bisnis` | ✅ |
| Tab Langganan | Dashboard UMKM | ✅ |
| Sponsor | `sponsorship`, `disponsori`, `services/sponsor.py` | ❌ Dicabut |
| Laporan k-anonymity | View `laporan_kabupaten_k10` (`HAVING >= 10`) | ✅ View siap; produknya Tahun 3 |

**Pembayaran tidak diimplementasikan pada tahap ini.** Status langganan diatur manual oleh ADMIN. Integrasi payment gateway memerlukan badan hukum dan kredensial merchant yang berada di luar cakupan hackathon. Yang dibangun adalah **struktur yang siap dipasangi** gateway — bukan gateway itu sendiri, dan bukan pula tiruannya.

---

## Roadmap & gerbang keputusan

| | Fokus | Gerbang lanjut ke tahap berikutnya |
|---|---|---|
| **Tahun 1** | Akuisisi wisatawan & UMKM; 1–2 pilot pemerintah gratis; Growth opsional | ≥ 300 UMKM terdaftar · ≥ 10.000 itinerary · ≥ 1 pilot menyatakan minat berbayar |
| **Tahun 2** | Konversi langganan UMKM + lisensi Government SaaS | ≥ 8% konversi berbayar · ≥ 3 lisensi kabupaten · retensi bulanan ≥ 85% |
| **Tahun 3** | Marketplace/komisi + Tourism Intelligence Report + ekspansi | ≥ 5.000 itinerary/kuartal/kabupaten (syarat k-anonymity) · badan hukum & PSE siap |

### Metrik yang benar-benar menentukan nasib platform

Bukan jumlah unduhan, melainkan:

1. **Itinerary per bulan** — sinyal permintaan sisi wisatawan
2. **Rasio UMKM aktif** (login ≥ 1×/bulan) — sinyal apakah produknya benar-benar dipakai
3. **Retensi langganan** — sinyal apakah insight-nya bernilai, bukan sekadar menarik
4. **Konversi pilot pemerintah → berbayar** — satu-satunya bukti M2 layak

Keempatnya bisa dihitung langsung dari skema yang sudah ada, sehingga **dashboard ADMIN sekaligus menjadi alat ukur bisnisnya sendiri**.

---

## Risiko terhadap model ini

1. **Akuisisi UMKM adalah kerja lapangan, bukan kerja produk.** Ini risiko terbesar dan paling mudah diremehkan.
2. **Siklus anggaran pemerintah lambat** meski pengadaan langsung memungkinkan. Pilot gratis adalah mitigasinya, tetapi pilot juga menunda pendapatan.
3. **Basis dataset kecil (8 kabupaten).** Ekspansi ke danau/kawasan lain memerlukan pengumpulan data ulang yang tidak otomatis.
4. **Ambang pengadaan LKPP berubah antar-Perpres** — verifikasi ulang sebelum setiap penawaran.
5. **Ketergantungan pada satu penyedia LLM.** Mitigasi: seluruh aritmetika sudah di Python, sehingga mengganti model hanya memengaruhi kualitas kalimat, bukan kebenaran angka.
