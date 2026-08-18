"""Identitas pengguna, biodata, dan permohonan peran."""

import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..core import config
from ..core.paths import engine
from ..core.sanitasi import bersihkan
from ..core.security import Pengguna, lupakan_peran, wajib_pengguna
from ..db import supabase as db
from ..schemas.auth import BiodataReq, KlaimPeranReq
from ..services.solver_state import get_solver

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")

# Kolom biodata yang boleh dibaca dan ditulis lewat endpoint ini.
#
# Daftar putih, BUKAN "semua kecuali". `profiles` juga memuat `role` dan
# `kabupaten` — dua kolom yang menentukan hak akses — dan satu kolom baru yang
# lupa dikecualikan pada pendekatan "semua kecuali" berarti kenaikan peran lewat
# formulir biodata. Trigger `cegah_naik_peran` di database memang menahan jalur
# browser, tetapi backend memakai service_role dan justru dilewatkan trigger
# itu; jadi pagarnya harus ada di sini.
KOLOM_BIODATA = (
    "full_name", "avatar_url", "telepon", "kota_asal", "negara",
    "bahasa_utama", "tanggal_lahir", "jenis_kelamin", "biodata_lengkap_pada",
)

_PILIH_BIODATA = ",".join(KOLOM_BIODATA)


def _biodata(user_id: str) -> tuple[dict, bool]:
    """`(biodata, siap)` — `siap` False bila kolomnya belum dimigrasi.

    Pembedaan ini menentukan perilaku gerbang onboarding, dan mengabaikannya
    pernah membuat seluruh aplikasi terkunci: bila kolomnya belum ada, setiap
    pengguna tampak "belum mengisi biodata", penjaga route memantulkan mereka ke
    /biodata, dan penyimpanannya membalas 503. Seluruh aplikasi mati untuk
    semua yang sudah masuk — karena satu migrasi belum dijalankan.

    Onboarding adalah kenyamanan antarmuka, bukan batas keamanan, jadi ia harus
    **gagal-terbuka**: fitur yang belum siap dilewati, bukan memblokir.
    """
    if not db.aktif():
        return {}, False
    try:
        return (db.satu("profiles", {
            "id": f"eq.{user_id}", "select": _PILIH_BIODATA,
        }) or {}), True
    except Exception as e:  # noqa: BLE001 — profil tetap tampil walau kolomnya belum ada
        if not db.tabel_hilang(e):
            _log.warning("Gagal membaca biodata: %s", e)
        return {}, False


@router.get("/saya")
def saya(pengguna: Pengguna = Depends(wajib_pengguna)):
    """Profil pemanggil beserta peran efektif dan biodatanya."""
    permohonan = None
    if db.aktif():
        try:
            permohonan = db.satu("role_requests", {
                "user_id": f"eq.{pengguna.id}",
                "status": "eq.PENDING",
                "select": "id,requested_role,status,created_at",
            })
        except Exception:  # noqa: BLE001 — profil tetap tampil walau DB bermasalah
            permohonan = None

    bio, bio_siap = _biodata(pengguna.id)

    return {
        "id": pengguna.id,
        "email": pengguna.email,
        "peran": pengguna.peran,
        "kabupaten": pengguna.kabupaten,
        "permohonan_tertunda": permohonan,
        "boleh": {
            "gov": pengguna.peran in ("GOV", "ADMIN"),
            "umkm": pengguna.peran in ("UMKM", "ADMIN"),
            "admin": pengguna.peran == "ADMIN",
        },
        # Dipakai halaman Akun untuk menjelaskan cara memperoleh peran GOV.
        "domain_gov": sorted(config.domain_gov()),
        "biodata": {k: bio.get(k) for k in KOLOM_BIODATA if k != "biodata_lengkap_pada"},
        # Satu-satunya pemicu halaman onboarding. Dihitung dari penanda waktu,
        # bukan dari kekosongan field: mengosongkan telepon tidak boleh membuat
        # seseorang dipaksa mengisi ulang formulir yang sama.
        #
        # `or not bio_siap` membuatnya GAGAL-TERBUKA. Tanpa itu, database yang
        # kolomnya belum dimigrasi membuat setiap pengguna tampak belum mengisi
        # biodata — penjaga route memantulkan semuanya ke /biodata, dan
        # penyimpanannya membalas 503. Seluruh aplikasi mati bagi semua yang
        # sudah masuk, hanya karena satu migrasi belum dijalankan. Onboarding
        # adalah kenyamanan antarmuka, bukan batas keamanan; ia harus dilewati
        # ketika belum siap, bukan memblokir.
        "biodata_lengkap": bool(bio.get("biodata_lengkap_pada")) or not bio_siap,
    }


