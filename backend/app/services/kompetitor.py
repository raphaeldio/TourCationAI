"""Analisis kompetitor sekabupaten — anonim (Fase 10).

Fitur ini dijanjikan katalog paket sejak Fase 9 (`Paket.analisis_kompetitor`:
GROWTH dan PRO) tetapi belum punya implementasi. Modul ini yang mengisinya.

DUA ATURAN YANG MEMBENTUK SELURUH RANCANGANNYA:

1. **Tidak ada nama pesaing yang keluar dari sini.** Yang dikembalikan hanya
   posisi relatif dan agregat. Membuka "warung X memasang Rp 25.000" mengubah
   produk insight menjadi alat intai harga, dan pemilik yang datanya dipakai
   tidak pernah menyetujui itu. Peringkat pun dikirim sebagai *posisi Anda dari
   N*, bukan sebagai daftar.

2. **Sel dengan pembanding terlalu sedikit disupresi, bukan ditampilkan kecil.**
   Di kabupaten yang baru punya dua usaha terdaftar, "rata-rata pesaing" adalah
   angka satu-dua usaha yang bisa ditebak siapa pun yang tinggal di sana.
   Ambangnya `K_MIN` dan alasan supresinya ikut dikirim, supaya antarmuka bisa
   menjelaskan kekosongan alih-alih menampilkan nol.

Sumber angkanya dua, dan mana yang dipakai selalu dinyatakan:

  * **Dataset CSV** — 117 rumah makan berikut sebaran harga dan sinyal
    ulasannya. Ini publik dan sudah tampil di halaman lain; ia yang membuat
    analisis tetap bernilai di wilayah yang usaha terdaftarnya masih sedikit.
  * **Usaha terdaftar** — hanya sebagai agregat, dan hanya bila lolos K_MIN.

Seperti `langganan.py`, modul ini tidak boleh diimpor jalur penyusun itinerary:
ia membaca status paket lewat pemanggilnya, dan analisis tidak pernah mengubah
peringkat siapa pun.
"""

import logging
from typing import Optional

from ..core.paths import DATA_DIR, engine
from ..db import supabase as db
from . import price_check
from .analytics import get_intel, kunci_nama

_log = logging.getLogger(__name__)

# Jumlah usaha terdaftar minimum sebelum sebuah agregat boleh ditampilkan.
# Lebih longgar daripada k=10 pada laporan pemerintah karena yang dibandingkan
# di sini bukan perilaku wisatawan melainkan harga yang memang dipajang di
# depan warung — tetapi tetap harus lebih dari "saya dan satu tetangga".
K_MIN = 3


def _median(nilai: list[float]) -> Optional[float]:
    if not nilai:
        return None
    urut = sorted(nilai)
    tengah = len(urut) // 2
    if len(urut) % 2:
        return float(urut[tengah])
    return (urut[tengah - 1] + urut[tengah]) / 2


def _label_posisi(persentil: Optional[float]) -> str:
    if persentil is None:
        return "TANPA ACUAN"
    if persentil < 25:
        return "TERMURAH"
    if persentil < 45:
        return "DI BAWAH TENGAH"
    if persentil <= 55:
        return "SEKITAR TENGAH"
    if persentil <= 75:
        return "DI ATAS TENGAH"
    return "TERMAHAL"


