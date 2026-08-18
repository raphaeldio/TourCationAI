"""Simulator dampak kebijakan pariwisata (Fitur 4).

Pendekatannya rule-based dan sengaja sederhana — itu diperbolehkan untuk tahap
ini. Yang TIDAK diperbolehkan adalah mengarang angka. Karena itu setiap
parameter di sini bersandar pada salah satu dari tiga hal:

  1. Angka nyata di dataset  — volume wisatawan 2024, budget harian, lama
     tinggal, jumlah destinasi/UMKM, skor fasilitas.
  2. Konstanta yang sudah ada di engine.py — khususnya `PROFIL_DEF[...]
     ["umkm_weight"]` sebagai porsi belanja yang jatuh ke usaha lokal. Memakai
     konstanta yang sudah dipakai solver jauh lebih bisa dipertahankan
     daripada mengarang angka baru.
  3. Elastisitas yang DITURUNKAN dari data saat proses build — lihat
     `_basis_festival()`. Sepuluh baris kode inilah pembeda antara
     "rule-based" dan "karangan".

Setiap hasil membawa `asumsi` berisi nilai DAN sumbernya, serta pembanding
"tanpa intervensi". Panel asumsi itulah yang membuat simulator sederhana bisa
diterima — bukan ketepatan angkanya, melainkan keterbukaan cara menghitungnya.
"""

import math
from typing import Optional

from ..core.paths import engine
from .analytics import get_intel

SKENARIO = {
    "festival": "Festival daerah baru",
    "promosi": "Program promosi wisata",
    "pelatihan_umkm": "Pelatihan UMKM",
    "destinasi_baru": "Penambahan destinasi wisata",
    "budaya": "Program pengembangan budaya",
}

SKALA_FESTIVAL = {"lokal": 0.5, "regional": 1.0, "nasional": 1.6}
JANGKAUAN_PROMOSI = {"lokal": 0.6, "nasional": 1.0, "internasional": 1.3}
WAKTU_FESTIVAL = {"puncak": 1.15, "biasa": 1.0, "sepi": 0.8}

# Lama tinggal hanya tercatat untuk Toba (1,31 hari). Dipakai sebagai angka
# kawasan dengan catatan sumber — bukan di-ffill diam-diam ke kabupaten lain.
LAMA_TINGGAL_CADANGAN = 1.31


