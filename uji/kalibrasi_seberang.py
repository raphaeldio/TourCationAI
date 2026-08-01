"""Kalibrasi PENALTI_SEBERANG_KM.

Menyapu beberapa nilai bobot dan melaporkan akibatnya pada penyeberangan feri,
kerapatan rute, rating, dan biaya — supaya nilainya dipilih dari hasil, bukan
dari tebakan berapa kilometer 'setara' satu perjalanan feri.
"""
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

import engine  # noqa: E402
from engine import (  # noqa: E402
    BudgetSolverV3, FerryDetector, ItineraryRequest, build_daily_routes,
)

solver = BudgetSolverV3(DATA)
ferry = FerryDetector(DATA)

SKENARIO = [
    (b, h, m, o)
    for b, h in [(1_500_000, 2), (3_000_000, 3), (5_000_000, 3),
                 (8_000_000, 4), (12_000_000, 5)]
    for m in [None, ["Alam"], ["Budaya"]]
    for o in [2, 4]
]

asli = engine.PENALTI_SEBERANG_KM
print(f"{'penalti':>8} | {'feri':>5} {'maks':>4} | {'km/hari med':>11} {'rata2':>6} | "
      f"{'rating':>6} | {'biaya rata2':>12}")
print("-" * 72)
try:
    for pen in (0.0, 10.0, 12.0, 15.0, 20.0, 25.0, 30.0, 60.0):
        engine.PENALTI_SEBERANG_KM = pen
        feri, km, rat, tot = [], [], [], []
        for b, h, m, o in SKENARIO:
            r = solver.solve(ItineraryRequest(
                budget_total=b, n_days=h, n_nights=h - 1, n_orang=o,
                moda="mobil", use_osrm=False, minat_wisata=m))
            if r["status"] != "Optimal":
                continue
            rute = build_daily_routes(r, h, use_osrm=False, ferry_detector=ferry)
            feri.append(rute["total_penyeberangan"])
            km.append(rute["total_jarak_semua_hari_km"] / h)
            rat.append(statistics.mean(a["place-rating"] for a in r["attractions"]))
            tot.append(r["total_estimasi"])
        tandai = " <- dipakai" if pen == asli else ""
        print(f"{pen:8.1f} | {statistics.mean(feri):5.2f} {max(feri):4} | "
              f"{statistics.median(km):11.1f} {statistics.mean(km):6.1f} | "
              f"{statistics.mean(rat):6.3f} | {int(statistics.mean(tot)):12,}{tandai}")
finally:
    engine.PENALTI_SEBERANG_KM = asli
