"""Bentuk permintaan untuk verifikasi usaha oleh dinas."""

from typing import Optional

from pydantic import BaseModel, Field


class KeputusanVerifikasiReq(BaseModel):
    """Tandai atau cabut verifikasi satu usaha.

    `catatan` opsional saat menandai, tetapi sangat dianjurkan saat MENCABUT —
    pemilik usaha berhak tahu dasarnya, dan kolom audit tanpa alasan tidak bisa
    dipertanggungjawabkan ketika ada sengketa. Kewajiban itu tidak ditegakkan di
    sini melainkan dibiarkan sebagai kebiasaan: menolak permintaan tanpa catatan
    akan membuat petugas menulis titik satu buah, dan catatan palsu lebih buruk
    daripada catatan kosong yang jujur.
    """

    setuju: bool
    catatan: Optional[str] = Field(default=None, max_length=400)


class WilayahPetugasReq(BaseModel):
    """Tetapkan wilayah kerja satu akun GOV. Hanya ADMIN.

    Peran GOV datang dari domain surel dan aktif seketika, tetapi WILAYAH-nya
    tidak bisa ikut disimpulkan dari sana: `dishub@tobakab.go.id` tidak lebih
    membuktikan wewenang atas Toba daripada atas Samosir. Karena itu wilayah
    ditetapkan terpisah, dan hanya oleh ADMIN — kalau pemegang akun bisa
    memilihnya sendiri, pembatasan verifikasi per kabupaten kehilangan artinya.

    `kabupaten` boleh None untuk MENCABUT wilayah, yang efeknya membuat akun itu
    tidak bisa memverifikasi apa pun lagi.
    """

    user_id: str = Field(min_length=1, max_length=64)
    kabupaten: Optional[str] = Field(default=None, max_length=100)
