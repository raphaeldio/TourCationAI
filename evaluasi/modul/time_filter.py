"""BAGIAN 5 — Evaluasi Time-Aware Filter.

Time-Aware Filter (MODUL 3/3c) menyaring destinasi yang tutup pada hari/jam
perjalanan, baik di tahap SELEKSI (`filter_open_places` di dalam `solve`, aktif
bila `solver.jadwal` terisi) maupun di tahap PENATAAN rute (urutan yang
mengutamakan tempat yang buka). Toggle yang jujur & tanpa mengubah engine:
mengeset `solver.jadwal = None` mematikan filter; mengembalikannya menyalakan.

Perbandingan Tanpa vs Dengan Filter
-----------------------------------
Untuk tiap skenario, rencana disusun dua kali (filter OFF vs ON). Pada tiap
rencana dihitung DESTINASI TIDAK VALID = destinasi yang, pada jam kunjungan
terjadwalnya, PASTI TUTUP menurut jadwal ground-truth (selalu jadwal asli, lepas
dari apakah solver memakainya). Cek memakai `engine._wisata_buka_pada`, cermin
dari logika peringatan agenda engine.

- Invalid Attraction Reduction (%) = (invalid_tanpa - invalid_dengan) / invalid_tanpa x 100
- Schedule Feasibility (%)         = (total_dengan - invalid_dengan) / total_dengan x 100

Agar penutupan MINGGUAN ikut teruji (bukan hanya jam harian), evaluasi memakai
`tanggal_mulai` tetap sehingga hari dalam seminggu aktif.

Keluaran: time_filter_report.csv
"""
from __future__ import annotations

import csv


def _hitung_invalid(engine, result, n_days, ground_jadwal, tanggal_mulai):
    """(total_wisata, jumlah_tidak_valid) untuk rencana Optimal.

    Tidak valid = pasti tutup pada jam kunjungan terjadwalnya (per hari).
    """
    rute = engine.build_daily_routes(
        result, n_days, use_osrm=False, jadwal=ground_jadwal,
        tanggal_mulai=tanggal_mulai)
    total = 0
    invalid = 0
    for hari in rute.get("days", []):
        wlist = hari.get("wisata_terurut", [])
        hari_idx = hari.get("hari_indeks")
        jam_kunjungan = engine.jadwal_wisata_harian(len(wlist))
        for w, jam in zip(wlist, jam_kunjungan):
            total += 1
            if engine._wisata_buka_pada(w, jam, ground_jadwal, hari_idx) is False:
                invalid += 1
    return total, invalid


def evaluate(engine, solver, make_req, scenarios, csv_path,
             tanggal_mulai="2026-07-27") -> dict:
    """Bandingkan rencana tanpa vs dengan Time-Aware Filter.

    `make_req(budget, n_days, n_orang, tanggal_mulai)` -> ItineraryRequest.
    Ground-truth jadwal = jadwal asli solver (disimpan sebelum toggle).
    """
    ground_jadwal = solver.jadwal
    if ground_jadwal is None or not getattr(ground_jadwal, "entri", None):
        # Tanpa dataset jadwal, filter tak bisa diuji secara bermakna.
        return {"status": "jadwal tidak tersedia", "csv_path": str(csv_path)}

    # Konteks cakupan: seberapa banyak destinasi yang memang terkendala waktu.
    # Ini menjelaskan skala efek filter secara jujur — dataset dengan sedikit
    # destinasi tutup akan menunjukkan reduksi kecil (filter berperan sebagai
    # PENJAGA kelayakan, bukan pengoreksi yang sering aktif).
    attr = solver.attractions
    n_attr = len(attr)
    n_berjadwal = sum(1 for n in attr["place-name"] if ground_jadwal.cari(n))
    n_hari_tutup = sum(1 for n in attr["place-name"]
                       if ground_jadwal.cari(n) and ground_jadwal.hari_tutup(n))

    detail = []
    tot_invalid_tanpa = tot_invalid_dengan = 0
    tot_wisata_dengan = 0
    try:
        for budget, n_days, n_orang in scenarios:
            # --- Filter OFF ---
            solver.jadwal = None
            r_off = solver.solve(make_req(budget, n_days, n_orang, tanggal_mulai))
            # --- Filter ON ---
            solver.jadwal = ground_jadwal
            r_on = solver.solve(make_req(budget, n_days, n_orang, tanggal_mulai))

            if r_off.get("status") != "Optimal" or r_on.get("status") != "Optimal":
                continue

            total_off, inv_off = _hitung_invalid(engine, r_off, n_days, ground_jadwal, tanggal_mulai)
            total_on, inv_on = _hitung_invalid(engine, r_on, n_days, ground_jadwal, tanggal_mulai)

            tot_invalid_tanpa += inv_off
            tot_invalid_dengan += inv_on
            tot_wisata_dengan += total_on

            red = ((inv_off - inv_on) / inv_off * 100.0) if inv_off > 0 else 0.0
            feas = ((total_on - inv_on) / total_on * 100.0) if total_on > 0 else 100.0
            detail.append({
                "budget": budget, "n_days": n_days, "n_orang": n_orang,
                "tutup_tanpa_filter": inv_off,
                "tutup_dengan_filter": inv_on,
                "total_wisata_dengan_filter": total_on,
                "invalid_reduction_pct": round(red, 1),
                "schedule_feasibility_pct": round(feas, 1),
            })
    finally:
        solver.jadwal = ground_jadwal   # selalu pulihkan

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["# Time-Aware Filter — tanggal_mulai=" + str(tanggal_mulai)])
        w.writerow(["budget", "n_days", "n_orang", "tutup_tanpa_filter",
                    "tutup_dengan_filter", "total_wisata_dengan_filter",
                    "invalid_reduction_pct", "schedule_feasibility_pct"])
        for d in detail:
            w.writerow([d["budget"], d["n_days"], d["n_orang"],
                        d["tutup_tanpa_filter"], d["tutup_dengan_filter"],
                        d["total_wisata_dengan_filter"], d["invalid_reduction_pct"],
                        d["schedule_feasibility_pct"]])

    overall_red = ((tot_invalid_tanpa - tot_invalid_dengan) / tot_invalid_tanpa * 100.0
                   ) if tot_invalid_tanpa > 0 else 0.0
    overall_feas = ((tot_wisata_dengan - tot_invalid_dengan) / tot_wisata_dengan * 100.0
                    ) if tot_wisata_dengan > 0 else 100.0
    return {
        "status": "ok",
        "n_skenario": len(detail),
        "total_invalid_tanpa": tot_invalid_tanpa,
        "total_invalid_dengan": tot_invalid_dengan,
        "invalid_reduction_pct": round(overall_red, 1),
        "schedule_feasibility_pct": round(overall_feas, 1),
        "n_attr": n_attr,
        "n_berjadwal": n_berjadwal,
        "n_hari_tutup": n_hari_tutup,
        "csv_path": str(csv_path),
        "detail": detail,
    }
