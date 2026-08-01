"""BAGIAN 3 — Evaluasi Ferry Detector.

Apa yang diukur
---------------
Inti Ferry Detector adalah pengklasifikasi SISI DANAU (`engine.sisi_danau`):
sebuah penyeberangan feri dibutuhkan bila—dan hanya bila—titik asal dan tujuan
berada di sisi yang berbeda (daratan vs Pulau Samosir). `FerryDetector.cari_feri`
mengembalikan info feri persis ketika `sisi_danau(a) != sisi_danau(b)`. Karena
keputusan "butuh feri" adalah fungsi deterministik dari kedua sisi, mengukur
KETEPATAN KLASIFIKASI SISI per-destinasi memvalidasi langsung inti modul ini.

Ground truth yang INDEPENDEN
----------------------------
Prediksi diuji terhadap label independen dari `engine.deteksi_kabupaten` — sebuah
pengklasifikasi kabupaten yang jauh lebih lengkap (menangani "Kabupaten Samosir",
"Samosir Regency", segmen alamat persis, dan pemetaan kecamatan) dan memakai
DAFTAR KATA KUNCI BERBEDA dari `sisi_danau`. Pulau Samosir secara administratif =
Kabupaten Samosir, jadi:

    ground truth positif (butuh-feri / sisi Samosir) := deteksi_kabupaten == "Samosir"
    ground truth negatif (daratan)                   := deteksi_kabupaten kabupaten lain
    prediksi positif                                 := sisi_danau == "samosir"

Destinasi yang kabupatennya tidak dapat dipastikan (`deteksi_kabupaten` -> None)
TIDAK dapat dilabeli, jadi dikeluarkan dari himpunan uji dan dilaporkan sebagai
cakupan. Keterbatasan yang jujur: kedua pengklasifikasi membaca teks alamat yang
sama, sehingga metrik ini mengukur kekokohan/keselarasan cakupan kata kunci —
bukan oracle geografis. Ketidaksepakatan yang muncul nyata (berasal dari daftar
kecamatan yang berbeda), sehingga confusion matrix tidak trivial.

Selain klasifikasi sisi, ditambahkan pemeriksaan tingkat-PASANGAN pada sampel
pasangan destinasi berlabel: apakah `cari_feri` memutuskan "butuh menyeberang"
sesuai ground truth sisi. Ini menegaskan keputusan penyeberangan end-to-end.

Keluaran: ferry_detector_report.csv
"""
from __future__ import annotations

import csv
import itertools
import random


def _metrics(tp: int, fp: int, fn: int, tn: int) -> dict:
    total = tp + fp + fn + tn
    acc = (tp + tn) / total if total else 0.0
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return {
        "accuracy": round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall": round(rec * 100, 2),
        "f1": round(f1 * 100, 2),
    }


