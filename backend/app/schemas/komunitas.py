"""Skema untuk rating publik, aspirasi UMKM, dan pengumuman pemerintah."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class RatingReq(BaseModel):
    """Satu akun satu rating; nilai boleh diubah, tidak boleh ditumpuk."""

    rating: int = Field(ge=1, le=5)
    komentar: Optional[str] = Field(default=None, max_length=1000)


class AspirasiReq(BaseModel):
    kategori: Literal[
        "INFRASTRUKTUR", "PERMODALAN", "PELATIHAN", "PROMOSI", "PERIZINAN", "LAINNYA"
    ] = "LAINNYA"
    judul: str = Field(max_length=150)
    isi: str = Field(max_length=2000)


class TanggapanReq(BaseModel):
    status: Literal["BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"]
    tanggapan: Optional[str] = Field(default=None, max_length=2000)


class PengumumanReq(BaseModel):
    jenis: Literal["KEBIJAKAN", "BANTUAN", "PELATIHAN", "EVENT", "LAINNYA"] = "KEBIJAKAN"
    judul: str = Field(max_length=150)
    isi: str = Field(max_length=4000)
    instansi: Optional[str] = Field(default=None, max_length=150)
    # Kosong berarti berlaku untuk seluruh kabupaten.
    kabupaten: Optional[str] = Field(default=None, max_length=100)
    nilai_bantuan: Optional[int] = Field(default=None, ge=0)
    cara_daftar: Optional[str] = Field(default=None, max_length=1000)
    tenggat: Optional[str] = Field(default=None, max_length=10)


class PengumumanPatch(BaseModel):
    aktif: Optional[bool] = None
