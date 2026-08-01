"""Audit formulasi model: dekomposisi koefisien, sensitivitas bobot,
dan celah optimalitas akibat hotel dipilih greedy di luar ILP."""
import json
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

import pandas as pd  # noqa: E402
import pulp  # noqa: E402
from engine import (  # noqa: E402
    BudgetSolverV3, ItineraryRequest, haversine_km, muat_kuliner_khas, skor_umkm,
)

solver = BudgetSolverV3(DATA)
BUD, HARI, ORANG = 5_000_000, 3, 2


def req_baku(**kw):
    d = dict(budget_total=BUD, n_days=HARI, n_nights=HARI - 1, n_orang=ORANG,
             moda="mobil", use_osrm=False)
    d.update(kw)
    return ItineraryRequest(**d)


# ── 1. Dekomposisi koefisien fungsi tujuan ────────────────────────────────
r = solver.solve(req_baku())
hotel = r["hotel"][0]
h_lat, h_lon = hotel["latitude"], hotel["longitude"]
kuliner = muat_kuliner_khas(DATA)

restos = solver.restos.copy()
attrs = solver.attractions.copy()
restos["jarak"] = restos.apply(lambda x: haversine_km(h_lat, h_lon, x["latitude"], x["longitude"]), axis=1)
attrs["jarak"] = attrs.apply(lambda x: haversine_km(h_lat, h_lon, x["latitude"], x["longitude"]), axis=1)
max_jarak = max(restos["jarak"].max(), attrs["jarak"].max(), 1)
ref_r = restos["harga_min"].max()
ref_a = attrs["harga_min"].max()
umkm_w = r["umkm_weight_dipakai"]

def komponen_resto(row):
    rating = 0.7 * float(row["place-rating"])
    harga = 0.3 * (float(row["harga_min"]) / ref_r) * 5.0
    penalti = -(row["jarak"] / max_jarak) * 5.0 * 1.2
    umkm = umkm_w * 5.0 * skor_umkm(row.to_dict(), kuliner)["skor_umkm"]
    insentif = (float(row["harga_tengah"]) * ORANG / BUD) * 0.5 * 10
    return {"rating": rating, "harga_kualitas": harga, "penalti_jarak": penalti,
            "umkm": umkm, "insentif_budget": insentif}

komp = [komponen_resto(row) for _, row in restos.iterrows()]
dekomposisi = {k: {"min": round(min(c[k] for c in komp), 4),
                   "median": round(statistics.median(c[k] for c in komp), 4),
                   "max": round(max(c[k] for c in komp), 4)}
               for k in komp[0]}

# Korelasi harga vs skor total resto — menguji apakah model condong ke yang mahal
skor_total = [sum(c.values()) for c in komp]
harga = list(restos["harga_min"])
korelasi_harga_skor = round(pd.Series(skor_total).corr(pd.Series(harga)), 3)

# ── 2. Sensitivitas bobot UMKM ────────────────────────────────────────────
sens_umkm = {}
for w in (0.0, 0.25, 0.5, 0.75, 1.0):
    rr = solver.solve(req_baku(umkm_weight=w))
    sens_umkm[w] = {
        "porsi_umkm": rr["dampak_lokal"].get("proporsi_umkm"),
        "ragam_kuliner": rr["dampak_lokal"].get("ragam_kuliner_khas"),
        "total_estimasi": rr["total_estimasi"],
        "rating_resto": round(statistics.mean(x["place-rating"] for x in rr["restos"]), 3),
    }

# ── 3. Sensitivitas bobot utilisasi budget ────────────────────────────────
sens_util = {}
for w in (0.0, 0.5, 1.0, 2.0, 5.0):
    rr = solver.solve(req_baku(budget_utilization_weight=w))
    sens_util[w] = {
        "utilisasi": round(rr["total_estimasi"] / BUD, 3),
        "rating_wisata": round(statistics.mean(a["place-rating"] for a in rr["attractions"]), 3),
        "jarak_rata2": rr["jarak_rata2_wisata_ke_hotel"],
    }

# ── 4. Celah optimalitas: hotel greedy vs seluruh hotel dicoba ────────────
# _pick_hotel memilih hotel SEBELUM ILP, jadi optimum ILP hanya optimum
# BERSYARAT pada hotel itu. Di sini tiap hotel dipaksa jadi acuan lalu
# nilai fungsi tujuannya dibandingkan.
def solve_dengan_hotel(idx, req):
    """Jalankan ulang ILP dengan hotel tertentu dipaksa sebagai acuan."""
    asli = solver.hotels
    try:
        solver.hotels = asli.iloc[[idx]].reset_index(drop=True)
        return solver.solve(req)
    finally:
        solver.hotels = asli

hasil_hotel = []
for i in range(len(solver.hotels)):
    rr = solve_dengan_hotel(i, req_baku())
    if rr.get("status") != "Optimal":
        continue
    hasil_hotel.append({
        "hotel": solver.hotels.loc[i, "place-name"],
        "harga": int(solver.hotels.loc[i, "harga_tengah"]),
        "rating_hotel": float(solver.hotels.loc[i, "place-rating"]),
        "rating_wisata": round(statistics.mean(a["place-rating"] for a in rr["attractions"]), 3),
        "jarak_rata2": rr["jarak_rata2_wisata_ke_hotel"],
        "total_estimasi": rr["total_estimasi"],
        "porsi_umkm": rr["dampak_lokal"].get("proporsi_umkm"),
    })

hotel_greedy = hotel["place-name"]
# Peringkat berdasarkan proxy kualitas rencana: jarak rata-rata (makin kecil makin baik)
urut_jarak = sorted(hasil_hotel, key=lambda x: x["jarak_rata2"])
peringkat_greedy = next(i for i, x in enumerate(urut_jarak, 1)
                        if x["hotel"] == hotel_greedy)

print(json.dumps({
    "skenario": f"Rp{BUD:,} / {HARI} hari / {ORANG} orang",
    "hotel_terpilih_greedy": hotel_greedy,
    "1_dekomposisi_koefisien_resto": dekomposisi,
    "korelasi_harga_vs_skor_resto": korelasi_harga_skor,
    "2_sensitivitas_umkm_weight": sens_umkm,
    "3_sensitivitas_budget_util_weight": sens_util,
    "4_celah_hotel": {
        "n_hotel_layak": len(hasil_hotel),
        "peringkat_greedy_menurut_jarak": f"{peringkat_greedy} dari {len(urut_jarak)}",
        "jarak_greedy": next(x["jarak_rata2"] for x in hasil_hotel if x["hotel"] == hotel_greedy),
        "jarak_terbaik": urut_jarak[0]["jarak_rata2"],
        "hotel_terbaik_menurut_jarak": urut_jarak[0]["hotel"],
        "3_terbaik": urut_jarak[:3],
        "greedy": [x for x in hasil_hotel if x["hotel"] == hotel_greedy],
    },
}, indent=2, ensure_ascii=False, default=str))
