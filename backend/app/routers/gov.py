"""Tindakan dinas atas usaha di wilayahnya — verifikasi identitas dan kotak masuk.

Terpisah dari `routers/intel.py` dengan sengaja. Router intel menerbitkan ANGKA:
seluruh endpointnya baca-saja dan tidak satu pun mengubah keadaan siapa pun.
Router ini MENULIS, dan yang ditulisnya menyangkut akun orang lain. Menggabungkan
keduanya membuat satu berkas yang sebagian isinya tidak berbahaya dan sebagian
sangat berbahaya, dan perbedaan itu tidak lagi terlihat dari nama modulnya.

Penjaga peran dipasang di tingkat router — pola yang sama dengan `intel.py` —
supaya endpoint yang ditambahkan belakangan tidak bisa lupa dijaga.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from ..core.security import Pengguna, wajib_peran
from ..schemas.verifikasi import KeputusanVerifikasiReq
from ..services import notifikasi, verifikasi as vrf

router = APIRouter(prefix="/api/gov", dependencies=[Depends(wajib_peran("GOV"))])


@router.get("/verifikasi")
def daftar_verifikasi(
    hanya_belum: bool = Query(False, description="Hanya yang belum terverifikasi."),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Usaha di wilayah kerja pemanggil beserta status verifikasinya.

    Petugas tanpa wilayah kerja mendapat **403 dengan pesan yang menyebut apa
    yang harus dilakukan**, bukan daftar kosong. Daftar kosong akan dibaca
    sebagai "belum ada usaha di kabupaten saya" — kesimpulan yang salah, dan
    yang membuat orang menunggu alih-alih menghubungi admin.
    """
    return vrf.daftar(pengguna.peran, pengguna.kabupaten, hanya_belum)


@router.post("/verifikasi/{business_id}")
def putuskan_verifikasi(
    business_id: str,
    req: KeputusanVerifikasiReq,
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Tandai atau cabut verifikasi satu usaha.

    Yang berubah hanyalah `umkm_business.verified` beserta kolom auditnya —
    peran pemilik, keberadaan usahanya, dan produknya tidak tersentuh. Verifikasi
    di sini menyatakan IDENTITAS, bukan hak berusaha: usaha yang belum
    terverifikasi tetap bisa mengisi menu dan tetap muncul di platform.

    Efek nyatanya dua: lencana terverifikasi bagi wisatawan, dan seperempat
    komponen kelengkapan pada skor verifikasi harga tiap produknya — 0,05 dari
    total. Skor produk dihitung ulang seketika supaya pemiliknya tidak melihat
    angka lama.
    """
    hasil = vrf.putuskan(
        business_id=business_id,
        peran=pengguna.peran,
        kabupaten=pengguna.kabupaten,
        petugas_id=pengguna.id,
        setuju=req.setuju,
        catatan=req.catatan,
    )
    # Percobaan kirim langsung supaya pemberitahuan tidak menunggu admin
    # menyiram antrean. Gagal di sini tidak apa-apa: barisnya sudah tersimpan.
    notifikasi.kirim_tertunda()
    return hasil


@router.get("/notifikasi")
def kotak_masuk(
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
    batas: int = Query(50, ge=1, le=200),
):
    """Pemberitahuan untuk wilayah pemanggil, apa pun status pengirimannya.

    Status pengiriman ikut ditampilkan dengan sengaja. Petugas berhak tahu bahwa
    sebuah pemberitahuan TERCATAT tetapi surelnya belum sampai — tanpa itu,
    SMTP yang mati terlihat persis sama dengan tidak ada kabar apa pun.

    ADMIN (yang selalu lolos penjaga GOV) melihat seluruh wilayah.
    """
    wilayah: Optional[str] = None if pengguna.peran == "ADMIN" else pengguna.kabupaten
    return {
        "wilayah": wilayah,
        "notifikasi": notifikasi.kotak_masuk(wilayah, batas),
        "pengiriman_surel_aktif": notifikasi.pengiriman_aktif(),
    }
