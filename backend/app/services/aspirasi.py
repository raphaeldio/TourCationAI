"""Jalur dua arah UMKM <-> Pemerintah.

    UMKM  -> aspirasi    : keluhan, usulan, permintaan bantuan
    GOV   -> pengumuman  : kebijakan, program bantuan, pelatihan, event

Dua tabel terpisah dan sengaja tidak dijadikan satu "pesan" generik. Arahnya
berbeda, hak aksesnya berbeda, dan siklus hidupnya berbeda: aspirasi punya
status yang bergerak (BARU -> DITINDAKLANJUTI -> SELESAI) sedangkan pengumuman
punya masa tayang. Menyatukannya akan memaksa separuh kolom selalu kosong.

Seluruh pembacaan lintas-tenant (GOV membaca aspirasi semua UMKM) lewat
FastAPI dengan service_role, sehingga aturan peran tetap hanya di satu tempat.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from ..core.sanitasi import bersihkan
from ..db import supabase as db

_log = logging.getLogger(__name__)

KATEGORI = ["INFRASTRUKTUR", "PERMODALAN", "PELATIHAN", "PROMOSI", "PERIZINAN", "LAINNYA"]
STATUS = ["BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"]
JENIS_PENGUMUMAN = ["KEBIJAKAN", "BANTUAN", "PELATIHAN", "EVENT", "LAINNYA"]


def _pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


# ---------------------------------------------------------------------------
# Aspirasi — sisi UMKM
# ---------------------------------------------------------------------------
def kirim_aspirasi(usaha: dict, kategori: str, judul: str, isi: str) -> dict:
    """Simpan aspirasi baru.

    Judul dan isi melewati `bersihkan()` yang sama dengan nama produk. Teks ini
    akan dibaca pegawai dinas — dan kelak mungkin diringkas AI — jadi permukaan
    injeksinya sama nyatanya dengan deskripsi produk.
    """
    _pastikan_db()
    if kategori not in KATEGORI:
        raise HTTPException(400, f"Kategori tidak dikenal: {kategori}.")

    baris = db.sisipkan("aspirasi", {
        "business_id": usaha["id"],
        "kabupaten": usaha.get("kabupaten"),
        "kategori": kategori,
        "judul": bersihkan(judul, 150, "Judul", wajib=True),
        "isi": bersihkan(isi, 2000, "Isi aspirasi", wajib=True),
    }, kembalikan=True)
    if not baris:
        raise HTTPException(500, "Aspirasi gagal disimpan.")
    return baris[0]


def aspirasi_usaha(business_id: str, batas: int = 50) -> list[dict]:
    _pastikan_db()
    return db.pilih("aspirasi", {
        "business_id": f"eq.{business_id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(batas),
    })


# ---------------------------------------------------------------------------
# Aspirasi — sisi pemerintah
# ---------------------------------------------------------------------------
def aspirasi_masuk(kabupaten: Optional[str], status: Optional[str],
                   batas: int = 100) -> list[dict]:
    """Kotak masuk dinas.

    `kabupaten` dari profil pengguna GOV bila ada — pegawai dinas kabupaten
    hanya melihat wilayahnya sendiri. ADMIN memanggil tanpa filter.
    """
    _pastikan_db()
    params = {"select": "*", "order": "created_at.desc", "limit": str(batas)}
    if kabupaten:
        params["kabupaten"] = f"eq.{kabupaten}"
    if status and status != "SEMUA":
        params["status"] = f"eq.{status}"

    baris = db.pilih("aspirasi", params)
    if not baris:
        return []

    # Lampirkan nama usaha. Tanpa ini kotak masuk hanya berisi UUID, dan
    # petugas tidak bisa menilai konteksnya.
    ids = ",".join({b["business_id"] for b in baris})
    usaha = db.pilih("umkm_business", {
        "id": f"in.({ids})",
        "select": "id,place_name,kabupaten",
        "limit": "200",
    })
    nama = {u["id"]: u for u in usaha}
    for b in baris:
        u = nama.get(b["business_id"]) or {}
        b["nama_usaha"] = u.get("place_name")
    return baris


def tanggapi_aspirasi(aspirasi_id: str, status: str, tanggapan: Optional[str],
                      oleh: str) -> dict:
    _pastikan_db()
    if status not in STATUS:
        raise HTTPException(400, f"Status tidak dikenal: {status}.")

    ada = db.satu("aspirasi", {"id": f"eq.{aspirasi_id}", "select": "id"})
    if not ada:
        raise HTTPException(404, "Aspirasi tidak ditemukan.")

    sekarang = datetime.now(timezone.utc).isoformat()
    isi = {"status": status, "updated_at": sekarang}
    if tanggapan is not None:
        isi["tanggapan"] = bersihkan(tanggapan, 2000, "Tanggapan")
        isi["ditanggapi_oleh"] = oleh
        isi["ditanggapi_pada"] = sekarang

    hasil = db.perbarui("aspirasi", {"id": f"eq.{aspirasi_id}"}, isi, kembalikan=True)
    return hasil[0] if hasil else {"id": aspirasi_id, **isi}


def ringkas_aspirasi(kabupaten: Optional[str]) -> dict:
    """Cacah per status dan per kategori, untuk kartu ringkas dashboard GOV."""
    baris = aspirasi_masuk(kabupaten, None, batas=500)
    per_status = {s: 0 for s in STATUS}
    per_kategori = {k: 0 for k in KATEGORI}
    for b in baris:
        per_status[b.get("status", "BARU")] = per_status.get(b.get("status", "BARU"), 0) + 1
        per_kategori[b.get("kategori", "LAINNYA")] = (
            per_kategori.get(b.get("kategori", "LAINNYA"), 0) + 1
        )
    return {
        "total": len(baris),
        "belum_ditangani": per_status["BARU"] + per_status["DIBACA"],
        "per_status": per_status,
        "per_kategori": per_kategori,
    }


# ---------------------------------------------------------------------------
# Pengumuman
# ---------------------------------------------------------------------------
def buat_pengumuman(oleh: str, instansi: Optional[str], kabupaten: Optional[str],
                    jenis: str, judul: str, isi: str,
                    nilai_bantuan: Optional[int], cara_daftar: Optional[str],
                    tenggat: Optional[str]) -> dict:
    _pastikan_db()
    if jenis not in JENIS_PENGUMUMAN:
        raise HTTPException(400, f"Jenis tidak dikenal: {jenis}.")

    baris = db.sisipkan("pengumuman", {
        "dibuat_oleh": oleh,
        "instansi": bersihkan(instansi, 150, "Instansi"),
        "kabupaten": kabupaten or None,
        "jenis": jenis,
        "judul": bersihkan(judul, 150, "Judul", wajib=True),
        "isi": bersihkan(isi, 4000, "Isi pengumuman", wajib=True),
        "nilai_bantuan": nilai_bantuan,
        "cara_daftar": bersihkan(cara_daftar, 1000, "Cara mendaftar"),
        "tenggat": tenggat or None,
    }, kembalikan=True)
    if not baris:
        raise HTTPException(500, "Pengumuman gagal disimpan.")
    return baris[0]


def pengumuman_untuk(kabupaten: Optional[str], batas: int = 50) -> list[dict]:
    """Pengumuman yang berlaku bagi satu UMKM.

    Termasuk yang `kabupaten` NULL — itu berarti berlaku nasional. PostgREST
    memerlukan bentuk `or=(...)` untuk menggabungkan keduanya dalam satu kueri.
    """
    _pastikan_db()
    params = {
        "select": "*",
        "aktif": "is.true",
        "order": "created_at.desc",
        "limit": str(batas),
    }
    if kabupaten:
        params["or"] = f"(kabupaten.is.null,kabupaten.eq.{kabupaten})"
    return db.pilih("pengumuman", params)


def pengumuman_saya(oleh: Optional[str], kabupaten: Optional[str],
                    batas: int = 100) -> list[dict]:
    """Daftar untuk panel GOV, termasuk yang sudah tidak aktif."""
    _pastikan_db()
    params = {"select": "*", "order": "created_at.desc", "limit": str(batas)}
    if kabupaten:
        params["or"] = f"(kabupaten.is.null,kabupaten.eq.{kabupaten})"
    elif oleh:
        params["dibuat_oleh"] = f"eq.{oleh}"
    return db.pilih("pengumuman", params)


def ubah_pengumuman(pengumuman_id: str, aktif: Optional[bool]) -> dict:
    _pastikan_db()
    ada = db.satu("pengumuman", {"id": f"eq.{pengumuman_id}", "select": "id"})
    if not ada:
        raise HTTPException(404, "Pengumuman tidak ditemukan.")
    isi = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if aktif is not None:
        isi["aktif"] = aktif
    hasil = db.perbarui("pengumuman", {"id": f"eq.{pengumuman_id}"}, isi, kembalikan=True)
    return hasil[0] if hasil else {"id": pengumuman_id, **isi}
