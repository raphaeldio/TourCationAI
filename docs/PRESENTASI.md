# Naskah Presentasi TourCation AI — 10 Menit + 10 Menit Tanya Jawab

*Disusun mengikuti enam poin wajib rubrik penjurian. Bahasa sengaja dibuat awam:
juri belum tentu ahli optimasi, dan yang menilai adalah kejelasan, bukan kerumitan.*

---

## Aturan main yang menentukan gaya bicara

1. **Satu slide, satu kalimat kunci.** Sisanya diucapkan, bukan dibaca.
2. **Sebut maksimal tiga angka per bagian.** Angka keempat menghapus ingatan atas tiga yang pertama.
3. **Setiap istilah teknis wajib punya padanan sehari-hari**, diucapkan dalam napas yang sama.
   Contoh: *"Integer Linear Programming — sederhananya, matematika pemilihan kombinasi terbaik di bawah uang terbatas."*
4. **Jangan pernah membuka source code di panggung.** Kode dibicarakan, tidak dipamerkan.
5. **Sebut keterbatasan lebih dulu sebelum juri menemukannya.** Itu memindahkan posisi Anda
   dari "yang diuji" menjadi "yang menguasai".
6. Jika aturan *blind review* masih berlaku pada sesi presentasi, jangan sebut nama institusi.

---

## Pembagian waktu (10 menit)

| Waktu | Bagian | Poin rubrik |
|---|---|---|
| 0:00–0:50 | Pembuka & latar belakang | 1 |
| 0:50–2:00 | Analisis permasalahan | 2 |
| 2:00–3:40 | Pendekatan AI & modelling | 3 |
| 3:40–4:30 | Proses pengembangan solusi | 4 |
| 4:30–8:00 | **Demo produk** | 5 |
| 8:00–9:20 | Dampak & potensi pengembangan | 6 |
| 9:20–10:00 | Penutup + keterbatasan jujur | — |

Latih dengan stopwatch. Bagian yang paling sering meleber adalah demo — potong di sana, bukan di bagian dampak.

---

# BAGIAN A — NASKAH PER SEGMEN

## 1. Latar belakang dan permasalahan (0:00–0:50)

**Slide: satu kalimat besar + foto Danau Toba.**

> "Informasi wisata Danau Toba itu sudah melimpah. Daftar destinasi ada, ulasan ada, harga ada.
> Tapi coba Bapak/Ibu bayangkan seorang wisatawan dengan uang lima juta rupiah dan waktu tiga hari.
> Pertanyaannya bukan *'ada apa saja di Toba'* — itu sudah dijawab Google.
> Pertanyaannya adalah **'dari ratusan pilihan ini, kombinasi mana yang muat di uang saya,
> masuk akal rutenya, dan tempatnya tidak tutup saat saya datang?'**
> Pertanyaan kedua itu yang belum ada yang menjawab."

Lalu balik sudut pandangnya — ini yang membedakan tim Anda:

> "Dan ada sisi yang lebih jarang dilihat lagi. Setiap kali wisatawan menyusun rencana,
> ia sebenarnya sedang menyatakan permintaan pasar. Hari ini sinyal itu hilang begitu saja.
> Pemilik warung di Balige tidak pernah tahu ada berapa orang yang hampir mampir ke tempatnya.
> Dinas pariwisata tidak pernah tahu wilayah mana yang diminati tapi tidak punya fasilitas."

**Kalimat kunci untuk dihafal:**
> *"Masalahnya bukan kekurangan informasi. Masalahnya adalah pengambilan keputusan — dan sinyal permintaan yang terbuang."*

---

## 2. Analisis permasalahan (0:50–2:00)

**Slide: tiga kotak — Wisatawan · UMKM · Pemerintah.**

Jelaskan tiga pihak yang sama-sama rugi dari satu akar masalah yang sama:

