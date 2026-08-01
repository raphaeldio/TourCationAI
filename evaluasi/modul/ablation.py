"""BAGIAN 7 — Ablation Study.

Menyalakan modul satu per satu dan mengukur dampak NYATA masing-masing pada
metrik yang benar-benar dipengaruhinya. Konfigurasi (kumulatif):

    A  ILP saja
    B  + Route Optimizer
    C  + Route Optimizer + Time Filter
    D  + Route Optimizer + Time Filter + Ferry Detector
    E  Full System (+ UMKM Scorer)

Cara toggle (tanpa mengubah logika engine):
    Route Optimizer : rute naif (urutan seleksi) vs `build_daily_routes` (klaster+NN)
    Time Filter     : `solver.jadwal = None` vs jadwal asli
    Ferry Detector  : `build_daily_routes(ferry_detector=None)` vs terisi
    UMKM Scorer     : `umkm_weight = 0.0` vs profil (None)

CATATAN KEJUJURAN — modul bekerja pada SUMBU BERBEDA
----------------------------------------------------
Pada arsitektur ini penalti menyeberang danau sudah ada di INTI ILP, dan
penataan rute + deteksi feri berjalan SETELAH solver. Maka:
- Route Optimizer & Ferry Detector adalah pasca-solve -> TIDAK mengubah OFS;
  Route Optimizer memangkas JARAK, Ferry Detector menambah KESADARAN penyeberangan.
- Time Filter mengubah kolam destinasi -> dapat menggeser OFS, jarak, diversity.
- UMKM Scorer menambah suku UMKM ke fungsi tujuan -> menggeser OFS & komposisi
  tempat makan (bukan destinasi/diversity).

Karena itu kontribusi tiap modul dilaporkan pada sumbu aslinya, bukan dipaksa
menjadi kenaikan OFS yang seragam. Ini temuan yang lebih kuat: tiap modul
menyumbang hal yang berbeda dan saling melengkapi.
"""
from __future__ import annotations

import csv
import statistics
import time

# config -> (route_opt, time_filter, ferry, umkm)
KONFIG = {
    "A": (False, False, False, False),
    "B": (True,  False, False, False),
    "C": (True,  True,  False, False),
    "D": (True,  True,  True,  False),
    "E": (True,  True,  True,  True),
}
LABEL = {
    "A": "ILP saja",
    "B": "+ Route Optimizer",
    "C": "+ Time Filter",
    "D": "+ Ferry Detector",
    "E": "Full System (+ UMKM)",
}


def _run_config(engine, solver, ferry_detector, make_req, diversity_fn, naive_km_fn,
                budget, n_days, n_orang, tanggal_mulai, flags):
    route_opt, time_filter, ferry, umkm = flags
    ground_jadwal = solver.jadwal
    solver.jadwal = ground_jadwal if time_filter else None
    umkm_w = None if umkm else 0.0
    try:
        t0 = time.perf_counter()
        r = solver.solve(make_req(budget, n_days, n_orang, umkm_w, tanggal_mulai))
        runtime = time.perf_counter() - t0
    finally:
        solver.jadwal = ground_jadwal

    if r.get("status") != "Optimal":
        return None

    if route_opt:
        rute = engine.build_daily_routes(
            r, n_days, use_osrm=False,
            ferry_detector=(ferry_detector if ferry else None),
            jadwal=(ground_jadwal if time_filter else None),
            tanggal_mulai=tanggal_mulai)
        distance = rute.get("total_jarak_semua_hari_km", 0.0)
        crossings = rute.get("total_penyeberangan", 0) if ferry else None
    else:
        distance = naive_km_fn(r, n_days)
        crossings = None

    div, _ = diversity_fn(r["attractions"])
    dl = r.get("dampak_lokal") or {}
    n_umkm = dl.get("umkm_lokal_otentik", 0) if isinstance(dl, dict) else 0
    return {
        "ofs": round(r["nilai_objektif"], 3),
        "utilization": r.get("persen_terpakai_estimasi"),
        "distance": round(distance, 2),
        "diversity": div,
        "runtime": round(runtime, 3),
        "crossings": crossings,
        "n_umkm": n_umkm,
    }


