"""Selisih estimasi dataset vs harga terlapor UMKM — seri KEEMPAT.

Tiga seri sebelumnya sudah ada dan tidak pernah dijumlahkan satu sama lain:
volume ulasan (`analytics`), cacah perencanaan (`live`), pengamatan lapangan
(`lapangan`). Modul ini menambah yang keempat, dan alasan keberadaannya justru
lahir dari pencabutan override harga.

Selama harga UMKM masih menimpa `solver.restos`, kedua angka dilebur menjadi
satu — dan peleburan itu MENGHAPUS selisihnya. Padahal selisih itulah yang
berguna bagi pemerintah: ia menjawab "apakah harga di lapangan berbeda dari yang
tercatat?", pertanyaan yang tidak bisa dijawab oleh angka campuran.

DUA SATUAN YANG TIDAK SAMA — dan bagaimana modul ini menanganinya.

`harga_min`/`harga_max` pada dataset adalah PITA HARGA MAKAN PER ORANG, hasil
bucket harga Google. `umkm_product.harga` adalah HARGA SATU ITEM MENU. Keduanya
tidak sebanding: median item menu bisa jatuh jauh di bawah estimasi makan hanya
karena pemiliknya mendaftarkan minuman.

Karena itu angka UTAMA di sini bukan besaran selisih, melainkan POSISI:

    apakah harga terlapor sebuah usaha jatuh di bawah, di dalam, atau di atas
    pita estimasi dataset untuk usaha ITU SENDIRI?

Posisi tahan terhadap ketidaksamaan satuan — "18 dari 24 usaha melaporkan harga
di bawah batas bawah estimasi" adalah pernyataan yang bisa dipertanggungjawabkan
tanpa mengklaim kedua angka mengukur hal yang sama. Besaran selisih tetap
dilaporkan sebagai angka kedua, dengan peringatan satuan menempel padanya.

BERPASANGAN, BUKAN DUA SEBARAN TERPISAH. Setiap usaha dibandingkan dengan pita
estimasi milik tempatnya sendiri, dan selisih per usaha itulah yang diagregasi.
Membandingkan median seluruh estimasi kabupaten dengan median seluruh harga
terlapor kabupaten akan mencampur usaha yang tidak sama — bias komposisi yang
akan muncul begitu ada satu kabupaten dengan banyak warung murah terdaftar.

Hanya harga TERVERIFIKASI yang ikut: skor >= 0,7 dan status pemeriksaan OK.
Harga yang ditandai SUSPECT atau FLAGGED tidak boleh masuk statistik daerah —
itu justru salah satu dari dua pintu yang kini dijaga skor verifikasi.

Selalu mengembalikan sesuatu yang bisa dirender. Tanpa database isinya
`{"aktif": false}` dan kartunya cukup disembunyikan; seluruh angka CSV di
dashboard tetap tampil.
"""

import logging
import statistics
import threading
import time
from typing import Optional

from ..core.paths import engine
from ..db import supabase as db
from .analytics import kunci_nama
from .price_check import AMBANG_TERVERIFIKASI

_log = logging.getLogger(__name__)

# Sama dengan `live._TTL`: cukup untuk membuat angka terasa hidup saat demo tanpa
# memanggil PostgREST setiap kali kartu dirender.
_TTL = 120.0

_BATAS_BARIS = 5000

# Di bawah ini median selisih tidak diterbitkan — hanya cacah posisi, yang tetap
# jujur pada n berapa pun karena ia hitungan, bukan estimasi sebaran.
#
# Angkanya sengaja rendah. Alasannya sama dengan jendela 180 hari di `lapangan`:
# pada volume hackathon, ambang yang lebih tinggi menghasilkan null di setiap
# kabupaten, dan field yang selalu null akan dibaca sebagai "tidak ada selisih"
# — kesimpulan yang persis terbalik dari "belum cukup data".
MIN_USAHA_MEDIAN = 3

POSISI = ("DI BAWAH", "DI DALAM", "DI ATAS")

_cache: Optional[tuple[float, dict]] = None
_kunci = threading.Lock()


