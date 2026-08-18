"""Endpoint simulasi dampak kebijakan (Fitur 4).

Murni aritmetika Python — tidak memanggil LLM dan tidak butuh kunci API.
Narasi AI ditambahkan terpisah nanti dan sifatnya melengkapi: seluruh angka,
grafik, dan panel asumsi tetap tampil utuh tanpanya.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.paths import engine
from ..core.security import Pengguna, wajib_peran
from ..schemas.insight import NarasiSimulasi
from ..schemas.simulasi import SimulasiReq
from ..services import ai_fakta
from ..services.ai_insight import hasilkan
from ..services.analytics import get_intel
from ..services.simulator import SKENARIO, jalankan_simulasi

# Simulasi kebijakan adalah alat pemerintah; dijaga di tingkat router.
router = APIRouter(prefix="/api/simulasi", dependencies=[Depends(wajib_peran("GOV"))])


@router.get("/opsi")
def opsi_simulasi():
    """Pilihan yang tersedia untuk form simulasi."""
    intel = get_intel()
    return {
        "skenario": [{"kunci": k, "label": v} for k, v in SKENARIO.items()],
        "kabupaten": [
            {
                "nama": s["kabupaten"],
                "wisatawan_2024": int(s["wisatawan_2024"]) if s["wisatawan_2024"] else None,
                "diimputasi": s["wisatawan_diimputasi"],
                "n_destinasi": s["n_destinasi"],
                "n_umkm": s["n_umkm"],
                "n_umkm_kuat": s["n_umkm_kuat"],
                "musim_puncak": s["musim_puncak"],
            }
            for s in intel.daftar_kabupaten()
        ],
        "profil": [
            {"kunci": k, "umkm_weight": v["umkm_weight"], "deskripsi": v["deskripsi"]}
            for k, v in engine.PROFIL_DEF.items()
        ],
        "kategori": list(engine.MINAT_DEF.keys()),
    }


@router.post("")
def simulasi(req: SimulasiReq):
    try:
        return jalankan_simulasi(req.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/narasi")
def simulasi_narasi(
    req: SimulasiReq,
    request: Request,
    refresh: bool = Query(False, description="Paksa buat ulang; hanya untuk ADMIN."),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Penjelasan AI atas satu hasil simulasi.

    Rule engine dijalankan ulang di sini alih-alih menerima hasil dari klien.
    Itu disengaja: kalau angka datang dari browser, siapa pun bisa mengirim
    angka karangan lalu meminta AI menuliskannya seolah hasil model.
    """
    try:
        hasil = jalankan_simulasi(req.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))

    narasi = hasilkan(
        fitur="simulasi",
        scope=f"{hasil['skenario']}:{hasil['kabupaten']}",
        fakta=ai_fakta.fakta_simulasi(hasil),
        petunjuk=ai_fakta.PETUNJUK_SIMULASI,
        model_hasil=NarasiSimulasi,
        request=request,
        user_id=pengguna.id,
        refresh=refresh and pengguna.peran == "ADMIN",
    )
    return {"hasil": hasil, **narasi}
