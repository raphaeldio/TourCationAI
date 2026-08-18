"""Laporan lapangan wisatawan — muara pemerintah.

Ini seri KETIGA, dan ia diperlakukan sama hati-hatinya dengan dua seri yang
sudah ada:

    volume ulasan CSV   proksi permintaan, skala ribuan, umur 12 bulan
    log itinerary       perencanaan nyata, skala puluhan  (live.py)
    laporan lapangan    pengamatan nyata, skala satuan    (modul ini)

Ketiganya tidak pernah dijumlahkan. Aturan yang sama dengan `live.py` berlaku
di sini dan dengan alasan yang sama: satuannya tidak sebanding, dan angka yang
tampak besar hasil menjumlahkan hal yang berbeda lebih berbahaya daripada
angka kecil yang jujur. `AMBANG_BUKTI` menjaga hal itu pada tingkat penyajian.

**Kenapa modul ini ada sama sekali.** Tujuh sumbu `gap.py` seluruhnya
diturunkan dari CSV, dan `analytics.py` sendiri menyebut kolom fasilitasnya
"INDIKATOR KEBERADAAN, bukan cacah/sensus". Artinya seluruh rekomendasi
prioritas pembangunan selama ini berdiri di atas dugaan yang belum pernah
dibantah data lapangan. Laporan wisatawan adalah pengamatan langsung pertama
yang bisa mengonfirmasi atau membantah dugaan itu.

**Anonimitas.** Seluruh pembacaan di modul ini lewat view `laporan_lapangan_gov`
yang tidak memuat `ulasan_id`, sehingga tidak ada satu pun kueri sisi
pemerintah yang punya rute menuju identitas pelapor. Pembatasan itu ada di
skema, bukan di daftar kolom yang harus diingat setiap kali kueri baru ditulis.
"""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from ..core.sanitasi import bersihkan
from ..db import supabase as db
from .migrasi import jaga

_log = logging.getLogger(__name__)

# Jalur baca yang tidak membawa identitas. Penulisan tetap ke tabel dasar.
VIEW_GOV = "laporan_lapangan_gov"
TABEL = "laporan_lapangan"

STATUS = ["BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"]
TINGKAT = ["RINGAN", "SEDANG", "BERAT"]

# Kategori beserta apa yang bisa dilakukan terhadapnya. `sumbu` menunjuk sumbu
# gap.py yang dikonfirmasi laporan ini; None berarti gap.py memang tidak
# memodelkan hal itu — dan menyatakannya kosong lebih jujur daripada memaksa
# setiap kategori punya sumbu.
KATEGORI_LAPANGAN = [
    {"kode": "AKSES_JALAN", "label": "Akses jalan",
     "sumbu": None, "pendataan": False,
     "petunjuk": "Jalan rusak, terlalu sempit, atau tidak bisa dilalui kendaraan."},
    {"kode": "FASILITAS_UMUM", "label": "Fasilitas umum",
     "sumbu": "fasilitas", "pendataan": False,
     "petunjuk": "Toilet, parkir, tempat ibadah, tempat istirahat."},
    {"kode": "KEBERSIHAN", "label": "Kebersihan",
     "sumbu": None, "pendataan": False,
     "petunjuk": "Sampah menumpuk, sanitasi buruk."},
    {"kode": "PAPAN_PENUNJUK", "label": "Papan penunjuk arah",
     "sumbu": "fasilitas", "pendataan": False,
     "petunjuk": "Rambu hilang, arah membingungkan, lokasi sulit ditemukan."},
    {"kode": "SINYAL_KOMUNIKASI", "label": "Sinyal komunikasi",
     "sumbu": "fasilitas", "pendataan": False,
     "petunjuk": "Tidak ada sinyal seluler atau internet di lokasi."},
    {"kode": "KEAMANAN", "label": "Keamanan",
     "sumbu": None, "pendataan": False,
     "petunjuk": "Lokasi rawan, tidak ada penjagaan, penerangan kurang."},
    {"kode": "TARIF_TIDAK_RESMI", "label": "Tarif tidak resmi",
     "sumbu": None, "pendataan": False,
     "petunjuk": "Pungutan liar, parkir liar, tarif masuk dadakan."},
    {"kode": "JAM_OPERASIONAL", "label": "Jam buka tidak sesuai",
     "sumbu": None, "pendataan": True,
     "petunjuk": "Tutup padahal jadwal di aplikasi menyatakan buka."},
    {"kode": "LAINNYA", "label": "Lainnya",
     "sumbu": None, "pendataan": False, "petunjuk": ""},
]

