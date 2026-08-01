"""BAGIAN 6 — Evaluasi UMKM Scorer.

UMKM Scorer (MODUL 5) menambahkan suku `umkm_w * 5.0 * skor_umkm` ke fungsi
tujuan tiap tempat makan, sehingga solver condong memilih warung/lapo/kuliner
khas Batak yang otentik. Toggle yang jujur tanpa mengubah engine:

    umkm_weight = 0.0   -> scorer MATI (tempat makan dipilih tanpa insentif UMKM)
    umkm_weight = None  -> scorer HIDUP (ikut bobot profil dari budget/hari)

Perbandingan Tanpa vs Dengan Scorer (per skenario, tempat makan yang dipilih):
- UMKM terpilih         = `dampak_lokal.umkm_lokal_otentik` (skor_umkm >= 0.5)
- UMKM Exposure Rate (%)= UMKM terpilih / total kunjungan makan x 100  (dengan scorer)
- UMKM Selection Increase = UMKM_dengan - UMKM_tanpa
- Average UMKM Score     = rata-rata skor_umkm tempat makan terpilih (dengan scorer)

Keluaran: umkm_scorer_report.csv
"""
from __future__ import annotations

import csv
import statistics


def _umkm_count(result):
    dl = result.get("dampak_lokal") or {}
    if not isinstance(dl, dict):
        return 0, 0
    return dl.get("umkm_lokal_otentik", 0), dl.get("total_kunjungan_makan", 0)


def _avg_skor(result, skor_umkm, kuliner_khas):
    restos = result.get("restos", [])
    if not restos:
        return 0.0
    skor = []
    for r in restos:
        s = r.get("skor_umkm")
        if s is None:
            s = skor_umkm(r, kuliner_khas)["skor_umkm"]
        skor.append(float(s))
    return round(statistics.mean(skor), 3) if skor else 0.0


def evaluate(solver, make_req, scenarios, csv_path,
             skor_umkm, muat_kuliner_khas) -> dict:
    """Bandingkan tempat makan terpilih tanpa vs dengan UMKM Scorer.

    `make_req(budget, n_days, n_orang, umkm_weight)` -> ItineraryRequest.
    """
    kuliner_khas = muat_kuliner_khas(solver.data_dir)
    detail = []
    tot_umkm_tanpa = tot_umkm_dengan = tot_makan_dengan = 0
    exposure_list = []
    avg_skor_list = []

    for budget, n_days, n_orang in scenarios:
        r_off = solver.solve(make_req(budget, n_days, n_orang, 0.0))    # scorer OFF
        r_on = solver.solve(make_req(budget, n_days, n_orang, None))    # scorer ON (profil)
        if r_off.get("status") != "Optimal" or r_on.get("status") != "Optimal":
            continue

        umkm_off, _ = _umkm_count(r_off)
        umkm_on, makan_on = _umkm_count(r_on)
        avg_skor_on = _avg_skor(r_on, skor_umkm, kuliner_khas)
        exposure = (umkm_on / makan_on * 100.0) if makan_on else 0.0
        umkm_w_dipakai = r_on.get("umkm_weight_dipakai")

        tot_umkm_tanpa += umkm_off
        tot_umkm_dengan += umkm_on
        tot_makan_dengan += makan_on
        exposure_list.append(exposure)
        avg_skor_list.append(avg_skor_on)

        detail.append({
            "budget": budget, "n_days": n_days, "n_orang": n_orang,
            "umkm_weight_dipakai": umkm_w_dipakai,
            "umkm_tanpa_scorer": umkm_off,
            "umkm_dengan_scorer": umkm_on,
            "total_kunjungan_makan": makan_on,
            "umkm_selection_increase": umkm_on - umkm_off,
            "umkm_exposure_rate_pct": round(exposure, 1),
            "avg_umkm_score": avg_skor_on,
        })

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["budget", "n_days", "n_orang", "umkm_weight_dipakai",
                    "umkm_tanpa_scorer", "umkm_dengan_scorer", "total_kunjungan_makan",
                    "umkm_selection_increase", "umkm_exposure_rate_pct", "avg_umkm_score"])
        for d in detail:
            w.writerow([d["budget"], d["n_days"], d["n_orang"], d["umkm_weight_dipakai"],
                        d["umkm_tanpa_scorer"], d["umkm_dengan_scorer"],
                        d["total_kunjungan_makan"], d["umkm_selection_increase"],
                        d["umkm_exposure_rate_pct"], d["avg_umkm_score"]])

    overall_exposure = (tot_umkm_dengan / tot_makan_dengan * 100.0) if tot_makan_dengan else 0.0
    return {
        "n_skenario": len(detail),
        "total_umkm_tanpa": tot_umkm_tanpa,
        "total_umkm_dengan": tot_umkm_dengan,
        "umkm_selection_increase": tot_umkm_dengan - tot_umkm_tanpa,
        "umkm_exposure_rate_pct": round(overall_exposure, 1),
        "mean_umkm_exposure_pct": round(statistics.mean(exposure_list), 1) if exposure_list else None,
        "mean_avg_umkm_score": round(statistics.mean(avg_skor_list), 3) if avg_skor_list else None,
        "csv_path": str(csv_path),
        "detail": detail,
    }