# ---------------------------------------------------------------------------
# Bagian 1 — posisi harga terhadap sebaran acuan
# ---------------------------------------------------------------------------
def _posisi_harga(produk: list[dict], kabupaten: Optional[str]) -> dict:
    grup = price_check.grup_untuk(kabupaten)
    harga_saya = [int(p["harga"]) for p in produk if p.get("harga")]
    median_saya = _median(harga_saya)

    if grup is None:
        return {
            "tersedia": False,
            "alasan": "Belum ada sebaran pembanding untuk wilayah ini.",
            "median_saya": int(median_saya) if median_saya else None,
            "per_produk": [],
        }

    persentil_saya = grup.persentil(median_saya) if median_saya else None
    return {
        "tersedia": True,
        "grup": grup.nama,
        "n_pembanding": grup.n_tempat,
        "n_titik_harga": grup.n_titik,
        "median_wilayah": int(grup.median),
        "p25": int(grup.p25),
        "p75": int(grup.p75),
        "median_saya": int(median_saya) if median_saya else None,
        "persentil_saya": persentil_saya,
        "posisi": _label_posisi(persentil_saya),
        "per_produk": [
            {
                "id": p["id"],
                "nama": p["nama"],
                "harga": int(p["harga"]),
                "persentil": grup.persentil(int(p["harga"])),
                "posisi": _label_posisi(grup.persentil(int(p["harga"]))),
                "status": p.get("harga_status"),
            }
            for p in produk
            if p.get("harga")
        ],
        "metode": (
            "Persentil empiris terhadap titik harga nyata pada dataset — kedua "
            "ujung pita harga tiap rumah makan, bukan titik tengahnya."
        ),
    }


# ---------------------------------------------------------------------------
# Bagian 2 — posisi sinyal permintaan pada dataset
# ---------------------------------------------------------------------------
def _posisi_permintaan(usaha: dict) -> dict:
    """Peringkat sinyal ulasan usaha ini di antara rumah makan sekabupaten.

    Hanya bisa dijawab bila usaha tertaut ke sebuah baris dataset lewat
    `place_name_norm` — konvensi join yang sama dengan `tautan_usaha.py` dan
    chokepoint harga di `solver_state`. Usaha yang tidak ada di CSV bukan
    kekeliruan: ia hanya belum pernah ter-scrape, dan itu dikatakan apa adanya.
    """
    kabupaten = usaha.get("kabupaten")
    try:
        intel = get_intel()
    except Exception as e:  # noqa: BLE001 — analisis boleh tak lengkap, tak boleh 500
        _log.warning("Intel tidak tersedia untuk analisis kompetitor: %s", e)
        return {"tersedia": False, "alasan": "Agregat dataset belum siap di server."}

    sekabupaten = [
        t for t in intel.tempat.values()
        if t.get("jenis") == "umkm" and t.get("kabupaten") == kabupaten
    ]
    if len(sekabupaten) < K_MIN:
        return {
            "tersedia": False,
            "alasan": (
                f"Hanya {len(sekabupaten)} rumah makan {kabupaten or 'wilayah ini'} "
                "yang terdata di dataset — terlalu sedikit untuk jadi pembanding."
            ),
            "n_pembanding": len(sekabupaten),
        }

    kunci = usaha.get("place_name_norm") or kunci_nama(usaha.get("place_name"))
    saya = next((t for t in sekabupaten if kunci_nama(t["nama"]) == kunci), None)

    sinyal = sorted((int(t.get("ulasan_12_bulan") or 0) for t in sekabupaten), reverse=True)
    rating = [float(t["rating"]) for t in sekabupaten if t.get("rating") is not None]

    hasil = {
        "tersedia": True,
        "n_pembanding": len(sekabupaten),
        "sinyal_median": _median([float(s) for s in sinyal]),
        "sinyal_tertinggi": sinyal[0] if sinyal else 0,
        "rating_rata2_wilayah": round(sum(rating) / len(rating), 2) if rating else None,
        "tertaut_dataset": saya is not None,
    }

    if saya is None:
        hasil["catatan"] = (
            "Usaha Anda belum ditemukan pada dataset ulasan, jadi peringkatnya "
            "belum bisa dihitung. Angka di atas tetap berlaku sebagai patokan "
            "wilayah."
        )
        return hasil

    saya_sinyal = int(saya.get("ulasan_12_bulan") or 0)
    posisi = sum(1 for s in sinyal if s > saya_sinyal) + 1
    hasil.update({
        "sinyal_saya": saya_sinyal,
        "rating_saya": saya.get("rating"),
        "peringkat": posisi,
        "dari": len(sekabupaten),
        "persentil": round(100.0 * (len(sekabupaten) - posisi) / len(sekabupaten), 1),
        "status_tren": saya.get("status_tren"),
        # Tempat tersensor punya riwayat terpotong; pertumbuhannya memang tidak
        # terukur, dan menampilkannya sebagai angka akan menipu pemiliknya.
        "tersensor": bool(saya.get("tersensor")),
    })
    return hasil


