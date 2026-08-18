"""Tier langganan UMKM (Fase 9).

ATURAN INTEGRITAS YANG TIDAK BISA DITAWAR: **langganan tidak membeli peringkat.**
Tidak satu pun nilai di modul ini boleh dibaca oleh `engine.py`, oleh
`services/solver_state.py`, atau oleh jalur mana pun yang menyusun itinerary.
Premium membeli *insight* — statistik lebih panjang, advisor lebih sering,
analisis harga — bukan *visibilitas*. Begitu langganan bisa membeli peringkat,
kualitas rekomendasi runtuh dan produk pemerintah ikut kehilangan keabsahannya:
dua lini pendapatan mati demi satu.

Cara memeriksanya tetap sederhana: modul ini hanya diimpor oleh router UMKM dan
router admin. Kalau suatu saat ia muncul di daftar impor solver, aturan di atas
sudah dilanggar.

Degradasi: tanpa database — atau tanpa baris langganan — semua usaha dianggap
FREE. Itu keadaan aman; yang hilang hanya fitur berbayar, bukan halamannya.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from ..db import supabase as db

_log = logging.getLogger(__name__)

# Jendela kuota. Dihitung bergulir dari `kuota_direset`, bukan dari kalender:
# pengguna yang berlangganan tanggal 20 tidak kehilangan jatahnya sepuluh hari
# kemudian hanya karena bulan berganti.
JENDELA_HARI = 30


@dataclass(frozen=True)
class Paket:
    kunci: str
    nama: str
    harga_bulanan: int
    # Berapa kali AI Advisor boleh dipanggil per jendela 30 hari.
    kuota_advisor: int
    maks_produk: int
    riwayat_bulan: int
    ekspor_csv: bool
    analisis_kompetitor: bool


PAKET: dict[str, Paket] = {
    "FREE": Paket("FREE", "Gratis", 0, 0, 5, 1, False, False),
    "GROWTH": Paket("GROWTH", "Growth", 49_000, 1, 25, 12, False, True),
    "PRO": Paket("PRO", "Pro", 149_000, 8, 0, 24, True, True),
}

URL_UPGRADE = "/bisnis"


def paket_dari(kunci: Optional[str]) -> Paket:
    return PAKET.get((kunci or "FREE").upper(), PAKET["FREE"])


def _baris(business_id: str) -> Optional[dict]:
    if not db.aktif():
        return None
    try:
        return db.satu("subscription", {
            "business_id": f"eq.{business_id}",
            "select": "id,plan,status,mulai,selesai,kuota_terpakai,kuota_direset",
        })
    except Exception as e:  # noqa: BLE001 — gangguan DB tidak menaikkan hak
        _log.warning("Gagal membaca langganan: %s", e)
        return None


def _kedaluwarsa(baris: dict) -> bool:
    selesai = baris.get("selesai")
    if not selesai:
        return False
    try:
        return datetime.fromisoformat(selesai.replace("Z", "+00:00")) < datetime.now(timezone.utc)
    except ValueError:
        return False


def status_langganan(business_id: str) -> dict:
    """Paket efektif + sisa kuota advisor untuk satu usaha.

    Selalu mengembalikan sesuatu yang bisa dirender. Tidak pernah melempar:
    halaman langganan harus tetap tampil walau tabelnya belum ada.
    """
    baris = _baris(business_id)

    if not baris or baris.get("status") != "AKTIF" or _kedaluwarsa(baris):
        p = PAKET["FREE"]
        alasan = None
        if baris and _kedaluwarsa(baris):
            alasan = "Masa langganan sudah berakhir."
        elif baris and baris.get("status") != "AKTIF":
            alasan = f"Langganan berstatus {baris.get('status')}."
        return {
            "plan": p.kunci,
            "nama": p.nama,
            "harga_bulanan": p.harga_bulanan,
            "status": (baris or {}).get("status", "TIDAK ADA"),
            "mulai": (baris or {}).get("mulai"),
            "selesai": (baris or {}).get("selesai"),
            "kuota_advisor": p.kuota_advisor,
            "kuota_terpakai": 0,
            "kuota_sisa": 0,
            "batas_produk": p.maks_produk,
            "riwayat_bulan": p.riwayat_bulan,
            "ekspor_csv": p.ekspor_csv,
            "analisis_kompetitor": p.analisis_kompetitor,
            "catatan": alasan,
            "upgrade_url": URL_UPGRADE,
        }

    p = paket_dari(baris.get("plan"))
    terpakai = int(baris.get("kuota_terpakai") or 0)
    if _perlu_reset(baris):
        terpakai = 0

    return {
        "plan": p.kunci,
        "nama": p.nama,
        "harga_bulanan": p.harga_bulanan,
        "status": baris.get("status"),
        "mulai": baris.get("mulai"),
        "selesai": baris.get("selesai"),
        "kuota_advisor": p.kuota_advisor,
        "kuota_terpakai": terpakai,
        "kuota_sisa": max(p.kuota_advisor - terpakai, 0),
        "batas_produk": p.maks_produk,
        "riwayat_bulan": p.riwayat_bulan,
        "ekspor_csv": p.ekspor_csv,
        "analisis_kompetitor": p.analisis_kompetitor,
        "catatan": None,
        "upgrade_url": URL_UPGRADE,
    }


def _perlu_reset(baris: dict) -> bool:
    stempel = baris.get("kuota_direset")
    if not stempel:
        return True
    try:
        sejak = datetime.fromisoformat(stempel.replace("Z", "+00:00"))
    except ValueError:
        return True
    return datetime.now(timezone.utc) - sejak >= timedelta(days=JENDELA_HARI)


def pakai_kuota(business_id: str) -> None:
    """Naikkan pencacah pemakaian advisor; reset dulu bila jendelanya lewat.

    Dipanggil HANYA setelah panggilan model benar-benar terjadi. Cache hit
    tidak memakan kuota — sama seperti pembatasan laju di `ai_insight.hasilkan`,
    dan karena alasan yang sama: membuka halaman berulang kali bukan pemakaian.
    """
    baris = _baris(business_id)
    if not baris:
        return
    sekarang = datetime.now(timezone.utc).isoformat()
    isi = (
        {"kuota_terpakai": 1, "kuota_direset": sekarang, "updated_at": sekarang}
        if _perlu_reset(baris)
        else {"kuota_terpakai": int(baris.get("kuota_terpakai") or 0) + 1,
              "updated_at": sekarang}
    )
    try:
        db.perbarui("subscription", {"business_id": f"eq.{business_id}"}, isi)
    except Exception as e:  # noqa: BLE001 — gagal mencatat != gagal melayani
        _log.warning("Gagal mencatat pemakaian kuota: %s", e)


def pastikan_batas_produk(business_id: str, peran: Optional[str] = None) -> None:
    """Tolak penambahan satu produk aktif bila jatah paket sudah penuh.

    Satu-satunya tempat batas ini ditegakkan. Ia dipanggil dari SETIAP jalur
    yang menaikkan jumlah produk aktif — membuat produk baru, dan menghidupkan
    kembali produk yang tadinya nonaktif. Menjaganya hanya di jalur pembuatan
    menyisakan pintu belakang: penuhi kuota, nonaktifkan satu, buat lagi, lalu
    hidupkan yang tadi, berulang tanpa batas.

    Dulu kebocorannya bukan sekadar urusan komersial: jumlah produk aktif
    mengalir ke `min()`/`max()` yang menyusun harga_min/harga_max/harga_tengah
    di `solver.restos`, sehingga batas paket — nilai komersial — ikut menggeser
    peringkat di itinerary. Jalur itu SUDAH TIDAK ADA; override harga dicabut
    dan harga UMKM tidak lagi menyentuh solver sama sekali (lihat
    `services/solver_state.py` dan `docs/ARSITEKTUR_HARGA.md`).

    Batas ini kini murni komersial, dan penegakannya tetap dipertahankan justru
    karena itu: satu batas yang bisa dilewati membuat seluruh katalog paket
    tidak bermakna. Yang hilang hanyalah akibatnya pada rekomendasi.

    Dibalas 402, bukan 400: ini bukan kesalahan masukan, melainkan batas
    komersial yang bisa dibuka sendiri oleh pengguna. ADMIN dikecualikan, sama
    seperti pengecualian pada kuota advisor.
    """
    if peran == "ADMIN":
        return

    status = status_langganan(business_id)
    batas = status["batas_produk"]
    if not batas:  # 0 = tanpa batas (PRO)
        return

    # Impor lokal: menjaga langganan.py tetap tanpa ketergantungan modul pada
    # lapisan produk, sehingga daftar impor puncaknya tetap sependek sekarang.
    from . import umkm as svc

    n_aktif = len(svc.daftar_produk(business_id, hanya_aktif=True))
    if n_aktif < batas:
        return

    raise HTTPException(
        402,
        detail={
            "pesan": (
                f"Paket {status['plan']} dibatasi {batas} produk aktif. "
                "Nonaktifkan salah satu produk, atau naikkan paket."
            ),
            "batas_produk": batas,
            "produk_aktif": n_aktif,
            "upgrade_url": status["upgrade_url"],
        },
    )


def daftar_paket() -> list[dict]:
    """Katalog paket untuk halaman harga publik."""
    return [
        {
            "kunci": p.kunci,
            "nama": p.nama,
            "harga_bulanan": p.harga_bulanan,
            "kuota_advisor": p.kuota_advisor,
            "batas_produk": p.maks_produk,
            "riwayat_bulan": p.riwayat_bulan,
            "ekspor_csv": p.ekspor_csv,
            "analisis_kompetitor": p.analisis_kompetitor,
        }
        for p in PAKET.values()
    ]
