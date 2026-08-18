from typing import Literal, Optional

from pydantic import BaseModel, Field


class SimulasiReq(BaseModel):
    skenario: Literal[
        "festival", "promosi", "pelatihan_umkm", "destinasi_baru", "budaya"
    ]
    kabupaten: str
    # Menentukan porsi belanja yang jatuh ke usaha lokal; memakai profil yang
    # sama dengan solver itinerary agar dua bagian produk ini konsisten.
    profil: Optional[str] = "Seimbang"

    # -- festival --
    skala: Literal["lokal", "regional", "nasional"] = "regional"
    waktu: Literal["puncak", "biasa", "sepi"] = "biasa"

    # -- promosi --
    anggaran: int = Field(default=1_000_000_000, ge=0, le=1_000_000_000_000)
    jangkauan: Literal["lokal", "nasional", "internasional"] = "nasional"

    # -- pelatihan UMKM --
    n_terlatih: int = Field(default=50, ge=0, le=100_000)

    # -- destinasi baru --
    n_destinasi_baru: int = Field(default=3, ge=0, le=500)
    kategori_baru: Literal["Alam", "Budaya", "Rohani", "Rekreasi"] = "Budaya"

    # -- program budaya --
    n_program: int = Field(default=3, ge=0, le=100)