> "Kami membedah masalahnya jadi tiga pihak.
>
> **Wisatawan** menghadapi persoalan yang di ilmu komputer disebut *constrained optimization* —
> memilih kombinasi terbaik di bawah batasan. Analoginya: belanja di supermarket dengan uang pas-pasan.
> Mesin pencari bisa menunjukkan daftar barang, tapi tidak bisa menyusun isi keranjang yang optimal untuk Anda.
>
> **UMKM lokal** kalah bersaing bukan karena kualitas, tapi karena tidak terlihat.
> Dan ini melingkar: tidak dapat pengunjung karena tidak punya ulasan,
> tidak punya ulasan karena tidak pernah dapat pengunjung.
>
> **Pemerintah daerah** menyusun kebijakan berbasis survei yang mahal, sekali jalan, dan usang dalam hitungan bulan.
> Contoh nyata dari data resmi yang kami olah: **Kabupaten Karo menerima 2,3 juta kunjungan,
> tetapi nol destinasinya terdata dalam sistem pariwisata.** Itu bukan berarti Karo tidak punya wisata —
> itu berarti pendataannya bolong, dan tidak ada yang tahu sampai datanya dihitung berdampingan."

**Tutup dengan tesis produk:**
> *"Kesimpulan analisis kami: ketiganya bisa diselesaikan satu sistem, kalau data perjalanan wisatawan dikembalikan kepada pihak yang bisa bertindak atasnya."*

---

## 3. Pendekatan AI dan modelling (2:00–3:40)

Ini segmen paling menentukan nilai teknis. **Jangan tampilkan rumus penuh** — tampilkan struktur.

**Slide: diagram dua lapis.**

```
   LAPIS 1 — MESIN KEPUTUSAN (deterministik)
   Integer Linear Programming · PuLP + solver CBC
   → memilih destinasi, rumah makan, penginapan
   → semua angka berasal dari 14 dataset resmi

   LAPIS 2 — MODEL BAHASA (gpt-4o-mini)
   → hanya menjelaskan angka yang sudah jadi
   → tidak pernah menghitung
```

Naskahnya:

> "Kami mengambil satu keputusan arsitektural di awal yang menentukan segalanya:
> **AI generatif tidak boleh menyentuh angka.**
>
> Intinya adalah model *Integer Linear Programming*. Sederhananya begini:
> ada 137 destinasi, 117 rumah makan, dan 27 penginapan. Kombinasinya jutaan.
> Model ini mencari **satu kombinasi terbaik** yang memenuhi seluruh syarat sekaligus:
> tidak melebihi anggaran, sesuai minat, tempatnya sedang buka, rutenya tidak bolak-balik,
> dan sebisa mungkin uangnya jatuh ke usaha lokal. Semua syarat itu ditulis sebagai
> pertidaksamaan matematis, lalu diselesaikan oleh *solver*.
>
> Kenapa bukan langsung pakai ChatGPT saja? Karena model bahasa itu **mengarang angka dengan percaya diri.**
> Kalau ia salah menjumlahkan biaya, wisatawan yang menanggung akibatnya di lapangan.
> Jadi pembagiannya tegas: **matematika yang menghitung, AI yang menjelaskan.**
> Model bahasa kami menerima blok berisi angka jadi, dengan perintah eksplisit:
> *jangan menghitung, salin persis*."

**Bukti bahwa pemisahan ini nyata, bukan klaim** — ini kalimat yang membuat juri percaya:

> "Cara membuktikannya mudah: **matikan kunci OpenAI, seluruh aplikasi tetap berjalan penuh.**
> Semua angka, grafik, dan itinerary tetap keluar. Yang hilang hanya paragraf penjelasannya.
> Artinya kalau kuota AI habis di tengah demo, presentasi ini turun kualitas — tidak gagal."

Sebutkan komponen pendukung dengan cepat (satu napas masing-masing):

> "Di sekitar model inti ada empat komponen: **pencari rute terpendek** memakai jarak jalan sungguhan;
> **penyaring jam operasional** supaya tidak dikirim ke tempat yang tutup;
> **pendeteksi penyeberangan feri** ke Samosir — karena jarak lurus di peta bisa menipu kalau di tengahnya ada danau;
> dan **penilai keberpihakan UMKM** yang memberi bobot pada rumah makan yang menyajikan kuliner khas Batak dengan harga terjangkau."

**Angka yang disebut di sini — cukup tiga:**
- 100% dari 90 skenario uji menghasilkan rencana yang layak
- **Nol pelanggaran anggaran** — bukan disaring belakangan, tapi dijamin oleh model
- Rata-rata **0,4 detik** per rencana

---

## 4. Proses pengembangan solusi (3:40–4:30)

**Slide: garis waktu empat tahap.**

