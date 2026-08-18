"""Bentuk permintaan untuk fitur UMKM (F3).

Pydantic hanya menjaga TIPE dan RENTANG di sini. Pembersihan teks — kendali
karakter, batas panjang, penolakan frasa injeksi — dilakukan `core.sanitasi`
supaya pesan galatnya bisa menjelaskan apa yang salah kepada pemilik warung,
bukan sekadar "value error".
"""

from typing import Optional

from pydantic import BaseModel, Field


class UsahaPatch(BaseModel):
    """Profil usaha. `place_name` sengaja tidak bisa diubah di sini —
    ia adalah kunci join ke dataset dan hanya ditetapkan saat approval admin."""

    alamat: Optional[str] = None
    deskripsi: Optional[str] = None
    telepon: Optional[str] = None
    jam_buka: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)


class ProdukReq(BaseModel):
    nama: str
    harga: int = Field(ge=0, le=1_000_000_000)
    deskripsi: Optional[str] = None
    kategori: Optional[str] = None
    is_kuliner_khas: bool = False


class ProdukPatch(BaseModel):
    nama: Optional[str] = None
    harga: Optional[int] = Field(default=None, ge=0, le=1_000_000_000)
    deskripsi: Optional[str] = None
    kategori: Optional[str] = None
    is_kuliner_khas: Optional[bool] = None
    aktif: Optional[bool] = None


class SuaraReq(BaseModel):
    """Penilaian komunitas atas kewajaran harga: setuju / abstain / tidak."""

    vote: int = Field(ge=-1, le=1)
    komentar: Optional[str] = None
