"""Lapisan intelijen pariwisata: agregat per kabupaten dari CSV.

Seluruh angka di sini diturunkan dari 14 CSV di data/ — tidak ada data sintetis
dan tidak ada angka karangan. Bila sebuah sinyal tidak bisa didukung data, ia
dikembalikan sebagai None beserta alasannya, bukan diisi tebakan.

Sumber utama dan keterbatasannya
--------------------------------
* wisata-metadata / resto-metadata  -> jumlah destinasi & UMKM per kabupaten,
  dipetakan dengan engine.deteksi_kabupaten(). Karo & Pakpak Bharat menghasilkan
  NOL destinasi terdata; itu sebagian artefak cakupan dataset, bukan bukti tidak
  ada wisata di sana. Karena itu label yang benar adalah "0 destinasi TERDATA".
* wisata-v2 / resto-hotel-v2        -> proksi permintaan dari volume ulasan.
  Lihat review_dates.py untuk aturan bucket bulanan.
* Info_Seputar_Danau_Toba           -> volume wisatawan 2024, budget harian,
  musim, event MICE. Hanya memuat ~3 contoh per kabupaten, sehingga kolom
  fasilitasnya adalah INDIKATOR KEBERADAAN, bukan cacah/sensus.

Pembangunan objek Intelligence bersifat malas (lazy) dan dikunci; lihat
get_intel(). Sengaja TIDAK dibangun saat startup supaya /api/health tetap
responsif ketika instance Render bangun dari tidur.
"""

import math
import re
import threading
import unicodedata
from datetime import date
from typing import Optional

from ..core.paths import DATA_DIR, engine
from .review_dates import bucket_bulan, klasifikasi_umur, offset_hari

_PREFIX = "Dataset_HackathonTourism_-_IT_DEL__1_-"

# Batas jumlah ulasan per tempat yang tampak dipakai saat scraping. Tempat yang
# menyentuh angka ini punya riwayat terpotong; lihat _tandai_tersensor().
BATAS_SCRAPE = 200

BERKAS = {
    "wisata_meta": f"{_PREFIX}wisata-metadata_typed.csv",
    "resto_meta": f"{_PREFIX}resto-metadata_typed.csv",
    "wisata_ulasan": f"{_PREFIX}wisata-v2_typed.csv",
    "resto_ulasan": f"{_PREFIX}resto-hotel-v2_typed.csv",
    "info_seputar": f"{_PREFIX}Info_Seputar_Danau_Toba_typed.csv",
    "atraksi": f"{_PREFIX}Attractions_Info_typed.csv",
    "operasional": f"{_PREFIX}waktu_operasional_destinasi_typed.csv",
}

# Kata kunci untuk sinyal yang tidak punya kolom terstruktur di dataset.
_KATA_KELUARGA = re.compile(r"\b(keluarga|anak[- ]?anak|anak|family|ramah anak)\b", re.I)
_KATA_BUDAYA = re.compile(r"\b(budaya|adat|sejarah|batak|bolon|ulos|tradisional)\b", re.I)

# Jumlah kategori place-type berbeda di dataset; penyebut normalisasi entropi.
_N_KATEGORI = 7


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------
def kunci_nama(nama) -> str:
    """Kunci join ternormalisasi.

    Kecocokan persis nama tempat hanya menutup 87/138 tempat berulasan;
    normalisasi menaikkannya ke 101/138. Selisihnya berasal dari beda tanda
    baca, spasi ganda, dan huruf beraksen.
    """
    teks = unicodedata.normalize("NFKD", str(nama or ""))
    teks = teks.encode("ascii", "ignore").decode()
    teks = re.sub(r"[^a-z0-9 ]", " ", teks.lower())
    return re.sub(r"\s+", " ", teks).strip()


def _angka(teks) -> Optional[float]:
    """Ambil angka pertama dari teks bercampur ('2,595,069' -> 2595069)."""
    if teks is None:
        return None
    m = re.search(r"\d[\d.,]*", str(teks))
    if not m:
        return None
    bersih = m.group(0).replace(".", "").replace(",", "")
    try:
        return float(bersih)
    except ValueError:
        return None


