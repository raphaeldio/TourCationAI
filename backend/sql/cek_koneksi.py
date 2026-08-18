"""Uji koneksi database dan kesiapan tabel — baca-saja, tidak menulis apa pun.

Jalankan dari root repo:

    python backend/sql/cek_koneksi.py

Dipakai untuk memisahkan tiga kegagalan yang gejalanya di UI mirip:
kredensial belum diisi, kredensial salah, dan tabel belum dimigrasi.
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv opsional; uvicorn memuatnya sendiri
    pass

from backend.app.core import config  # noqa: E402
from backend.app.db import supabase as db  # noqa: E402

# Tabel lama + tabel yang dibawa migrasi umpan balik perjalanan.
LAMA = [
    "profiles", "umkm_business", "umkm_product", "subscription",
    "umkm_rating", "trust_score", "price_feedback", "verification_score",
    "itinerary_log", "itinerary_place", "aspirasi", "pengumuman",
]
BARU = [
    # 2026-08-17_umpan_balik_perjalanan.sql
    "perjalanan_ulasan", "laporan_lapangan", "laporan_lapangan_gov",
    # 2026-08-17b_simpan_itinerary.sql
    "itinerary_simpanan",
]

# Kolom yang ditambahkan ke tabel LAMA. Tabelnya sudah ada, jadi keberadaannya
# hanya bisa dipastikan dengan memilih kolom itu secara eksplisit.
KOLOM_BARU = [
    # 2026-08-17_umpan_balik_perjalanan.sql
    ("umkm_rating", "itinerary_id"),
    # 2026-08-17c_biodata_profil.sql — satu kolom cukup sebagai wakil, karena
    # migrasinya menambahkan seluruhnya dalam satu pernyataan.
    ("profiles", "biodata_lengkap_pada"),
]


def utama() -> int:
    print("URL         :", config.supabase_url() or "(belum diset)")
    kunci = config.supabase_service_key()
    print("service_role:", f"terisi, {len(kunci)} karakter" if kunci else "(belum diset)")
    print("JWT alg     :", config.supabase_jwt_alg())

    if not db.aktif():
        print("\nGAGAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum lengkap di .env.")
        return 1

    print("\n-- tabel lama --")
    gagal = 0
    for t in LAMA:
        try:
            db.pilih(t, {"select": "*", "limit": "1"})
            print(f"  OK      {t}")
        except Exception as e:  # noqa: BLE001
            print(f"  GAGAL   {t}: {type(e).__name__}")
            gagal += 1

    print("\n-- objek dari migrasi baru --")
    belum = 0
    for t in BARU:
        try:
            db.pilih(t, {"select": "*", "limit": "1"})
            print(f"  OK      {t}")
        except Exception:  # noqa: BLE001
            print(f"  BELUM   {t}")
            belum += 1

    for tabel, kolom in KOLOM_BARU:
        try:
            db.pilih(tabel, {"select": kolom, "limit": "1"})
            print(f"  OK      {tabel}.{kolom}")
        except Exception:  # noqa: BLE001
            print(f"  BELUM   {tabel}.{kolom}")
            belum += 1

    if gagal:
        print(f"\n{gagal} tabel lama tidak terbaca — periksa kunci service_role.")
        return 1
    if belum:
        print(f"\n{belum} objek belum ada. Terapkan migrasi yang relevan:")
        print("  backend/sql/2026-08-17_umpan_balik_perjalanan.sql")
        print("  backend/sql/2026-08-17b_simpan_itinerary.sql")
        print("  backend/sql/2026-08-17c_biodata_profil.sql")
        return 2

    print("\nSemua siap.")
    return 0


if __name__ == "__main__":
    raise SystemExit(utama())