> "Pengembangannya kami susun berlapis, dan setiap lapis punya alasan.
>
> **Pertama**, kami bersihkan datanya. Dataset panitia punya berkas yang rusak formatnya —
> setiap barisnya terbungkus tanda kutip, sebagian nama tempat mengandung koma yang merusak kolom.
> Kami tulis pembaca khusus, dan seluruh pembersihan dilakukan **di dalam kode saat program jalan**,
> bukan lewat file antara. Tujuannya supaya juri bisa menelusuri setiap transformasi.
>
> **Kedua**, kami bangun mesin optimasinya, lalu **mengujinya secara sistematis** —
> 90 skenario kombinasi anggaran, durasi, dan jumlah orang. Termasuk *ablation study*:
> kami matikan komponen UMKM-nya, lalu bandingkan hasilnya, untuk membuktikan komponen itu memang berpengaruh.
> Bobot-bobot di dalam model tidak kami tetapkan sepihak — semuanya hasil kalibrasi terukur.
>
> **Ketiga**, kami bangun antarmukanya, dan yang paling penting: setelah mesin inti selesai diuji,
> **file mesinnya tidak pernah kami sentuh lagi.** Semua fitur baru mengimpornya secara baca-saja.
> Itu yang menjaga seluruh laporan evaluasi kami tetap sah sampai hari ini.
>
> **Keempat**, kami perluas dari satu produk menjadi platform tiga peran — wisatawan, UMKM, pemerintah —
> di atas basis data dengan pengendalian akses per peran."

Kalau ada waktu, satu kalimat soal disiplin tim:

> "Satu aturan yang kami pegang di seluruh proses: **tidak ada data sintetis.**
> Kalau datanya kosong, kami tulis 'nol destinasi terdata' — bukan kami karang isinya."

---

## 5. Implementasi produk — DEMO (4:30–8:00)

**Ini bagian yang paling banyak menentukan kesan. Urutannya harus diceritakan sebagai satu alur, bukan tur menu.**

Kalimat pembuka demo:

> "Saya akan tunjukkan satu alur utuh: bagaimana satu rencana perjalanan berubah menjadi
> keputusan bisnis untuk UMKM dan keputusan kebijakan untuk pemerintah."

### Adegan 1 — Wisatawan (± 90 detik)

1. Isi panel *Atur Perjalanan*: **Rp5.000.000 · 3 hari 2 malam · 2 orang · Alam, Budaya, Kuliner · mobil**.
   Ucapkan sambil mengetik: *"Ini satu-satunya input yang diminta ke wisatawan."*
2. Tekan **Susun Rencana**. Sambil menunggu: *"Yang berjalan sekarang bukan pencarian, tapi pemecahan model matematis."*
3. Tunjuk agenda harian berjam. → *"Jamnya bukan hiasan — sudah dicek terhadap jam buka."*
4. **Tukar satu pilihan rumah makan.** Tunjuk total biaya dan angka dampak UMKM yang berubah seketika.
   → *"Setiap angka di sini bisa ditelusuri ke dataset. Tidak ada yang dikarang."*
5. Buka **Peta rute**. → *"Urutan kunjungan disusun supaya tidak bolak-balik, dan penyeberangan feri terdeteksi otomatis."*
6. Tunjuk **Dampak UMKM**. → **"Dari seluruh pengujian, 95% kunjungan makan jatuh ke usaha lokal otentik."**

### Adegan 2 — Sisi UMKM (± 45 detik)

> "Sekarang sisi sebaliknya. Ini dashboard pemilik usaha."

Tunjukkan sinyal permintaan dan pita harga pembanding.

> "Pemilik warung bisa melihat posisinya dibanding usaha sejenis sekabupaten.
> Dan ada aturan yang kami pegang keras: **kami sembunyikan angka persentil kalau pembandingnya kurang dari lima usaha** —
> pada sampel sekecil itu, angkanya lebih menyesatkan daripada membantu."

Satu kalimat integritas yang kuat:

> "UMKM bisa mengunggah harganya sendiri. Tapi harga itu **tidak langsung dipercaya** —
> ia lewat pemeriksaan kewajaran statistik dulu. Sebab satu harga palsu tidak hanya merusak satu baris,
> ia bisa merusak peringkat seluruh restoran di delapan kabupaten sekaligus."