# ---------------------------------------------------------------------------
# Bagian 3 — agregat usaha terdaftar sekabupaten (k-supresi)
# ---------------------------------------------------------------------------
def _agregat_terdaftar(usaha: dict) -> dict:
    """Rata-rata kelengkapan dan kategori yang ramai di antara usaha terdaftar.

    Seluruhnya agregat. `business_id` tidak pernah ikut keluar, dan tiap sel
    yang bersandar pada kurang dari K_MIN usaha disupresi.
    """
    kabupaten = usaha.get("kabupaten")
    kosong = {"tersedia": False, "n_usaha": 0, "alasan": None}

    if not kabupaten or not db.aktif():
        kosong["alasan"] = "Kabupaten usaha belum diisi."
        return kosong

    try:
        tetangga = db.pilih("umkm_business", {
            "kabupaten": f"eq.{kabupaten}",
            "select": "id",
            "limit": "500",
        })
    except Exception as e:  # noqa: BLE001
        _log.warning("Gagal membaca usaha sekabupaten: %s", e)
        kosong["alasan"] = "Data usaha sekabupaten belum bisa dibaca."
        return kosong

    lain = [t["id"] for t in tetangga if t["id"] != usaha["id"]]
    if len(lain) < K_MIN:
        return {
            "tersedia": False,
            "n_usaha": len(lain),
            "alasan": (
                f"Baru {len(lain)} usaha lain di {kabupaten} yang terdaftar. "
                f"Agregat disembunyikan sampai minimal {K_MIN}, karena di bawah "
                "itu angkanya menunjuk ke usaha tertentu."
            ),
        }

    try:
        produk = db.pilih("umkm_product", {
            "business_id": f"in.({','.join(lain)})",
            "aktif": "is.true",
            "select": "business_id,kategori,harga,is_kuliner_khas",
            "limit": "2000",
        })
    except Exception as e:  # noqa: BLE001
        _log.warning("Gagal membaca produk sekabupaten: %s", e)
        return {"tersedia": False, "n_usaha": len(lain),
                "alasan": "Data produk sekabupaten belum bisa dibaca."}

    # Kategori dihitung dalam JUMLAH USAHA, bukan jumlah produk: satu usaha yang
    # mendaftarkan lima varian kopi tidak boleh terbaca sebagai lima pesaing.
    per_kategori: dict[str, set] = {}
    for p in produk:
        nama = (p.get("kategori") or "").strip()
        if nama:
            per_kategori.setdefault(nama.title(), set()).add(p["business_id"])

    kategori_ramai = sorted(
        (
            {"kategori": k, "n_usaha": len(v)}
            for k, v in per_kategori.items()
            if len(v) >= K_MIN
        ),
        key=lambda x: x["n_usaha"],
        reverse=True,
    )[:8]

    harga = [float(p["harga"]) for p in produk if p.get("harga")]
    n_khas = len({p["business_id"] for p in produk if p.get("is_kuliner_khas")})

    return {
        "tersedia": True,
        "n_usaha": len(lain),
        "n_produk": len(produk),
        "median_harga_terdaftar": int(_median(harga)) if harga else None,
        "kategori_ramai": kategori_ramai,
        "n_kategori_disupresi": sum(1 for v in per_kategori.values() if len(v) < K_MIN),
        "share_kuliner_khas": round(n_khas / len(lain), 2) if lain else None,
    }


