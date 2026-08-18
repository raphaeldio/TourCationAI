"""Penjaga untuk fitur yang tabelnya mungkin belum dimigrasi.

Umpan balik perjalanan membawa tabel baru (`perjalanan_ulasan`,
`laporan_lapangan`, view `laporan_lapangan_gov`) dan satu kolom tambahan
(`umkm_rating.itinerary_id`). Kode-nya bisa ter-deploy lebih dulu daripada
migrasinya — pada praktiknya itu justru keadaan yang paling sering terjadi.

Tanpa penjaga ini, keadaan tersebut muncul sebagai **500 Internal Server Error**
di lima endpoint berbeda, masing-masing dengan jejak galat yang tidak menyebut
sebabnya. Yang dibutuhkan operator hanya satu kalimat: tabelnya belum ada,
jalankan migrasinya.

Kenapa 503 dan bukan 500: 500 berarti "ada yang rusak di server dan kami tidak
tahu apa". 503 berarti "layanan ini belum siap" — benar secara harfiah, dan
satu-satunya yang bisa memperbaikinya adalah orang yang membaca pesannya.
Pilihan kode statusnya mengikuti `db.aktif()` yang sudah membalas 503 untuk
kredensial yang belum diisi; keduanya kelas masalah yang sama.
"""

from contextlib import contextmanager
from typing import Iterator

from fastapi import HTTPException

from ..db import supabase as db

def _pesan(berkas: str, fitur: str) -> str:
    return (
        f"Fitur {fitur} belum aktif: tabelnya belum ada di database. "
        f"Terapkan {berkas} lebih dulu "
        "(jalankan `python backend/sql/cek_koneksi.py` untuk memeriksa)."
    )


BERKAS_UMPAN_BALIK = "backend/sql/2026-08-17_umpan_balik_perjalanan.sql"
BERKAS_SIMPANAN = "backend/sql/2026-08-17b_simpan_itinerary.sql"

PESAN = _pesan(BERKAS_UMPAN_BALIK, "umpan balik perjalanan")
PESAN_SIMPANAN = _pesan(BERKAS_SIMPANAN, "simpan perjalanan")


@contextmanager
def jaga(pesan: str = PESAN) -> Iterator[None]:
    """Ubah "relasi/kolom belum ada" menjadi 503 yang bisa ditindaklanjuti.

    `pesan` bisa ditimpa karena ada lebih dari satu migrasi, dan pesan yang
    menunjuk berkas yang SALAH lebih buruk daripada tidak ada pesan sama
    sekali: operator akan menjalankan migrasi yang sudah diterapkan, melihat
    "Success", lalu menyimpulkan galatnya ada di tempat lain.

    HTTPException diteruskan apa adanya: 404 "Perjalanan tidak ditemukan" yang
    sengaja dilempar service TIDAK boleh berubah jadi 503 hanya karena kode
    statusnya kebetulan sama dengan yang dipakai PostgREST untuk relasi hilang.
    Galat lain juga diteruskan — gangguan jaringan bukan urusan migrasi, dan
    menyembunyikannya di balik pesan ini akan menyesatkan.
    """
    try:
        yield
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — hanya satu kelas yang diterjemahkan
        if db.tabel_hilang(e):
            raise HTTPException(503, pesan) from e
        raise


__all__ = [
    "BERKAS_SIMPANAN",
    "BERKAS_UMPAN_BALIK",
    "PESAN",
    "PESAN_SIMPANAN",
    "jaga",
]