@router.patch("/biodata")
def simpan_biodata(req: BiodataReq, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Simpan biodata pemanggil. Dipakai onboarding maupun penyuntingan.

    Satu endpoint untuk keduanya: formulirnya sama, dan dua endpoint yang
    menulis kolom yang sama pasti akan menyimpang cepat atau lambat.

    Peran dan kabupaten TIDAK PERNAH tersentuh dari sini — lihat
    `KOLOM_BIODATA`. Kenaikan peran hanya lewat /api/admin/...
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    lahir = (req.tanggal_lahir or "").strip() or None
    if lahir:
        try:
            nilai = date.fromisoformat(lahir)
        except ValueError:
            raise HTTPException(400, "Tanggal lahir harus berformat YYYY-MM-DD.")
        # Diperiksa di sini DAN di database. Pesan yang bisa dibaca datang dari
        # sini; batasan database menjaga jalur lain yang mungkin dibuat nanti.
        if not date(1900, 1, 2) <= nilai < date.today():
            raise HTTPException(400, "Tanggal lahir tidak wajar.")

    isi = {
        "full_name": bersihkan(req.nama_lengkap, 120, "Nama lengkap", wajib=True),
        "avatar_url": bersihkan(req.avatar_url, 500, "Foto profil"),
        "telepon": bersihkan(req.telepon, 40, "Telepon"),
        "kota_asal": bersihkan(req.kota_asal, 100, "Kota asal"),
        "negara": bersihkan(req.negara, 100, "Negara"),
        "bahasa_utama": bersihkan(req.bahasa_utama, 60, "Bahasa utama"),
        "tanggal_lahir": lahir,
        "jenis_kelamin": req.jenis_kelamin,
        # Ditulis setiap kali; penyuntingan pun menyegarkan penandanya. Yang
        # penting ia tidak pernah kembali NULL, karena itulah yang membedakan
        # "belum pernah mengisi" dari "mengisi lalu mengosongkan sebagian".
        "biodata_lengkap_pada": datetime.now(timezone.utc).isoformat(),
    }

    try:
        hasil = db.perbarui("profiles", {"id": f"eq.{pengguna.id}"}, isi, kembalikan=True)
    except Exception as e:  # noqa: BLE001
        if db.tabel_hilang(e):
            raise HTTPException(
                503,
                "Kolom biodata belum ada di database. Terapkan "
                "backend/sql/2026-08-17c_biodata_profil.sql lebih dulu "
                "(jalankan `python backend/sql/cek_koneksi.py` untuk memeriksa).",
            ) from e
        raise HTTPException(500, f"Gagal menyimpan biodata: {e}")

    if not hasil:
        # Baris profiles dibuat trigger saat pengguna pertama kali masuk. Kalau
        # ia belum ada, UPDATE tidak mengenai apa pun dan diam-diam "berhasil".
        raise HTTPException(404, "Baris profil belum ada. Coba masuk ulang.")

    # Cache peran memuat kabupaten; biodata tidak mengubahnya, tetapi membuang
    # cache di sini membuat halaman berikutnya membaca baris yang baru ditulis
    # alih-alih salinan berumur sampai 60 detik.
    lupakan_peran(pengguna.id)

    baris = hasil[0]
    return {
        "biodata": {k: baris.get(k) for k in KOLOM_BIODATA if k != "biodata_lengkap_pada"},
        "biodata_lengkap": bool(baris.get("biodata_lengkap_pada")),
    }


@router.get("/usaha-tersedia")
def usaha_tersedia(cari: str = "", batas: int = 20):
    """Nama usaha dari dataset, untuk diklaim akun UMKM.

    Publik: daftar ini memang sudah tampil di direktori, dan calon pemilik
    perlu melihatnya sebelum masuk untuk tahu usahanya terdaftar atau tidak.
    """
    solver, _, _ = get_solver()
    kunci = (cari or "").strip().lower()
    hasil = []
    for _, r in solver.restos.iterrows():
        nama = str(r.get("place-name") or "").strip()
        if not nama or (kunci and kunci not in nama.lower()):
            continue
        hasil.append({
            "nama": nama,
            "alamat": r.get("address"),
            "kabupaten": engine.deteksi_kabupaten(r.get("address")),
        })
        if len(hasil) >= max(1, min(batas, 100)):
            break
    return {"usaha": hasil}


@router.post("/klaim")
def klaim_peran(req: KlaimPeranReq, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Ajukan permohonan naik peran. Keputusan ada di tangan ADMIN.

    Perhatikan: endpoint ini TIDAK PERNAH mengubah peran. Ia hanya membuat
    baris permohonan. Kenaikan peran hanya terjadi lewat /api/admin/... dan
    tambahan trigger database menolak perubahan peran dari sisi klien.
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    if pengguna.peran != "USER":
        raise HTTPException(400, f"Akun Anda sudah berperan {pengguna.peran}.")

    if req.requested_role == "UMKM" and not (req.umkm_place_name or "").strip():
        raise HTTPException(400, "Nama usaha wajib diisi untuk peran UMKM.")

    # GOV tidak lewat antrean persetujuan sama sekali. Kepemilikan alamat surel
    # dinas sudah menjadi buktinya, dan admin tidak punya cara memverifikasi
    # klaim "saya orang dinas" yang lebih baik daripada domain surelnya.
    if req.requested_role == "GOV":
        raise HTTPException(
            403,
            "Peran Pemerintah tidak diajukan lewat formulir. Masuk memakai "
            "alamat surel dinas (berakhiran .go.id) atau surel yang sudah "
            "didaftarkan pada GOV_EMAILS — peran GOV aktif seketika saat masuk.",
        )

    try:
        baris = db.sisipkan("role_requests", {
            "user_id": pengguna.id,
            "requested_role": req.requested_role,
            "umkm_place_name": req.umkm_place_name,
            "instansi": req.instansi,
            "kabupaten": req.kabupaten,
            "alasan": req.alasan,
        }, kembalikan=True)
    except Exception as e:  # noqa: BLE001
        # Indeks unik role_requests_satu_pending menahan permohonan ganda.
        if "role_requests_satu_pending" in str(e):
            raise HTTPException(409, "Anda sudah punya permohonan yang menunggu ditinjau.")
        raise HTTPException(500, f"Gagal menyimpan permohonan: {e}")

    return {"status": "PENDING", "permohonan": baris[0] if baris else None}
