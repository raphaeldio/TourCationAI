"""Perjalanan dan ulasan pasca-perjalanan — sisi wisatawan.

    GET    /api/saya/perjalanan          inbox perjalanan milik pemanggil
    GET    /api/saya/ulasan-perjalanan   riwayat ulasan milik pemanggil
    GET    /api/perjalanan/{id}          buka rencana yang tersimpan
    PUT    /api/perjalanan/{id}/simpan   simpan / perbarui rencana
    DELETE /api/perjalanan/{id}/simpan   buang simpanan
    GET    /api/perjalanan/{id}/ulasan   isi formulir (tempat + ulasan lama)
    POST   /api/perjalanan/{id}/ulasan   kirim ulasan

Seluruhnya menuntut akun. Tidak ada endpoint publik di sini, dan itu memang
konsekuensi yang benar: perjalanan tanpa akun tidak punya pemilik, dan ulasan
tanpa pemilik tidak bisa dibatasi satu per perjalanan.
"""

from fastapi import APIRouter, Depends

from ..core.security import Pengguna, wajib_pengguna
from ..schemas.perjalanan import SimpanPerjalananReq, UlasanPerjalananReq
from ..services import perjalanan as svc
from ..services import simpanan as smp

router = APIRouter()


@router.get("/api/saya/perjalanan")
def perjalanan_saya(pengguna: Pengguna = Depends(wajib_pengguna)):
    """Perjalanan milik pemanggil beserta status dan tanda sudah diulas.

    `boleh_diulas` dihitung di server, bukan di UI. Kalau tombolnya hanya
    disembunyikan di frontend, POST tetap bisa dipanggil langsung — dan ulasan
    untuk perjalanan yang belum terjadi adalah persis jenis data yang membuat
    seluruh bukti lapangan tidak bisa dipercaya.
    """
    return {"perjalanan": svc.daftar_perjalanan(pengguna.id)}


@router.get("/api/saya/ulasan-perjalanan")
def ulasan_perjalanan_saya(pengguna: Pengguna = Depends(wajib_pengguna)):
    return {"ulasan": svc.ulasan_saya(pengguna.id)}


@router.put("/api/perjalanan/{itinerary_id}/simpan")
def simpan_perjalanan(itinerary_id: str, req: SimpanPerjalananReq,
                      pengguna: Pengguna = Depends(wajib_pengguna)):
    """Simpan rencana ke inbox pemanggil.

    PUT, bukan POST — operasinya idempoten. Satu itinerary punya paling banyak
    satu simpanan (primary key di database), jadi menekan Simpan dua kali
    memperbarui judul yang sama alih-alih menambah baris kedua. Pemilihan
    metode HTTP-nya mengikuti sifat itu supaya kontraknya jelas dari luar,
    sama seperti `PUT /api/umkm-publik/{id}/rating`.
    """
    return smp.simpan(itinerary_id, pengguna.id, req.payload, req.judul)


@router.get("/api/perjalanan/{itinerary_id}")
def buka_perjalanan(itinerary_id: str, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Rencana tersimpan, apa adanya seperti saat disimpan.

    Solver TIDAK dipanggil di sini. Menyusun ulang akan menghasilkan rencana
    yang berbeda begitu dataset atau harga acuan berubah — dan rencana yang
    berubah sendiri setelah disimpan bukan rencana yang disimpan.
    """
    return smp.ambil(itinerary_id, pengguna.id)


@router.delete("/api/perjalanan/{itinerary_id}/simpan")
def hapus_simpanan(itinerary_id: str, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Buang simpanan; jejak analitik dan ulasannya tetap ada.

    Agregat kabupaten yang sudah terhitung tidak boleh berubah surut hanya
    karena satu orang merapikan inbox-nya, dan laporan yang sudah masuk ke
    dinas bukan milik pelapor lagi.
    """
    return smp.hapus(itinerary_id, pengguna.id)


@router.get("/api/perjalanan/{itinerary_id}/ulasan")
def detail_ulasan(itinerary_id: str, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Isi halaman ulasan.

    Daftar tempat datang dari server supaya wisatawan tidak mengetik satu pun
    nama tempat: nama yang masuk laporan harus sama persis dengan yang dipakai
    dataset agar bisa dijoin ke `umkm_business` dan diagregasi per kabupaten.
    """
    return svc.detail_ulasan(itinerary_id, pengguna.id)


@router.post("/api/perjalanan/{itinerary_id}/ulasan", status_code=201)
def kirim_ulasan(itinerary_id: str, req: UlasanPerjalananReq,
                 pengguna: Pengguna = Depends(wajib_pengguna)):
    """Kirim ulasan perjalanan, laporan lapangan, dan penilaian usaha sekaligus.

    409 bila perjalanan sudah pernah diulas. Sengaja bukan pembaruan diam-diam:
    ulasan yang bisa ditulis ulang berkali-kali membuat agregat lapangan
    bergerak tanpa jejak, dan dinas tidak punya cara tahu angka mana yang
    pernah ia baca.
    """
    return svc.simpan_ulasan(itinerary_id, pengguna.id, req)
