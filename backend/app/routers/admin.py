"""Peninjauan permohonan peran. Hanya ADMIN.

Ini satu-satunya jalur yang boleh menaikkan peran seseorang. Trigger
`profiles_cegah_naik_peran` pada database menolak perubahan peran yang datang
dari peran `authenticated`/`anon`, sehingga klien browser tidak dapat
melewati jalur ini bahkan bila memanggil PostgREST secara langsung.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from ..core.security import Pengguna, lupakan_peran, wajib_peran
from ..db import supabase as db
from ..schemas.auth import AturLanggananReq, KeputusanPeranReq
from ..schemas.verifikasi import WilayahPetugasReq
from ..services import notifikasi, verifikasi

router = APIRouter(prefix="/api/admin")


@router.get("/permohonan")
def daftar_permohonan(
    status: str = Query("PENDING", pattern="^(PENDING|APPROVED|REJECTED|SEMUA)$"),
    _: Pengguna = Depends(wajib_peran("ADMIN")),
):
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")
    params = {"select": "*", "order": "created_at.desc", "limit": "100"}
    if status != "SEMUA":
        params["status"] = f"eq.{status}"
    return {"permohonan": db.pilih("role_requests", params)}


@router.post("/permohonan/{permohonan_id}")
def putuskan_permohonan(
    permohonan_id: str,
    req: KeputusanPeranReq,
    admin: Pengguna = Depends(wajib_peran("ADMIN")),
):
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    permohonan = db.satu("role_requests", {"id": f"eq.{permohonan_id}", "select": "*"})
    if not permohonan:
        raise HTTPException(404, "Permohonan tidak ditemukan.")
    if permohonan["status"] != "PENDING":
        raise HTTPException(409, f"Permohonan sudah berstatus {permohonan['status']}.")

    sekarang = datetime.now(timezone.utc).isoformat()
    baru = "APPROVED" if req.setuju else "REJECTED"

    db.perbarui("role_requests", {"id": f"eq.{permohonan_id}"}, {
        "status": baru,
        "reviewed_by": admin.id,
        "reviewed_at": sekarang,
        "catatan_review": req.catatan,
    })

    if req.setuju:
        pemohon = permohonan["user_id"]
        db.perbarui("profiles", {"id": f"eq.{pemohon}"}, {
            "role": permohonan["requested_role"],
            "kabupaten": permohonan.get("kabupaten"),
        })

        # Untuk UMKM, sekalian buatkan baris usaha yang tertaut ke nama dari
        # dataset — inilah jembatan antara akun dan data CSV.
        #
        # Perhatikan yang TIDAK terjadi di sini: usaha ini belum `verified`.
        # Persetujuan admin memberi HAK BERUSAHA — pemilik bisa langsung mengisi
        # menu — sedangkan verifikasi identitas adalah kewenangan dinas
        # kabupaten (`services/verifikasi.py`). Dua hal itu sengaja dipisah:
        # kalau digabung, petugas cukup tidak menekan tombol untuk mengucilkan
        # pesaing dari platform.
        if permohonan["requested_role"] == "UMKM" and permohonan.get("umkm_place_name"):
            sudah = db.satu("umkm_business", {"owner_id": f"eq.{pemohon}", "select": "id"})
            if not sudah:
                dibuat = db.sisipkan("umkm_business", {
                    "owner_id": pemohon,
                    "place_name": permohonan["umkm_place_name"],
                    "kabupaten": permohonan.get("kabupaten"),
                }, kembalikan=True)

                # Beri tahu dinas bahwa ada usaha menunggu verifikasi. Diantrekan
                # lebih dulu lalu dicoba kirim; kegagalan SMTP tidak boleh
                # membatalkan persetujuan yang sudah sah tersimpan di atas.
                if dibuat:
                    verifikasi.beri_tahu_usaha_baru(dibuat[0])
                    notifikasi.kirim_tertunda()

        # Buang cache peran supaya persetujuan berlaku seketika, tanpa
        # menunggu TTL 60 detik atau token pemohon di-refresh.
        lupakan_peran(pemohon)

    return {"status": baru, "permohonan_id": permohonan_id}


@router.post("/solver/reload")
def muat_ulang_data(_: Pengguna = Depends(wajib_peran("ADMIN"))):
    """Muat ulang dataset CSV ke solver tanpa merestart proses.

    Dulu endpoint ini menerapkan ulang override harga UMKM sebelum TTL habis.
    Override itu sudah dicabut — harga UMKM tidak lagi menyentuh solver sama
    sekali, jadi tidak ada yang perlu disegerakan. Yang tersisa berguna untuk
    hal lain: mengganti berkas di `data/` lalu memakainya tanpa restart.
    """
    from ..services.solver_state import muat_ulang_solver
    return {"status": "ok", **muat_ulang_solver()}


@router.post("/langganan")
def atur_langganan(req: AturLanggananReq, _: Pengguna = Depends(wajib_peran("ADMIN"))):
    """Tetapkan tier langganan sebuah usaha.

    Ini pengganti payment gateway untuk tahap ini. Barisnya di-upsert supaya
    memanggil dua kali tidak menghasilkan dua langganan untuk satu usaha —
    kolom `business_id` memang unik, tetapi galat kunci ganda adalah cara yang
    buruk untuk menyampaikan "sudah ada".
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    usaha = db.satu("umkm_business", {"id": f"eq.{req.business_id}", "select": "id"})
    if not usaha:
        raise HTTPException(404, "Usaha tidak ditemukan.")

    sekarang = datetime.now(timezone.utc)
    selesai = (sekarang + timedelta(days=30 * req.bulan)).isoformat() if req.bulan else None
    isi = {
        "plan": req.plan,
        "status": "AKTIF",
        "mulai": sekarang.isoformat(),
        "selesai": selesai,
        # Kuota disegarkan setiap kali paket ditetapkan ulang: pelanggan yang
        # baru naik tier tidak mewarisi pemakaian dari tier sebelumnya.
        "kuota_terpakai": 0,
        "kuota_direset": sekarang.isoformat(),
        "catatan": req.catatan,
        "updated_at": sekarang.isoformat(),
    }

    ada = db.satu("subscription", {"business_id": f"eq.{req.business_id}", "select": "id"})
    if ada:
        db.perbarui("subscription", {"business_id": f"eq.{req.business_id}"}, isi)
    else:
        db.sisipkan("subscription", {"business_id": req.business_id, **isi})

    from ..services.langganan import status_langganan
    return {"status": "ok", "langganan": status_langganan(req.business_id)}


