"""Rencana perjalanan yang disimpan wisatawan.

Perbedaannya dengan `itinerary_log` bukan soal teknis, melainkan soal NIAT.
`itinerary_log` mencatat bahwa sebuah rencana pernah disusun — itu jejak
analitik, dan ia terjadi tanpa pengguna memintanya. Tabel di sini mencatat bahwa
pengguna INGIN menyimpannya, dan hanya itulah yang layak muncul di inbox-nya.

Dua sifat yang dipegang modul ini:

  * **Payload disimpan apa adanya, tidak pernah disusun ulang.** Membuka
    rencana lama tidak memanggil solver. Kalau ia dipanggil, rencana yang sama
    akan berubah begitu dataset, harga acuan, atau bobot jarak berubah — dan
    `itinerary_log` bahkan tidak menyimpan `origin_lat`/`origin_lon`, jadi
    rekonstruksinya tidak akan pernah utuh. Rencana yang berubah sendiri setelah
    disimpan bukan rencana yang disimpan.

  * **Satu itinerary satu simpanan.** Ditegakkan primary key di database, bukan
    pemeriksaan di sini. Menekan Simpan dua kali memperbarui judul yang sama,
    tidak pernah menambah baris kedua — alasannya sama seperti `umkm_rating`:
    pemeriksaan aplikasi punya celah balapan, primary key tidak.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from ..core.sanitasi import bersihkan
from ..db import supabase as db
from .migrasi import PESAN_SIMPANAN, jaga

_log = logging.getLogger(__name__)

TABEL = "itinerary_simpanan"

# Pagar ukuran payload. Rencana 5 hari yang paling gemuk pun jauh di bawah ini;
# angkanya ada supaya satu permintaan aneh tidak jadi baris raksasa di Postgres.
MAKS_PAYLOAD_KB = 512

BATAS_DAFTAR = 50


def _pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


def _milik(itinerary_id: str, user_id: str) -> dict:
    """Baris itinerary_log milik pemanggil.

    404 — bukan 403 — untuk perjalanan orang lain, mengikuti alasan yang sama
    dengan `umkm.produk_milik`: membedakan "tidak ada" dari "ada tapi bukan
    punyamu" membocorkan keberadaan baris kepada siapa pun yang menebak id.
    """
    baris = db.satu("itinerary_log", {
        "id": f"eq.{itinerary_id}",
        "select": "id,user_id,tanggal_mulai,n_days,kabupaten_tersentuh",
    })
    if not baris or baris.get("user_id") != user_id:
        raise HTTPException(404, "Perjalanan tidak ditemukan.")
    return baris


def _judul_bawaan(log: dict) -> str:
    """Judul rangkaian dari kabupaten dan durasi.

    Dipakai ketika pengguna menyimpan tanpa memberi nama. Judul WAJIB akan
    memaksa orang mengarang nama sebelum boleh menyimpan, dan itu menghalangi
    tindakan yang seharusnya cukup satu klik.
    """
    kab = [k for k in (log.get("kabupaten_tersentuh") or []) if k]
    hari = log.get("n_days") or 1
    wilayah = " · ".join(kab[:2]) if kab else "Danau Toba"
    return f"{wilayah}, {hari} hari"


def simpan(itinerary_id: str, user_id: str, payload: dict,
           judul: Optional[str]) -> dict:
    """Simpan atau perbarui rencana. Idempoten terhadap `itinerary_id`."""
    _pastikan_db()
    if not isinstance(payload, dict) or not payload.get("days"):
        raise HTTPException(400, "Payload rencana tidak lengkap.")

    # Diukur kasar lewat repr; tujuannya menahan yang ekstrem, bukan menghitung
    # byte dengan tepat.
    if len(repr(payload)) > MAKS_PAYLOAD_KB * 1024:
        raise HTTPException(413, "Rencana terlalu besar untuk disimpan.")

    log = _milik(itinerary_id, user_id)
    nama = bersihkan(judul, 120, "Judul perjalanan") or _judul_bawaan(log)
    sekarang = datetime.now(timezone.utc).isoformat()

    with jaga(PESAN_SIMPANAN):
        ada = db.satu(TABEL, {
            "itinerary_id": f"eq.{itinerary_id}", "select": "itinerary_id",
        })
        isi = {"judul": nama, "payload": payload, "updated_at": sekarang}
        if ada:
            db.perbarui(TABEL, {"itinerary_id": f"eq.{itinerary_id}"}, isi)
            aksi = "diperbarui"
        else:
            db.sisipkan(TABEL, {
                "itinerary_id": itinerary_id,
                "user_id": user_id,
                "disimpan_pada": sekarang,
                **isi,
            })
            aksi = "disimpan"

    return {"aksi": aksi, "itinerary_id": itinerary_id, "judul": nama}


def ambil(itinerary_id: str, user_id: str) -> dict:
    """Payload utuh untuk membuka kembali rencana.

    Membawa serta status perjalanan dan tanda sudah-diulas supaya halaman yang
    membukanya bisa langsung menawarkan tombol yang tepat — tanpa permintaan
    kedua hanya untuk tahu apakah tombol "Beri Ulasan" perlu muncul.
    """
    _pastikan_db()
    log = _milik(itinerary_id, user_id)

    with jaga(PESAN_SIMPANAN):
        baris = db.satu(TABEL, {
            "itinerary_id": f"eq.{itinerary_id}",
            "select": "itinerary_id,judul,payload,disimpan_pada,updated_at",
        })
    if not baris:
        raise HTTPException(404, "Rencana ini belum disimpan.")

    # Impor lokal: `perjalanan` mengimpor modul ini untuk melampirkan judul ke
    # daftar, jadi impor di puncak akan jadi lingkaran.
    from .perjalanan import boleh_diulas, status_perjalanan

    info = status_perjalanan(log)
    with jaga():
        ulasan = db.satu("perjalanan_ulasan", {
            "itinerary_id": f"eq.{itinerary_id}",
            "select": "id,skor_keseluruhan",
        })

    return {
        **baris,
        **info,
        "sudah_diulas": ulasan is not None,
        "skor_ulasan": (ulasan or {}).get("skor_keseluruhan"),
        "boleh_diulas": boleh_diulas(info) and ulasan is None,
    }


def hapus(itinerary_id: str, user_id: str) -> dict:
    """Buang simpanan. Jejak analitik dan ulasannya TIDAK ikut terhapus.

    Yang dilepas hanyalah salinan rencana milik pengguna. `itinerary_log` tetap
    ada karena agregat kabupaten yang sudah terhitung tidak boleh berubah
    surut hanya karena satu orang merapikan inbox-nya, dan ulasannya tetap ada
    karena laporan lapangan yang sudah masuk ke dinas bukan milik pelapor lagi.
    """
    _pastikan_db()
    _milik(itinerary_id, user_id)
    with jaga(PESAN_SIMPANAN):
        db.hapus(TABEL, {"itinerary_id": f"eq.{itinerary_id}"})
    return {"status": "dihapus", "itinerary_id": itinerary_id}


def daftar_simpanan(user_id: str) -> list[str]:
    """itinerary_id yang disimpan pemanggil, terbaru dulu."""
    if not db.aktif():
        return []
    with jaga(PESAN_SIMPANAN):
        baris = db.pilih(TABEL, {
            "user_id": f"eq.{user_id}",
            "select": "itinerary_id",
            "order": "disimpan_pada.desc",
            "limit": str(BATAS_DAFTAR),
        })
    return [b["itinerary_id"] for b in (baris or [])]


def peta_judul(itinerary_ids: list[str]) -> dict[str, dict]:
    """{itinerary_id -> {judul, disimpan_pada}} untuk sekumpulan perjalanan.

    Versi jamak supaya daftar inbox cukup satu kueri, bukan satu per baris.
    Tidak pernah melempar: inbox tanpa judul masih terbaca, inbox yang gagal
    memuat tidak.
    """
    if not itinerary_ids or not db.aktif():
        return {}
    try:
        baris = db.pilih(TABEL, {
            "itinerary_id": f"in.({','.join(itinerary_ids)})",
            "select": "itinerary_id,judul,disimpan_pada",
            "limit": str(BATAS_DAFTAR),
        })
    except Exception as e:  # noqa: BLE001
        _log.warning("Gagal membaca simpanan: %s", e)
        return {}
    return {b["itinerary_id"]: b for b in (baris or [])}


__all__ = ["ambil", "daftar_simpanan", "hapus", "peta_judul", "simpan"]
