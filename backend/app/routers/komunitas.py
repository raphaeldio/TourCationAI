"""Rating publik, aspirasi UMKM, laporan wisatawan, dan pengumuman pemerintah.

Empat permukaan dengan hak akses berbeda, sengaja dikumpulkan di satu router
karena semuanya adalah jalur komunikasi antar-peran:

    /api/umkm-publik/*   siapa pun boleh baca; menilai perlu akun (peran apa pun)
    /api/aspirasi/*      UMKM mengirim; GOV membaca dan menanggapi
    /api/laporan/*       WISATAWAN mengirim; GOV membaca dan menanggapi
    /api/pengumuman/*    GOV menerbitkan; UMKM membaca

Perhatikan arah `/api/laporan`: **pengirimannya tidak ada di sini.** Laporan
lapangan hanya lahir sebagai bagian dari ulasan pasca-perjalanan di
`routers/perjalanan.py`. Membuka endpoint kirim yang berdiri sendiri akan
menghapus satu-satunya sifat yang membuat laporan itu layak jadi bukti
kebijakan: bahwa pelapornya benar-benar pernah ke sana.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..core.security import Pengguna, pengguna_opsional, wajib_pengguna, wajib_peran
from ..db import supabase as db
from ..schemas.komunitas import (
    AspirasiReq,
    PengumumanPatch,
    PengumumanReq,
    RatingReq,
    TanggapanReq,
)
from ..schemas.perjalanan import TanggapanLaporanReq
from ..services import aspirasi as asp
from ..services import lapangan as lap
from ..services import rating as rt
from ..services import umkm as svc

router = APIRouter()


# ---------------------------------------------------------------------------
# Rating publik — direktori UMKM
# ---------------------------------------------------------------------------
@router.get("/api/umkm-publik/{business_id}")
def profil_publik(
    business_id: str,
    pengguna: Optional[Pengguna] = Depends(pengguna_opsional),
):
    """Profil UMKM beserta rating dan skor kepercayaannya.

    Publik: wisatawan harus bisa membacanya sebelum masuk. Bila kebetulan ada
    token sah, rating milik pemanggil ikut dikirim supaya UI bisa menampilkan
    "Anda memberi 4" alih-alih formulir kosong.
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")

    usaha = db.satu("umkm_business", {
        "id": f"eq.{business_id}",
        "select": "id,place_name,kabupaten,alamat,deskripsi,jam_buka,verified",
    })
    if not usaha:
        raise HTTPException(404, "Usaha tidak ditemukan.")

    ulasan = [
        # user_id sengaja TIDAK diteruskan: identitas penilai bukan urusan
        # pembaca, dan menampilkannya membuat rating jadi ajang saling kenal.
        {k: v for k, v in u.items() if k != "user_id"}
        for u in rt.daftar_rating(business_id, batas=30)
    ]
    return {
        "usaha": usaha,
        "trust": rt.trust_usaha(business_id),
        "ringkas_rating": rt.ringkas_rating(business_id),
        "ulasan": ulasan,
        # Menu aktif beserta rekap suara kewajaran harganya. Wisatawan tidak
        # bisa menilai harga yang tidak pernah ia lihat, jadi daftar ini adalah
        # syarat agar POST /api/umkm/produk/{id}/suara punya jalan masuk.
        "produk": svc.produk_publik(business_id, pengguna.id if pengguna else None),
        "rating_saya": rt.rating_saya(business_id, pengguna.id) if pengguna else None,
        "boleh_menilai": bool(pengguna) and (not pengguna or usaha.get("id") is not None),
    }


@router.put("/api/umkm-publik/{business_id}/rating")
def beri_rating(
    business_id: str,
    req: RatingReq,
    pengguna: Pengguna = Depends(wajib_pengguna),
):
    """Beri atau ubah rating. PUT, bukan POST — operasinya memang idempoten.

    Satu akun satu rating: memanggil ini dua kali mengubah nilai yang sama,
    tidak pernah menambah suara kedua. Pemilihan metode HTTP-nya mengikuti
    sifat itu supaya kontraknya jelas dari luar.
    """
    return rt.simpan_rating(business_id, pengguna.id, req.rating, req.komentar)


@router.delete("/api/umkm-publik/{business_id}/rating")
def hapus_rating(business_id: str, pengguna: Pengguna = Depends(wajib_pengguna)):
    return rt.hapus_rating(business_id, pengguna.id)


@router.get("/api/saya/rating")
def rating_saya_semua(pengguna: Pengguna = Depends(wajib_pengguna)):
    """Riwayat penilaian milik pemanggil — untuk halaman sisi wisatawan."""
    if not db.aktif():
        return {"rating": []}
    baris = db.pilih("umkm_rating", {
        "user_id": f"eq.{pengguna.id}",
        "select": "business_id,rating,komentar,updated_at",
        "order": "updated_at.desc",
        "limit": "100",
    })
    if not baris:
        return {"rating": []}
    ids = ",".join({b["business_id"] for b in baris})
    usaha = db.pilih("umkm_business", {
        "id": f"in.({ids})", "select": "id,place_name,kabupaten", "limit": "200",
    })
    nama = {u["id"]: u for u in usaha}
    for b in baris:
        u = nama.get(b["business_id"]) or {}
        b["nama_usaha"] = u.get("place_name")
        b["kabupaten"] = u.get("kabupaten")
    return {"rating": baris}


# ---------------------------------------------------------------------------
# Aspirasi — UMKM mengirim
# ---------------------------------------------------------------------------
_umkm = Depends(wajib_peran("UMKM"))
_gov = Depends(wajib_peran("GOV"))


