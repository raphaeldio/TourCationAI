"""Analisis kesenjangan pengembangan wisata per kabupaten (Fitur 2).

Tujuh sumbu, masing-masing dinormalisasi lintas 8 kabupaten, digabung jadi satu
skor GAP (tinggi = makin tertinggal). Prioritas mengalikan kesenjangan dengan
permintaan yang SUDAH ada, sehingga yang naik ke atas adalah wilayah dengan
"banyak pengunjung, sedikit pasokan" — bukan sekadar wilayah paling sepi.

Setiap temuan membawa `bukti` berisi angka mentah supaya bisa dibantah. Analisis
yang tidak bisa dibantah tidak berguna bagi pengambil kebijakan.
"""

from ..core.paths import engine
from .analytics import _norm, get_intel

BOBOT = {
    "destinasi": 0.22,
    "umkm": 0.20,
    "ragam": 0.16,
    "budaya": 0.12,
    "keluarga": 0.10,
    "malam": 0.10,
    "fasilitas": 0.10,
}

LABEL_SUMBU = {
    "destinasi": "Jumlah destinasi",
    "umkm": "UMKM pendukung",
    "ragam": "Ragam kategori wisata",
    "budaya": "Aktivitas budaya",
    "keluarga": "Aktivitas keluarga",
    "malam": "Aktivitas malam",
    "fasilitas": "Fasilitas penunjang",
}

# Titik peta untuk kabupaten yang tidak punya satu pun destinasi terdata,
# sehingga centroid tidak bisa dihitung dari data. Ditandai "tanpa data" di UI.
PUSAT_CADANGAN = {
    "Karo": (3.1053, 98.4914),            # Kabanjahe
    "Pakpak Bharat": (2.6167, 98.1667),   # Salak
}


def _centroid(intel, kabupaten: str):
    titik = [
        (t["lat"], t["lon"])
        for t in intel.tempat.values()
        if t.get("kabupaten") == kabupaten and t.get("lat") and t.get("lon")
    ]
    if titik:
        return (
            round(sum(p[0] for p in titik) / len(titik), 5),
            round(sum(p[1] for p in titik) / len(titik), 5),
            False,
        )
    lat, lon = PUSAT_CADANGAN.get(kabupaten, (2.6845, 98.8756))  # tengah Danau Toba
    return (lat, lon, True)


def _rekomendasi(sumbu: dict, s: dict) -> list[dict]:
    """Rekomendasi rule-based dari sumbu terlemah. Bukan keluaran LLM."""
    urut = sorted(sumbu.items(), key=lambda kv: kv[1], reverse=True)
    saran = []
    for nama, nilai in urut[:3]:
        if nilai < 0.35:  # sudah cukup baik, tidak perlu direkomendasikan
            continue
        if nama == "destinasi":
            teks = ("Prioritaskan pendataan dan pengembangan destinasi: baru "
                    f"{s['n_destinasi']} destinasi terdata di dataset.")
        elif nama == "umkm":
            teks = (f"Dorong UMKM pendukung — {s['n_umkm']} UMKM terdata "
                    f"({s['n_umkm_kuat']} tergolong lokal-otentik) untuk "
                    f"{s['n_destinasi']} destinasi.")
        elif nama == "ragam":
            teks = ("Diversifikasi jenis wisata; sebaran kategori masih terpusat "
                    f"(entropi ternormalisasi {s['entropi_kategori']}).")
        elif nama == "budaya":
            teks = "Kembangkan atraksi budaya terjadwal (sanggar, festival adat, museum)."
        elif nama == "keluarga":
            teks = "Tambah fasilitas ramah keluarga: area anak, jalur aman, paket keluarga."
        elif nama == "malam":
            teks = ("Perpanjang jam operasional dan kembangkan aktivitas malam; "
                    f"baru {int(s['rasio_malam'] * 100)}% destinasi buka sampai 20.00.")
        else:
            teks = ("Lengkapi fasilitas penunjang; baru "
                    f"{len(s['fasilitas_ada'])} dari {len(engine.JENIS_FASILITAS)} "
                    "jenis fasilitas tercatat.")
        saran.append({"sumbu": LABEL_SUMBU[nama], "skor_gap": round(nilai, 3), "saran": teks})
    return saran