### Adegan 3 — Sisi Pemerintah (± 60 detik)

Buka **Analisis Kesenjangan**.

> "Ini skor kesenjangan tujuh sumbu untuk delapan kabupaten. Dan inilah temuan yang saya sebut di awal:
> **Karo, 2,3 juta kunjungan, nol destinasi terdata. Dairi dan Humbang Hasundutan punya wisata, nol UMKM kuliner terdata.**
> Kami tidak menyembunyikan kekosongan ini — kami **menjualnya sebagai temuan**: inilah wilayah yang perlu didata lebih dulu."

Buka **Simulator Kebijakan**, jalankan satu skenario (mis. Festival Daerah).

> "Dan ini yang tidak bisa dilakukan survei mana pun: **mensimulasikan dampak kebijakan sebelum anggarannya keluar.**
> Perhatikan panel **Asumsi Model** ini — setiap angka dasarnya kami buka, lengkap dengan sumbernya,
> dan selalu dibandingkan dengan skenario tidak melakukan apa-apa.
> Kami lebih memilih simulasi yang bisa diperdebatkan daripada angka ajaib yang tidak bisa dipertanggungjawabkan."

### Adegan 4 — penutup demo (± 15 detik)

Kalau sempat: penerjemah 18 bahasa termasuk **Batak Toba**, dan ekspor PDF.

> "Satu hal kecil tapi berarti: penerjemahnya mencakup Bahasa Batak Toba."

---

## 6. Dampak dan potensi pengembangan (8:00–9:20)

**Slide: tiga baris dampak + roadmap.**

> "Dampaknya kami ukur di tiga tingkat.
>
> **Bagi wisatawan** — perencanaan yang tadinya berjam-jam menjadi hitungan detik,
> dengan jaminan tidak melampaui anggaran.
>
> **Bagi UMKM** — keberpihakan yang bukan slogan, melainkan **suku dalam rumus matematisnya**.
> Dan kami sediakan mekanisme pemerataan: dua UMKM yang paling belum dikenal di wilayah yang dilalui rute
> ikut ditampilkan, supaya lingkaran 'tidak dikenal karena tidak pernah muncul' bisa diputus.
> Ini pun dijaga: mekanisme itu **tidak pernah menyentuh mesin optimasi**, jadi rute dan biaya tidak berubah sedikit pun.
>
> **Bagi pemerintah daerah** — pengambilan kebijakan berbasis sinyal permintaan yang diperbarui terus-menerus,
> bukan survei sekali jalan."

Model bisnis, ringkas dan jujur:

> "Secara bisnis, dua lini yang sudah terbangun: **langganan UMKM** mulai Rp49.000 sebulan —
> setara dua porsi makan — dan **lisensi intelijen pariwisata untuk pemerintah daerah**.
> Satu aturan tidak bisa ditawar: **langganan tidak membeli peringkat.**
> Premium membeli wawasan, bukan visibilitas. Dan itu **ditegakkan oleh struktur kode**, bukan sekadar janji —
> modul langganan kami secara arsitektur tidak pernah bisa menyentuh mesin itinerary.
> Begitu peringkat bisa dibeli, kualitas rekomendasi runtuh, dan produk untuk pemerintah ikut kehilangan nilainya."

Potensi pengembangan (sebut cepat, tiga saja):

> "Ke depan: integrasi pembayaran dan pemesanan langsung, perluasan ke kawasan wisata prioritas lain —
> karena metodenya tidak terikat Danau Toba, hanya perlu dataset setara —
> dan yang paling berdampak: **umpan balik pendataan**, di mana kekosongan yang ditemukan sistem
> menjadi masukan resmi untuk perbaikan data pariwisata daerah."

---

## 7. Penutup (9:20–10:00)

Sebut keterbatasan **lebih dulu**, lalu tutup dengan kalimat sikap.