KODE_KATEGORI = [k["kode"] for k in KATEGORI_LAPANGAN]
_SUMBU = {k["kode"]: k["sumbu"] for k in KATEGORI_LAPANGAN}
_PENDATAAN = {k["kode"] for k in KATEGORI_LAPANGAN if k["pendataan"]}
_LABEL = {k["kode"]: k["label"] for k in KATEGORI_LAPANGAN}

# Di bawah jumlah ini, laporan sebuah kabupaten ditampilkan sebagai hitungan
# mentah dan TIDAK dipakai memeringkat wilayah maupun membantah sumbu gap.
# Sejajar dengan `live.AMBANG_RANKING`, dan dengan alasan yang persis sama.
AMBANG_BUKTI = 10

# Bobot tingkat keparahan saat menghitung indeks tekanan. Bukan skor ilmiah —
# ia hanya mencegah sepuluh laporan RINGAN menutupi satu laporan BERAT.
BOBOT_TINGKAT = {"RINGAN": 1.0, "SEDANG": 2.0, "BERAT": 3.0}

_BATAS_BARIS = 2000


def _pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


def _sejak(hari: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=hari)).isoformat()


# ---------------------------------------------------------------------------
# Kotak masuk dinas
# ---------------------------------------------------------------------------
def kotak_masuk(kabupaten: Optional[str], status: Optional[str] = None,
                kategori: Optional[str] = None, batas: int = 200) -> list[dict]:
    """Laporan masuk untuk dinas, disaring di SERVER.

    Pegawai GOV yang profilnya terikat satu kabupaten hanya melihat wilayahnya.
    Penyaringan tidak boleh dilakukan di UI — kalau begitu datanya tetap
    terkirim ke browser dan kerahasiaan wilayah hanya sebatas kesopanan.
    """
    _pastikan_db()
    params = {"select": "*", "order": "created_at.desc", "limit": str(batas)}
    if kabupaten:
        params["kabupaten"] = f"eq.{kabupaten}"
    if status and status != "SEMUA":
        params["status"] = f"eq.{status}"
    if kategori and kategori != "SEMUA":
        params["kategori"] = f"eq.{kategori}"
    with jaga():
        return db.pilih(VIEW_GOV, params) or []


def tanggapi(laporan_id: str, status: str, tanggapan: Optional[str],
             oleh: str) -> dict:
    """Ubah status dan/atau balas satu laporan.

    Kosakata statusnya sengaja sama persis dengan `aspirasi`: petugas yang
    sama membuka dua kotak masuk, dan dua kosakata status untuk hal yang sama
    hanya akan membuat salah satunya diisi asal-asalan.
    """
    _pastikan_db()
    if status not in STATUS:
        raise HTTPException(400, f"Status tidak dikenal: {status}.")

    with jaga():
        if not db.satu(VIEW_GOV, {"id": f"eq.{laporan_id}", "select": "id"}):
            raise HTTPException(404, "Laporan tidak ditemukan.")

        sekarang = datetime.now(timezone.utc).isoformat()
        isi = {"status": status, "updated_at": sekarang}
        if tanggapan is not None:
            isi["tanggapan"] = bersihkan(tanggapan, 2000, "Tanggapan")
            isi["ditanggapi_oleh"] = oleh
            isi["ditanggapi_pada"] = sekarang

        # Penulisan ke tabel dasar; pembacaan balik lewat view supaya jawabannya
        # tidak pernah memuat kolom yang view sengaja sembunyikan.
        db.perbarui(TABEL, {"id": f"eq.{laporan_id}"}, isi)
        return db.satu(VIEW_GOV, {"id": f"eq.{laporan_id}", "select": "*"}) or {
            "id": laporan_id, **isi
        }


# ---------------------------------------------------------------------------
# Agregat untuk dashboard
# ---------------------------------------------------------------------------
def _indeks_tekanan(baris: list[dict]) -> float:
    return round(sum(BOBOT_TINGKAT.get(b.get("tingkat"), 1.0) for b in baris), 1)