def _angka(nilai) -> Optional[float]:
    """Kolom numeric PostgREST bisa datang sebagai angka maupun string."""
    try:
        n = float(nilai)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _pita_dataset() -> dict[str, dict]:
    """{kunci_nama -> pita estimasi} dari CSV, lewat lapisan estimasi kanonik.

    Sengaja `harga_dasar_restos()`, bukan CSV dibaca ulang di sini: angka yang
    dibandingkan harus PERSIS angka yang dilihat wisatawan sebagai "est." pada
    kartu itinerary. Dua jalur baca ke sumber yang sama adalah dua tempat untuk
    berbeda pendapat.
    """
    from .solver_state import harga_dasar_restos

    hasil: dict[str, dict] = {}
    for _, baris in harga_dasar_restos().iterrows():
        nama = str(baris.get("place-name") or "").strip()
        if not nama:
            continue
        h_min = _angka(baris.get("harga_min"))
        h_max = _angka(baris.get("harga_max"))
        if h_min is None or h_max is None:
            continue
        if h_max < h_min:
            h_min, h_max = h_max, h_min
        hasil[kunci_nama(nama)] = {
            "nama": nama,
            "kabupaten": engine.deteksi_kabupaten(baris.get("address")),
            "min": h_min,
            "max": h_max,
            "tengah": (h_min + h_max) / 2,
        }
    return hasil


def _harga_terverifikasi() -> dict[str, list[float]]:
    """{business_id -> daftar harga produk yang lolos verifikasi}.

    Syaratnya sama persis dengan yang dulu dipakai chokepoint, dan itu memang
    disengaja: definisi "harga ini layak dipercaya" tidak boleh punya dua versi.
    Bedanya hanya tujuannya — dulu menentukan apa yang masuk solver, sekarang
    menentukan apa yang masuk statistik daerah.
    """
    skor = db.pilih("verification_score", {
        "select": "product_id,skor,komponen",
        "skor": f"gte.{AMBANG_TERVERIFIKASI}",
        "limit": str(_BATAS_BARIS),
    })
    layak = {
        r["product_id"] for r in skor
        if (r.get("komponen") or {}).get("status") == "OK"
    }
    if not layak:
        return {}

    produk = db.pilih("umkm_product", {
        "select": "id,harga,business_id",
        "aktif": "is.true",
        "limit": str(_BATAS_BARIS),
    })

    per_usaha: dict[str, list[float]] = {}
    for p in produk:
        if p["id"] not in layak:
            continue
        harga = _angka(p.get("harga"))
        bid = p.get("business_id")
        if harga is None or not bid:
            continue
        per_usaha.setdefault(bid, []).append(harga)
    return per_usaha


def _posisi(terlapor: float, pita: dict) -> str:
    if terlapor < pita["min"]:
        return "DI BAWAH"
    if terlapor > pita["max"]:
        return "DI ATAS"
    return "DI DALAM"


def _kerangka_kabupaten() -> dict[str, dict]:
    return {
        k: {
            "kabupaten": k,
            "n_usaha": 0,
            "n_produk": 0,
            "posisi": {p: 0 for p in POSISI},
            "selisih_rupiah": None,
            "selisih_persen": None,
            "cukup_untuk_median": False,
            "_delta": [],
            "_delta_persen": [],
        }
        for k in engine.KABUPATEN_TOBA
    }


def _ringkas_bucket(s: dict) -> dict:
    """Tutup satu bucket: hitung median bila n memadai, buang kerja antara."""
    delta = s.pop("_delta")
    delta_persen = s.pop("_delta_persen")
    if len(delta) >= MIN_USAHA_MEDIAN:
        s["selisih_rupiah"] = int(statistics.median(delta))
        s["selisih_persen"] = round(statistics.median(delta_persen), 1)
        s["cukup_untuk_median"] = True
    return s