@router.get("/ringkas")
def ringkas_admin(_: Pengguna = Depends(wajib_peran("ADMIN"))):
    """Angka operasional untuk panel admin."""
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    def cacah(tabel: str, params: dict | None = None) -> int:
        return len(db.pilih(tabel, {**(params or {}), "select": "id", "limit": "1000"}))

    return {
        "permohonan_tertunda": cacah("role_requests", {"status": "eq.PENDING"}),
        "total_usaha": cacah("umkm_business"),
        "total_itinerary": cacah("itinerary_log"),
    }


@router.post("/gov/wilayah")
def atur_wilayah_petugas(req: WilayahPetugasReq, _: Pengguna = Depends(wajib_peran("ADMIN"))):
    """Tetapkan wilayah kerja satu akun GOV.

    Peran GOV datang dari domain surel dan aktif seketika, tetapi WILAYAH-nya
    tidak bisa ikut disimpulkan dari sana: `dishub@tobakab.go.id` tidak lebih
    membuktikan wewenang atas Toba daripada atas Samosir. Karena itu wilayah
    ditetapkan di sini, dan hanya oleh ADMIN.

    Ini satu-satunya jalur penulisannya. Endpoint biodata di `routers/auth.py`
    sengaja tidak memuat `kabupaten`, sehingga pemegang akun tidak bisa memilih
    wilayahnya sendiri — syarat mutlak agar pembatasan verifikasi per kabupaten
    berarti apa-apa.

    `kabupaten: null` mencabut wilayah, dan akibatnya akun itu tidak bisa
    memverifikasi apa pun lagi (`services/verifikasi.py` gagal tertutup).
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    hasil = db.perbarui(
        "profiles", {"id": f"eq.{req.user_id}"},
        {"kabupaten": req.kabupaten}, kembalikan=True)
    if not hasil:
        raise HTTPException(404, "Akun tidak ditemukan.")

    # Wilayah ikut ter-cache bersama peran selama 60 detik; tanpa ini penetapan
    # baru terasa setelah cache habis, dan petugas mengira tombolnya rusak.
    lupakan_peran(req.user_id)
    return {"status": "ok", "user_id": req.user_id, "kabupaten": req.kabupaten}


@router.post("/notifikasi/kirim")
def kirim_notifikasi(_: Pengguna = Depends(wajib_peran("ADMIN"))):
    """Siram antrean notifikasi sekarang juga.

    Pengiriman sudah dicoba otomatis saat notifikasi dibuat. Endpoint ini untuk
    keadaan yang tidak bisa ditangani otomatis: SMTP sempat mati lalu hidup lagi,
    kredensial baru diperbaiki, atau antrean menumpuk karena aplikasi berjalan
    tanpa konfigurasi surel selama beberapa waktu.
    """
    return notifikasi.kirim_tertunda()