# ---------------------------------------------------------------------------
# Bagian 4 — celah menu terhadap kuliner khas kawasan
# ---------------------------------------------------------------------------
def _celah_kuliner(usaha: dict, produk: list[dict]) -> dict:
    """Kuliner khas Batak yang belum ada di menu, plus sinyal yang dibaca mesin.

    Pencocokannya sengaja dititipkan ke `engine.skor_umkm` — fungsi yang SAMA
    dengan yang memberi bobot UMKM pada mesin rekomendasi. Menulis pencocokan
    kedua di sini berarti pemilik warung melihat "Naniura sudah ada" sementara
    mesinnya menghitung sebaliknya, dan tidak ada cara menjelaskan selisih itu
    kepadanya.

    Daftar khasnya dari CSV kuliner, bukan dari menu pesaing, jadi bagian ini
    bebas dari persoalan anonimitas.
    """
    try:
        semua = engine.muat_kuliner_khas(DATA_DIR)
    except Exception as e:  # noqa: BLE001
        _log.warning("Daftar kuliner khas tidak terbaca: %s", e)
        return {"tersedia": False, "sudah_ditawarkan": [], "belum_ditawarkan": []}

    menu = " ".join(
        f"{p.get('nama') or ''} {p.get('deskripsi') or ''}" for p in produk
    )
    harga = [int(p["harga"]) for p in produk if p.get("harga")]

    sinyal = engine.skor_umkm({
        "recommend-menu": menu,
        "place-name": usaha.get("place_name") or "",
        "harga_min": _median([float(h) for h in harga]),
    }, semua)

    sudah = list(sinyal.get("kuliner_khas_disajikan") or [])
    belum = [
        n for n in dict.fromkeys(str(k).strip() for k in semua if str(k).strip())
        if n not in sudah
    ]

    return {
        "tersedia": True,
        "n_khas_kawasan": len(sudah) + len(belum),
        "sudah_ditawarkan": sudah,
        "belum_ditawarkan": belum[:12],
        "skor_umkm": sinyal.get("skor_umkm"),
        "umkm_kuat": bool(sinyal.get("is_umkm_kuat")),
        "komponen": {
            "kuliner_khas": sinyal.get("sinyal_kuliner_khas"),
            "nama_lokal": sinyal.get("sinyal_nama_lokal"),
            "harga_terjangkau": sinyal.get("sinyal_harga_terjangkau"),
        },
        "catatan": (
            "Skor ini disimulasikan atas menu yang Anda daftarkan, memakai "
            "fungsi yang sama dengan mesin rekomendasi. Kuliner khas menaikkan "
            "skor karena ia menandai keotentikan menu — bukan karena paket "
            "langganan Anda."
        ),
    }


# ---------------------------------------------------------------------------
# Perakitan
# ---------------------------------------------------------------------------
def analisis(usaha: dict, produk: list[dict]) -> dict:
    """Analisis kompetitor lengkap untuk satu usaha. Tidak pernah melempar."""
    aktif = [p for p in produk if p.get("aktif")]
    kabupaten = usaha.get("kabupaten")

    try:
        intel_kab = get_intel().kab.get(kabupaten or "") or {}
    except Exception:  # noqa: BLE001
        intel_kab = {}

    jam = (usaha.get("jam_buka") or "").strip()

    return {
        "kabupaten": kabupaten,
        "n_produk_saya": len(aktif),
        "posisi_harga": _posisi_harga(aktif, kabupaten),
        "permintaan": _posisi_permintaan(usaha),
        "terdaftar": _agregat_terdaftar(usaha),
        "celah_menu": _celah_kuliner(usaha, aktif),
        "operasional": {
            "rasio_malam_wilayah": intel_kab.get("rasio_malam"),
            "jam_buka_saya": jam or None,
            "musim_puncak": intel_kab.get("musim_puncak"),
            "catatan": (
                "Rasio malam adalah bagian destinasi yang buka sampai pukul "
                "20.00 di kabupaten Anda — patokan apakah jam tutup lebih "
                "panjang masuk akal di wilayah ini."
            ),
        },
        "anonimitas": {
            "k_min": K_MIN,
            "aturan": (
                "Tidak ada nama usaha pesaing yang dikirim endpoint ini. Setiap "
                f"agregat yang bersandar pada kurang dari {K_MIN} usaha "
                "disupresi beserta alasannya."
            ),
        },
        "netralitas": (
            "Analisis ini tidak mengubah posisi Anda di rekomendasi wisatawan. "
            "Paket menentukan apa yang bisa Anda LIHAT, bukan urutan yang "
            "dilihat orang lain."
        ),
    }
