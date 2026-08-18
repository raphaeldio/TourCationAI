"""Riwayat statistik bulanan satu usaha (Fase 10).

`Paket.riwayat_bulan` sudah dijanjikan sejak Fase 9 — FREE 1 bulan, GROWTH 12,
PRO 24 — tetapi tidak ada satu pun endpoint yang membacanya. Modul ini yang
mengisinya.

Yang dijual paket di sini adalah **kedalaman**, bukan akses. Karena itu endpoint
riwayat TIDAK digerbangi 402: setiap tier bisa membukanya, hanya jendelanya yang
berbeda, dan jawabannya selalu menyebutkan berapa bulan yang tidak ditampilkan
beserta paket yang membukanya. Dinding yang menampilkan "fitur terkunci" untuk
data milik pengguna sendiri akan terasa seperti penyanderaan; jendela yang
memendek terasa seperti apa adanya — dan itu memang yang terjadi.

Tidak ada tabel baru. Seluruh angkanya sudah tercatat sebagai efek samping
pemakaian biasa:

    umkm_view_log    berapa kali usaha muncul/dibuka wisatawan
    umkm_rating      penilaian bintang yang masuk
    price_feedback   suara kewajaran harga atas produk usaha ini
    price_flag       jejak tiap kali harga dinilai ulang

Modul ini tidak pernah melempar. Tabel yang gagal dibaca menjadi kolom nol
dengan catatan, karena riwayat yang bolong di satu sumber tetap lebih berguna
daripada halaman galat.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from ..db import supabase as db

_log = logging.getLogger(__name__)

# Jendela terpanjang yang ditawarkan paket mana pun. Dipakai untuk memberi tahu
# pengguna FREE berapa banyak yang sedang tidak ia lihat.
JENDELA_MAKS = 24


def _awal_bulan(d: datetime) -> datetime:
    return d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _mundur_bulan(d: datetime, n: int) -> datetime:
    """Awal bulan n bulan sebelum d. Aritmetika bulan, bukan 30 hari."""
    bulan = d.month - 1 - n
    tahun = d.year + bulan // 12
    return _awal_bulan(d.replace(year=tahun, month=bulan % 12 + 1, day=1))


def _kunci_bulan(stempel) -> Optional[str]:
    if not stempel:
        return None
    return str(stempel)[:7]  # "2026-08-17T..." -> "2026-08"


def _baca(tabel: str, params: dict) -> list[dict]:
    """Pembacaan yang gagal tidak boleh menjatuhkan seluruh riwayat."""
    if not db.aktif():
        return []
    try:
        return db.pilih(tabel, params)
    except Exception as e:  # noqa: BLE001
        _log.warning("Riwayat: gagal membaca %s: %s", tabel, e)
        return []


def riwayat(business_id: str, jendela_bulan: int, plan: str,
            product_ids: Optional[list[str]] = None) -> dict:
    """Seri bulanan untuk satu usaha, sepanjang jendela paketnya."""
    jendela = max(1, min(int(jendela_bulan or 1), JENDELA_MAKS))
    sekarang = datetime.now(timezone.utc)
    mulai = _mundur_bulan(sekarang, jendela - 1)
    sejak = mulai.isoformat()

    # Rangka bulan dibuat lebih dulu supaya bulan tanpa aktivitas tetap muncul
    # sebagai nol. Deret yang melompati bulan kosong membuat grafik berbohong:
    # jeda dua bulan akan terbaca sebagai dua batang berdampingan.
    urut = [_kunci_bulan(_mundur_bulan(sekarang, i).isoformat()) for i in range(jendela - 1, -1, -1)]
    ember = {
        b: {
            "bulan": b,
            "dilihat": 0,
            "n_rating": 0,
            "jumlah_bintang": 0,
            "n_suara": 0,
            "n_setuju": 0,
            "n_penilaian_harga": 0,
            "n_ditandai": 0,
        }
        for b in urut
    }

    def tambah(stempel, kolom: str, nilai: int = 1) -> None:
        baris = ember.get(_kunci_bulan(stempel))
        if baris is not None:
            baris[kolom] += nilai

    for v in _baca("umkm_view_log", {
        "business_id": f"eq.{business_id}",
        "created_at": f"gte.{sejak}",
        "select": "created_at",
        "limit": "10000",
    }):
        tambah(v.get("created_at"), "dilihat")

    for r in _baca("umkm_rating", {
        "business_id": f"eq.{business_id}",
        "created_at": f"gte.{sejak}",
        "select": "created_at,rating",
        "limit": "5000",
    }):
        tambah(r.get("created_at"), "n_rating")
        tambah(r.get("created_at"), "jumlah_bintang", int(r.get("rating") or 0))

    for f in _baca("price_flag", {
        "business_id": f"eq.{business_id}",
        "created_at": f"gte.{sejak}",
        "select": "created_at,status",
        "limit": "5000",
    }):
        tambah(f.get("created_at"), "n_penilaian_harga")
        if f.get("status") in ("SUSPECT", "FLAGGED"):
            tambah(f.get("created_at"), "n_ditandai")

    # price_feedback menunjuk produk, bukan usaha; tanpa daftar id produk tidak
    # ada cara menyaringnya di sisi server.
    if product_ids:
        for s in _baca("price_feedback", {
            "product_id": f"in.({','.join(product_ids)})",
            "created_at": f"gte.{sejak}",
            "select": "created_at,vote",
            "limit": "5000",
        }):
            if s.get("vote") in (1, -1):
                tambah(s.get("created_at"), "n_suara")
            if s.get("vote") == 1:
                tambah(s.get("created_at"), "n_setuju")

    bulan = []
    for b in urut:
        baris = ember[b]
        n_rating = baris["n_rating"]
        bulan.append({
            **{k: v for k, v in baris.items() if k != "jumlah_bintang"},
            "rata_rating": round(baris["jumlah_bintang"] / n_rating, 2) if n_rating else None,
        })

    total = {
        "dilihat": sum(b["dilihat"] for b in bulan),
        "n_rating": sum(b["n_rating"] for b in bulan),
        "n_suara": sum(b["n_suara"] for b in bulan),
        "n_setuju": sum(b["n_setuju"] for b in bulan),
        "n_penilaian_harga": sum(b["n_penilaian_harga"] for b in bulan),
        "n_ditandai": sum(b["n_ditandai"] for b in bulan),
    }
    jumlah_bintang = sum(ember[b]["jumlah_bintang"] for b in urut)
    total["rata_rating"] = (
        round(jumlah_bintang / total["n_rating"], 2) if total["n_rating"] else None
    )

    return {
        "plan": plan,
        "jendela_bulan": jendela,
        "jendela_maksimum": JENDELA_MAKS,
        "dibatasi_paket": jendela < JENDELA_MAKS,
        "bulan_tersembunyi": max(JENDELA_MAKS - jendela, 0),
        "mulai": mulai.date().isoformat(),
        "bulan": bulan,
        "total": total,
        "kosong": all(
            not (b["dilihat"] or b["n_rating"] or b["n_suara"] or b["n_penilaian_harga"])
            for b in bulan
        ),
        "catatan": (
            "Dihitung dari jejak pemakaian nyata: tampilan halaman usaha, "
            "penilaian wisatawan, suara kewajaran harga, dan setiap kali harga "
            "produk dinilai ulang. Tidak ada angka yang disimulasikan."
        ),
    }


def sejak_iso(jendela_bulan: int) -> str:
    """Batas bawah waktu untuk jendela paket, dalam ISO 8601 UTC.

    Dipakai ekspor CSV supaya berkas yang terunduh mencakup periode yang sama
    persis dengan grafik riwayat — dua jendela berbeda untuk paket yang sama
    akan terlihat seperti data yang tidak konsisten.
    """
    sekarang = datetime.now(timezone.utc)
    return _mundur_bulan(sekarang, max(1, int(jendela_bulan or 1)) - 1).isoformat()


__all__ = ["riwayat", "sejak_iso", "JENDELA_MAKS"]
