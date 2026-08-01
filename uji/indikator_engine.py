"""Uji indikator keberhasilan engine TourCation AI.

Menjalankan matriks skenario lewat solver + route builder, lalu melaporkan
metrik yang bisa diverifikasi: kepatuhan budget, keterpenuhan minat, kerapatan
rute, keberpihakan UMKM, dan waktu komputasi.
"""
import json
import statistics
import sys
from pathlib import Path
import time

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

from engine import (  # noqa: E402
    BudgetSolverV3,
    FerryDetector,
    ItineraryRequest,
    JadwalOperasional,
    build_daily_routes,
    hitung_biaya_transport,
)

solver = BudgetSolverV3(DATA)
ferry = FerryDetector(DATA)
jadwal = JadwalOperasional(DATA)

SKENARIO = []
for budget, hari in [(1_500_000, 2), (3_000_000, 3), (5_000_000, 3),
                     (8_000_000, 4), (12_000_000, 5), (2_000_000, 1)]:
    for minat in [None, ["Alam"], ["Budaya"], ["Rohani"], ["Alam", "Budaya"]]:
        for orang in [1, 2, 4]:
            SKENARIO.append((budget, hari, minat, orang))

hasil = []
t0 = time.time()
for budget, hari, minat, orang in SKENARIO:
    req = ItineraryRequest(
        budget_total=budget,
        n_days=hari,
        n_nights=max(hari - 1, 0),
        minat_wisata=minat,
        n_orang=orang,
        moda="mobil",
        use_osrm=False,          # offline: Haversine, agar hasil dapat direproduksi
        tanggal_mulai="2026-08-03",  # Senin — menguji penutupan mingguan
    )
    t = time.time()
    r = solver.solve(req)
    t_solve = time.time() - t

    row = {"budget": budget, "hari": hari, "minat": minat, "orang": orang,
           "status": r.get("status"), "t_solve": t_solve}

    if r.get("status") == "Optimal":
        t = time.time()
        rute = build_daily_routes(r, hari, use_osrm=False,
                                  ferry_detector=ferry, jadwal=jadwal,
                                  tanggal_mulai=req.tanggal_mulai)
        t_rute = time.time() - t

        km = rute["total_jarak_semua_hari_km"]
        trans = hitung_biaya_transport(km, hari, orang, "mobil",
                                       rute["total_penyeberangan"],
                                       data_dir=DATA)
        d = r["dampak_lokal"]
        row.update({
            "t_rute": t_rute,
            "total_max": r["total_max"],
            "total_estimasi": r["total_estimasi"],
            "patuh_budget": r["total_max"] <= budget,
            "utilisasi": r["total_estimasi"] / budget,
            "n_makan": r["jumlah_makan"],
            "makan_benar": r["jumlah_makan"] == 3 * hari,
            "n_wisata": r["jumlah_wisata"],
            "minat_status": r["minat_status"],
            "sesuai_minat": r["jumlah_wisata_sesuai_minat"],
            "porsi_minat": (r["jumlah_wisata_sesuai_minat"] / r["jumlah_wisata"]
                            if minat else None),
            "rating_wisata": statistics.mean(a["place-rating"] for a in r["attractions"]),
            "rating_resto": statistics.mean(x["place-rating"] for x in r["restos"]),
            "km_total": km,
            "km_per_hari": km / hari,
            "feri": rute["total_penyeberangan"],
            "umkm_porsi": d.get("proporsi_umkm"),
            "ragam_kuliner": d.get("ragam_kuliner_khas"),
            "jam_status": r.get("jam_status"),
            "ditolak_jam": len(r.get("wisata_ditolak_jam") or []),
            "transport_realistis": trans.get("realistis"),
        })
    hasil.append(row)

durasi_total = time.time() - t0
ok = [h for h in hasil if h["status"] == "Optimal"]


def ringkas(kunci, saring=None):
    v = [h[kunci] for h in ok if h.get(kunci) is not None
         and (saring is None or saring(h))]
    if not v:
        return None
    return {"n": len(v), "min": round(min(v), 3), "mean": round(statistics.mean(v), 3),
            "median": round(statistics.median(v), 3), "max": round(max(v), 3)}


laporan = {
    "n_skenario": len(hasil),
    "n_optimal": len(ok),
    "tingkat_keberhasilan": round(len(ok) / len(hasil) * 100, 1),
    "durasi_total_detik": round(durasi_total, 1),
    "patuh_budget_semua": all(h["patuh_budget"] for h in ok),
    "n_langgar_budget": sum(0 if h["patuh_budget"] else 1 for h in ok),
    "makan_benar_semua": all(h["makan_benar"] for h in ok),
    "minat_diterapkan": sum(1 for h in ok if h["minat_status"] == "diterapkan"),
    "minat_dilonggarkan": sum(1 for h in ok if h["minat_status"] == "dilonggarkan"),
    "n_skenario_berminat": sum(1 for h in ok if h["minat"]),
    "porsi_minat_100": sum(1 for h in ok if h.get("porsi_minat") == 1.0),
    "transport_tidak_realistis": sum(1 for h in ok if h.get("transport_realistis") is False),
    "waktu_solve_detik": ringkas("t_solve"),
    "waktu_rute_detik": ringkas("t_rute"),
    "utilisasi_budget": ringkas("utilisasi"),
    "rating_wisata": ringkas("rating_wisata"),
    "rating_resto": ringkas("rating_resto"),
    "km_per_hari": ringkas("km_per_hari"),
    "umkm_porsi": ringkas("umkm_porsi"),
    "ragam_kuliner": ringkas("ragam_kuliner"),
    "feri": ringkas("feri"),
    "porsi_minat": ringkas("porsi_minat"),
    "ditolak_jam": ringkas("ditolak_jam"),
    "gagal": [{k: h[k] for k in ("budget", "hari", "minat", "orang", "status")}
              for h in hasil if h["status"] != "Optimal"],
}

print(json.dumps(laporan, indent=2, ensure_ascii=False, default=str))