def _semua_angka(teks) -> list[float]:
    """Semua angka dalam teks, untuk rentang seperti 'Rp 150.000 - 300.000'."""
    hasil = []
    for m in re.finditer(r"\d[\d.,]*", str(teks or "")):
        bersih = m.group(0).replace(".", "").replace(",", "")
        try:
            hasil.append(float(bersih))
        except ValueError:
            continue
    return hasil


def _kosong(nilai) -> bool:
    return nilai is None or str(nilai).strip().lower() in ("", "nan", "none", "-")


def _norm(nilai: float, lo: float, hi: float) -> float:
    """Min-max ke [0,1]; 0 bila seluruh nilai sama (tak ada informasi pembeda)."""
    if hi - lo < 1e-9:
        return 0.0
    return max(0.0, min(1.0, (nilai - lo) / (hi - lo)))


def _entropi(cacah: dict) -> float:
    """Entropi Shannon ternormalisasi atas sebaran kategori."""
    total = sum(cacah.values())
    if total <= 0:
        return 0.0
    h = 0.0
    for n in cacah.values():
        if n <= 0:
            continue
        p = n / total
        h -= p * math.log(p)
    return h / math.log(_N_KATEGORI)


def _jam_tutup(teks) -> Optional[float]:
    """Jam tutup dalam desimal dari '07.00 - 21.30' atau '24 jam'."""
    if _kosong(teks):
        return None
    t = str(teks).lower()
    if "24" in t and "jam" in t:
        return 24.0
    jam = re.findall(r"(\d{1,2})[.:](\d{2})", t)
    if not jam:
        return None
    h, m = jam[-1]
    nilai = int(h) + int(m) / 60.0
    return nilai if 0 <= nilai <= 24 else None


