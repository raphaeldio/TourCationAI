from typing import List, Optional

from pydantic import BaseModel


class ItineraryReq(BaseModel):
    budget_total: int = 5_000_000
    n_days: int = 3
    n_nights: int = 2
    n_orang: int = 2
    minat_wisata: Optional[List[str]] = None
    max_attractions_per_day: int = 3
    profil_pilihan: Optional[str] = None
    use_osrm: bool = True
    # Titik pangkal rute saat turis tidak menginap.
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    moda: str = "mobil"                       # jalan_kaki | motor | mobil | umum
    tanggal_mulai: Optional[str] = None       # "YYYY-MM-DD"; aktifkan filter libur mingguan
    gaya_jelajah: Optional[str] = None        # Dekat-dekat | Seimbang | Jelajah jauh
    # Bila diisi, rencana disusun ULANG dengan hotel ini sebagai acuan jarak.
    hotel_pilihan: Optional[str] = None