@router.get("/api/aspirasi/saya")
def aspirasi_saya(pengguna: Pengguna = _umkm):
    usaha = svc.usaha_milik(pengguna.id)
    return {"aspirasi": asp.aspirasi_usaha(usaha["id"])}


@router.post("/api/aspirasi", status_code=201)
def kirim_aspirasi(req: AspirasiReq, pengguna: Pengguna = _umkm):
    usaha = svc.usaha_milik(pengguna.id)
    return {"aspirasi": asp.kirim_aspirasi(usaha, req.kategori, req.judul, req.isi)}


# ---------------------------------------------------------------------------
# Aspirasi — pemerintah membaca & menanggapi
# ---------------------------------------------------------------------------
@router.get("/api/aspirasi")
def kotak_masuk(
    status: str = Query("SEMUA"),
    kabupaten: Optional[str] = Query(None),
    pengguna: Pengguna = _gov,
):
    """Kotak masuk dinas.

    Pegawai GOV yang profilnya terikat satu kabupaten hanya melihat wilayahnya;
    ADMIN dan GOV tanpa kabupaten melihat semuanya. Penyaringan dilakukan di
    server, bukan di UI — kalau tidak, datanya tetap terkirim ke browser.
    """
    wilayah = kabupaten or (None if pengguna.peran == "ADMIN" else pengguna.kabupaten)
    return {
        "aspirasi": asp.aspirasi_masuk(wilayah, status),
        "ringkas": asp.ringkas_aspirasi(wilayah),
        "kabupaten": wilayah,
    }


@router.post("/api/aspirasi/{aspirasi_id}/tanggapan")
def tanggapi(aspirasi_id: str, req: TanggapanReq, pengguna: Pengguna = _gov):
    return {"aspirasi": asp.tanggapi_aspirasi(
        aspirasi_id, req.status, req.tanggapan, pengguna.id)}


# ---------------------------------------------------------------------------
# Laporan lapangan — pemerintah membaca & menanggapi
# ---------------------------------------------------------------------------
@router.get("/api/laporan")
def laporan_masuk(
    status: str = Query("SEMUA"),
    kategori: str = Query("SEMUA"),
    kabupaten: Optional[str] = Query(None),
    pengguna: Pengguna = _gov,
):
    """Kotak masuk laporan wisatawan.

    Penyaringan wilayah mengikuti aturan yang sama dengan kotak masuk aspirasi
    dan dilakukan di server dengan alasan yang sama.

    Isinya dibaca dari view `laporan_lapangan_gov`, yang tidak membawa
    `ulasan_id` — jadi tidak ada rute apa pun dari layar ini menuju identitas
    pelapor, bahkan bagi ADMIN. Itu ditegakkan skema, bukan oleh daftar kolom
    yang harus diingat setiap kali kueri baru ditulis.
    """
    wilayah = kabupaten or (None if pengguna.peran == "ADMIN" else pengguna.kabupaten)
    return {
        "laporan": lap.kotak_masuk(wilayah, status, kategori),
        "kabupaten": wilayah,
        "kategori": lap.KATEGORI_LAPANGAN,
        "status_tersedia": lap.STATUS,
    }


@router.post("/api/laporan/{laporan_id}/tanggapan")
def tanggapi_laporan(laporan_id: str, req: TanggapanLaporanReq,
                     pengguna: Pengguna = _gov):
    """Balas atau ubah status satu laporan.

    Tanggapan dinas TIDAK pernah menyentuh skor usaha mana pun — termasuk
    laporan TARIF_TIDAK_RESMI. Status harga tetap ditentukan `price_check`
    yang murni statistik, karena keputusan yang bisa digerakkan sepuluh akun
    tidak bisa dipertanggungjawabkan ke pemilik warung yang ditandai.
    """
    return {"laporan": lap.tanggapi(
        laporan_id, req.status, req.tanggapan, pengguna.id)}


# ---------------------------------------------------------------------------
# Pengumuman
# ---------------------------------------------------------------------------
@router.get("/api/pengumuman")
def pengumuman_untuk_saya(pengguna: Pengguna = Depends(wajib_pengguna)):
    """Pengumuman yang berlaku bagi pemanggil.

    UMKM melihat pengumuman wilayahnya + yang berlaku nasional. GOV melihat
    daftar terbitannya sendiri lewat endpoint terpisah di bawah.
    """
    kabupaten = pengguna.kabupaten
    if pengguna.peran == "UMKM":
        usaha = svc.usaha_milik(pengguna.id, wajib=False)
        if usaha:
            kabupaten = usaha.get("kabupaten") or kabupaten
    return {"pengumuman": asp.pengumuman_untuk(kabupaten)}


@router.get("/api/pengumuman/kelola")
def daftar_kelola(pengguna: Pengguna = _gov):
    wilayah = None if pengguna.peran == "ADMIN" else pengguna.kabupaten
    return {"pengumuman": asp.pengumuman_saya(pengguna.id, wilayah)}


@router.post("/api/pengumuman", status_code=201)
def terbitkan(req: PengumumanReq, pengguna: Pengguna = _gov):
    return {"pengumuman": asp.buat_pengumuman(
        oleh=pengguna.id,
        instansi=req.instansi,
        kabupaten=req.kabupaten or pengguna.kabupaten,
        jenis=req.jenis,
        judul=req.judul,
        isi=req.isi,
        nilai_bantuan=req.nilai_bantuan,
        cara_daftar=req.cara_daftar,
        tenggat=req.tenggat,
    )}


@router.patch("/api/pengumuman/{pengumuman_id}")
def ubah(pengumuman_id: str, req: PengumumanPatch, _: Pengguna = _gov):
    return {"pengumuman": asp.ubah_pengumuman(pengumuman_id, req.aktif)}
