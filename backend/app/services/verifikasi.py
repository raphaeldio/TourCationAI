"""Verifikasi identitas usaha oleh dinas kabupaten.

Sampai sekarang `umkm_business.verified` hanya PERNAH DIBACA — di
`services/umkm.py` (seperempat komponen kelengkapan, jadi 0,05 dari skor
verifikasi harga) dan `services/rating.py` (skor kepercayaan). Tidak ada satu pun
endpoint yang menyetelnya. Modul ini memberinya pemilik.

APA YANG DIVERIFIKASI, DAN APA YANG TIDAK.

Yang diverifikasi: bahwa usaha ini benar ada dan benar dimiliki pemegang akunnya.
Dinas kabupaten punya alat untuk itu — data NIB/izin usaha, dan kemampuan datang
ke lokasi. Admin platform tidak; ia hanya bisa percaya begitu saja. Argumen yang
sama sudah dipakai untuk peran GOV itu sendiri: `routers/auth.py` menolak
permohonan GOV karena domain surel dinas adalah bukti yang lebih baik daripada
penilaian admin.

Yang TIDAK diverifikasi: hak berusaha di platform. Baris `umkm_business` tetap
dibuat saat ADMIN menyetujui klaim, jadi pemilik warung bisa langsung mengisi
menu tanpa menunggu dinas. Pemisahan ini bukan kerapian belaka — ia menutup satu
jalur penyalahgunaan. Kalau verifikasi dan akses digabung, petugas cukup TIDAK
menekan tombol untuk mengucilkan pesaing, dan pengucilan itu tidak diredam bobot
skor mana pun. Dipisah begini, menahan verifikasi hanya menahan lencana.

KENAPA PENGARUHNYA SENGAJA KECIL. Skor verifikasi harga tersusun dari 0,45
statistik + 0,35 komunitas + 0,20 kelengkapan, dan verifikasi dinas hanya
seperempat dari komponen terakhir. Petugas tidak menyentuh uji z maupun suara
komunitas. Artinya petugas yang berpihak pun tidak bisa membuat harga janggal
menjadi terverifikasi — dan itu penting, karena angka yang sama mengalir kembali
ke statistik yang dibaca pemerintah sendiri (`services/selisih_harga.py`). Pihak
yang diukur tidak boleh bisa menyetel alat ukurnya.

PEMBATASAN WILAYAH GAGAL TERTUTUP. Petugas GOV tanpa `kabupaten` tidak bisa
memverifikasi apa pun. Wilayah hanya bisa ditulis lewat jalur admin — endpoint
biodata di `routers/auth.py` sengaja tidak memuatnya — sehingga pemegang akun
tidak bisa memilih wilayahnya sendiri.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from ..db import supabase as db
from . import notifikasi

_log = logging.getLogger(__name__)

BERKAS_MIGRASI = "backend/sql/2026-08-17d_verifikasi_usaha.sql"


def _pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


def wilayah_petugas(peran: str, kabupaten: Optional[str]) -> Optional[str]:
    """Wilayah yang boleh disentuh pemanggil. None untuk ADMIN berarti seluruhnya.

    ADMIN dikecualikan supaya selalu ada jalan memperbaiki keadaan ketika sebuah
    kabupaten belum punya petugas — atau ketika petugasnya keliru menandai. Itu
    bukan lubang: tindakannya tetap tercatat lengkap di kolom audit.
    """
    if peran == "ADMIN":
        return None
    if not kabupaten:
        raise HTTPException(
            403,
            "Akun Anda belum ditetapkan wilayah kerjanya, jadi belum bisa "
            "memverifikasi usaha. Hubungi admin untuk menetapkan kabupaten pada "
            "akun ini.",
        )
    return kabupaten


def daftar(peran: str, kabupaten: Optional[str], hanya_belum: bool = False) -> dict:
    """Usaha di wilayah petugas, beserta status verifikasinya."""
    _pastikan_db()
    wilayah = wilayah_petugas(peran, kabupaten)

    params = {
        "select": (
            "id,place_name,place_name_norm,kabupaten,alamat,telepon,jam_buka,"
            "deskripsi,verified,verified_at,verifikasi_catatan,"
            "verifikasi_oleh_kabupaten,created_at"
        ),
        "order": "created_at.desc",
        "limit": "300",
    }
    if wilayah:
        params["kabupaten"] = f"eq.{wilayah}"
    if hanya_belum:
        params["verified"] = "not.is.true"

    try:
        baris = db.pilih("umkm_business", params)
    except Exception as e:  # noqa: BLE001
        if db.tabel_hilang(e):
            raise HTTPException(
                503,
                f"Kolom verifikasi belum ada di database. Terapkan "
                f"{BERKAS_MIGRASI} lebih dulu.",
            ) from e
        raise

    terverifikasi = sum(1 for b in baris if b.get("verified"))
    return {
        "wilayah": wilayah,
        "usaha": baris,
        "ringkas": {
            "n_usaha": len(baris),
            "n_terverifikasi": terverifikasi,
            "n_menunggu": len(baris) - terverifikasi,
        },
        "catatan": (
            "Verifikasi menyatakan usaha ini benar ada dan benar milik pemegang "
            "akunnya. Ia TIDAK menentukan apakah usaha boleh beroperasi di "
            "platform — itu sudah terjadi saat klaim disetujui — dan tidak "
            "menentukan peringkatnya di itinerary."
        ),
    }


def putuskan(
    business_id: str,
    peran: str,
    kabupaten: Optional[str],
    petugas_id: str,
    setuju: bool,
    catatan: Optional[str] = None,
) -> dict:
    """Tandai atau cabut verifikasi satu usaha.

    Pencabutan disediakan dan sengaja tidak dipersulit: verifikasi yang tidak
    bisa dicabut memaksa petugas ragu untuk menandai apa pun, dan keraguan itu
    berakhir sebagai kolom yang tidak pernah terisi.
    """
    _pastikan_db()
    wilayah = wilayah_petugas(peran, kabupaten)

    usaha = db.satu("umkm_business", {
        "id": f"eq.{business_id}",
        "select": "id,place_name,kabupaten,owner_id,verified",
    })
    if not usaha:
        raise HTTPException(404, "Usaha tidak ditemukan.")

    # Pemeriksaan wilayah dilakukan terhadap kabupaten pada BARIS USAHA, bukan
    # yang tercantum pada permohonan. `role_requests.kabupaten` diisi sendiri
    # oleh pemohon; memakainya berarti pemohon bisa memilih petugas mana yang
    # menangani berkasnya.
    if wilayah and (usaha.get("kabupaten") or "") != wilayah:
        raise HTTPException(
            403,
            f"Usaha ini terdaftar di {usaha.get('kabupaten') or 'wilayah lain'}, "
            f"di luar wilayah kerja Anda ({wilayah}).",
        )

    sekarang = datetime.now(timezone.utc).isoformat()
    bersih = (catatan or "").strip()[:400] or None
    isi = {
        "verified": bool(setuju),
        "verified_by": petugas_id,
        "verified_at": sekarang if setuju else None,
        "verifikasi_catatan": bersih,
        "verifikasi_oleh_kabupaten": wilayah,
    }

    try:
        hasil = db.perbarui(
            "umkm_business", {"id": f"eq.{business_id}"}, isi, kembalikan=True)
    except Exception as e:  # noqa: BLE001
        if db.tabel_hilang(e):
            raise HTTPException(
                503,
                f"Kolom verifikasi belum ada di database. Terapkan "
                f"{BERKAS_MIGRASI} lebih dulu.",
            ) from e
        raise

    baru = hasil[0] if hasil else {**usaha, **isi}

    # Skor verifikasi tiap produk ikut bergerak karena `usaha_terverifikasi`
    # adalah salah satu komponennya — dihitung ulang sekarang supaya pemiliknya
    # tidak melihat angka lama sampai harga berikutnya diedit.
    _hitung_ulang_produk(business_id, baru)

    if setuju:
        notifikasi.antre(
            jenis=notifikasi.JENIS_TERVERIFIKASI,
            judul=f"Usaha terverifikasi: {usaha.get('place_name') or business_id}",
            isi=(
                f"{usaha.get('place_name')} di {usaha.get('kabupaten')} telah "
                f"ditandai terverifikasi pada {sekarang}.\n\n"
                f"Catatan petugas: {bersih or '-'}\n\n"
                "Verifikasi ini menyatakan identitas usaha, bukan kelayakan "
                "harganya. Kewajaran harga tetap dinilai statistik dan komunitas."
            ),
            kabupaten=usaha.get("kabupaten"),
            business_id=business_id,
        )

    return {"usaha": baru, "verified": bool(setuju)}


def _hitung_ulang_produk(business_id: str, usaha: dict) -> None:
    """Hitung ulang skor verifikasi seluruh produk aktif usaha ini."""
    from . import umkm as svc

    try:
        for p in svc.daftar_produk(business_id, hanya_aktif=True):
            svc.nilai_produk(p, usaha)
    except Exception as e:  # noqa: BLE001 — verifikasinya sendiri sudah tersimpan
        _log.warning("Skor produk gagal dihitung ulang setelah verifikasi: %s", e)


def beri_tahu_usaha_baru(usaha: dict) -> int:
    """Antrekan pemberitahuan bahwa ada usaha baru menunggu verifikasi.

    Dipanggil dari jalur persetujuan klaim di `routers/admin.py`. Dipisah ke sini
    supaya router tidak perlu tahu bentuk pesannya.
    """
    return notifikasi.antre(
        jenis=notifikasi.JENIS_TERTUNDA,
        judul=f"Usaha baru menunggu verifikasi: {usaha.get('place_name')}",
        isi=(
            "Usaha berikut telah disetujui masuk platform dan kini menunggu "
            "verifikasi identitas oleh dinas:\n\n"
            f"  Nama      : {usaha.get('place_name')}\n"
            f"  Kabupaten : {usaha.get('kabupaten') or '-'}\n\n"
            "Verifikasi menyatakan usaha ini benar ada dan benar milik pemegang "
            "akunnya. Usaha sudah bisa mengisi menu tanpa menunggu verifikasi — "
            "yang tertahan hanya lencana terverifikasi, bukan hak berusahanya.\n\n"
            "Buka dashboard pemerintah, menu Verifikasi Usaha."
        ),
        kabupaten=usaha.get("kabupaten"),
        business_id=usaha.get("id"),
    )
