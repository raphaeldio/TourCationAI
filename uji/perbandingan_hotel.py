"""Perbandingan langsung: pemilihan hotel LAMA (greedy, harga bertanda positif)
versus BARU (proxy kedekatan + ILP multi-kandidat).

Cara kerjanya: rumus lama direproduksi di sini untuk menentukan hotel mana yang
DULU akan terpilih, lalu rencana dengan hotel itu disusun ulang lewat
`hotel_pilihan` — sehingga keduanya dibandingkan pada engine yang sama persis.
"""
import json
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

from engine import (  # noqa: E402
    BudgetSolverV3, FerryDetector, ItineraryRequest, build_daily_routes,
    hitung_jumlah_kamar,
)

solver = BudgetSolverV3(DATA)
ferry = FerryDetector(DATA)


def hotel_lama(req):
    """Reproduksi `_pick_hotel()` versi lama: skor kualitas dengan suku harga POSITIF."""
    h = solver.hotels.copy()
    n_kamar = hitung_jumlah_kamar(req.n_orang)
    if req.n_nights > 0:
        muat = h[h["harga_max"] * n_kamar * req.n_nights <= req.budget_total * 0.5]
        if not muat.empty:
            h = muat
    ref = h["harga_min"].max()
    h["skor"] = h.apply(
        lambda r: BudgetSolverV3._quality_score(r["place-rating"], r["harga_min"], ref),
        axis=1)
    return h.sort_values("skor", ascending=False).iloc[0]["place-name"]


def ukur(r, hari):
    rute = build_daily_routes(r, hari, use_osrm=False, ferry_detector=ferry)
    return {
        "hotel": r["hotel"][0]["place-name"][:34],
        "harga_hotel": int(r["hotel"][0]["harga_tengah"]),
        "total": r["total_estimasi"],
        "jarak_wisata": r["jarak_rata2_wisata_ke_hotel"],
        "km_rute": rute["total_jarak_semua_hari_km"],
        "feri": rute["total_penyeberangan"],
        "n_wisata": r["jumlah_wisata"],
        "rating": round(statistics.mean(a["place-rating"] for a in r["attractions"]), 3),
        "umkm": r["dampak_lokal"].get("proporsi_umkm"),
    }


baris = []
for bud, hari, org in [(1_500_000, 2, 2), (3_000_000, 3, 2), (5_000_000, 3, 2),
                       (8_000_000, 4, 2), (12_000_000, 5, 4)]:
    def buat(**kw):
        return ItineraryRequest(budget_total=bud, n_days=hari, n_nights=hari - 1,
                                n_orang=org, moda="mobil", use_osrm=False, **kw)

    baru = solver.solve(buat())
    lama = solver.solve(buat(hotel_pilihan=hotel_lama(buat())))
    if baru["status"] != "Optimal" or lama["status"] != "Optimal":
        continue
    a, b = ukur(lama, hari), ukur(baru, hari)
    baris.append({
        "skenario": f"Rp{bud // 1_000_000}jt / {hari} hari / {org} org",
        "lama": a, "baru": b,
        "selisih": {
            "biaya": b["total"] - a["total"],
            "hemat_persen": round((a["total"] - b["total"]) / a["total"] * 100, 1),
            "jarak_wisata": round(b["jarak_wisata"] - a["jarak_wisata"], 2),
            "km_rute": round(b["km_rute"] - a["km_rute"], 2),
            "feri": b["feri"] - a["feri"],
            "rating": round(b["rating"] - a["rating"], 3),
            "n_wisata": b["n_wisata"] - a["n_wisata"],
        },
    })

print(json.dumps({
    "perbandingan": baris,
    "ringkasan": {
        "rata2_hemat_persen": round(statistics.mean(
            x["selisih"]["hemat_persen"] for x in baris), 1),
        "total_hemat_rupiah": sum(-x["selisih"]["biaya"] for x in baris),
        "rata2_selisih_jarak_wisata_km": round(statistics.mean(
            x["selisih"]["jarak_wisata"] for x in baris), 2),
        "rata2_selisih_rating": round(statistics.mean(
            x["selisih"]["rating"] for x in baris), 4),
        "total_selisih_feri": sum(x["selisih"]["feri"] for x in baris),
    },
}, indent=2, ensure_ascii=False))
