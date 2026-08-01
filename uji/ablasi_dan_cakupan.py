"""Uji lanjutan: ablasi bobot jarak, ambang budget minimum, dan cakupan data."""
import json
import statistics
import sys
from pathlib import Path
import time

AKAR = Path(__file__).resolve().parent.parent
DATA = str(AKAR / "data")
sys.path.insert(0, str(AKAR))

from engine import (  # noqa: E402
    BudgetSolverV3, FerryDetector, ItineraryRequest, JadwalOperasional,
    build_daily_routes, check_osrm_available, deteksi_kabupaten,
)

D = DATA  # folder dataset
solver = BudgetSolverV3(D)
ferry = FerryDetector(D)
jadwal = JadwalOperasional(D)


def jalankan(bobot, budget=5_000_000, hari=3, minat=None, orang=2):
    req = ItineraryRequest(budget_total=budget, n_days=hari, n_nights=hari - 1,
                           minat_wisata=minat, n_orang=orang, moda="mobil",
                           use_osrm=False, distance_penalty_weight=bobot)
    r = solver.solve(req)
    if r.get("status") != "Optimal":
        return None
    rute = build_daily_routes(r, hari, use_osrm=False, ferry_detector=ferry, jadwal=jadwal)
    return {
        "km": rute["total_jarak_semua_hari_km"],
        "rating": round(statistics.mean(a["place-rating"] for a in r["attractions"]), 3),
        "feri": rute["total_penyeberangan"],
        "utilisasi": round(r["total_estimasi"] / budget, 3),
    }


# 1. Ablasi bobot penalti jarak (GAYA_JELAJAH)
ablasi = {}
for nama, w in [("Jelajah jauh (0.15)", 0.15), ("Seimbang (0.6)", 0.6),
                ("Dekat-dekat (1.2)", 1.2)]:
    v = [jalankan(w, budget=b, hari=3) for b in (3_000_000, 5_000_000, 8_000_000)]
    ablasi[nama] = {
        "km_rata2": round(statistics.mean(x["km"] for x in v), 1),
        "rating_rata2": round(statistics.mean(x["rating"] for x in v), 3),
        "feri_total": sum(x["feri"] for x in v),
    }

# 2. Ambang budget minimum yang masih terpecahkan (3 hari, 2 orang)
ambang = {}
for hari in (1, 2, 3, 5):
    lo, hi = 100_000, 12_000_000
    for _ in range(24):
        mid = (lo + hi) // 2
        req = ItineraryRequest(budget_total=mid, n_days=hari, n_nights=hari - 1,
                               n_orang=2, moda="mobil", use_osrm=False)
        if solver.solve(req).get("status") == "Optimal":
            hi = mid
        else:
            lo = mid + 1
    ambang[f"{hari} hari / 2 orang"] = hi

# 3. Perilaku saat budget di bawah ambang — harus menolak, bukan mengarang
req_mustahil = ItineraryRequest(budget_total=200_000, n_days=3, n_nights=2,
                                n_orang=4, moda="mobil", use_osrm=False)
r_mustahil = solver.solve(req_mustahil)

# 4. Cakupan deteksi kabupaten atas seluruh destinasi
attr = solver.attractions
terdeteksi = sum(1 for a in attr["address"].fillna("") if deteksi_kabupaten(a))
# 5. Cakupan jadwal mingguan (MODUL 3c)
cocok = sum(1 for n in attr["place-name"] if jadwal.cari(n))
tutup_mingguan = sum(1 for n in attr["place-name"]
                     if jadwal.cari(n) and jadwal.hari_tutup(n))

# 6. Ketersediaan OSRM saat ini + biaya waktunya
t = time.time()
osrm_hidup = check_osrm_available()
t_osrm = round(time.time() - t, 2)

t = time.time()
req_osrm = ItineraryRequest(budget_total=5_000_000, n_days=3, n_nights=2,
                            n_orang=2, moda="mobil", use_osrm=True)
r_osrm = solver.solve(req_osrm)
rute_osrm = (build_daily_routes(r_osrm, 3, use_osrm=True, ferry_detector=ferry,
                                jadwal=jadwal)
             if r_osrm.get("status") == "Optimal" else None)
t_osrm_penuh = round(time.time() - t, 2)

print(json.dumps({
    "ablasi_bobot_jarak": ablasi,
    "budget_minimum_terpecahkan": ambang,
    "budget_mustahil": {"status": r_mustahil.get("status"),
                        "pesan": r_mustahil.get("message")},
    "cakupan_data": {
        "n_wisata": int(len(attr)),
        "n_resto": int(len(solver.restos)),
        "n_hotel": int(len(solver.hotels)),
        "kabupaten_terdeteksi": f"{terdeteksi}/{len(attr)}",
        "jadwal_mingguan_cocok": f"{cocok}/{len(attr)}",
        "punya_hari_tutup": tutup_mingguan,
    },
    "osrm": {
        "hidup": osrm_hidup,
        "detik_cek": t_osrm,
        "detik_rencana_penuh": t_osrm_penuh,
        "sumber_jarak": rute_osrm["sumber_jarak"] if rute_osrm else None,
        "km_total": rute_osrm["total_jarak_semua_hari_km"] if rute_osrm else None,
    },
}, indent=2, ensure_ascii=False))