> "Sebelum menutup, tiga keterbatasan yang perlu kami sampaikan terbuka:
> **pertama**, informasi hari tutup hanya tersedia untuk 20 dari 137 destinasi — ini keterbatasan data, bukan algoritma;
> **kedua**, volume ulasan kami perlakukan sebagai *proksi* permintaan, bukan jumlah kunjungan sesungguhnya,
> dan label itu kami tempelkan di setiap grafik;
> **ketiga**, angka model bisnis kami adalah asumsi terbuka, bukan proyeksi tervalidasi.
>
> Kami memilih menampilkan batasan-batasan ini, karena produk yang menyembunyikan batasnya
> justru lebih sulit dipercaya daripada yang menyatakannya.
>
> TourCation AI, singkatnya: **matematika yang menyusun keputusan, AI yang menjelaskannya,
> dan data yang dikembalikan kepada orang-orang yang bisa bertindak atasnya.** Terima kasih."

---

# BAGIAN B — SUSUNAN SLIDE (10 slide)

| # | Judul slide | Isi visual | Jangan |
|---|---|---|---|
| 1 | Judul + satu kalimat masalah | Foto Toba, nama produk | Logo institusi (blind review) |
| 2 | Masalahnya bukan informasi | Ilustrasi "5 juta, 3 hari, ratusan pilihan" | Paragraf panjang |
| 3 | Tiga pihak yang rugi | 3 kotak: Wisatawan · UMKM · Pemerintah | Teks kecil |
| 4 | Dua lapis AI | Diagram ILP di atas, LLM di bawah | Rumus matematis penuh |
| 5 | Bukti disiplin | "Tanpa kunci OpenAI, semua angka tetap keluar" | Screenshot kode |
| 6 | Proses pengembangan | Garis waktu 4 tahap | Daftar teknologi |
| 7 | **DEMO** | Slide kosong bertuliskan DEMO | Slide penuh screenshot |
| 8 | Temuan Gap Analysis | Karo: 2,3 juta kunjungan · 0 destinasi terdata | Terlalu banyak kabupaten |
| 9 | Dampak & model bisnis | 3 baris dampak + 2 lini pendapatan | Proyeksi keuangan detail |
| 10 | Keterbatasan + penutup | 3 batasan + kalimat sikap | Kata "sempurna" |

---

# BAGIAN C — CHECKLIST SEBELUM NAIK PANGGUNG

- [ ] **Buka URL produksi 2 menit sebelum tampil.** Layanan gratis Render tidur setelah 15 menit —
      akses pertama bisa memakan ±50 detik. Ini pembunuh demo nomor satu.
- [ ] Susun **satu itinerary lengkap sebelum tampil**, biarkan tab-nya terbuka sebagai cadangan.
- [ ] Siapkan **rekaman video demo** sebagai jaring pengaman kalau internet mati.
- [ ] Cek kuota OpenAI. Kalau habis: tetap lanjut, dan **sebutkan** bahwa angka tidak bergantung padanya —
      itu justru memperkuat argumen desain Anda.
- [ ] Zoom peramban di **125%** supaya angka terbaca dari kursi juri.
- [ ] Tutup semua tab lain, notifikasi, dan folder kode.
- [ ] Siapkan **PDF hasil ekspor** satu rencana untuk dibagikan bila juri minta.
- [ ] Sepakati pembagian bicara: satu orang narator utama, satu orang mengoperasikan demo,
      satu orang khusus menyiapkan jawaban tanya jawab.

---

# BAGIAN D — PERSIAPAN TANYA JAWAB (10 menit)

Jawab **pendek dulu, baru alasan**. Jangan mulai dari sejarahnya.

**"Di mana AI-nya kalau intinya cuma optimasi matematis?"**
→ *"Optimasi adalah cabang klasik kecerdasan buatan — bidang yang sama yang dipakai maskapai menyusun jadwal penerbangan.
Yang kami tambahkan di atasnya adalah model bahasa, tapi kami tempatkan pada perannya yang benar: menjelaskan, bukan menghitung.
Menurut kami memakai AI generatif untuk menghitung biaya perjalanan justru penyalahgunaan alat."*

**"Apa bedanya dengan Traveloka atau Google Maps?"**
→ *"Google menjawab 'ada apa saja'. Traveloka menjual satu-satu produk.
Kami menjawab pertanyaan yang tidak dijawab keduanya: kombinasi mana yang muat di anggaran saya sekaligus masuk akal rutenya.
Dan tidak ada dari keduanya yang mengembalikan sinyal permintaan ke UMKM dan pemerintah daerah."*

**"Datanya dari mana? Ada data buatan?"**
→ *"Seluruhnya dari 14 berkas dataset panitia. Tidak ada satu pun angka sintetis.
Justru karena itu kekosongan datanya kelihatan, dan kami tampilkan apa adanya."*