def analisis_gap() -> dict:
    """Skor gap + prioritas + bukti untuk seluruh kabupaten."""
    intel = get_intel()
    daftar = intel.daftar_kabupaten()

    def rentang(ambil):
        nilai = [ambil(s) for s in daftar]
        return min(nilai), max(nilai)

    lo_dest, hi_dest = rentang(lambda s: s["n_destinasi"])
    lo_rasio, hi_rasio = rentang(
        lambda s: s["n_umkm_kuat"] / max(s["n_destinasi"], 1))
    lo_wis, hi_wis = rentang(lambda s: s["wisatawan_2024"] or 0)

    hasil = []
    for s in daftar:
        rasio_umkm = s["n_umkm_kuat"] / max(s["n_destinasi"], 1)
        sumbu = {
            "destinasi": 1.0 - _norm(s["n_destinasi"], lo_dest, hi_dest),
            "umkm": 1.0 - _norm(rasio_umkm, lo_rasio, hi_rasio),
            "ragam": 1.0 - s["entropi_kategori"],
            "budaya": 1.0 - s["skor_budaya"],
            "keluarga": 1.0 - s["skor_keluarga"],
            "malam": 1.0 - s["skor_malam"],
            "fasilitas": 1.0 - s["skor_fasilitas"],
        }
        gap = sum(BOBOT[k] * v for k, v in sumbu.items())
        permintaan = _norm(s["wisatawan_2024"] or 0, lo_wis, hi_wis)
        prioritas = gap * (0.5 + 0.5 * permintaan)

        lat, lon, tanpa_data = _centroid(intel, s["kabupaten"])

        hasil.append({
            "kabupaten": s["kabupaten"],
            "skor_gap": round(gap, 4),
            "skor_prioritas": round(prioritas, 4),
            "permintaan_ternormalisasi": round(permintaan, 3),
            "sumbu": {k: round(v, 3) for k, v in sumbu.items()},
            "sumbu_label": LABEL_SUMBU,
            "bukti": {
                "n_destinasi": s["n_destinasi"],
                "n_umkm": s["n_umkm"],
                "n_umkm_kuat": s["n_umkm_kuat"],
                "entropi_kategori": s["entropi_kategori"],
                "skor_fasilitas": s["skor_fasilitas"],
                "fasilitas_ada": s["fasilitas_ada"],
                "rasio_malam": s["rasio_malam"],
                "wisatawan_2024": int(s["wisatawan_2024"]) if s["wisatawan_2024"] else None,
                "wisatawan_diimputasi": s["wisatawan_diimputasi"],
                "ulasan_12_bulan": s["ulasan_12_bulan"],
                "mice_event": s["mice_event"],
            },
            "peta": {"lat": lat, "lon": lon, "tanpa_data": tanpa_data},
            "atraksi_terdokumentasi": s["atraksi_terdokumentasi"][:4],
            "rekomendasi": _rekomendasi(sumbu, s),
            # Label eksplisit: nol di sini berarti belum terdata.
            "catatan_data": (
                "Tidak ada destinasi terdata di dataset untuk kabupaten ini. "
                "Attractions_Info memuat atraksi yang ada, sehingga kekosongan "
                "ini adalah celah PENDATAAN, bukan bukti ketiadaan wisata."
                if s["n_destinasi"] == 0 else None
            ),
        })

    hasil.sort(key=lambda h: h["skor_prioritas"], reverse=True)
    for i, h in enumerate(hasil, start=1):
        h["peringkat_prioritas"] = i

    return {
        "kabupaten": hasil,
        "bobot": BOBOT,
        "metodologi": (
            "Tujuh sumbu dinormalisasi min-max lintas 8 kabupaten (tinggi = "
            "makin tertinggal), digabung berbobot menjadi skor GAP. Prioritas = "
            "GAP x (0,5 + 0,5 x permintaan ternormalisasi), sehingga wilayah "
            "berpermintaan tinggi namun berpasokan rendah naik ke atas."
        ),
        "ringkas": get_intel().ringkas(),
    }