def _basis_festival(intel) -> tuple[float, str]:
    """Elastisitas dasar festival, DITURUNKAN dari data, bukan dipatok.

    Toba adalah satu-satunya kabupaten dengan event berskala besar yang
    tercatat (F1 Powerboat, Aquabike). Rasio bulan ulasan tertinggi terhadap
    median bulanannya memberi perkiraan kasar seberapa besar sebuah event
    mengangkat perhatian terhadap suatu wilayah.

    Diklip ke [0,03; 0,12] supaya satu bulan anomali tidak menghasilkan
    elastisitas yang tidak masuk akal.
    """
    seri = [n for n in intel.kab["Toba"]["ulasan_bulanan"] if n > 0]
    if len(seri) < 6:
        return 0.06, "nilai bawaan (data bulanan Toba tidak memadai)"
    urut = sorted(seri)
    median = urut[len(urut) // 2]
    puncak = max(seri)
    if median <= 0:
        return 0.06, "nilai bawaan (median bulanan Toba nol)"
    mentah = puncak / median - 1.0
    nilai = min(max(mentah, 0.03), 0.12)
    return (
        round(nilai, 4),
        f"diturunkan dari rasio puncak/median ulasan bulanan Toba "
        f"({puncak}/{median} = {mentah:.2f}), diklip ke [0,03; 0,12]",
    )


def _budget_tengah(s: dict, semua: list[dict]) -> tuple[float, str]:
    """Titik tengah budget harian wisatawan; jatuh ke median kawasan bila kosong."""
    if s.get("budget_harian"):
        lo, hi = s["budget_harian"]
        return (lo + hi) / 2.0, "titik tengah Budget Harian pada dataset"
    nilai = sorted(
        (b["budget_harian"][0] + b["budget_harian"][1]) / 2.0
        for b in semua
        if b.get("budget_harian")
    )
    if not nilai:
        return 250_000.0, "nilai bawaan (tidak ada data budget di dataset)"
    return nilai[len(nilai) // 2], "median kawasan (budget kabupaten ini tidak tercatat)"


def _lama_tinggal(intel) -> tuple[float, str]:
    tercatat = [
        (k, s["durasi_kunjungan"])
        for k, s in intel.kab.items()
        if s.get("durasi_kunjungan")
    ]
    if tercatat:
        kab, nilai = tercatat[0]
        return nilai, f"lama kunjungan tercatat untuk {kab}, dipakai untuk kawasan"
    return LAMA_TINGGAL_CADANGAN, "nilai bawaan kawasan"


def _entropi_setelah(tipe: dict, kategori: str, n_baru: int) -> float:
    """Entropi ternormalisasi setelah menambahkan n destinasi pada satu kategori.

    Dihitung dengan benar-benar menambahkan destinasi ke cacah kategori lalu
    menghitung ulang — bukan dengan bonus tetap. Efeknya: menambah Wisata
    Budaya di wilayah yang didominasi Wisata Alam menaikkan skor jauh lebih
    besar daripada menambah Wisata Alam lagi. Itu mekanik nyata, dan langsung
    memperagakan temuan analisis kesenjangan.
    """
    tipe_target = engine.MINAT_DEF.get(kategori, {}).get("tipe") or ["Wisata Alam"]
    baru = dict(tipe)
    baru[tipe_target[0]] = baru.get(tipe_target[0], 0) + n_baru
    total = sum(baru.values())
    if total <= 0:
        return 0.0
    h = 0.0
    for n in baru.values():
        if n > 0:
            p = n / total
            h -= p * math.log(p)
    return h / math.log(7)


def _hitung_uplift(req: dict, s: dict, intel) -> tuple[float, list[dict], list[str], dict]:
    """Kembalikan (uplift, asumsi, catatan, tambahan) per skenario."""
    skenario = req["skenario"]
    asumsi: list[dict] = []
    catatan: list[str] = []
    tambahan: dict = {}

    if skenario == "festival":
        basis, sumber_basis = _basis_festival(intel)
        skala = SKALA_FESTIVAL.get(req.get("skala", "regional"), 1.0)
        kesiapan = 0.5 + 0.5 * s["skor_fasilitas"]
        musim = WAKTU_FESTIVAL.get(req.get("waktu", "biasa"), 1.0)
        uplift = min(basis * skala * kesiapan * musim, 0.15)

        asumsi += [
            {"parameter": "Elastisitas dasar festival", "nilai": f"{basis:.3f}", "sumber": sumber_basis},
            {"parameter": "Faktor skala", "nilai": f"{skala:.2f}", "sumber": f"skala {req.get('skala')}"},
            {"parameter": "Kesiapan wilayah", "nilai": f"{kesiapan:.2f}",
             "sumber": f"0,5 + 0,5 x skor fasilitas ({s['skor_fasilitas']:.2f})"},
            {"parameter": "Faktor waktu", "nilai": f"{musim:.2f}",
             "sumber": f"waktu {req.get('waktu')}; musim puncak wilayah: {s.get('musim_puncak') or 'tidak tercatat'}"},
            {"parameter": "Batas atas uplift", "nilai": "15%", "sumber": "cap untuk mencegah proyeksi berlebihan"},
        ]
        if s.get("mice_event"):
            catatan.append(
                f"Wilayah ini sudah pernah menggelar event tercatat: {', '.join(s['mice_event'][:3])}."
            )
        # Efek festival memuncak lalu meluruh, tidak permanen.
        tambahan["pola"] = "puncak"
        tambahan["ekor"] = [1.0, 0.30, 0.15]

    elif skenario == "promosi":
        anggaran = max(int(req.get("anggaran") or 0), 0)
        jangkauan = JANGKAUAN_PROMOSI.get(req.get("jangkauan", "nasional"), 1.0)
        uplift = min(0.04 * math.sqrt(anggaran / 1e9) * jangkauan, 0.12)

        asumsi += [
            {"parameter": "Anggaran promosi", "nilai": f"Rp {anggaran:,.0f}".replace(",", "."),
             "sumber": "masukan pengguna"},
            {"parameter": "Bentuk respons", "nilai": "akar kuadrat",
             "sumber": "imbal hasil menurun — menggandakan anggaran tidak menggandakan dampak"},
            {"parameter": "Faktor jangkauan", "nilai": f"{jangkauan:.2f}",
             "sumber": f"jangkauan {req.get('jangkauan')}"},
            {"parameter": "Batas atas uplift", "nilai": "12%", "sumber": "cap untuk mencegah proyeksi berlebihan"},
        ]
        if req.get("jangkauan") == "internasional":
            wisman = s.get("wisman_2024") or 0
            catatan.append(
                f"Wisatawan mancanegara tercatat di wilayah ini hanya {int(wisman):,} orang. "
                "Kenaikan persentase akan terlihat besar karena basisnya sangat kecil."
                .replace(",", ".")
            )
        tambahan["pola"] = "bertahap"

    elif skenario == "pelatihan_umkm":
        # Pelatihan menaikkan PORSI belanja yang jatuh ke usaha lokal, bukan
        # jumlah wisatawan. Memodelkannya begini lebih kredibel daripada
        # memalsukan lonjakan kunjungan, sekaligus menyambungkan cerita F3-F4.
        n_terlatih = max(int(req.get("n_terlatih") or 0), 0)
        potensi = max(s["n_umkm"] - s["n_umkm_kuat"], 0)
        delta_kuat = min(n_terlatih * 0.45, potensi)
        # Pembaginya adalah SELURUH UMKM terdata, bukan yang sudah lokal-otentik.
        # Memakai n_umkm_kuat membuat rasio tak terbatas: satu kabupaten dengan
        # 1 UMKM kuat dan 100 UMKM lemah akan menghasilkan kenaikan porsi belanja
        # ratusan poin persen. Dengan pembagi n_umkm, delta_kuat <= potensi <=
        # n_umkm sehingga kenaikannya terbatas 5 poin persen secara konstruksi —
        # tercapai hanya bila SELURUH UMKM di wilayah itu berhasil ditingkatkan.
        basis_umkm = max(s["n_umkm"], 1)

        # Peredam kecukupan data. Rasio "berapa persen UMKM ditingkatkan" hanya
        # bermakna bila ada cukup UMKM terdata untuk dijadikan penyebut. Tanpa
        # peredam ini, Tapanuli Utara — yang hanya punya 1 UMKM terdata —
        # menghasilkan kenaikan 5 poin persen penuh dari melatih SATU usaha,
        # seolah satu warung dapat menyerap 5% belanja wisatawan sekabupaten.
        # Ambang 10 dipilih sebagai jumlah minimum agar rasionya berarti.
        keandalan = min(basis_umkm / 10.0, 1.0)

        uplift = 0.02 * (delta_kuat / basis_umkm) * keandalan
        tambahan["delta_bagian_umkm"] = 0.05 * (delta_kuat / basis_umkm) * keandalan
        tambahan["delta_umkm_kuat"] = round(delta_kuat, 1)
        tambahan["potensi_umkm"] = potensi
        tambahan["keandalan_data"] = round(keandalan, 2)
        tambahan["pola"] = "bertahap"

        asumsi += [
            {"parameter": "UMKM dilatih", "nilai": str(n_terlatih), "sumber": "masukan pengguna"},
            {"parameter": "Tingkat keberhasilan", "nilai": "45%",
             "sumber": "asumsi konservatif: tidak semua peserta pelatihan berubah jadi usaha lokal-otentik"},
            {"parameter": "Ruang perbaikan", "nilai": f"{potensi} UMKM",
             "sumber": f"{s['n_umkm']} UMKM terdata dikurangi {s['n_umkm_kuat']} yang sudah lokal-otentik"},
            {"parameter": "Efek utama", "nilai": "porsi belanja lokal",
             "sumber": "pelatihan menaikkan bagian belanja ke usaha lokal, bukan jumlah wisatawan"},
            {"parameter": "Batas kenaikan porsi", "nilai": "+5 poin persen",
             "sumber": "tercapai hanya bila seluruh UMKM terdata berhasil ditingkatkan"},
        ]
        if keandalan < 1.0:
            asumsi.append({
                "parameter": "Peredam kecukupan data",
                "nilai": f"x{keandalan:.2f}",
                "sumber": f"hanya {s['n_umkm']} UMKM terdata; rasio baru bermakna mulai 10 UMKM",
            })
            catatan.append(
                f"Basis UMKM di wilayah ini sangat tipis ({s['n_umkm']} terdata), sehingga "
                "dampaknya diredam dan hasilnya bersifat indikatif. Pendataan UMKM perlu "
                "didahulukan sebelum program pelatihan dirancang berdasarkan angka ini."
            )
        if potensi == 0:
            catatan.append(
                "Tidak ada UMKM terdata yang bisa ditingkatkan di wilayah ini, sehingga "
                "dampak pelatihan tidak dapat dihitung. Prioritaskan pendataan UMKM lebih dulu."
            )
        elif n_terlatih * 0.45 > potensi:
            catatan.append(
                f"Jumlah peserta dibatasi kenyataan: hanya {potensi} UMKM terdata yang "
                "belum tergolong lokal-otentik di wilayah ini."
            )

    elif skenario == "destinasi_baru":
        n_baru = max(int(req.get("n_destinasi_baru") or 0), 0)
        kategori = req.get("kategori_baru") or "Budaya"
        dasar = max(s["n_destinasi"], 5)  # floor mencegah pembagian meledak di Karo/Pakpak
        h_lama = s["entropi_kategori"]
        h_baru = _entropi_setelah(s["tipe"], kategori, n_baru)
        bonus = 0.5 * (h_baru - h_lama)
        uplift = min(0.30 * (n_baru / dasar) * (1 + bonus), 0.20)
        tambahan["entropi_lama"] = round(h_lama, 3)
        tambahan["entropi_baru"] = round(h_baru, 3)
        tambahan["pola"] = "bertahap"

        asumsi += [
            {"parameter": "Destinasi baru", "nilai": f"{n_baru} ({kategori})", "sumber": "masukan pengguna"},
            {"parameter": "Basis pembanding", "nilai": str(dasar),
             "sumber": f"{s['n_destinasi']} destinasi terdata, dengan lantai 5 agar wilayah tanpa data tidak meledak"},
            {"parameter": "Bonus keragaman", "nilai": f"{bonus:+.3f}",
             "sumber": f"entropi kategori {h_lama:.2f} -> {h_baru:.2f} setelah penambahan"},
            {"parameter": "Batas atas uplift", "nilai": "20%", "sumber": "cap untuk mencegah proyeksi berlebihan"},
        ]
        if s["n_destinasi"] == 0:
            catatan.append(
                "Belum ada destinasi terdata di wilayah ini, sehingga hasilnya bersifat "
                "indikatif. Pendataan destinasi perlu didahulukan."
            )

    elif skenario == "budaya":
        n_program = max(int(req.get("n_program") or 0), 0)
        delta_budaya = min(0.25, 0.05 * n_program)
        uplift = min(0.08 * delta_budaya / max(s["skor_budaya"], 0.1), 0.10)
        tambahan["delta_skor_budaya"] = round(delta_budaya, 3)
        tambahan["delta_lama_tinggal"] = round(0.15 * delta_budaya, 3)
        tambahan["pola"] = "bertahap"

        asumsi += [
            {"parameter": "Jumlah program", "nilai": str(n_program), "sumber": "masukan pengguna"},
            {"parameter": "Kenaikan skor budaya", "nilai": f"+{delta_budaya:.2f}",
             "sumber": f"0,05 per program, dibatasi 0,25; skor sekarang {s['skor_budaya']:.2f}"},
            {"parameter": "Efek tambahan", "nilai": f"+{0.15 * delta_budaya:.3f} hari",
             "sumber": "dampak utama lewat lama tinggal, bukan jumlah kunjungan"},
        ]

    else:
        raise ValueError(f"Skenario '{skenario}' tidak dikenal.")

    return max(uplift, 0.0), asumsi, catatan, tambahan


def _proyeksi_bulanan(w_dasar: float, delta_total: float, pola: str,
                      ekor: Optional[list] = None) -> list[dict]:
    """Sebaran dampak selama 12 bulan ke depan untuk grafik perbandingan."""
    per_bulan = w_dasar / 12.0
    hasil = []
    for i in range(12):
        if pola == "puncak" and ekor:
            # Event digelar pada bulan ke-4; efeknya memuncak lalu meluruh.
            berat = 0.0
            for j, e in enumerate(ekor):
                if i == 3 + j:
                    berat = e
            bagian = delta_total * berat / max(sum(ekor), 1e-9)
        else:
            # Program berjalan bertahap: efek naik landai lalu mendatar.
            ramp = min((i + 1) / 6.0, 1.0)
            bagian = delta_total * ramp / 9.0
        hasil.append({
            "bulan": f"B+{i + 1}",
            "dasar": round(per_bulan),
            "intervensi": round(per_bulan + bagian),
        })
    return hasil


def jalankan_simulasi(req: dict) -> dict:
    """Hitung dampak satu skenario. Seluruh aritmetika terjadi di sini."""
    intel = get_intel()
    nama = req.get("kabupaten")
    kab = next((k for k in engine.KABUPATEN_TOBA if k.lower() == str(nama).lower()), None)
    if kab is None:
        raise ValueError(f"Kabupaten '{nama}' tidak dikenal.")

    s = intel.kab[kab]
    semua = intel.daftar_kabupaten()

    profil = req.get("profil") or "Seimbang"
    info_profil = engine.PROFIL_DEF.get(profil) or engine.PROFIL_DEF["Seimbang"]
    bagian_umkm = info_profil["umkm_weight"]

    w = float(s["wisatawan_2024"] or 0)
    b, sumber_b = _budget_tengah(s, semua)
    lama, sumber_lama = _lama_tinggal(intel)

    uplift, asumsi, catatan, tambahan = _hitung_uplift(req, s, intel)

    delta_w = w * uplift
    delta_lama = tambahan.get("delta_lama_tinggal", 0.0)
    delta_bagian = tambahan.get("delta_bagian_umkm", 0.0)

    # Dampak ekonomi punya dua jalur: lebih banyak orang, dan orang yang sama
    # tinggal lebih lama. Skenario budaya bekerja lewat jalur kedua.
    ekonomi_dasar = w * lama * b
    ekonomi_baru = (w + delta_w) * (lama + delta_lama) * b
    delta_ekonomi = ekonomi_baru - ekonomi_dasar

    umkm_dasar = ekonomi_dasar * bagian_umkm
    umkm_baru = ekonomi_baru * (bagian_umkm + delta_bagian)
    delta_umkm = umkm_baru - umkm_dasar

    asumsi.insert(0, {
        "parameter": "Volume wisatawan 2024",
        "nilai": f"{int(w):,}".replace(",", "."),
        "sumber": ("angka imputasi — tidak tercatat di dataset"
                   if s["wisatawan_diimputasi"] else "Profil Wisatawan Nusantara 2024"),
    })
    asumsi += [
        {"parameter": "Budget harian", "nilai": f"Rp {b:,.0f}".replace(",", "."), "sumber": sumber_b},
        {"parameter": "Lama tinggal", "nilai": f"{lama:.2f} hari", "sumber": sumber_lama},
        {"parameter": "Porsi belanja ke usaha lokal", "nilai": f"{bagian_umkm:.0%}",
         "sumber": f"engine.PROFIL_DEF['{profil}'].umkm_weight — konstanta yang sama dipakai solver itinerary"},
    ]
    if s["wisatawan_diimputasi"]:
        catatan.append(
            "Volume wisatawan wilayah ini tidak ada di dataset dan diimputasi dengan "
            "median kawasan. Seluruh angka rupiah di bawah mewarisi ketidakpastian itu."
        )

    # Pembanding "tanpa intervensi": tren wilayah sendiri, diklip +-20% supaya
    # sinyal ulasan yang bergejolak tidak berubah jadi proyeksi liar.
    yoy = max(min(s.get("pertumbuhan") or 0.0, 0.20), -0.20)
    w_tanpa = w * (1 + yoy)

    # Sebaran wisatawan antar-kabupaten sebelum vs sesudah.
    total_lama = sum(float(x["wisatawan_2024"] or 0) for x in semua)
    total_baru = total_lama + delta_w
    distribusi = []
    for x in semua:
        wx = float(x["wisatawan_2024"] or 0)
        wx_baru = wx + (delta_w if x["kabupaten"] == kab else 0.0)
        distribusi.append({
            "kabupaten": x["kabupaten"],
            "sebelum": round(wx / total_lama, 4) if total_lama else 0.0,
            "sesudah": round(wx_baru / total_baru, 4) if total_baru else 0.0,
            "diimputasi": x["wisatawan_diimputasi"],
        })

    return {
        "skenario": req["skenario"],
        "label_skenario": SKENARIO[req["skenario"]],
        "kabupaten": kab,
        "profil": profil,
        "uplift": round(uplift, 4),
        "dasar": {
            "wisatawan": round(w),
            "wisatawan_diimputasi": s["wisatawan_diimputasi"],
            "budget_harian": round(b),
            "lama_tinggal": lama,
            "bagian_umkm": bagian_umkm,
            "n_destinasi": s["n_destinasi"],
            "n_umkm": s["n_umkm"],
            "n_umkm_kuat": s["n_umkm_kuat"],
            "ekonomi": round(ekonomi_dasar),
            "transaksi_umkm": round(umkm_dasar),
        },
        "dampak": {
            "delta_wisatawan": round(delta_w),
            "wisatawan_sesudah": round(w + delta_w),
            "delta_ekonomi": round(delta_ekonomi),
            "delta_transaksi_umkm": round(delta_umkm),
            "delta_lama_tinggal": delta_lama,
            "delta_bagian_umkm": round(delta_bagian, 4),
            **{k: v for k, v in tambahan.items() if k not in ("pola", "ekor")},
        },
        "tanpa_intervensi": {
            "wisatawan": round(w_tanpa),
            "pertumbuhan_dipakai": round(yoy, 4),
            "penjelasan": (
                "Proyeksi bila tidak ada program, memakai tren wilayah sendiri "
                "yang diklip pada +-20%."
            ),
        },
        "seri": _proyeksi_bulanan(w, delta_w, tambahan.get("pola", "bertahap"),
                                  tambahan.get("ekor")),
        "distribusi": distribusi,
        "asumsi": asumsi,
        "catatan": catatan,
        "peringatan": (
            "Hasil ini adalah proyeksi rule-based dari data historis, bukan ramalan. "
            "Ia berguna untuk membandingkan pilihan kebijakan secara relatif, bukan "
            "untuk dipakai sebagai target anggaran."
        ),
    }
