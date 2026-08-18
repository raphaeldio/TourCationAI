from fastapi import APIRouter

from ..core.paths import engine
from ..services.langganan import daftar_paket

router = APIRouter()


@router.get("/api/meta")
def meta():
    """Pilihan minat, profil, dan gaya jelajah untuk form perencanaan.

    Field "ikon" milik engine (emoji) tidak dikirim: UI menggambar ikon vektor
    sendiri, dan emoji rusak saat diekspor ke PDF.
    """
    return {
        "minat": [
            {"key": k, "deskripsi": v["deskripsi"]}
            for k, v in engine.MINAT_DEF.items()
        ],
        # Bobot ikut dikirim agar UI bisa menjelaskan efek tiap pilihan.
        "profil": [
            {"key": k, "deskripsi": v["deskripsi"], "umkm_weight": v["umkm_weight"]}
            for k, v in engine.PROFIL_DEF.items()
        ],
        "gaya_jelajah": [
            {"key": k, "deskripsi": v["deskripsi"], "bobot": v["bobot"]}
            for k, v in engine.GAYA_JELAJAH.items()
        ],
    }


@router.get("/api/paket")
def paket():
    """Katalog paket langganan — publik, tanpa autentikasi.

    Halaman harga harus bisa dibaca calon pelanggan yang belum punya akun, dan
    isinya memang tidak rahasia. Tidak menyentuh database sama sekali: daftarnya
    konstanta di services/langganan.py.
    """
    return {"paket": daftar_paket()}