def agregat(hari: int = 180, kabupaten: Optional[str] = None) -> dict:
    """Rekap laporan lapangan + akurasi rencana, untuk dashboard pemerintah.

    Selalu mengembalikan dict dan tidak pernah melempar karena database sedang
    bermasalah — kartu ini cukup disembunyikan sementara seluruh angka CSV di
    dashboard tetap tampil. Pola yang sama dipakai `live.statistik_live`.
    """
    if not db.aktif():
        return {"aktif": False, "alasan": "Basis data belum dikonfigurasi di server."}

    sejak = _sejak(hari)
    try:
        params = {
            "select": "id,place_name,kabupaten,jenis,kategori,tingkat,status,created_at",
            "created_at": f"gte.{sejak}",
            "order": "created_at.desc",
            "limit": str(_BATAS_BARIS),
        }
        if kabupaten:
            params["kabupaten"] = f"eq.{kabupaten}"
        baris = db.pilih(VIEW_GOV, params) or []

        # Ulasan perjalanan: hanya yang JADI BERANGKAT. Ulasan dari rencana
        # yang batal tetap tersimpan dan tetap berguna untuk memahami kenapa
        # rencana tidak terpakai, tetapi ia bukan pengamatan lapangan.
        ulasan = db.pilih("perjalanan_ulasan", {
            "select": "skor_keseluruhan,akurasi_biaya,akurasi_waktu,created_at",
            "created_at": f"gte.{sejak}",
            "jadi_berangkat": "is.true",
            "limit": str(_BATAS_BARIS),
        }) or []
    except Exception as e:  # noqa: BLE001
        return {"aktif": False, "alasan": f"Gagal membaca laporan: {e}"}

    # -- per kategori -------------------------------------------------------
    per_kategori = Counter(b.get("kategori", "LAINNYA") for b in baris)
    kategori = [
        {
            "kode": k,
            "label": _LABEL.get(k, k),
            "n": per_kategori.get(k, 0),
            "sumbu_gap": _SUMBU.get(k),
            "pendataan": k in _PENDATAAN,
        }
        for k in KODE_KATEGORI
        if per_kategori.get(k, 0)
    ]
    kategori.sort(key=lambda x: x["n"], reverse=True)

    # -- per kabupaten ------------------------------------------------------
    per_kab: dict[str, list[dict]] = {}
    for b in baris:
        if b.get("kabupaten"):
            per_kab.setdefault(b["kabupaten"], []).append(b)

    kabupaten_rekap = []
    for nama, isi in per_kab.items():
        c = Counter(x.get("kategori", "LAINNYA") for x in isi)
        kabupaten_rekap.append({
            "kabupaten": nama,
            "n": len(isi),
            "indeks_tekanan": _indeks_tekanan(isi),
            "n_berat": sum(1 for x in isi if x.get("tingkat") == "BERAT"),
            "belum_ditangani": sum(1 for x in isi if x.get("status") in ("BARU", "DIBACA")),
            "kategori_teratas": c.most_common(1)[0][0] if c else None,
            # Konfirmasi lapangan atas sumbu 'fasilitas' gap.py. Inilah satu-
            # satunya kolom di seluruh dashboard yang berasal dari pengamatan
            # langsung, bukan dari proksi.
            "n_konfirmasi_fasilitas": sum(
                1 for x in isi if _SUMBU.get(x.get("kategori")) == "fasilitas"),
            "n_masalah_pendataan": sum(
                1 for x in isi if x.get("kategori") in _PENDATAAN),
            "cukup_untuk_bukti": len(isi) >= AMBANG_BUKTI,
        })
    kabupaten_rekap.sort(key=lambda x: x["indeks_tekanan"], reverse=True)

    # -- tempat paling banyak dilaporkan ------------------------------------
    per_tempat: Counter = Counter()
    asal: dict[str, dict] = {}
    for b in baris:
        n = b.get("place_name")
        if not n:
            continue
        per_tempat[n] += 1
        asal.setdefault(n, {"kabupaten": b.get("kabupaten"), "jenis": b.get("jenis")})
    tempat_teratas = [
        {"nama": n, "n_laporan": c, **asal[n]} for n, c in per_tempat.most_common(10)
    ]

    # -- akurasi rencana ----------------------------------------------------
    biaya = Counter(u["akurasi_biaya"] for u in ulasan if u.get("akurasi_biaya"))
    waktu = Counter(u["akurasi_waktu"] for u in ulasan if u.get("akurasi_waktu"))
    skor = [int(u["skor_keseluruhan"]) for u in ulasan if u.get("skor_keseluruhan")]
    n_biaya = sum(biaya.values())

    akurasi = {
        "n_ulasan": len(ulasan),
        "rata_skor": round(sum(skor) / len(skor), 2) if skor else None,
        "biaya": dict(biaya),
        "waktu": dict(waktu),
        # Proporsi yang menganggap biaya nyata MELEBIHI estimasi. Ini yang
        # paling langsung menghakimi mesin penyusun rencana: kalau angkanya
        # tinggi, estimasi biaya sistem terlalu optimis dan itu masalah kami,
        # bukan masalah kabupaten mana pun.
        "porsi_lebih_mahal": round(
            (biaya.get("LEBIH_MAHAL", 0) + biaya.get("JAUH_LEBIH_MAHAL", 0)) / n_biaya, 3
        ) if n_biaya else None,
        "cukup_untuk_kesimpulan": len(ulasan) >= AMBANG_BUKTI,
    }

    belum = sum(1 for b in baris if b.get("status") in ("BARU", "DIBACA"))
    return {
        "aktif": True,
        "jendela_hari": hari,
        "total": len(baris),
        "belum_ditangani": belum,
        "ambang_bukti": AMBANG_BUKTI,
        "cukup_untuk_bukti": len(baris) >= AMBANG_BUKTI,
        "per_kategori": kategori,
        "per_kabupaten": kabupaten_rekap,
        "tempat_teratas": tempat_teratas,
        "akurasi_rencana": akurasi,
        "terpotong": len(baris) >= _BATAS_BARIS,
        "diperbarui": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "metodologi": (
            "Pengamatan langsung wisatawan yang perjalanannya sudah selesai, "
            "TERPISAH dari volume ulasan Google dan dari cacah itinerary — "
            "ketiganya tidak pernah dijumlahkan karena satuannya tidak "
            f"sebanding. Di bawah {AMBANG_BUKTI} laporan, angka sebuah wilayah "
            "ditampilkan apa adanya dan belum layak dipakai memeringkat "
            "wilayah maupun membantah sumbu analisis kesenjangan. Laporan "
            "tidak memuat identitas pelapor."
        ),
    }


