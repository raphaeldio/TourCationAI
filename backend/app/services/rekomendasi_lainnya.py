"""Slot "Rekomendasi Lainnya" — pemerataan paparan bagi UMKM berkembang.

Mekaniknya: dua UMKM dengan skor kepercayaan TERENDAH di kabupaten yang dilalui
rute ikut ditampilkan, ditandai jelas, supaya mereka punya kesempatan menerima
kunjungan dan rating. Rating itulah yang kemudian menggerakkan skor kepercayaan
mereka — jadi slot ini adalah jalan keluar dari lingkaran "tidak punya rating
karena tidak pernah muncul, tidak pernah muncul karena tidak punya rating".

CATATAN DESAIN YANG PERLU DIKETAHUI PEMBACA BERIKUTNYA.
Menampilkan usaha berperingkat terendah kepada wisatawan berisiko: kalau
disajikan seolah-olah rekomendasi utama, ia merusak kepercayaan pada seluruh
rekomendasi. Tiga pagar membuat mekanik ini tetap jujur, dan ketiganya wajib
dipertahankan:

  1. **Tidak pernah menyentuh ILP.** Fungsi di sini dipanggil SESUDAH
     `build_itinerary_payload()` selesai. Rute, biaya, agenda, dan total jarak
     sudah final dan tidak berubah sedikit pun.
  2. **Ada gerbang kelayakan.** Harga tidak boleh berstatus FLAGGED, usaha
     harus berada di kabupaten yang memang dilalui, dan usaha yang skornya
     rendah KARENA banyak rating buruk (bukan karena belum punya rating)
     dikecualikan — paparan untuk usaha yang benar-benar bermasalah merugikan
     wisatawan sekaligus tidak membantu UMKM-nya.
  3. **Pelabelan apa adanya.** Setiap item membawa `alasan_tampil` dan
     `skor_kepercayaan`, bukan disamarkan sebagai pilihan terbaik.

Satu aturan tambahan: item ini **tidak pernah ikut tercatat ke analitik
pemerintah** — pencatatan berjalan sebelum blok ini dilampirkan, supaya paparan
bantuan tidak terbaca sebagai permintaan nyata di dashboard kebijakan.
"""

import logging

from ..core.paths import engine
from ..db import supabase as db
from .rating import label_trust

_log = logging.getLogger(__name__)

JUMLAH_SLOT = 2

# Skor di bawah ini tergolong rendah. Usaha dengan skor di atasnya tidak butuh
# bantuan paparan.
AMBANG_RENDAH = 0.55

# Usaha yang sudah punya cukup rating DAN reratanya buruk tidak ikut: skor
# rendahnya adalah penilaian publik yang matang, bukan ketiadaan data.
MIN_RATING_MATANG = 5
RERATA_BURUK = 2.5

# Di bawah jumlah penilaian ini, rating usaha TIDAK DITAMPILKAN ke wisatawan —
# lihat `_pembekuan_rating` untuk alasannya.
MIN_RATING_TAMPIL = 5


def _kabupaten_rute(payload: dict) -> set[str]:
    """Kabupaten yang benar-benar disentuh rencana ini.

    Sumbernya `days[].kabupaten`, daftar yang sudah dihitung
    `build_itinerary_payload` dari alamat seluruh agenda hari itu.

    Versi sebelumnya membaca `agenda[].place.kabupaten` — kunci yang tidak
    pernah ada pada payload; `_fmt_place` tidak mengeluarkannya. Akibatnya
    himpunan ini SELALU kosong, `pilih_umkm_berkembang` selalu pulang lebih
    awal, dan blok "Rekomendasi Lainnya" tidak pernah muncul sekalipun datanya
    ada — tanpa satu pun galat yang terlihat.
    """
    kab: set[str] = set()
    for hari in payload.get("days") or []:
        for k in hari.get("kabupaten") or []:
            if k:
                kab.add(k)
    # Hotel hanya membawa alamat, jadi kabupatennya dideteksi dari situ.
    hotel = payload.get("hotel") or {}
    k_hotel = hotel.get("kabupaten") or engine.deteksi_kabupaten(hotel.get("address"))
    if k_hotel:
        kab.add(k_hotel)
    return kab


def _layak(baris: dict) -> bool:
    n = int(baris.get("n_rating") or 0)
    rata = baris.get("rata_rating")
    if n >= MIN_RATING_MATANG and rata is not None and float(rata) < RERATA_BURUK:
        return False  # buruk menurut penilaian publik yang sudah matang
    return float(baris.get("skor") or 0) < AMBANG_RENDAH


