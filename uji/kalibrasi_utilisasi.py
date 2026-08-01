"""Kalibrasi budget_utilization_weight (dan _UTIL_BASIS / _UTIL_BOBOT).

Menyapu beberapa nilai bobot insentif utilisasi budget dan melaporkan
akibatnya pada utilisasi budget (dasar tengah & dasar dicadangkan/max) dan
pada rating rata-rata rencana — supaya nilainya dipilih dari hasil, bukan
dari tebakan. Prinsip yang dipakai: ambil bobot tertinggi yang menaikkan
utilisasi TANPA menggerus rating; budget menganggur mestinya jadi upgrade
mutu yang nyata, bukan sekadar item mahal.

Catatan hasil (30 skenario): utilisasi jenuh di ~74% (tengah) / ~91% (max)
bahkan pada bobot ekstrem — inventaris harga menahannya, jadi 100% memang
tidak dikejar dengan mengorbankan kualitas. Nilai 4.0 memberi lonjakan
utilisasi terbesar dengan rating rata-rata praktis tak berubah.
"""
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

from engine import BudgetSolverV3, ItineraryRequest  # noqa: E402

solver = BudgetSolverV3(DATA)

SKENARIO = [
    (b, h, o, m)
    for b, h in [(1_500_000, 1), (2_000_000, 2), (3_000_000, 2),
                 (5_000_000, 3), (8_000_000, 4), (10_000_000, 3)]
    for o in [2, 4]
    for m in [None, ["Alam"]]
]

print(f"{'bobot':>6} | {'util tengah%':>12} {'util max%':>10} | {'rating':>7}")
print("-" * 46)
for w in (0.0, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0):
    est, mx, rat = [], [], []
    for b, h, o, m in SKENARIO:
        r = solver.solve(ItineraryRequest(
            budget_total=b, n_days=h, n_nights=max(h - 1, 0), n_orang=o,
            moda="mobil", use_osrm=False, minat_wisata=m,
            budget_utilization_weight=w))
        if r["status"] != "Optimal":
            continue
        est.append(r["persen_terpakai_estimasi"])
        mx.append(r["total_max"] / r["budget_total"] * 100)
        nilai = ([a["place-rating"] for a in r["attractions"]]
                 + [x["place-rating"] for x in r["restos"]])
        rat.append(statistics.mean(nilai))
    tandai = " <- dipakai" if w == 4.0 else ""
    print(f"{w:6.1f} | {statistics.mean(est):12.1f} {statistics.mean(mx):10.1f} | "
          f"{statistics.mean(rat):7.4f}{tandai}")