**"Kalau UMKM memasukkan harga palsu bagaimana?"**
→ *"Harga pengguna hanya bisa masuk lewat satu pintu di dalam kode, dan harus lolos uji kewajaran statistik
terhadap harga sejenis di kabupaten yang sama, plus dibatasi rentang aman. Harga mencurigakan tetap terlihat pemiliknya
dengan tanda peringatan, tapi tidak pernah dijadikan acuan."*

**"Karo nol destinasi — bukankah itu berarti sistem Anda salah?"**
→ *"Itu keterbatasan cakupan dataset, dan kami memilih menampilkannya daripada menutupinya.
Nilainya justru di situ: sistem menunjukkan wilayah mana yang perlu didata lebih dulu.
Label yang kami pakai pun 'nol destinasi terdata', bukan 'nol destinasi'."*

**"Siapa yang benar-benar mau bayar?"**
→ *"Pembayar utamanya pemerintah daerah, bukan UMKM. Langganan UMKM tidak menutup biaya operasional —
kami sudah menghitungnya dan menyatakannya terbuka di dokumen model bisnis.
Fungsinya adalah menjaga sisi pasokan tetap aktif, supaya produk intelijen untuk pemerintah punya data untuk dijual."*

**"Apakah UMKM yang bayar muncul lebih dulu di rekomendasi?"**
→ *"Tidak, dan itu bukan sekadar kebijakan — modul langganan secara arsitektur tidak pernah bisa menyentuh mesin itinerary.
Bisa diperiksa dalam satu perintah pencarian di kode kami."*

**"Bagaimana kalau penggunanya ribuan sekaligus?"**
→ *"Saat ini skalanya prototipe: dataset dimuat sekali ke memori, satu rencana rata-rata 0,4 detik.
Untuk skala produksi, langkah berikutnya adalah antrean pekerjaan dan cache hasil.
Kami belum mengujinya untuk beban serentak, dan kami tidak akan mengklaim sudah."*

**"Kalau internetnya mati di lokasi wisata?"**
→ *"Perhitungan jarak otomatis turun ke estimasi garis lurus, dan sistem menandai bahwa angkanya berasal dari estimasi.
Rencana yang sudah tersusun bisa diekspor ke PDF untuk dibawa luring."*

**Kalau tidak tahu jawabannya:**
→ *"Itu belum kami uji. Yang bisa saya sampaikan adalah data yang kami punya: [sebut fakta terdekat].
Untuk memastikannya, uji yang perlu dijalankan adalah [sebut caranya]."*
Jangan pernah mengarang. Juri jauh lebih menghargai batas yang jelas daripada jawaban yang meyakinkan tapi kosong.

---

# BAGIAN E — DAFTAR ANGKA YANG BOLEH DISEBUT

Hafalkan ini; jangan menyebut angka di luar daftar ini kecuali yakin.

| Angka | Konteks pemakaian |
|---|---|
| 137 destinasi · 117 rumah makan · 27 penginapan · 14 berkas data | Skala data |
| 100% dari 90 skenario menghasilkan rencana layak | Keandalan model |
| 0 pelanggaran anggaran | Jaminan inti |
| ± 0,4 detik per rencana | Kecepatan |
| 95% kunjungan makan jatuh ke UMKM lokal | Keberpihakan |
| Karo: 2,3 juta kunjungan, 0 destinasi terdata | Temuan kebijakan |
| 8 kabupaten · 7 sumbu kesenjangan | Cakupan analisis |
| Rp49.000 / Rp149.000 per bulan | Langganan UMKM |
| 18 bahasa termasuk Batak Toba | Inklusivitas |
| 20 dari 137 destinasi punya info hari tutup | Keterbatasan jujur |

---

## Tiga kalimat yang paling menentukan penilaian

Kalau semua hilang dari ingatan, sisakan tiga ini:

1. *"Masalahnya bukan kekurangan informasi, melainkan pengambilan keputusan."*
2. *"Matematika yang menghitung, AI yang menjelaskan — matikan kunci AI-nya, semua angka tetap keluar."*
3. *"Setiap itinerary adalah sinyal permintaan, dan sinyal itu kami kembalikan kepada UMKM dan pemerintah daerah."*
