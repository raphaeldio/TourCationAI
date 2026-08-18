"""Agregat dari log itinerary — seri KEDUA, terpisah dari sinyal ulasan.

Aturan §4 rencana: dua seri ini tidak pernah dicampur. Volume ulasan adalah
proksi permintaan berskala ribuan dan berumur satu tahun; log itinerary adalah
cacah perencanaan nyata yang di awal masih puluhan. Menjumlahkan keduanya
menghasilkan angka yang tampak besar tapi tidak bersatuan.

Ambang `AMBANG_RANKING` menjaga hal yang sama pada tingkat penyajian: di bawah
30 itinerary, angka di sini ditandai belum layak dipakai untuk memeringkat.
"""

import threading
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..db import supabase as db

# Sedikit di atas satu siklus baca dashboard, cukup untuk membuat angka terasa
# hidup saat demo tanpa memanggil PostgREST tiap kali kartu dirender.
_TTL = 120.0

# Batas unduh per tabel. Pada volume hackathon tak akan tersentuh; bila
# tersentuh, payload menandainya lewat `terpotong` alih-alih diam-diam salah.
_BATAS_BARIS = 5000

# Di bawah ini angka live hanya ditampilkan sebagai hitungan mentah, tidak
# pernah dipakai memeringkat kabupaten — n-nya terlalu kecil untuk itu.
AMBANG_RANKING = 30

_cache: Optional[tuple[float, dict]] = None
_kunci = threading.Lock()


def _sejak(hari: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=hari)).isoformat()


def _hitung(hari: int) -> dict:
    batas = _sejak(hari)
    sekarang = datetime.now(timezone.utc)

    total_semua = db.cacah("itinerary_log")
    log = db.pilih("itinerary_log", {
        "select": "created_at,kabupaten_tersentuh,status,total_estimasi,n_days,n_orang",
        "created_at": f"gte.{batas}",
        "order": "created_at.desc",
        "limit": str(_BATAS_BARIS),
    })
    tempat = db.pilih("itinerary_place", {
        "select": "place_name,kabupaten,jenis,dipilih,created_at",
        "created_at": f"gte.{batas}",
        "dipilih": "is.true",
        "order": "created_at.desc",
        "limit": str(_BATAS_BARIS),
    })

    # -- seri harian --------------------------------------------------------
    ember: Counter = Counter()
    for baris in log:
        tanggal = str(baris.get("created_at") or "")[:10]
        if tanggal:
            ember[tanggal] += 1
    seri = []
    for mundur in range(hari - 1, -1, -1):
        tanggal = (sekarang - timedelta(days=mundur)).date().isoformat()
        seri.append({"tanggal": tanggal, "itinerary": ember.get(tanggal, 0)})

    # -- per kabupaten ------------------------------------------------------
    # Satu itinerary bisa menyentuh beberapa kabupaten; ia dihitung di setiap
    # kabupaten yang dilewatinya. Karena itu jumlah kolom ini SELALU >= total
    # itinerary, dan itu dinyatakan di `catatan` agar tidak terbaca ganda.
    kab_itin: Counter = Counter()
    for baris in log:
        for k in baris.get("kabupaten_tersentuh") or []:
            kab_itin[k] += 1
    kab_tempat: Counter = Counter()
    for baris in tempat:
        if baris.get("kabupaten"):
            kab_tempat[baris["kabupaten"]] += 1

    per_kabupaten = [
        {"kabupaten": k, "itinerary": n, "tempat_masuk_rencana": kab_tempat.get(k, 0)}
        for k, n in kab_itin.most_common()
    ]

    # -- tempat paling sering masuk rencana ---------------------------------
    populer: Counter = Counter()
    asal: dict[str, dict] = {}
    for baris in tempat:
        nama = baris.get("place_name")
        if not nama:
            continue
        populer[nama] += 1
        asal.setdefault(nama, {"kabupaten": baris.get("kabupaten"),
                               "jenis": baris.get("jenis")})
    tempat_teratas = [
        {"nama": n, "masuk_rencana": c, **asal[n]} for n, c in populer.most_common(10)
    ]

    n_log = len(log)
    berhasil = sum(1 for b in log if b.get("status") == "Optimal")
    anggaran = [b["total_estimasi"] for b in log if b.get("total_estimasi")]

    return {
        "aktif": True,
        "jendela_hari": hari,
        "total_itinerary": total_semua,
        "itinerary_jendela": n_log,
        "itinerary_berhasil": berhasil,
        "itinerary_gagal": n_log - berhasil,
        "rerata_estimasi": int(sum(anggaran) / len(anggaran)) if anggaran else None,
        "ambang_ranking": AMBANG_RANKING,
        "cukup_untuk_ranking": n_log >= AMBANG_RANKING,
        "seri_harian": seri,
        "per_kabupaten": per_kabupaten,
        "tempat_teratas": tempat_teratas,
        "terpotong": n_log >= _BATAS_BARIS or len(tempat) >= _BATAS_BARIS,
        "diperbarui": sekarang.isoformat(timespec="seconds"),
        "catatan": (
            "Seri perencanaan nyata, TERPISAH dari sinyal ulasan — satuannya "
            "tidak sebanding dan keduanya tidak pernah dijumlahkan. Satu "
            "itinerary dihitung di setiap kabupaten yang dilewatinya, jadi "
            f"jumlah per kabupaten melebihi total. Di bawah {AMBANG_RANKING} "
            "itinerary, angka ini belum layak dipakai memeringkat wilayah."
        ),
    }


def statistik_live(hari: int = 30, paksa: bool = False) -> dict:
    """Agregat log itinerary dengan cache 120 detik.

    Selalu mengembalikan dict — tidak pernah melempar. Bila Supabase belum
    dikonfigurasi atau sedang bermasalah, `aktif` bernilai false dan dashboard
    cukup menyembunyikan kartunya. Seluruh angka CSV tetap tampil.
    """
    global _cache

    if not db.aktif():
        return {"aktif": False, "alasan": "Basis data belum dikonfigurasi di server."}

    sekarang = time.monotonic()
    if not paksa and _cache and sekarang - _cache[0] < _TTL:
        return _cache[1]

    try:
        data = _hitung(hari)
    except Exception as e:  # noqa: BLE001 — dashboard tetap tampil tanpa seri live
        return {"aktif": False, "alasan": f"Gagal membaca log: {e}"}

    with _kunci:
        _cache = (sekarang, data)
    return data


def reset_live() -> None:
    """Buang cache — dipakai pengujian dan endpoint admin."""
    global _cache
    with _kunci:
        _cache = None