def evaluate(engine, solver, ferry_detector, make_req, diversity_fn, naive_km_fn,
             scenarios, csv_path, tanggal_mulai="2026-07-27") -> dict:
    """Jalankan ablasi pada beberapa skenario, rata-ratakan per konfigurasi.

    `make_req(budget, n_days, n_orang, umkm_weight, tanggal_mulai)` -> request.
    """
    # kumpulan hasil per konfigurasi (list of dict metrik), per skenario
    per_config = {c: [] for c in KONFIG}
    for budget, n_days, n_orang in scenarios:
        for c, flags in KONFIG.items():
            hasil = _run_config(engine, solver, ferry_detector, make_req,
                                diversity_fn, naive_km_fn, budget, n_days, n_orang,
                                tanggal_mulai, flags)
            if hasil is not None:
                per_config[c].append(hasil)

    def _avg(c, key):
        vals = [h[key] for h in per_config[c] if h.get(key) is not None]
        return round(statistics.mean(vals), 3) if vals else None

    tabel = {}
    for c in KONFIG:
        tabel[c] = {
            "label": LABEL[c],
            "ofs": _avg(c, "ofs"),
            "utilization": _avg(c, "utilization"),
            "distance": _avg(c, "distance"),
            "diversity": _avg(c, "diversity"),
            "runtime": _avg(c, "runtime"),
            "crossings": _avg(c, "crossings"),
            "n_umkm": _avg(c, "n_umkm"),
        }

    # --- Kontribusi tiap modul pada sumbu aslinya ---------------------------
    def _delta(after, before, key):
        a, b = tabel[after].get(key), tabel[before].get(key)
        if a is None or b is None:
            return None
        return round(a - b, 3)

    def _pct(after, before, key):
        a, b = tabel[after].get(key), tabel[before].get(key)
        if a is None or b is None or b == 0:
            return None
        return round((a - b) / abs(b) * 100.0, 2)

    # Route Optimizer: saving positif = jarak berkurang (A - B).
    saving_km = _delta("A", "B", "distance")
    reduction_pct = _pct("A", "B", "distance")  # (A-B)/|B|; positif bila A>B
    dist_a, dist_b = tabel["A"].get("distance"), tabel["B"].get("distance")
    if dist_a and dist_b:
        reduction_pct = round((dist_a - dist_b) / dist_a * 100.0, 2)
    kontribusi = {
        "Route Optimizer": {
            "sumbu": "Total Distance",
            "saving_km": saving_km,           # positif = lebih pendek
            "reduction_pct": reduction_pct,   # positif = lebih pendek
            "catatan": "memangkas jarak tempuh; OFS tidak berubah (pasca-solve).",
        },
        "Time Filter": {
            "sumbu": "OFS / Diversity / Distance",
            "delta_ofs": _delta("C", "B", "ofs"),
            "ofs_pct": _pct("C", "B", "ofs"),
            "delta_diversity": _delta("C", "B", "diversity"),
            "delta_distance": _delta("C", "B", "distance"),
            "catatan": "membuang destinasi yang tutup pada hari/jam perjalanan.",
        },
        "Ferry Detector": {
            "sumbu": "Kesadaran penyeberangan",
            "crossings_terdeteksi": tabel["D"].get("crossings"),
            "delta_ofs": _delta("D", "C", "ofs"),
            "catatan": "mendeteksi & memberi info penyeberangan feri; OFS/jarak "
                       "tetap karena penalti seberang sudah di inti ILP.",
        },
        "UMKM Scorer": {
            "sumbu": "OFS / komposisi tempat makan",
            "delta_ofs": _delta("E", "D", "ofs"),
            "ofs_pct": _pct("E", "D", "ofs"),
            "delta_umkm": _delta("E", "D", "n_umkm"),
            "catatan": "menambah suku UMKM ke fungsi tujuan; menaikkan pilihan "
                       "warung/lapo otentik.",
        },
    }

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["config", "label", "ofs", "budget_utilization_pct",
                    "total_distance_km", "diversity_pct", "runtime_s",
                    "penyeberangan", "n_umkm"])
        for c in KONFIG:
            t = tabel[c]
            w.writerow([c, t["label"], t["ofs"], t["utilization"], t["distance"],
                        t["diversity"], t["runtime"],
                        "-" if t["crossings"] is None else t["crossings"], t["n_umkm"]])

    return {
        "tabel": tabel,
        "kontribusi": kontribusi,
        "n_skenario": len(scenarios),
        "csv_path": str(csv_path),
    }