def _hitung(kabupaten: Optional[str]) -> dict:
    pita = _pita_dataset()
    per_usaha = _harga_terverifikasi()

    usaha = db.pilih("umkm_business", {
        "select": "id,place_name,place_name_norm,kabupaten",
        "limit": str(_BATAS_BARIS),
    })

    per_kab = _kerangka_kabupaten()
    nasional = {
        "n_usaha": 0,
        "n_produk": 0,
        "posisi": {p: 0 for p in POSISI},
        "selisih_rupiah": None,
        "selisih_persen": None,
        "cukup_untuk_median": False,
        "_delta": [],
        "_delta_persen": [],
    }
    rinci: list[dict] = []
    tanpa_pasangan = 0

    for u in usaha:
        harga = per_usaha.get(u["id"])
        if not harga:
            continue

        norm = u.get("place_name_norm") or kunci_nama(u.get("place_name"))
        p = pita.get(norm)
        if p is None:
            # Usaha terdaftar yang namanya tidak ada di dataset. Bukan galat —
            # ia hanya tidak punya pita estimasi untuk dibandingkan.
            tanpa_pasangan += 1
            continue

        # Kabupaten dari baris usaha lebih dipercaya daripada hasil deteksi
        # alamat CSV: yang pertama diisi saat approval admin, yang kedua ditebak
        # dari string alamat.
        kab = u.get("kabupaten") or p["kabupaten"]
        if kab not in per_kab:
            continue
        if kabupaten and kab != kabupaten:
            continue

        terlapor = statistics.median(harga)
        posisi = _posisi(terlapor, p)
        delta = terlapor - p["tengah"]
        delta_persen = (delta / p["tengah"]) * 100 if p["tengah"] else 0.0

        for bucket in (per_kab[kab], nasional):
            bucket["n_usaha"] += 1
            bucket["n_produk"] += len(harga)
            bucket["posisi"][posisi] += 1
            bucket["_delta"].append(delta)
            bucket["_delta_persen"].append(delta_persen)

        rinci.append({
            "nama": p["nama"],
            "kabupaten": kab,
            "n_produk": len(harga),
            "estimasi_min": int(p["min"]),
            "estimasi_max": int(p["max"]),
            "terlapor_median": int(terlapor),
            "posisi": posisi,
            "selisih_rupiah": int(delta),
            "selisih_persen": round(delta_persen, 1),
        })

    rinci.sort(key=lambda r: r["selisih_persen"])

    return {
        "aktif": True,
        "nasional": _ringkas_bucket(nasional),
        "kabupaten": [_ringkas_bucket(s) for s in per_kab.values()],
        "urutan": engine.KABUPATEN_TOBA,
        "usaha": rinci,
        "usaha_tanpa_pasangan_dataset": tanpa_pasangan,
        "ambang": {
            "skor_terverifikasi": AMBANG_TERVERIFIKASI,
            "min_usaha_median": MIN_USAHA_MEDIAN,
        },
        "metodologi": (
            "Perbandingan BERPASANGAN per usaha: harga terlapor sebuah usaha "
            "dibandingkan dengan pita estimasi tempatnya sendiri, lalu selisih "
            "per usaha diagregasi. Hanya harga terverifikasi yang ikut "
            f"(skor >= {AMBANG_TERVERIFIKASI} dan status OK). "
            "PERINGATAN SATUAN: estimasi dataset adalah pita harga makan per "
            "orang dari bucket harga Google, sedangkan harga terlapor adalah "
            "harga satu item menu. Keduanya tidak sebanding langsung, sehingga "
            "angka utama di sini adalah POSISI (di bawah / di dalam / di atas "
            "pita), bukan besaran selisihnya. Besaran dilaporkan sebagai "
            "indikasi arah saja. Median selisih hanya diterbitkan bila ada "
            f"minimal {MIN_USAHA_MEDIAN} usaha terpasangkan."
        ),
    }


def agregat(kabupaten: Optional[str] = None) -> dict:
    """Selisih estimasi vs terlapor. Selalu mengembalikan dict yang bisa dirender.

    Cache hanya untuk permintaan nasional. Permintaan per kabupaten dihitung
    langsung: ia jauh lebih jarang, dan meng-cache per kunci wilayah menambah
    jalan invalidasi tanpa menghemat apa pun yang terukur.
    """
    global _cache

    if not db.aktif():
        return {
            "aktif": False,
            "alasan": "Basis data belum dikonfigurasi, jadi belum ada harga terlapor.",
        }

    if kabupaten:
        try:
            return _hitung(kabupaten)
        except Exception as e:  # noqa: BLE001 — kartu disembunyikan, dashboard utuh
            _log.warning("Selisih harga gagal dihitung: %s", e)
            return {"aktif": False, "alasan": "Data selisih harga belum bisa dibaca."}

    sekarang = time.monotonic()
    if _cache and sekarang < _cache[0]:
        return _cache[1]

    try:
        hasil = _hitung(None)
    except Exception as e:  # noqa: BLE001
        _log.warning("Selisih harga gagal dihitung: %s", e)
        return {"aktif": False, "alasan": "Data selisih harga belum bisa dibaca."}

    with _kunci:
        _cache = (sekarang + _TTL, hasil)
    return hasil


def reset_cache() -> None:
    global _cache
    with _kunci:
        _cache = None