# ---------------------------------------------------------------------------
# Sisi UMKM
# ---------------------------------------------------------------------------
def laporan_untuk_tempat(place_name_norm: str, batas: int = 50) -> list[dict]:
    """Laporan yang menyangkut tempat yang diklaim sebuah akun UMKM.

    Sebagian kategori memang urusan dinas dan tidak bisa diapa-apakan pemilik
    warung — tapi ia berhak tahu bahwa jalan menuju tempatnya dilaporkan rusak,
    karena itulah yang akan ia bawa ke dinas lewat jalur aspirasi. Satu
    kategori, JAM_OPERASIONAL, justru langsung bisa ia perbaiki sendiri.

    Dibaca dari view, jadi pemilik usaha pun tidak punya rute ke identitas
    pelapor. Itu bukan kesopanan; itu yang membuat pelaporan aman dilakukan.
    """
    if not db.aktif() or not place_name_norm:
        return []
    try:
        return db.pilih(VIEW_GOV, {
            "place_name_norm": f"eq.{place_name_norm}",
            "select": "id,place_name,kabupaten,kategori,tingkat,isi,status,"
                      "tanggapan,ditanggapi_pada,created_at",
            "order": "created_at.desc",
            "limit": str(batas),
        }) or []
    except Exception as e:  # noqa: BLE001 — dashboard UMKM tetap tampil
        _log.warning("Gagal membaca laporan untuk usaha: %s", e)
        return []


def ringkas_untuk_tempat(baris: list[dict]) -> dict:
    """Rekap kecil untuk kartu dashboard UMKM."""
    c = Counter(b.get("kategori", "LAINNYA") for b in baris)
    return {
        "total": len(baris),
        "belum_ditanggapi": sum(1 for b in baris if b.get("status") in ("BARU", "DIBACA")),
        "bisa_saya_perbaiki": sum(1 for b in baris if b.get("kategori") in _PENDATAAN),
        "per_kategori": [
            {"kode": k, "label": _LABEL.get(k, k), "n": n} for k, n in c.most_common()
        ],
    }


__all__ = [
    "AMBANG_BUKTI",
    "KATEGORI_LAPANGAN",
    "KODE_KATEGORI",
    "STATUS",
    "TINGKAT",
    "agregat",
    "kotak_masuk",
    "laporan_untuk_tempat",
    "ringkas_untuk_tempat",
    "tanggapi",
]