def _pembekuan_rating(n_rating: int) -> bool:
    """Apakah rating usaha ini disembunyikan dari wisatawan.

    Usaha di slot ini berskor rendah justru KARENA belum dinilai — gerbang
    kelayakan sudah menyingkirkan yang rendah karena benar-benar dinilai buruk.
    Menampilkan "PERLU PEMBINAAN" pada usaha yang cuma belum dikenal berarti
    menghukumnya atas ketiadaan data, dan itu meniadakan seluruh gunanya slot
    ini: wisatawan menghindarinya, ratingnya tidak pernah bertambah, skornya
    tidak pernah naik.

    Pembekuannya SEMENTARA dan punya syarat lepas yang jelas — begitu penilaian
    mencapai `MIN_RATING_TAMPIL`, angkanya tampil apa adanya, bagus maupun
    tidak. Yang dibekukan hanya tampilannya; penilaian tetap diterima, tetap
    tercatat, dan tetap menggerakkan skor kepercayaan seperti biasa.
    """
    return n_rating < MIN_RATING_TAMPIL


def pilih_umkm_berkembang(payload: dict, batas: int = JUMLAH_SLOT) -> list[dict]:
    """Dua usaha berskor terendah di kabupaten yang dilalui rute.

    Tidak pernah melempar: gangguan database berarti slot ini kosong, dan
    itinerary tetap utuh.
    """
    if not db.aktif():
        return []
    kab = _kabupaten_rute(payload)
    if not kab:
        return []

    try:
        # Nama kabupaten dikutip: "Tapanuli Utara" dan dua lainnya mengandung
        # spasi, dan `in.()` tanpa kutip menyerahkan pemenggalannya pada tebakan
        # PostgREST.
        usaha = db.pilih("umkm_business", {
            "kabupaten": "in.({})".format(",".join(f'"{k}"' for k in sorted(kab))),
            "select": "id,place_name,kabupaten,alamat,deskripsi,jam_buka,verified",
            "limit": "200",
        })
        if not usaha:
            return []

        ids = ",".join(u["id"] for u in usaha)
        skor = db.pilih("trust_score", {
            "business_id": f"in.({ids})",
            "select": "business_id,skor,n_rating,rata_rating",
            "limit": "200",
        })
    except Exception as e:  # noqa: BLE001 — slot kosong jauh lebih baik dari 500
        _log.warning("Gagal memilih UMKM berkembang: %s", e)
        return []

    per_usaha = {s["business_id"]: s for s in skor}
    kandidat = []
    for u in usaha:
        s = per_usaha.get(u["id"]) or {"skor": 0.0, "n_rating": 0, "rata_rating": None}
        if not _layak(s):
            continue
        kandidat.append({
            "business_id": u["id"],
            "nama": u["place_name"],
            "kabupaten": u.get("kabupaten"),
            "alamat": u.get("alamat"),
            "deskripsi": u.get("deskripsi"),
            "jam_buka": u.get("jam_buka"),
            "skor_kepercayaan": round(float(s.get("skor") or 0), 3),
            "label_kepercayaan": label_trust(float(s.get("skor") or 0)),
            "n_rating": int(s.get("n_rating") or 0),
            "rata_rating": s.get("rata_rating"),
        })

    kandidat.sort(key=lambda x: (x["skor_kepercayaan"], x["n_rating"]))
    terpilih = kandidat[:batas]

    for k in terpilih:
        k["alasan_tampil"] = (
            "UMKM berkembang di wilayah yang Anda lalui. Belum banyak dinilai "
            "wisatawan — kunjungan dan penilaian Anda membantu membentuk "
            "skor kepercayaannya."
            if k["n_rating"] == 0 else
            f"UMKM berkembang di wilayah yang Anda lalui. Baru {k['n_rating']} "
            "penilaian sejauh ini."
        )
        k["rating_dibekukan"] = _pembekuan_rating(k["n_rating"])
        if k["rating_dibekukan"]:
            k["catatan_rating"] = (
                "Rating sedang dibekukan. Penilaian yang masuk baru "
                f"{k['n_rating']} dari {MIN_RATING_TAMPIL} — terlalu sedikit "
                "untuk menggambarkan usaha ini secara adil. Angkanya tampil "
                "apa adanya begitu cukup terkumpul. Penilaian Anda tetap "
                "tercatat."
            )
        # Ditandai supaya query analitik pemerintah bisa menyaringnya keluar.
        k["rekomendasi_lainnya"] = True

    return terpilih


def lampirkan(payload: dict) -> dict:
    """Sisipkan blok `rekomendasi_lainnya` ke payload itinerary.

    Menulis ke KUNCI BARU di tingkat atas, tidak pernah menyunting `days`,
    `agenda`, `summary`, maupun `hotel`. Sifat itu yang membuat pengaruhnya
    bisa diuji: jalankan dua kali dengan dan tanpa slot ini, seluruh angka
    perjalanan wajib identik.
    """
    try:
        item = pilih_umkm_berkembang(payload)
    except Exception as e:  # noqa: BLE001
        _log.warning("Slot rekomendasi lainnya dilewati: %s", e)
        return payload

    payload["rekomendasi_lainnya"] = {
        "judul": "Rekomendasi Lainnya",
        "keterangan": (
            "Bukan bagian dari rencana yang dioptimalkan. Ditampilkan agar UMKM "
            "yang belum banyak dikenal punya kesempatan yang sama — biaya, rute, "
            "dan agenda di atas tidak terpengaruh sama sekali."
        ),
        "item": item,
    }
    return payload
