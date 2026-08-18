from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..core.paths import engine
from ..core.security import Pengguna, pengguna_opsional
from ..schemas.itinerary import ItineraryReq
from ..services.itinerary_shape import build_itinerary_payload
from ..services.logging_service import catat_itinerary
from ..services.rekomendasi_lainnya import lampirkan as lampirkan_rekomendasi_lainnya
from ..services.solver_state import get_solver
from ..services.tautan_usaha import lampirkan as lampirkan_tautan_usaha

router = APIRouter()


def _bobot_jelajah(nama: Optional[str]) -> dict:
    """Gaya jelajah -> distance_penalty_weight; kosong bila nama tak dikenal."""
    info = engine.GAYA_JELAJAH.get(str(nama or "").strip())
    return {"distance_penalty_weight": info["bobot"]} if info else {}


@router.post("/api/itinerary")
def buat_itinerary(
    req: ItineraryReq,
    tugas: BackgroundTasks,
    pengguna: Optional[Pengguna] = Depends(pengguna_opsional),
):
    """Endpoint ini TETAP PUBLIK.

    `pengguna_opsional` tidak menggerbangi apa pun — ia hanya melampirkan
    `user_id` pada catatan analitik bila kebetulan ada token yang sah. Tanpa
    token, itinerary tetap disusun dan tetap dicatat secara anonim.
    """
    if req.budget_total <= 0:
        raise HTTPException(400, "Budget harus lebih dari 0.")
    solver, ferry, fasilitas = get_solver()
    id_pengguna = pengguna.id if pengguna else None
    try:
        ereq = engine.ItineraryRequest(
            budget_total=int(req.budget_total),
            n_days=int(req.n_days),
            n_nights=int(req.n_nights),
            n_orang=max(int(req.n_orang), 1),
            minat_wisata=req.minat_wisata or None,
            max_attractions_per_day=max(int(req.max_attractions_per_day), 1),
            profil_pilihan=req.profil_pilihan,
            use_osrm=bool(req.use_osrm),
            origin_lat=req.origin_lat,
            origin_lon=req.origin_lon,
            moda=req.moda,
            tanggal_mulai=req.tanggal_mulai,
            hotel_pilihan=req.hotel_pilihan,
            **_bobot_jelajah(req.gaya_jelajah),
        )
        result = solver.solve(ereq)
        if result.get("status") != "Optimal":
            gagal = {"status": result.get("status"),
                     "message": result.get("message", "Solver tidak menemukan solusi "
                                           "dalam batasan ini. Coba naikkan budget/durasi.")}
            # Permintaan yang tak terpenuhi ikut dicatat: kombinasi budget dan
            # durasi yang selalu gagal adalah sinyal kesenjangan yang nyata
            # bagi dashboard pemerintah, dan hilang kalau hanya sukses dicatat.
            tugas.add_task(catat_itinerary, req.model_dump(), gagal, id_pengguna)
            return gagal
        routed = engine.build_daily_routes(
            result, n_days=ereq.n_days, use_osrm=ereq.use_osrm, ferry_detector=ferry,
            jadwal=solver.jadwal, tanggal_mulai=ereq.tanggal_mulai)
        payload = build_itinerary_payload(result, routed)
        # Dicatat SEBELUM slot pemerataan dilampirkan: yang masuk analitik
        # pemerintah harus permintaan nyata, bukan paparan bantuan.
        #
        # Dua jalur, dan bedanya disengaja:
        #
        #   anonim      -> BackgroundTasks. Tidak ada yang butuh id-nya, jadi
        #                  latensi database tidak perlu ikut ditanggung respons.
        #   sudah masuk -> LANGSUNG, karena `itinerary_id` harus ada di jawaban
        #                  agar tombol Simpan punya sasaran. Menjalankannya di
        #                  latar belakang berarti klien menerima rencana yang
        #                  belum punya id, dan menekan Simpan sedetik kemudian
        #                  akan menabrak baris yang belum ada.
        #
        # Biayanya satu INSERT untuk pengguna yang baru saja menunggu solver
        # ILP selesai; itu tidak terasa. Kegagalannya pun tidak fatal —
        # `catat_itinerary` tidak pernah melempar dan mengembalikan None,
        # sehingga rencananya tetap terkirim utuh tanpa id.
        if id_pengguna:
            payload["itinerary_id"] = catat_itinerary(
                req.model_dump(), payload, id_pengguna)
        else:
            tugas.add_task(catat_itinerary, req.model_dump(), payload, id_pengguna)
        # Ditempel PALING AKHIR, hanya sebagai kunci baru di tingkat atas.
        # Rute, biaya, agenda, dan total jarak sudah final di titik ini.
        payload = lampirkan_rekomendasi_lainnya(payload)
        # Tautan nama tempat -> akun UMKM yang mengklaimnya, supaya rumah makan
        # pada rencana utama ikut bisa dinilai. Sama-sama kunci baru saja.
        payload = lampirkan_tautan_usaha(payload, id_pengguna)
        return payload
    except Exception as e:  # noqa: BLE001 — kirim pesan yang bisa dibaca ke UI
        raise HTTPException(500, f"Gagal menyusun itinerary: {e}")