def evaluate(solver, ferry_detector, deteksi_kabupaten, sisi_danau,
             csv_path, n_pasangan_sampel: int = 400, seed: int = 7) -> dict:
    """Jalankan evaluasi Ferry Detector, tulis CSV, kembalikan ringkasan metrik.

    Parameter `deteksi_kabupaten`, `sisi_danau` diinjeksi dari engine agar modul
    ini tidak menduplikasi logika apa pun.
    """
    attr = solver.attractions
    rekam = attr.to_dict("records")

    # --- 1. Klasifikasi sisi per-destinasi (himpunan uji berlabel) ----------
    baris = []           # untuk CSV: satu baris per destinasi berlabel
    tp = fp = fn = tn = 0
    tak_terlabel = 0
    for p in rekam:
        kab = deteksi_kabupaten(p.get("address"))
        if kab is None:
            tak_terlabel += 1
            continue
        truth_samosir = (kab == "Samosir")
        pred_samosir = (sisi_danau(p) == "samosir")
        if truth_samosir and pred_samosir:
            tp += 1
            hasil = "TP"
        elif not truth_samosir and pred_samosir:
            fp += 1
            hasil = "FP"
        elif truth_samosir and not pred_samosir:
            fn += 1
            hasil = "FN"
        else:
            tn += 1
            hasil = "TN"
        baris.append({
            "place-name": p.get("place-name"),
            "kabupaten_ground_truth": kab,
            "truth_butuh_feri_side": "samosir" if truth_samosir else "mainland",
            "prediksi_sisi_danau": "samosir" if pred_samosir else "mainland",
            "hasil": hasil,
        })

    metrik_sisi = _metrics(tp, fp, fn, tn)
    confusion = {"TP": tp, "FP": fp, "FN": fn, "TN": tn}
    n_berlabel = tp + fp + fn + tn

    # --- 2. Keputusan penyeberangan tingkat-pasangan (cari_feri) ------------
    # Sampel pasangan destinasi berlabel; ground truth "butuh feri" = sisi beda.
    berlabel = [p for p in rekam if deteksi_kabupaten(p.get("address")) is not None]
    def _truth_side(p):
        return "samosir" if deteksi_kabupaten(p.get("address")) == "Samosir" else "mainland"

    rng = random.Random(seed)
    semua_pasangan = list(itertools.combinations(range(len(berlabel)), 2))
    if len(semua_pasangan) > n_pasangan_sampel:
        semua_pasangan = rng.sample(semua_pasangan, n_pasangan_sampel)

    ptp = pfp = pfn = ptn = 0
    for i, j in semua_pasangan:
        a, b = berlabel[i], berlabel[j]
        truth_cross = _truth_side(a) != _truth_side(b)
        pred_cross = ferry_detector.cari_feri(a, b) is not None
        if truth_cross and pred_cross:
            ptp += 1
        elif not truth_cross and pred_cross:
            pfp += 1
        elif truth_cross and not pred_cross:
            pfn += 1
        else:
            ptn += 1
    metrik_pasangan = _metrics(ptp, pfp, pfn, ptn)
    confusion_pasangan = {"TP": ptp, "FP": pfp, "FN": pfn, "TN": ptn}

    # --- Tulis CSV ----------------------------------------------------------
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["# Ferry Detector — klasifikasi sisi danau per destinasi"])
        w.writerow(["# ground truth: deteksi_kabupaten (independen) ; prediksi: sisi_danau"])
        w.writerow([])
        w.writerow(["place-name", "kabupaten_ground_truth",
                    "truth_butuh_feri_side", "prediksi_sisi_danau", "hasil"])
        for r in baris:
            w.writerow([r["place-name"], r["kabupaten_ground_truth"],
                        r["truth_butuh_feri_side"], r["prediksi_sisi_danau"], r["hasil"]])
        w.writerow([])
        w.writerow(["# Confusion matrix (positif = sisi Samosir / butuh feri)"])
        w.writerow(["", "pred_samosir", "pred_mainland"])
        w.writerow(["truth_samosir", tp, fn])
        w.writerow(["truth_mainland", fp, tn])
        w.writerow([])
        w.writerow(["metrik", "nilai_%"])
        for k, v in metrik_sisi.items():
            w.writerow([k, v])
        w.writerow(["destinasi_berlabel", n_berlabel])
        w.writerow(["destinasi_tak_terlabel", tak_terlabel])
        w.writerow([])
        w.writerow(["# Keputusan penyeberangan tingkat-pasangan (cari_feri)"])
        w.writerow(["pasangan_diuji", ptp + pfp + pfn + ptn])
        for k, v in metrik_pasangan.items():
            w.writerow([k, v])

    return {
        "metrik_sisi": metrik_sisi,
        "confusion": confusion,
        "n_berlabel": n_berlabel,
        "n_tak_terlabel": tak_terlabel,
        "metrik_pasangan": metrik_pasangan,
        "confusion_pasangan": confusion_pasangan,
        "n_pasangan": ptp + pfp + pfn + ptn,
        "csv_path": str(csv_path),
    }