# ---------------------------------------------------------------------------
# Objek intelijen
# ---------------------------------------------------------------------------
class Intelligence:
    """Agregat siap saji. Immutable setelah dibangun."""

    def __init__(self, data_dir: str = DATA_DIR):
        import pandas as pd

        self.pd = pd
        self.data_dir = data_dir
        self.dibangun = date.today().isoformat()
        self.catatan: list[str] = []

        self._muat_metadata()
        self._muat_ulasan()
        self._muat_info_seputar()
        self._hitung_skor()
        self._hitung_tren()

    # -- pemuatan -----------------------------------------------------------
    def _baca(self, kunci_berkas: str):
        import os
        try:
            return self.pd.read_csv(os.path.join(self.data_dir, BERKAS[kunci_berkas]))
        except Exception:  # noqa: BLE001 — berkas boleh tidak ada
            self.catatan.append(f"berkas {kunci_berkas} tidak terbaca")
            return self.pd.DataFrame()

    def _muat_metadata(self):
        """Destinasi & UMKM per kabupaten, plus atribut per tempat."""
        wisata = self._baca("wisata_meta")
        resto = self._baca("resto_meta")

        self.kab: dict[str, dict] = {
            k: {
                "kabupaten": k,
                "n_destinasi": 0,
                "n_umkm": 0,
                "n_umkm_kuat": 0,
                "tipe": {},
                "rating_wisata": [],
                "rating_umkm": [],
                "harga_umkm": [],
                "jam_tutup": [],
            }
            for k in engine.KABUPATEN_TOBA
        }

        self.tempat: dict[str, dict] = {}
        self.tanpa_kabupaten = {"wisata": 0, "umkm": 0}

        for _, r in wisata.iterrows():
            kab = engine.deteksi_kabupaten(r.get("address"))
            nama = str(r.get("place-name") or "").strip()
            tipe = str(r.get("place-type") or "").strip() or "Lainnya"
            tutup = _jam_tutup(r.get("operational-hour"))
            if kab is None:
                self.tanpa_kabupaten["wisata"] += 1
            else:
                s = self.kab[kab]
                s["n_destinasi"] += 1
                s["tipe"][tipe] = s["tipe"].get(tipe, 0) + 1
                if not _kosong(r.get("place-rating")):
                    s["rating_wisata"].append(float(r["place-rating"]))
                if tutup is not None:
                    s["jam_tutup"].append(tutup)
            if nama:
                self.tempat[kunci_nama(nama)] = {
                    "nama": nama,
                    "jenis": "wisata",
                    "kabupaten": kab,
                    "tipe": tipe,
                    "kategori": engine.minat_dari_tipe(tipe) or "Lainnya",
                    "rating": None if _kosong(r.get("place-rating")) else float(r["place-rating"]),
                    "lat": None if _kosong(r.get("latitude")) else float(r["latitude"]),
                    "lon": None if _kosong(r.get("longitude")) else float(r["longitude"]),
                    "buka_malam": bool(tutup is not None and tutup >= 20.0),
                }

        kuliner = engine.muat_kuliner_khas(self.data_dir)
        for _, r in resto.iterrows():
            kab = engine.deteksi_kabupaten(r.get("address"))
            nama = str(r.get("place-name") or "").strip()
            skor = engine.skor_umkm(r.to_dict(), kuliner)
            harga = _angka(r.get("harga_min"))
            if kab is None:
                self.tanpa_kabupaten["umkm"] += 1
            else:
                s = self.kab[kab]
                s["n_umkm"] += 1
                if skor["is_umkm_kuat"]:
                    s["n_umkm_kuat"] += 1
                if not _kosong(r.get("place-rating")):
                    s["rating_umkm"].append(float(r["place-rating"]))
                if harga:
                    s["harga_umkm"].append(harga)
            if nama:
                self.tempat.setdefault(kunci_nama(nama), {
                    "nama": nama,
                    "jenis": "umkm",
                    "kabupaten": kab,
                    "tipe": str(r.get("place-type") or "Restoran"),
                    "kategori": "Kuliner",
                    "rating": None if _kosong(r.get("place-rating")) else float(r["place-rating"]),
                    "lat": None if _kosong(r.get("latitude")) else float(r["latitude"]),
                    "lon": None if _kosong(r.get("longitude")) else float(r["longitude"]),
                    "skor_umkm": skor["skor_umkm"],
                    "umkm_kuat": skor["is_umkm_kuat"],
                })

    def _muat_ulasan(self):
        """Seri bulanan volume ulasan per tempat + rasio kata kunci per kabupaten.

        Dibaca dengan usecols dan dibuang segera setelah agregasi supaya jejak
        memori tetap kecil (dua berkas ini ~22 ribu baris).
        """
        for s in self.kab.values():
            s["ulasan_bulanan"] = [0] * 12
            s["ulasan_baseline"] = 0
            s["ulasan_berteks"] = 0
            s["cocok_keluarga"] = 0
            s["cocok_budaya"] = 0

        for t in self.tempat.values():
            t["ulasan_bulanan"] = [0] * 12
            t["ulasan_baseline"] = 0
            t["n_ulasan"] = 0
            t["offset_maks_hari"] = 0.0

        total_baris = 0
        terpetakan = 0
        tak_terbaca = 0

        for berkas in ("wisata_ulasan", "resto_ulasan"):
            df = self._baca(berkas)
            if not len(df):
                continue

            acuan = None
            if "scraped-at-date" in df.columns:
                tanggal = self.pd.to_datetime(df["scraped-at-date"], errors="coerce")
                if tanggal.notna().any():
                    acuan = tanggal.max().date()

            for _, r in df.iterrows():
                total_baris += 1
                k = kunci_nama(r.get("place-name"))
                tempat = self.tempat.get(k)
                umur = klasifikasi_umur(r.get("published-at"))
                if umur == "tak_terbaca":
                    tak_terbaca += 1

                bucket = bucket_bulan(r.get("published-at"), r.get("scraped-at-date"), acuan)

                if tempat is not None:
                    terpetakan += 1
                    tempat["n_ulasan"] += 1
                    hari = offset_hari(r.get("published-at"))
                    if hari is not None:
                        tempat["offset_maks_hari"] = max(tempat["offset_maks_hari"], hari)
                    if bucket is not None:
                        tempat["ulasan_bulanan"][bucket] += 1
                    elif umur == "baseline":
                        tempat["ulasan_baseline"] += 1

                    kab = tempat.get("kabupaten")
                    if kab:
                        # Sinyal kata kunci dihitung dari SEMUA ulasan; sensor
                        # scrape tidak memengaruhinya karena ini rasio, bukan tren.
                        teks = r.get("review-text")
                        if not _kosong(teks):
                            s = self.kab[kab]
                            s["ulasan_berteks"] += 1
                            if _KATA_KELUARGA.search(str(teks)):
                                s["cocok_keluarga"] += 1
                            if _KATA_BUDAYA.search(str(teks)):
                                s["cocok_budaya"] += 1

            del df

        self._tandai_tersensor()
        self._gulung_ke_kabupaten()

        self.cakupan_ulasan = {
            "baris_total": total_baris,
            "baris_terpetakan": terpetakan,
            "rasio": round(terpetakan / total_baris, 4) if total_baris else 0.0,
            "label_tak_terbaca": tak_terbaca,
            "tempat_tersensor": self.n_tersensor,
            "catatan_sensor": (
                f"{self.n_tersensor} tempat menyentuh batas scrape {BATAS_SCRAPE} "
                "ulasan sementara riwayatnya belum menembus 12 bulan. Riwayatnya "
                "terpotong, sehingga pertumbuhannya TIDAK dapat diukur dan tempat "
                "tersebut dikeluarkan dari peringkat tren serta dari seri kabupaten."
            ),
        }

    def _tandai_tersensor(self):
        """Tandai tempat yang riwayat ulasannya terpotong batas scrape.

        Contoh nyata: "Damar Toba ~ Lakeside Eatery & Stay" punya tepat 200
        ulasan yang SELURUHNYA berumur <= 30 hari. Scraper berhenti di batas 200
        sebelum menyentuh ulasan lama, jadi paruh "6 bulan sebelumnya" kosong
        bukan karena sepi, melainkan karena tidak terlihat. Tanpa penandaan ini,
        tempat semacam itu selalu muncul sebagai pertumbuhan tertinggi — dan
        daftar "menurun" selalu kosong, yang jelas tidak masuk akal.
        """
        self.n_tersensor = 0
        for t in self.tempat.values():
            tersensor = (
                t["n_ulasan"] >= BATAS_SCRAPE
                and t["offset_maks_hari"] < 365.0
            )
            t["tersensor"] = tersensor
            if tersensor:
                self.n_tersensor += 1

    def _gulung_ke_kabupaten(self):
        """Jumlahkan seri per tempat ke kabupaten, TANPA tempat tersensor."""
        for s in self.kab.values():
            s["tempat_tersensor"] = 0
        for t in self.tempat.values():
            kab = t.get("kabupaten")
            if not kab:
                continue
            s = self.kab[kab]
            if t["tersensor"]:
                s["tempat_tersensor"] += 1
                continue
            for i, n in enumerate(t["ulasan_bulanan"]):
                s["ulasan_bulanan"][i] += n
            s["ulasan_baseline"] += t["ulasan_baseline"]

    def _muat_info_seputar(self):
        """Volume wisatawan, budget, musim, event MICE, dan cakupan fasilitas."""
        df = self._baca("info_seputar")
        fasilitas = engine.FasilitasUmum(data_dir=self.data_dir)

        kol_wisnus = next(
            (c for c in df.columns if "Wisatawan Nusantara" in c), None)
        kol_wisman = next(
            (c for c in df.columns if "Wisatawan Internasional" in c), None)
        kol_budget = next((c for c in df.columns if "Budget Harian" in c), None)
        kol_durasi = next((c for c in df.columns if "Durasi Kunjungan" in c), None)
        kol_mice = next((c for c in df.columns if "MICE_Jenis Event" in c), None)
        kol_peak = next((c for c in df.columns if "Peak Season" in c), None)
        kol_cafe = next((c for c in df.columns if c.startswith("Kuliner_Café")), None)
        kol_bar = next((c for c in df.columns if "Pub & Bar" in c), None)
        kol_daya_tarik = [c for c in df.columns if c.startswith("Daya Tarik Wisata")]

        for s in self.kab.values():
            s.update({
                "wisatawan_2024": None,
                "wisatawan_diimputasi": False,
                "wisman_2024": None,
                "budget_harian": None,
                "durasi_kunjungan": None,
                "musim_puncak": None,
                "mice_event": [],
                "ada_cafe": False,
                "ada_pub_bar": False,
                "daya_tarik": [],
            })

        mentah: dict[str, list[float]] = {k: [] for k in engine.KABUPATEN_TOBA}

        for _, r in df.iterrows():
            nama = str(r.get("Nama Kabupaten") or "").strip()
            kab = next((k for k in engine.KABUPATEN_TOBA if k.lower() == nama.lower()), None)
            if kab is None:
                continue
            s = self.kab[kab]

            if kol_wisnus and not _kosong(r.get(kol_wisnus)):
                nilai = _angka(r.get(kol_wisnus))
                if nilai:
                    mentah[kab].append(nilai)
            if kol_wisman and s["wisman_2024"] is None and not _kosong(r.get(kol_wisman)):
                s["wisman_2024"] = _angka(r.get(kol_wisman))
            if kol_budget and s["budget_harian"] is None and not _kosong(r.get(kol_budget)):
                angka = [a for a in _semua_angka(r.get(kol_budget)) if a >= 1000]
                if angka:
                    s["budget_harian"] = [min(angka), max(angka)]
            if kol_durasi and s["durasi_kunjungan"] is None and not _kosong(r.get(kol_durasi)):
                teks = str(r.get(kol_durasi)).replace(",", ".")
                m = re.search(r"\d+(?:\.\d+)?", teks)
                if m:
                    s["durasi_kunjungan"] = float(m.group(0))
            if kol_peak and s["musim_puncak"] is None and not _kosong(r.get(kol_peak)):
                s["musim_puncak"] = str(r.get(kol_peak)).strip()
            if kol_mice and not _kosong(r.get(kol_mice)):
                ev = str(r.get(kol_mice)).strip()
                if ev not in s["mice_event"]:
                    s["mice_event"].append(ev)
            if kol_cafe and not _kosong(r.get(kol_cafe)):
                s["ada_cafe"] = True
            if kol_bar and not _kosong(r.get(kol_bar)):
                s["ada_pub_bar"] = True
            for c in kol_daya_tarik:
                if not _kosong(r.get(c)):
                    teks = str(r.get(c)).strip()
                    if teks not in s["daya_tarik"]:
                        s["daya_tarik"].append(teks)

        # Duplikat konflik: Pakpak Bharat punya dua baris (116.321 dan 751.225).
        # Nilai kedua identik dengan angka Toba — jelas salah salin. Ambil yang
        # terkecil, yang konsisten dengan kabupaten terkecil di kawasan ini.
        for kab, nilai in mentah.items():
            if nilai:
                self.kab[kab]["wisatawan_2024"] = min(nilai)
                if len(set(nilai)) > 1:
                    self.catatan.append(
                        f"{kab}: nilai wisatawan ganda {sorted(set(nilai))}, diambil minimum")

        # Humbang Hasundutan kosong dan Tapanuli Utara tidak punya baris sama
        # sekali. Diimputasi dengan median yang diketahui DAN ditandai, bukan
        # dibiarkan nol (nol akan salah dibaca sebagai "tidak ada wisatawan").
        diketahui = sorted(
            v["wisatawan_2024"] for v in self.kab.values() if v["wisatawan_2024"]
        )
        if diketahui:
            tengah = diketahui[len(diketahui) // 2]
            for s in self.kab.values():
                if not s["wisatawan_2024"]:
                    s["wisatawan_2024"] = tengah
                    s["wisatawan_diimputasi"] = True
                    self.catatan.append(
                        f"{s['kabupaten']}: volume wisatawan tidak ada di dataset, "
                        f"diimputasi dengan median {int(tengah):,}")

        # Cakupan fasilitas = berapa dari 9 jenis yang ADA (indikator keberadaan,
        # bukan cacah — Info_Seputar hanya memuat ~3 contoh per kabupaten).
        for kab, s in self.kab.items():
            punya = fasilitas.per_kabupaten.get(kab, {})
            ada = [j["kunci"] for j in engine.JENIS_FASILITAS if punya.get(j["kunci"])]
            s["fasilitas_ada"] = ada
            s["skor_fasilitas"] = round(len(ada) / len(engine.JENIS_FASILITAS), 3)

        self._muat_atraksi_tambahan()

    def _muat_atraksi_tambahan(self):
        """Deskripsi atraksi dari Attractions_Info.

        Penting karena berkas ini memuat baris untuk Karo dan Pakpak Bharat —
        dua kabupaten yang metadata utamanya kosong. Tanpa ini, kartu gap untuk
        keduanya tidak punya konten sama sekali.
        """
        df = self._baca("atraksi")
        for s in self.kab.values():
            s["atraksi_terdokumentasi"] = []
        if not len(df):
            return
        for _, r in df.iterrows():
            nama = str(r.get("Nama Kabupaten") or "").strip()
            kab = next((k for k in engine.KABUPATEN_TOBA if k.lower() == nama.lower()), None)
            if kab is None:
                continue
            judul = str(r.get("Nama Atraksi") or "").strip()
            if judul:
                self.kab[kab]["atraksi_terdokumentasi"].append({
                    "nama": judul,
                    "deskripsi": (str(r.get("Deskripsi") or "").strip()[:400] or None),
                    "harga_tiket": (str(r.get("Ticket Prices") or "").strip() or None),
                })

    # -- skor ---------------------------------------------------------------
    def _hitung_skor(self):
        """Skor komposit per kabupaten. Semua dinormalisasi lintas 8 kabupaten."""
        for s in self.kab.values():
            s["entropi_kategori"] = round(_entropi(s["tipe"]), 3)
            s["rating_rata2_wisata"] = (
                round(sum(s["rating_wisata"]) / len(s["rating_wisata"]), 2)
                if s["rating_wisata"] else None)
            s["rating_rata2_umkm"] = (
                round(sum(s["rating_umkm"]) / len(s["rating_umkm"]), 2)
                if s["rating_umkm"] else None)

            # Persentil harga disembunyikan pada n < 5: dengan sampel sekecil itu
            # p25/p75 lebih menyesatkan daripada informatif.
            harga = sorted(s["harga_umkm"])
            if len(harga) >= 5:
                s["pita_harga"] = {
                    "n": len(harga),
                    "p25": int(harga[len(harga) // 4]),
                    "p50": int(harga[len(harga) // 2]),
                    "p75": int(harga[(3 * len(harga)) // 4]),
                }
            else:
                s["pita_harga"] = {"n": len(harga), "p25": None, "p50": None, "p75": None}

            n_malam = sum(1 for j in s["jam_tutup"] if j >= 20.0)
            s["rasio_malam"] = round(n_malam / len(s["jam_tutup"]), 3) if s["jam_tutup"] else 0.0
            s["skor_malam"] = round(
                0.60 * s["rasio_malam"]
                + 0.25 * (1.0 if s["ada_pub_bar"] else 0.0)
                + 0.15 * (1.0 if s["ada_cafe"] else 0.0), 3)

            tipe_rekreasi = set(engine.MINAT_DEF["Rekreasi"]["tipe"])
            tipe_budaya = set(engine.MINAT_DEF["Budaya"]["tipe"])
            n_dest = max(s["n_destinasi"], 1)
            s["share_rekreasi"] = round(
                sum(v for t, v in s["tipe"].items() if t in tipe_rekreasi) / n_dest, 3)
            s["share_budaya"] = round(
                sum(v for t, v in s["tipe"].items() if t in tipe_budaya) / n_dest, 3)

            berteks = max(s["ulasan_berteks"], 1)
            s["rate_keluarga"] = round(s["cocok_keluarga"] / berteks, 4)
            s["rate_budaya"] = round(s["cocok_budaya"] / berteks, 4)

            teks_daya_tarik = " ".join(s["daya_tarik"]).lower()
            s["ada_cagar_budaya"] = bool(
                re.search(r"cagar budaya|desa wisata|museum|situs", teks_daya_tarik))

        # Normalisasi lintas kabupaten.
        def rentang(field):
            nilai = [s[field] for s in self.kab.values()]
            return min(nilai), max(nilai)

        lo_kel, hi_kel = rentang("rate_keluarga")
        lo_bud, hi_bud = rentang("rate_budaya")
        lo_rek, hi_rek = rentang("share_rekreasi")
        lo_sbud, hi_sbud = rentang("share_budaya")

        for s in self.kab.values():
            s["skor_keluarga"] = round(
                0.45 * _norm(s["share_rekreasi"], lo_rek, hi_rek)
                + 0.55 * _norm(s["rate_keluarga"], lo_kel, hi_kel), 3)
            s["skor_budaya"] = round(
                0.40 * _norm(s["share_budaya"], lo_sbud, hi_sbud)
                + 0.30 * (1.0 if s["ada_cagar_budaya"] else 0.0)
                + 0.30 * _norm(s["rate_budaya"], lo_bud, hi_bud), 3)

            # Buang penampung mentah agar payload tetap ramping.
            for buang in ("rating_wisata", "rating_umkm", "harga_umkm", "jam_tutup"):
                s.pop(buang, None)

    def _hitung_tren(self):
        """Pertumbuhan/penurunan berbasis paruh 6 bulan, dengan uji bukti.

        Patokan pembanding BUKAN 50/50. Seluruh dataset condong ke ulasan baru
        — Google menampilkan ulasan terbaru lebih dulu dan scraping dilakukan
        sekali di Juli 2025 — sehingga hampir semua tempat akan tampak "tumbuh"
        bila diuji terhadap null datar. Karena itu null-nya adalah proporsi
        nasional yang teramati: sebuah tempat disebut tumbuh hanya bila ia
        tumbuh LEBIH CEPAT daripada kawasan secara keseluruhan.
        """
        nas_baru = nas_lama = 0
        for t in self.tempat.values():
            if t.get("tersensor"):
                continue
            seri = t.get("ulasan_bulanan") or [0] * 12
            nas_baru += sum(seri[0:6])
            nas_lama += sum(seri[6:12])
        total_nas = nas_baru + nas_lama
        null_share = (nas_baru / total_nas) if total_nas else 0.5
        self.null_share = round(null_share, 4)
        self.bias_resensi = {
            "share_baru_nasional": self.null_share,
            "ulasan_6_terakhir": nas_baru,
            "ulasan_6_sebelumnya": nas_lama,
            "penjelasan": (
                "Proporsi ulasan 6 bulan terakhir terhadap 12 bulan di seluruh "
                "kawasan. Dipakai sebagai patokan null; nilai di atas 0,5 "
                "menunjukkan bias resensi bawaan sumber data, bukan lonjakan "
                "kunjungan."
            ),
        }

        for wadah in (self.kab.values(), self.tempat.values()):
            for s in wadah:
                seri = s.get("ulasan_bulanan") or [0] * 12
                baru = sum(seri[0:6])
                lama = sum(seri[6:12])
                n = baru + lama
                s["ulasan_12_bulan"] = n
                s["ulasan_6_terakhir"] = baru
                s["ulasan_6_sebelumnya"] = lama

                growth = (baru + 1) / (lama + 1) - 1.0
                share = (baru + 1) / (n + 2)
                se = math.sqrt(max(share * (1 - share) / (n + 2), 1e-12))
                z = (share - null_share) / max(se, 1e-6)

                # Tanpa aktivitas pada paruh sebelumnya, rasio pertumbuhan
                # meledak tanpa arti (+8100%). Yang informatif bukan angkanya,
                # melainkan fakta bahwa tidak ada riwayat pembanding.
                s["tanpa_pembanding"] = bool(lama == 0 and baru > 0)
                s["pertumbuhan"] = round(min(growth, 3.0), 3)
                s["pertumbuhan_terpotong"] = bool(growth > 3.0)
                s["z"] = round(z, 2)

                # Sensor scrape didahulukan: riwayat yang terpotong membuat
                # pertumbuhan tidak terdefinisi, sebesar apa pun angkanya.
                if s.get("tersensor"):
                    s["status_tren"] = "TERSENSOR"
                # Butuh efek DAN bukti: perubahan besar dari 3 ulasan bukan tren.
                elif n < 30:
                    s["status_tren"] = "DATA TIPIS"
                elif s["tanpa_pembanding"]:
                    # Tidak ada aktivitas 6 bulan sebelumnya: kemungkinan tempat
                    # baru terdaftar, bukan tempat lama yang melonjak.
                    s["status_tren"] = "BARU MUNCUL"
                elif growth >= 0.25 and z >= 1.64:
                    s["status_tren"] = "NAIK CEPAT"
                elif growth <= -0.25 and z <= -1.64:
                    s["status_tren"] = "TURUN"
                else:
                    s["status_tren"] = "STABIL"

                dasar = s.get("ulasan_baseline") or 0
                s["yoy_kasar"] = round(n / dasar - 1.0, 3) if dasar else None

    # -- penyajian ----------------------------------------------------------
    def daftar_kabupaten(self) -> list[dict]:
        return [self.kab[k] for k in engine.KABUPATEN_TOBA]

    def ringkas(self) -> dict:
        total_dest = sum(s["n_destinasi"] for s in self.kab.values())
        total_umkm = sum(s["n_umkm"] for s in self.kab.values())
        total_kuat = sum(s["n_umkm_kuat"] for s in self.kab.values())
        kategori: dict[str, int] = {}
        for s in self.kab.values():
            for t, n in s["tipe"].items():
                nama = engine.minat_dari_tipe(t) or "Lainnya"
                kategori[nama] = kategori.get(nama, 0) + n

        return {
            "total_destinasi": total_dest,
            "total_umkm": total_umkm,
            "total_umkm_kuat": total_kuat,
            "total_kabupaten": len(self.kab),
            "kabupaten_tanpa_destinasi": [
                k for k, s in self.kab.items() if s["n_destinasi"] == 0],
            "kabupaten_tanpa_umkm": [
                k for k, s in self.kab.items() if s["n_umkm"] == 0],
            "sebaran_kategori": kategori,
            "total_ulasan_12_bulan": sum(s["ulasan_12_bulan"] for s in self.kab.values()),
            "cakupan_ulasan": self.cakupan_ulasan,
            "tanpa_kabupaten": self.tanpa_kabupaten,
            "dibangun": self.dibangun,
            "catatan": self.catatan,
            "sumber": "Agregat langsung dari 14 CSV dataset; tanpa data sintetis.",
            "peringatan_proksi": (
                "Volume ulasan adalah PROKSI permintaan, bukan jumlah kunjungan. "
                "Jumlah destinasi/UMKM adalah yang TERDATA di dataset; nol berarti "
                "belum terdata, bukan tidak ada."
            ),
        }

    def tempat_teratas(self, batas: int = 10, jenis: str | None = None) -> list[dict]:
        pool = [t for t in self.tempat.values()
                if t.get("kabupaten") and (jenis is None or t["jenis"] == jenis)]
        pool.sort(key=lambda t: (t.get("ulasan_12_bulan", 0), t.get("rating") or 0), reverse=True)
        return pool[:batas]

    def tren_tempat(self, status: str, batas: int = 8) -> list[dict]:
        """Peringkat tren. Tempat tersensor tidak pernah masuk daftar."""
        pool = [t for t in self.tempat.values()
                if t.get("status_tren") == status
                and t.get("kabupaten")
                and not t.get("tersensor")]
        balik = status != "TURUN"
        pool.sort(key=lambda t: t.get("pertumbuhan", 0), reverse=balik)
        return pool[:batas]


# ---------------------------------------------------------------------------
# Singleton malas
# ---------------------------------------------------------------------------
_INTEL: Optional[Intelligence] = None
_LOCK = threading.Lock()


def get_intel() -> Intelligence:
    """Bangun sekali per proses. Aman dipanggil dari beberapa thread."""
    global _INTEL
    if _INTEL is None:
        with _LOCK:
            if _INTEL is None:
                _INTEL = Intelligence()
    return _INTEL


def reset_intel() -> None:
    """Paksa bangun ulang (dipakai endpoint admin & pengujian)."""
    global _INTEL
    with _LOCK:
        _INTEL = None
