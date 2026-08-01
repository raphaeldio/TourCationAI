"""BAGIAN 4 — Evaluasi Route Optimizer.

Route Optimizer di engine = `build_daily_routes`, yang melakukan dua hal atas
destinasi yang SUDAH dipilih solver: (a) mengelompokkan ke hari berdasarkan
kedekatan lokasi (`_bagi_wisata_per_hari`) dan (b) mengurutkan kunjungan dalam
sehari dengan nearest-neighbor (`_nearest_neighbor_order`).

Perbandingan Sebelum vs Sesudah
-------------------------------
- SEBELUM (baseline naif): destinasi yang sama, dibagi ke hari secara BERURUTAN
  mengikuti urutan seleksi solver (`_kuota_per_hari`), dikunjungi apa adanya
  hotel -> a1 -> a2 -> ... tanpa penataan ulang.
- SESUDAH (teroptimasi): `total_jarak_semua_hari_km` dari `build_daily_routes`.

Keduanya memakai jarak haversine yang sama (use_osrm=False), jadi selisihnya
murni efek penataan rute — bukan efek sumber jarak.

Travel-time reduction: tanpa OSRM tidak ada durasi jalan nyata. Di bawah asumsi
kecepatan rata-rata tetap, waktu tempuh sebanding dengan jarak, sehingga
persentase pengurangan waktu = persentase pengurangan jarak. Menit diturunkan
pada kecepatan nominal NOMINAL_KMH (40 km/jam) hanya untuk keterbacaan
(BUKAN klaim OSRM).

Keluaran: route_optimizer_report.csv
"""
from __future__ import annotations

import csv
import statistics

NOMINAL_KMH = 40.0   # kecepatan rata-rata nominal untuk konversi km -> menit


def naive_route_km(result, n_days, haversine_km, kuota_per_hari) -> float:
    """Total jarak baseline naif (haversine) untuk rencana `result`.

    Titik acuan sama dengan build_daily_routes (titik_acuan atau hotel[0]).
    Destinasi dibagi ke hari secara berurutan lalu dikunjungi apa adanya.
    """
    hotel = result.get("titik_acuan") or result["hotel"][0]
    attractions = [a for a in result["attractions"]
                   if a.get("latitude") is not None and a.get("longitude") is not None]
    total = 0.0
    mulai = 0
    for kuota in kuota_per_hari(len(attractions), n_days):
        grup = attractions[mulai:mulai + kuota]
        mulai += kuota
        cur = hotel
        for a in grup:
            total += haversine_km(cur["latitude"], cur["longitude"],
                                  a["latitude"], a["longitude"])
            cur = a
    return round(total, 2)


def evaluate(rows, csv_path) -> dict:
    """Agregasi metrik Route Optimizer dari baris batch (BAGIAN 1).

    Tiap baris optimal harus punya: budget, n_days, n_orang, total_jarak_km
    (teroptimasi) dan naive_jarak_km (baseline). Baris dengan naive <= 0
    (mis. 0 destinasi) dilewati dari statistik reduksi.
    """
    detail = []
    reduksi_pct = []
    saving_km = []
    for r in rows:
        if r.get("solver_status") != "Optimal":
            continue
        naive = r.get("naive_jarak_km")
        opt = r.get("total_jarak_km")
        if naive is None or opt is None or naive <= 0:
            continue
        red = (naive - opt) / naive * 100.0
        saving = naive - opt
        reduksi_pct.append(red)
        saving_km.append(saving)
        detail.append({
            "budget": r["budget"], "n_days": r["n_days"], "n_orang": r["n_orang"],
            "jarak_awal_km": round(naive, 2),
            "jarak_optimasi_km": round(opt, 2),
            "distance_reduction_pct": round(red, 2),
            "travel_time_reduction_pct": round(red, 2),   # = distance red. (asumsi v tetap)
            "saving_km": round(saving, 2),
            "saving_menit_nominal": round(saving / NOMINAL_KMH * 60.0, 1),
        })

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["budget", "n_days", "n_orang", "jarak_awal_km",
                    "jarak_optimasi_km", "distance_reduction_pct",
                    "travel_time_reduction_pct", "saving_km", "saving_menit_nominal"])
        for d in detail:
            w.writerow([d["budget"], d["n_days"], d["n_orang"], d["jarak_awal_km"],
                        d["jarak_optimasi_km"], d["distance_reduction_pct"],
                        d["travel_time_reduction_pct"], d["saving_km"],
                        d["saving_menit_nominal"]])

    ringkas = {
        "n_skenario": len(detail),
        "mean_distance_reduction_pct": round(statistics.mean(reduksi_pct), 2) if reduksi_pct else None,
        "mean_travel_time_reduction_pct": round(statistics.mean(reduksi_pct), 2) if reduksi_pct else None,
        "mean_saving_km": round(statistics.mean(saving_km), 2) if saving_km else None,
        "total_saving_km": round(sum(saving_km), 2) if saving_km else None,
        "csv_path": str(csv_path),
        "detail": detail,
    }
    return ringkas
