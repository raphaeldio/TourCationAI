"""Mesin perencana perjalanan Danau Toba.

Itinerary disusun lewat Integer Linear Programming (PuLP + solver CBC), bukan
model generatif: destinasi, tempat makan, penginapan, urutan rute, dan alokasi
anggaran adalah hasil optimasi yang deterministik dan dapat direproduksi.

Komponen utama:
    BudgetSolverV3      optimasi ILP di bawah batas anggaran
    build_daily_routes  urutan kunjungan harian + estimasi jam
    FerryDetector       deteksi dan tarif penyeberangan ke Samosir
    skor_umkm           penilaian keberpihakan UMKM sebuah tempat makan
    FasilitasUmum       SPBU, ATM, dan fasilitas di sekitar rute
"""

import pandas as pd
import pulp
import math
import csv
import requests
from dataclasses import dataclass
from typing import List, Optional

DATA_DIR = "data"


def _baca_csv_hotel(path):
    """Baca CSV hotel yang rusak: setiap baris data terbungkus tanda kutip
    dan berakhiran ';;', dan header berakhiran ';;'. Sebagian place-name
    memuat koma tanpa kutip sehingga jumlah kolomnya berlebih."""
    df0 = pd.read_csv(path)
    header = [c[:-2] if c.endswith(";;") else c for c in df0.columns]
    n = len(header)
    baris = []
    for mentah in df0.iloc[:, 0].astype(str):
        mentah = mentah.rstrip()
        if mentah.endswith(";;"):
            mentah = mentah[:-2].rstrip()
        kolom = next(csv.reader([mentah]))
        if len(kolom) > n:  # koma tanpa kutip di dalam place-name
            lebih = len(kolom) - n
            kolom = [",".join(kolom[: lebih + 1])] + kolom[lebih + 1 :]
        baris.append(kolom)
    df = pd.DataFrame(baris, columns=header)
    for kol in ("place-rating", "harga_min", "harga_max", "latitude", "longitude"):
        if kol in df.columns:
            df[kol] = pd.to_numeric(df[kol], errors="coerce")
    return df


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


OSRM_BASE = "http://router.project-osrm.org"
_DIST_CACHE = {}


def road_distance_km(lat1, lon1, lat2, lon2, use_osrm=True):
    """Jarak dua titik (km) lewat OSRM; jatuh ke haversine bila OSRM mati."""
    key = (round(lat1, 6), round(lon1, 6), round(lat2, 6), round(lon2, 6), use_osrm)
    if key in _DIST_CACHE:
        return _DIST_CACHE[key]

    result = None
    if use_osrm:
        try:
            url = f"{OSRM_BASE}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
            resp = requests.get(url, params={"overview": "false"}, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                result = {
                    "jarak_km": round(route["distance"] / 1000.0, 2),
                    "durasi_menit": round(route["duration"] / 60.0, 1),
                    "sumber": "osrm",
                }
        except Exception:
            result = None

    if result is None:
        result = {"jarak_km": round(haversine_km(lat1, lon1, lat2, lon2), 2),
                  "durasi_menit": None, "sumber": "haversine"}

    _DIST_CACHE[key] = result
    return result


_GEOM_CACHE = {}


def road_geometry_line(lat1, lon1, lat2, lon2, use_osrm=True):
    """Bentuk GARIS JALAN antara dua titik, untuk digambar di peta."""
    key = (round(lat1, 5), round(lon1, 5), round(lat2, 5), round(lon2, 5), use_osrm)
    if key in _GEOM_CACHE:
        return _GEOM_CACHE[key]

    hasil = None
    if use_osrm:
        try:
            url = f"{OSRM_BASE}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
            resp = requests.get(url, params={"overview": "full", "geometries": "geojson"},
                                timeout=6)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                titik = data["routes"][0].get("geometry", {}).get("coordinates")
                if titik and len(titik) >= 2:
                    hasil = {"garis": [[float(x), float(y)] for x, y in titik],
                             "sumber": "osrm"}
        except Exception:
            hasil = None

    if hasil is None:
        hasil = {"garis": [[lon1, lat1], [lon2, lat2]], "sumber": "lurus"}

    _GEOM_CACHE[key] = hasil
    return hasil


def check_osrm_available():
    """Cek sekali apakah OSRM bisa diakses (untuk info di awal program)."""
    try:
        r = road_distance_km(2.5482791, 99.0812858, 2.3628718, 99.0308496, use_osrm=True)
        return r["sumber"] == "osrm"
    except Exception:
        return False


@dataclass
class ItineraryRequest:
    budget_total: int
    n_days: int
    n_nights: int
    kabupaten: Optional[str] = None
    min_meals_per_day: int = 3
    max_meals_per_day: int = 3
    min_attractions_per_day: int = 1
    max_attractions_per_day: int = 3
    budget_utilization_weight: float = 4.0
    distance_penalty_weight: float = 1.2
    use_osrm: bool = True
    profil_pilihan: Optional[str] = None
    umkm_weight: Optional[float] = None
    minat_wisata: Optional[List[str]] = None
    n_orang: int = 1
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    moda: str = "mobil"
    tanggal_mulai: Optional[str] = None
    hotel_pilihan: Optional[str] = None


PENALTI_SEBERANG_KM = 12.0

_UTIL_BASIS = "max"
_UTIL_BOBOT = 10.0

POLA_PENGINAPAN = (
    r"\b(?:hotel|resort|guest\s?house|homestay|home\s?stay|penginapan|villa|"
    r"cottage|losmen|wisma|bungalow|inn|stay)\b"
)


def hitung_jumlah_kamar(n_orang: int) -> int:
    """Kebutuhan kamar hotel dari jumlah orang: 1 kamar per 2 orang, dibulatkan ke atas."""
    n_orang = max(1, int(n_orang))
    return math.ceil(n_orang / 2)


PROFIL_DEF = {
    "Otentik Lokal":  {"umkm_weight": 0.50, "deskripsi": "Maksimal warung & kuliner khas Batak — pengalaman lokal otentik"},
    "Premium Lokal":  {"umkm_weight": 0.35, "deskripsi": "Pengalaman berkualitas yang tetap kuat mendukung usaha lokal"},
    "Seimbang":       {"umkm_weight": 0.22, "deskripsi": "Campuran seimbang antara otentik lokal & kenyamanan general"},
    "General":        {"umkm_weight": 0.08, "deskripsi": "Tempat mapan & umum (hotel-resto mainstream)"},
}


GAYA_JELAJAH = {
    "Dekat-dekat":  {"bobot": 1.2,  "deskripsi": "Tempat berdekatan, sedikit waktu di jalan"},
    "Seimbang":     {"bobot": 0.6,  "deskripsi": "Sesekali agak jauh demi tempat yang layak"},
    "Jelajah jauh": {"bobot": 0.15, "deskripsi": "Siap jauh & menyeberang demi ikon Danau Toba"},
}


MINAT_DEF = {
    "Alam": {
        "tipe": ["Wisata Alam"],
        "ikon": "🌄",
        "deskripsi": "Danau, bukit, air terjun, dan pantai",
    },
    "Budaya": {
        "tipe": ["Wisata Budaya / Sejarah", "Museum", "Balai Masyarakat"],
        "ikon": "🗿",
        "deskripsi": "Situs sejarah, museum, dan balai adat Batak",
    },
    "Rohani": {
        "tipe": ["Wisata Rohani"],
        "ikon": "🙏",
        "deskripsi": "Ziarah, gereja tua, salib, dan taman doa",
    },
    "Rekreasi": {
        "tipe": ["Wisata Buatan", "Wisata Bisnis"],
        "ikon": "🎡",
        "deskripsi": "Waterpark, kolam, taman hiburan, dan pasar oleh-oleh",
    },
}


def normalisasi_minat(minat) -> List[str]:
    """Bersihkan input minat dari UI jadi daftar nama minat yang valid & unik."""
    if not minat:
        return []
    if isinstance(minat, str):
        minat = [minat]
    bersih = []
    for m in minat:
        nama = str(m).strip()
        if nama in MINAT_DEF and nama not in bersih:
            bersih.append(nama)
    return bersih


def tipe_dari_minat(minat) -> set:
    """Kumpulan nilai 'place-type' yang termasuk dalam daftar minat terpilih."""
    tipe = set()
    for nama in normalisasi_minat(minat):
        tipe.update(MINAT_DEF[nama]["tipe"])
    return tipe


def minat_dari_tipe(place_type) -> Optional[str]:
    """Kebalikan tipe_dari_minat(): satu 'place-type' -> nama minat (atau None)."""
    if place_type is None:
        return None
    t = str(place_type).strip()
    for nama, info in MINAT_DEF.items():
        if t in info["tipe"]:
            return nama
    return None

AMBANG_PROFIL = [
    (300_000,      "Otentik Lokal"),
    (800_000,      "Seimbang"),
    (float("inf"), "Premium Lokal"),
]


def saran_profil_dari_budget(budget_total, n_days):
    """Sarankan profil dari budget PER HARI (dipakai bila turis tidak memilih)."""
    budget_per_hari = budget_total / max(n_days, 1)
    for batas, nama in AMBANG_PROFIL:
        if budget_per_hari <= batas:
            return nama
    return "Seimbang"


def tentukan_profil(req):
    """Profil turis: pilihan eksplisit menang atas saran dari budget per hari."""
    budget_per_hari = int(req.budget_total / max(req.n_days, 1))

    if req.profil_pilihan and req.profil_pilihan in PROFIL_DEF:
        nama = req.profil_pilihan
        sumber = "dipilih turis"
    else:
        nama = saran_profil_dari_budget(req.budget_total, req.n_days)
        sumber = "disarankan dari budget"

    info = PROFIL_DEF[nama]
    return {
        "nama": nama,
        "umkm_weight": info["umkm_weight"],
        "deskripsi": info["deskripsi"],
        "budget_per_hari": budget_per_hari,
        "sumber_profil": sumber,
        "profil_saran_budget": saran_profil_dari_budget(req.budget_total, req.n_days),
    }


def _dedup_tempat_sama(df, ambang_km: float = 0.5):
    """Buang baris yang MERUJUK tempat fisik yang sama dari satu kolam."""
    kunci = df["place-name"].astype(str).str.strip().str.casefold()
    urut = df.assign(_kunci=kunci).sort_values(
        "place-rating", ascending=False, kind="mergesort")
    simpan_idx = []
    disimpan = []
    for idx, row in urut.iterrows():
        k, lat, lon = row["_kunci"], row["latitude"], row["longitude"]
        kembar = any(k == kk and haversine_km(lat, lon, la, lo) < ambang_km
                     for kk, la, lo in disimpan)
        if not kembar:
            disimpan.append((k, lat, lon))
            simpan_idx.append(idx)
    return df.loc[simpan_idx].sort_index().reset_index(drop=True)


class BudgetSolverV3:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.hotels = _baca_csv_hotel(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-hotel-metadata_typed.csv")
        self.restos = pd.read_csv(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-resto-metadata_typed.csv")
        self.attractions = pd.read_csv(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-wisata-metadata_typed.csv")
        self.jadwal = JadwalOperasional(data_dir)
        self._clean()

    def _clean(self):
        need = ["harga_min", "place-rating", "latitude", "longitude"]
        self.hotels = self.hotels.dropna(subset=need).reset_index(drop=True)
        self.restos = self.restos.dropna(subset=need).reset_index(drop=True)
        self.attractions = self.attractions.dropna(subset=need).reset_index(drop=True)

        for atribut in ("hotels", "restos", "attractions"):
            setattr(self, atribut, _dedup_tempat_sama(getattr(self, atribut)))

        for df in (self.hotels, self.restos, self.attractions):
            df["harga_max"] = df["harga_max"].fillna(df["harga_min"])
            df["harga_tengah"] = (df["harga_min"] + df["harga_max"]) / 2
            df["sisi_danau"] = [sisi_danau(r) for r in df.to_dict("records")]

        nama_hotel = set(
            self.hotels["place-name"].astype(str).str.strip().str.casefold()
        )
        nama_resto = self.restos["place-name"].astype(str).str.strip().str.casefold()
        self.restos = self.restos[~nama_resto.isin(nama_hotel)]
        self.restos = self.restos[
            ~self.restos["place-name"].astype(str).str.contains(
                POLA_PENGINAPAN, case=False, regex=True, na=False)
        ].reset_index(drop=True)

    @staticmethod
    def _quality_score(rating, harga, harga_max_ref, price_weight=0.3):
        rating = float(rating)
        harga_norm = (float(harga) / harga_max_ref) * 5.0 if harga_max_ref > 0 else 0.0
        return (1 - price_weight) * rating + price_weight * harga_norm

    def _kandidat_hotel(self, req: ItineraryRequest, n_kamar: int,
                        kolam_wisata: pd.DataFrame, k: int = 5):
        """Daftar hotel yang layak dicoba sebagai acuan, terurut dari yang paling"""
        h = self.hotels.copy()
        if req.n_nights > 0:
            muat = h["harga_max"] * n_kamar * req.n_nights <= req.budget_total * 0.5
            if muat.any():
                h = h[muat]

        kuota = max(req.max_attractions_per_day * req.n_days, 1)
        lat_w = kolam_wisata["latitude"].to_numpy()
        lon_w = kolam_wisata["longitude"].to_numpy()
        sisi_w = list(kolam_wisata["sisi_danau"])

        def jarak_kuota(row):
            sisi_h = row["sisi_danau"]
            d = sorted(
                haversine_km(row["latitude"], row["longitude"], a, b)
                + (PENALTI_SEBERANG_KM if s != sisi_h else 0.0)
                for a, b, s in zip(lat_w, lon_w, sisi_w)
            )
            return sum(d[:kuota]) / min(kuota, len(d)) if d else 0.0

        h = h.assign(jarak_kuota=h.apply(jarak_kuota, axis=1))

        def norm(s, terbalik=False):
            lo, hi = s.min(), s.max()
            if hi - lo < 1e-9:
                return pd.Series(0.5, index=s.index)
            v = (s - lo) / (hi - lo)
            return 1 - v if terbalik else v

        biaya_inap = h["harga_tengah"] * n_kamar * max(req.n_nights, 0)
        h["skor_kandidat"] = (
            0.50 * norm(h["jarak_kuota"], terbalik=True)
            + 0.30 * norm(h["place-rating"])
            + 0.20 * norm(biaya_inap, terbalik=True)
        )
        return list(h.sort_values("skor_kandidat", ascending=False).index[:k])

    def solve(self, req: ItineraryRequest) -> dict:
        """Susun itinerary sesuai permintaan."""
        minat = normalisasi_minat(req.minat_wisata)
        hasil = self._solve_multi(req, minat)
        if hasil["status"] != "Optimal" and minat:
            hasil = self._solve_multi(req, [])
        return hasil

    def _solve_multi(self, req: ItineraryRequest, minat_dipakai: List[str],
                     k: int = 8) -> dict:
        """Jalankan ILP untuk k kandidat hotel, kembalikan yang objektifnya terbaik."""
        n_kamar = hitung_jumlah_kamar(req.n_orang)

        kolam = self.attractions
        tipe = tipe_dari_minat(minat_dipakai)
        if tipe:
            cocok = kolam[kolam["place-type"].isin(tipe)]
            if len(cocok) >= req.min_attractions_per_day * req.n_days:
                kolam = cocok

        if req.hotel_pilihan:
            idx = self._cari_hotel(req.hotel_pilihan)
            if idx is not None:
                hasil = self._solve_sekali(req, minat_dipakai, hotel_idx=idx)
                if hasil["status"] == "Optimal":
                    hasil["hotel_kandidat"] = self._ringkas_kandidat(
                        [hasil] + self._coba_kandidat(
                            req, minat_dipakai, kolam, n_kamar, k, kecuali=idx))
                    hasil["hotel_sumber"] = "pilihan_turis"
                return hasil

        semua = self._coba_kandidat(req, minat_dipakai, kolam, n_kamar, k)
        if not semua:
            return self._solve_sekali(req, minat_dipakai)

        semua.sort(key=lambda r: r["nilai_objektif"], reverse=True)
        terbaik = semua[0]
        terbaik["hotel_kandidat"] = self._ringkas_kandidat(semua)
        terbaik["hotel_sumber"] = "dipilih_sistem"
        return terbaik

    def _coba_kandidat(self, req, minat_dipakai, kolam, n_kamar, k, kecuali=None):
        """Jalankan ILP untuk tiap kandidat hotel; buang yang tidak terpecahkan."""
        hasil = []
        for idx in self._kandidat_hotel(req, n_kamar, kolam, k):
            if idx == kecuali:
                continue
            r = self._solve_sekali(req, minat_dipakai, hotel_idx=idx)
            if r["status"] == "Optimal":
                hasil.append(r)
        return hasil

    def _cari_hotel(self, nama: str) -> Optional[int]:
        """Indeks hotel berdasarkan nama, tidak peka huruf besar/kecil."""
        target = str(nama).strip().casefold()
        for i, n in self.hotels["place-name"].items():
            if str(n).strip().casefold() == target:
                return int(i)
        return None

    @staticmethod
    def _ringkas_kandidat(hasil: List[dict], n: int = 8) -> List[dict]:
        """Delapan hotel teratas beserta angka rencana yang BENAR-BENAR dihasilkan.

        Tiga pertama tampil langsung sebagai kartu pilihan; sisanya dibuka lewat
        tombol 'lihat lebih banyak' di antarmuka. Semuanya angka ILP sungguhan."""
        urut = sorted(hasil, key=lambda r: r["nilai_objektif"], reverse=True)[:n]
        ringkas = []
        for r in urut:
            h = r["hotel"][0]
            ringkas.append({
                "place-name": h["place-name"],
                "place-rating": h["place-rating"],
                "harga_tengah": h["harga_tengah"],
                "harga_min": h["harga_min"],
                "harga_max": h["harga_max"],
                "address": h.get("address"),
                "latitude": h["latitude"],
                "longitude": h["longitude"],
                "total_estimasi": r["total_estimasi"],
                "jarak_rata2_wisata": r["jarak_rata2_wisata_ke_hotel"],
                "nilai_objektif": r["nilai_objektif"],
            })
        return ringkas

    def ringkas_dengan_pilihan(self, result: dict, resto_terpilih: list,
                               hotel_per_malam: list = None) -> dict:
        """Hitung ulang ringkasan biaya & dampak lokal untuk kombinasi tempat makan"""
        hotel = result["hotel"][0]
        attraksi = result.get("attractions", [])
        n_orang = result.get("n_orang", 1)
        n_kamar = result.get("n_kamar", 1)
        n_nights = result.get("n_nights", 0)
        n_days = max(result.get("n_days", 1), 1)
        budget = result.get("budget_total", 0)

        if n_nights <= 0:
            malam = []
        elif hotel_per_malam:
            malam = list(hotel_per_malam)[:n_nights]
            malam += [hotel] * (n_nights - len(malam))
        else:
            malam = [hotel] * n_nights

        def _total(col):
            biaya_h = sum((h.get(col) or 0) for h in malam) * n_kamar
            biaya_r = sum((r.get(col) or 0) for r in resto_terpilih) * n_orang
            biaya_a = sum((a.get(col) or 0) for a in attraksi) * n_orang
            return biaya_h + biaya_r + biaya_a

        estimasi = _total("harga_tengah")
        kuliner_khas = muat_kuliner_khas(self.data_dir)
        return {
            "total_min": int(_total("harga_min")),
            "total_estimasi": int(estimasi),
            "total_max": int(_total("harga_max")),
            "sisa_estimasi": int(budget - estimasi),
            "persen_terpakai_estimasi": round(estimasi / budget * 100, 1) if budget else 0.0,
            "estimasi_biaya_per_hari": int(estimasi / n_days),
            "dampak_lokal": analisis_dampak_lokal(resto_terpilih, kuliner_khas, n_orang),
        }

    def _solve_sekali(self, req: ItineraryRequest, minat_dipakai: List[str],
                      hotel_idx: Optional[int] = None) -> dict:
        n_kamar = hitung_jumlah_kamar(req.n_orang)
        if hotel_idx is None:
            hotel_idx = self._kandidat_hotel(req, n_kamar, self.attractions, k=1)[0]
        hotel = self.hotels.loc[hotel_idx]

        pakai_lokasi_user = req.origin_lat is not None and req.origin_lon is not None
        if pakai_lokasi_user:
            h_lat, h_lon = float(req.origin_lat), float(req.origin_lon)
            titik_acuan = {
                "place-name": "Lokasi Anda",
                "latitude": h_lat,
                "longitude": h_lon,
                "jenis": "lokasi_user",
            }
        else:
            h_lat, h_lon = hotel["latitude"], hotel["longitude"]
            titik_acuan = {
                "place-name": hotel["place-name"],
                "latitude": h_lat,
                "longitude": h_lon,
                "jenis": "hotel",
            }

        profil = tentukan_profil(req)
        umkm_w = req.umkm_weight if req.umkm_weight is not None else profil["umkm_weight"]

        restos = self.restos.copy()
        attractions = self.attractions.copy()
        restos["jarak_hotel"] = restos.apply(lambda r: haversine_km(h_lat, h_lon, r["latitude"], r["longitude"]), axis=1)
        attractions["jarak_hotel"] = attractions.apply(lambda r: haversine_km(h_lat, h_lon, r["latitude"], r["longitude"]), axis=1)

        sisi_acuan = (sisi_danau(titik_acuan) if pakai_lokasi_user
                      else hotel["sisi_danau"])
        for df in (restos, attractions):
            df["jarak_efektif"] = df["jarak_hotel"] + (
                df["sisi_danau"] != sisi_acuan) * PENALTI_SEBERANG_KM

        min_meals = req.min_meals_per_day * req.n_days
        max_meals = req.max_meals_per_day * req.n_days
        min_attr = req.min_attractions_per_day * req.n_days
        max_attr = req.max_attractions_per_day * req.n_days

        tipe_diminati = tipe_dari_minat(minat_dipakai)
        if tipe_diminati:
            cocok = attractions[attractions["place-type"].isin(tipe_diminati)]
            if len(cocok) >= min_attr:
                attractions = cocok
            else:
                minat_dipakai = []

        if minat_dipakai:
            minat_status = "diterapkan"
        elif normalisasi_minat(req.minat_wisata):
            minat_status = "dilonggarkan"
        else:
            minat_status = "semua"

        jam_status = "tanpa data"
        wisata_ditolak_jam = []
        if self.jadwal is not None and self.jadwal.entri:
            rekam = attractions.to_dict("records")
            bisa_dikunjungi = set()
            for d in range(max(req.n_days, 1)):
                hari_d = hari_ke_indeks(req.tanggal_mulai, d)
                for jam_uji in (WINDOW_WISATA_PAGI[0], WINDOW_WISATA_SORE[0]):
                    lolos, _ = filter_open_places(
                        rekam, jam_uji, keep_unknown=True,
                        jadwal=self.jadwal, hari=hari_d)
                    bisa_dikunjungi.update(p.get("place-name") for p in lolos)

            tersaring = attractions[attractions["place-name"].isin(bisa_dikunjungi)]
            ditolak = sorted(set(attractions["place-name"]) - bisa_dikunjungi)
            if not ditolak:
                jam_status = "semua buka"
            elif len(tersaring) >= min_attr:
                attractions = tersaring
                jam_status = "diterapkan"
                wisata_ditolak_jam = ditolak
            else:
                jam_status = "dilonggarkan"
                wisata_ditolak_jam = ditolak

        ref_resto = restos["harga_min"].max()
        ref_attr = attractions["harga_min"].max() if attractions["harga_min"].max() > 0 else 1

        kuliner_khas = muat_kuliner_khas(self.data_dir)
        restos["skor_umkm"] = restos.apply(
            lambda r: skor_umkm(r.to_dict(), kuliner_khas)["skor_umkm"], axis=1)

        prob = pulp.LpProblem("ItineraryBudgetV3", pulp.LpMaximize)
        x_r = pulp.LpVariable.dicts("resto", restos.index, lowBound=0, upBound=1, cat="Integer")
        x_a = pulp.LpVariable.dicts("attraction", attractions.index, cat="Binary")

        max_jarak = max(restos["jarak_efektif"].max(), attractions["jarak_efektif"].max(), 1)

        def skor_with_dist(rating, harga, ref, jarak):
            q = self._quality_score(rating, harga, ref)
            penalti = (jarak / max_jarak) * 5.0 * req.distance_penalty_weight
            return q - penalti

        skor_resto = {i: skor_with_dist(restos.loc[i, "place-rating"], restos.loc[i, "harga_min"], ref_resto, restos.loc[i, "jarak_efektif"])
                      + umkm_w * 5.0 * restos.loc[i, "skor_umkm"]
                      for i in restos.index}
        skor_attr = {i: skor_with_dist(attractions.loc[i, "place-rating"], attractions.loc[i, "harga_min"], ref_attr, attractions.loc[i, "jarak_efektif"]) for i in attractions.index}

        if req.n_nights > 0:
            biaya_hotel_est = hotel["harga_tengah"] * n_kamar * req.n_nights
            biaya_hotel_max = hotel["harga_max"] * n_kamar * req.n_nights
        else:
            biaya_hotel_est = 0
            biaya_hotel_max = 0
        biaya_resto_est = pulp.lpSum(x_r[i] * restos.loc[i, "harga_tengah"] * req.n_orang for i in restos.index)
        biaya_wisata_est = pulp.lpSum(x_a[i] * attractions.loc[i, "harga_tengah"] * req.n_orang for i in attractions.index)
        biaya_resto_max = pulp.lpSum(x_r[i] * restos.loc[i, "harga_max"] * req.n_orang for i in restos.index)
        biaya_wisata_max = pulp.lpSum(x_a[i] * attractions.loc[i, "harga_max"] * req.n_orang for i in attractions.index)

        t_moda = TARIF_MODA.get(req.moda, TARIF_MODA["mobil"])
        if req.moda == "umum":
            tarif_umum, _, _ = _muat_tarif_transport(self.data_dir)
            biaya_transport_est = tarif_umum * req.n_orang * req.n_days
        else:
            biaya_transport_est = pulp.lpSum(
                x_a[i] * 2 * attractions.loc[i, "jarak_hotel"] * t_moda["biaya_per_km"]
                for i in attractions.index
            )

        total_est = biaya_hotel_est + biaya_resto_est + biaya_wisata_est + biaya_transport_est
        total_max = biaya_hotel_max + biaya_resto_max + biaya_wisata_max + biaya_transport_est

        total_skor = (pulp.lpSum(x_r[i] * skor_resto[i] for i in restos.index)
                      + pulp.lpSum(x_a[i] * skor_attr[i] for i in attractions.index))
        basis_util = total_max if _UTIL_BASIS == "max" else total_est
        insentif_budget = (basis_util / req.budget_total) * req.budget_utilization_weight * _UTIL_BOBOT
        prob += total_skor + insentif_budget

        prob += total_max <= req.budget_total
        prob += pulp.lpSum(x_r[i] for i in restos.index) >= min_meals
        prob += pulp.lpSum(x_r[i] for i in restos.index) <= max_meals
        prob += pulp.lpSum(x_a[i] for i in attractions.index) >= min_attr
        prob += pulp.lpSum(x_a[i] for i in attractions.index) <= max_attr

        prob.solve(pulp.PULP_CBC_CMD(msg=0))

        if pulp.LpStatus[prob.status] != "Optimal":
            return {"status": pulp.LpStatus[prob.status],
                    "message": "Tidak ditemukan kombinasi yang pas. Coba sesuaikan budget atau rentang item."}

        sel_restos = restos.loc[[i for i in restos.index for _ in range(int(x_r[i].value() or 0))]]
        sel_attr = attractions.loc[[i for i in attractions.index if x_a[i].value() == 1]]

        cols = ["place-name", "harga_min", "harga_tengah", "harga_max", "place-rating", "address", "latitude", "longitude"]
        hotel_rec = hotel[cols].to_dict()

        opsi_hotel = opsi_sepadan(hotel_rec, self.hotels[cols].to_dict("records"), 3)
        for o in opsi_hotel:
            o["jarak_dari_acuan"] = round(
                haversine_km(h_lat, h_lon, o["latitude"], o["longitude"]), 1)

        attr_cols = cols + [c for c in ["operational-hour", "place-type"]
                            if c in sel_attr.columns]
        resto_cols = cols + [c for c in ["skor_umkm", "recommend-menu"] if c in sel_restos.columns]

        kuliner_khas = muat_kuliner_khas(self.data_dir)
        dampak_lokal = analisis_dampak_lokal(
            sel_restos[resto_cols].to_dict("records"), kuliner_khas, req.n_orang)

        if req.moda == "umum":
            transport_proxy = int(_muat_tarif_transport(self.data_dir)[0]
                                  * req.n_orang * req.n_days)
        else:
            transport_proxy = int(round(
                (sel_attr["jarak_hotel"].sum() * 2) * t_moda["biaya_per_km"]))

        def _total(col):
            biaya_h = (hotel[col] * n_kamar * req.n_nights) if req.n_nights > 0 else 0
            biaya_r = sel_restos[col].sum() * req.n_orang
            biaya_a = sel_attr[col].sum() * req.n_orang
            return biaya_h + biaya_r + biaya_a + transport_proxy

        est_per_hari = int(_total("harga_tengah") / max(req.n_days, 1))

        komposisi = {}
        for t in sel_attr.get("place-type", pd.Series(dtype=object)):
            nama_minat = minat_dari_tipe(t) or "Lainnya"
            komposisi[nama_minat] = komposisi.get(nama_minat, 0) + 1
        minat_diminta = normalisasi_minat(req.minat_wisata)
        sesuai_minat = sum(n for m, n in komposisi.items() if m in minat_diminta)

        return {
            "status": "Optimal",
            "nilai_objektif": round(float(pulp.value(prob.objective) or 0.0), 4),
            "hotel_indeks": int(hotel_idx),
            "minat_wisata": minat_dipakai,
            "minat_diminta": minat_diminta,
            "minat_status": minat_status,
            "jam_status": jam_status,
            "wisata_ditolak_jam": wisata_ditolak_jam,
            "tanggal_mulai": req.tanggal_mulai,
            "komposisi_wisata": komposisi,
            "jumlah_wisata_sesuai_minat": sesuai_minat,
            "budget_total": req.budget_total,
            "n_days": req.n_days,
            "n_nights": req.n_nights,
            "n_orang": req.n_orang,
            "n_kamar": n_kamar,
            "hotel_gratis_pulang_hari": req.n_nights == 0,
            "profil_turis": profil["nama"],
            "profil_deskripsi": profil["deskripsi"],
            "profil_sumber": profil["sumber_profil"],
            "profil_saran_budget": profil["profil_saran_budget"],
            "umkm_weight_dipakai": round(umkm_w, 2),
            "budget_per_hari_target": profil["budget_per_hari"],
            "estimasi_biaya_per_hari": est_per_hari,
            "total_min": int(_total("harga_min")),
            "total_estimasi": int(_total("harga_tengah")),
            "total_max": int(_total("harga_max")),
            "sisa_estimasi": int(req.budget_total - _total("harga_tengah")),
            "persen_terpakai_estimasi": round(_total("harga_tengah") / req.budget_total * 100, 1),
            "jumlah_makan": len(sel_restos),
            "jumlah_wisata": len(sel_attr),
            "jarak_rata2_wisata_ke_hotel": round(sel_attr["jarak_hotel"].mean(), 1),
            "dampak_lokal": dampak_lokal,
            "hotel": [hotel_rec],
            "titik_acuan": titik_acuan,
            "moda": req.moda,
            "transport_proxy": transport_proxy,
            "hotel_opsi": opsi_hotel,
            "restos": sel_restos[resto_cols].to_dict("records"),
            "kolam_resto": restos[resto_cols].to_dict("records"),
            "attractions": sel_attr[attr_cols].to_dict("records"),
        }


def _wisata_buka_pada(place, jam, jadwal=None, hari=None):
    """True bila tempat BUKA (atau tak diketahui) pada `jam`; False bila pasti tutup."""
    nama = place.get("place-name")
    entri = jadwal.cari(nama) if jadwal is not None else None
    if entri is not None:
        if hari is not None and jadwal.buka_pada_hari(nama, hari) is False:
            return False
        return jadwal.status(nama, jam, hari) is not False
    return is_open_at(place.get("operational-hour"), jam) is not False


def _nearest_neighbor_order(start, points, use_osrm=True,
                            slot_jam=None, jadwal=None, hari=None):
    remaining = [p for p in points if p.get("latitude") is not None and p.get("longitude") is not None]
    ordered = []
    cur_lat, cur_lon = start["latitude"], start["longitude"]
    total_dist = 0.0
    total_menit = 0.0
    ada_durasi = True
    idx = 0
    while remaining:
        dists = {p["place-name"]: road_distance_km(cur_lat, cur_lon, p["latitude"], p["longitude"], use_osrm)
                 for p in remaining}
        jam_slot = slot_jam[idx] if slot_jam is not None and idx < len(slot_jam) else None
        kandidat = remaining
        if jam_slot is not None:
            buka = [p for p in remaining if _wisata_buka_pada(p, jam_slot, jadwal, hari)]
            if buka:
                kandidat = buka
        nearest = min(kandidat, key=lambda p: dists[p["place-name"]]["jarak_km"])
        d = dists[nearest["place-name"]]
        nearest = dict(nearest)
        nearest["jarak_dari_sebelumnya_km"] = d["jarak_km"]
        nearest["durasi_menit"] = d["durasi_menit"]
        nearest["sumber_jarak"] = d["sumber"]
        ordered.append(nearest)
        total_dist += d["jarak_km"]
        if d["durasi_menit"] is not None:
            total_menit += d["durasi_menit"]
        else:
            ada_durasi = False
        cur_lat, cur_lon = nearest["latitude"], nearest["longitude"]
        remaining = [p for p in remaining if not (p["place-name"] == nearest["place-name"]
                     and p["latitude"] == nearest["latitude"])]
        idx += 1
    return ordered, round(total_dist, 2), (round(total_menit, 1) if ada_durasi else None)


def _kuota_per_hari(n_item, n_days):
    """Bagi n_item ke n_days serata mungkin: 9 item / 4 hari -> [3, 2, 2, 2]."""
    k, m = divmod(n_item, n_days)
    return [k + (1 if i < m else 0) for i in range(n_days)]


def _bagi_wisata_per_hari(attractions, n_days, hotel):
    """Kelompokkan wisata ke hari berdasarkan KEDEKATAN LOKASI."""
    sisa = list(attractions)
    kelompok = []
    for kuota in _kuota_per_hari(len(sisa), n_days):
        if not sisa or kuota <= 0:
            kelompok.append([])
            continue
        benih = max(sisa, key=lambda w: haversine_km(
            hotel["latitude"], hotel["longitude"], w["latitude"], w["longitude"]))
        sisa.remove(benih)
        grup = [benih]
        while len(grup) < kuota and sisa:
            dekat = min(sisa, key=lambda w: haversine_km(
                benih["latitude"], benih["longitude"], w["latitude"], w["longitude"]))
            sisa.remove(dekat)
            grup.append(dekat)
        kelompok.append(grup)

    def _jarak_grup(grup):
        if not grup:
            return float("inf")
        return min(haversine_km(hotel["latitude"], hotel["longitude"],
                                w["latitude"], w["longitude"]) for w in grup)

    kelompok.sort(key=_jarak_grup)
    return kelompok


def _bagi_resto_per_hari(restos, kelompok_wisata, n_days, hotel):
    """Bagikan tempat makan ke hari yang wisatanya PALING DEKAT."""
    sisa = list(restos)
    hasil = []
    for d, kuota in enumerate(_kuota_per_hari(len(sisa), n_days)):
        grup_w = kelompok_wisata[d] if d < len(kelompok_wisata) else []
        if grup_w:
            pusat_lat = sum(w["latitude"] for w in grup_w) / len(grup_w)
            pusat_lon = sum(w["longitude"] for w in grup_w) / len(grup_w)
        else:
            pusat_lat, pusat_lon = hotel["latitude"], hotel["longitude"]

        grup = []
        while len(grup) < kuota and sisa:
            dekat = min(sisa, key=lambda r: haversine_km(
                pusat_lat, pusat_lon, r["latitude"], r["longitude"]))
            sisa.remove(dekat)
            grup.append(dekat)
        hasil.append(grup)
    return hasil


def build_daily_routes(result: dict, n_days: int, use_osrm: bool = True,
                       ferry_detector=None, jadwal=None, tanggal_mulai=None) -> dict:
    if result.get("status") != "Optimal":
        return {"status": result.get("status"), "message": result.get("message")}
    hotel = result.get("titik_acuan") or result["hotel"][0]
    restos = result["restos"]
    attractions = result["attractions"]

    tanggal_mulai = tanggal_mulai or result.get("tanggal_mulai")

    wisata_per_hari = _bagi_wisata_per_hari(attractions, n_days, hotel)
    resto_per_hari = _bagi_resto_per_hari(restos, wisata_per_hari, n_days, hotel)
    days = []
    sumber_dipakai = set()
    total_penyeberangan = 0
    for d in range(n_days):
        hari_ini = hari_ke_indeks(tanggal_mulai, d)
        slot_jam = jadwal_wisata_harian(len(wisata_per_hari[d]))
        ordered_w, dist, menit = _nearest_neighbor_order(
            hotel, wisata_per_hari[d], use_osrm=use_osrm,
            slot_jam=slot_jam, jadwal=jadwal, hari=hari_ini)
        for w in ordered_w:
            sumber_dipakai.add(w.get("sumber_jarak", "haversine"))

        penyeberangan_hari = []
        if ferry_detector is not None:
            urutan = [hotel] + ordered_w
            for i in range(len(urutan) - 1):
                a, b = urutan[i], urutan[i + 1]
                if a.get("latitude") is None or b.get("latitude") is None:
                    continue
                feri = ferry_detector.cari_feri(a, b)
                if feri is not None:
                    penyeberangan_hari.append({
                        "dari": a["place-name"], "ke": b["place-name"], "info": feri,
                    })
                    total_penyeberangan += 1

        days.append({"hari": d + 1, "hotel_base": hotel["place-name"],
                     "wisata_terurut": ordered_w, "resto": resto_per_hari[d],
                     "total_jarak_km": dist, "total_durasi_menit": menit,
                     "penyeberangan": penyeberangan_hari,
                     "hari_indeks": hari_ini,
                     "hari_nama": HARI_NAMA[hari_ini] if hari_ini is not None else None,
                     "agenda": susun_agenda_harian(ordered_w, resto_per_hari[d],
                                                   result.get("kolam_resto"),
                                                   jadwal=jadwal, hari=hari_ini)})
    return {"status": "Optimal", "hotel": hotel, "days": days,
            "total_jarak_semua_hari_km": round(sum(day["total_jarak_km"] for day in days), 2),
            "total_penyeberangan": total_penyeberangan,
            "sumber_jarak": "osrm" if sumber_dipakai == {"osrm"} else
                            ("haversine" if sumber_dipakai == {"haversine"} else "campuran")}


import re


def parse_operational_hour(text):
    """Ubah teks jam operasional jadi (jam_buka, jam_tutup) dalam jam desimal."""
    if text is None:
        return None
    s = str(text).strip().lower()
    if s in ("", "nan"):
        return None

    if "24" in s and "jam" in s:
        return (0.0, 24.0)

    s_norm = s.replace(":", ".")

    matches = re.findall(r"(\d{1,2})\.(\d{2})", s_norm)
    if len(matches) >= 2:
        def to_decimal(h, m):
            return int(h) + int(m) / 60.0
        buka = to_decimal(*matches[0])
        tutup = to_decimal(*matches[1])
        return (buka, tutup)

    nums = re.findall(r"\d{1,2}", s)
    if len(nums) >= 2:
        return (float(nums[0]), float(nums[1]))

    return None


def is_open_at(operational_hour_text, jam_kunjungan):
    """Cek apakah tempat buka pada 'jam_kunjungan' (angka desimal, misal 14.5 = 14:30)."""
    parsed = parse_operational_hour(operational_hour_text)
    if parsed is None:
        return None
    buka, tutup = parsed
    if tutup < buka:
        return jam_kunjungan >= buka or jam_kunjungan <= tutup
    return buka <= jam_kunjungan <= tutup


HARI_NAMA = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
SEMUA_HARI = frozenset(range(7))

_HARI_INDEKS = {
    "senin": 0, "selasa": 1, "rabu": 2, "kamis": 3,
    "jumat": 4, "jum'at": 4, "jumaat": 4,
    "sabtu": 5, "minggu": 6, "ahad": 6,
}

_POLA_HARI = re.compile(
    r"(senin|selasa|rabu|kamis|jumat|jum'at|jumaat|sabtu|minggu|ahad)", re.IGNORECASE)
_POLA_RENTANG_JAM = re.compile(r"(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})")
_POLA_24JAM = re.compile(r"24\s*jam", re.IGNORECASE)


def _hari_dari_baris(baris):
    """Kumpulan indeks hari yang disebut satu baris teks."""
    nama = [m.group(1).lower() for m in _POLA_HARI.finditer(baris)]
    if not nama:
        return None
    idx = [_HARI_INDEKS[n] for n in nama]
    if len(idx) == 1:
        return frozenset(idx)
    awal, akhir = idx[0], idx[-1]
    if awal <= akhir:
        return frozenset(range(awal, akhir + 1))
    return frozenset(list(range(awal, 7)) + list(range(0, akhir + 1)))


def parse_jadwal_mingguan(teks):
    """Ubah teks 'WAKTU OPERASIONAL' jadi daftar {'hari': set, 'buka': f, 'tutup': f}."""
    if teks is None:
        return []
    s = str(teks).strip()
    if not s or s.lower() == "nan":
        return []

    jadwal = []
    hari_aktif = None
    for baris in s.split("\n"):
        baris = baris.strip()
        if not baris:
            continue

        hari_baris = _hari_dari_baris(baris)
        if hari_baris:
            hari_aktif = hari_baris

        hari_dipakai = hari_aktif or SEMUA_HARI

        if _POLA_24JAM.search(baris):
            jadwal.append({"hari": hari_dipakai, "buka": 0.0, "tutup": 24.0})
            continue

        for m in _POLA_RENTANG_JAM.finditer(baris):
            h1, m1, h2, m2 = (int(g) for g in m.groups())
            jadwal.append({
                "hari": hari_dipakai,
                "buka": h1 + m1 / 60.0,
                "tutup": h2 + m2 / 60.0,
            })

    return jadwal


def _normalisasi_nama(nama):
    """Nama tempat dalam bentuk banding."""
    s = str(nama).lower()
    s = re.sub(r"[.']", "", s)
    return re.sub(r"[^a-z0-9 ]", " ", s)


def _token_nama(nama):
    """Kumpulan kata penyusun nama, untuk pencocokan berbasis himpunan."""
    return frozenset(w for w in _normalisasi_nama(nama).split() if w)


class JadwalOperasional:
    """Indeks jam buka mingguan, dicocokkan ke nama destinasi."""

    def __init__(self, data_dir=DATA_DIR):
        self.entri = []
        self._cache_cari = {}
        try:
            df = pd.read_csv(
                f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_"
                f"-waktu_operasional_destinasi_typed.csv")
        except Exception:
            return

        for _, r in df.iterrows():
            nama = str(r.get("OBJEK / DESTINASI WISATA") or "").strip()
            if not nama:
                continue
            jadwal = parse_jadwal_mingguan(r.get("WAKTU OPERASIONAL"))
            if not jadwal:
                continue
            self.entri.append({
                "nama": nama,
                "token": _token_nama(nama),
                "jadwal": jadwal,
                "teks": str(r.get("WAKTU OPERASIONAL") or "").strip(),
                "fasilitas_umum": r.get("FASILITAS UMUM"),
                "fasilitas_penunjang": r.get("FASILITAS PENUNJANG"),
            })

    def cari(self, nama):
        """Entri jadwal untuk sebuah nama tempat, atau None bila tak ada padanan."""
        if not nama or not self.entri:
            return None
        kunci = str(nama)
        if kunci in self._cache_cari:
            return self._cache_cari[kunci]

        token = _token_nama(nama)
        hasil = None

        for e in self.entri:
            if e["token"] == token:
                hasil = e
                break

        if hasil is None and token:
            termuat = [e for e in self.entri
                       if token <= e["token"] or e["token"] <= token]
            if len(termuat) == 1:
                hasil = termuat[0]

        self._cache_cari[kunci] = hasil
        return hasil

    def status(self, nama, jam, hari=None):
        """True / False / None (tidak ada data) untuk sebuah tempat pada jam & hari."""
        e = self.cari(nama)
        if e is None:
            return None

        for j in e["jadwal"]:
            if hari is not None and hari not in j["hari"]:
                continue
            buka, tutup = j["buka"], j["tutup"]
            cocok = (jam >= buka or jam <= tutup) if tutup < buka else (buka <= jam <= tutup)
            if cocok:
                return True
        return False

    def buka_pada_hari(self, nama, hari):
        """Apakah tempat beroperasi sama sekali pada hari tertentu?"""
        e = self.cari(nama)
        if e is None:
            return None
        return any(hari in j["hari"] for j in e["jadwal"])

    def hari_tutup(self, nama):
        """Nama-nama hari saat tempat ini tidak beroperasi sama sekali."""
        e = self.cari(nama)
        if e is None:
            return []
        buka = set()
        for j in e["jadwal"]:
            buka |= set(j["hari"])
        return [HARI_NAMA[i] for i in range(7) if i not in buka]

    def ringkas(self, nama, hari=None):
        """Jam buka dalam bentuk terbaca, mis. 'buka 09:30-17:00'."""
        e = self.cari(nama)
        if e is None:
            return None
        blok = [j for j in e["jadwal"] if hari is None or hari in j["hari"]]
        if not blok:
            return "tutup pada hari ini"
        if any(j["buka"] == 0.0 and j["tutup"] == 24.0 for j in blok):
            return "buka 24 jam"
        j = blok[0]
        return f"buka {_decimal_to_jam(j['buka'])}-{_decimal_to_jam(j['tutup'])}"


def hari_ke_indeks(tanggal, offset=0):
    """Indeks hari (0=Senin) dari tanggal ISO 'YYYY-MM-DD' plus offset hari."""
    if not tanggal:
        return None
    try:
        from datetime import date, timedelta
        y, m, d = (int(x) for x in str(tanggal)[:10].split("-"))
        return (date(y, m, d) + timedelta(days=int(offset))).weekday()
    except Exception:
        return None


def filter_open_places(places, jam_kunjungan, hour_col="operational-hour",
                       keep_unknown=True, jadwal=None, hari=None):
    """Saring daftar tempat (list of dict), sisakan yang buka pada jam_kunjungan."""
    lolos, ditolak = [], []
    for p in places:
        status = None
        sumber = None

        if jadwal is not None:
            status = jadwal.status(p.get("place-name"), jam_kunjungan, hari)
            if status is not None:
                sumber = "jadwal_mingguan"

        if status is None:
            status = is_open_at(p.get(hour_col), jam_kunjungan)
            if status is not None:
                sumber = "operational-hour"

        p = dict(p)
        p["_status_buka"] = status
        p["_sumber_jam"] = sumber
        if status is True:
            lolos.append(p)
        elif status is None:
            if keep_unknown:
                p["_catatan_jam"] = "jam operasional tidak diketahui"
                lolos.append(p)
            else:
                ditolak.append(p)
        else:
            ditolak.append(p)
    return lolos, ditolak


def assign_visit_times(ordered_places, jam_mulai=9.0, durasi_per_tempat=1.5,
                       jeda_perjalanan=0.5, hour_col="operational-hour",
                       jadwal_jam=None, jadwal=None, hari=None):
    """Estimasi jam kunjungan tiap tempat, menghormati jam operasionalnya."""
    hasil = []
    jam_sekarang = jam_mulai
    for idx, p in enumerate(ordered_places):
        p = dict(p)
        if jadwal_jam is not None and idx < len(jadwal_jam):
            jam_sekarang = jadwal_jam[idx]
        p["jam_kunjungan"] = round(jam_sekarang, 2)
        p["jam_kunjungan_str"] = _decimal_to_jam(jam_sekarang)

        nama = p.get("place-name")
        entri = jadwal.cari(nama) if jadwal is not None else None

        if entri is not None:
            status = jadwal.status(nama, jam_sekarang, hari)
            p["sumber_jam"] = "jadwal_mingguan"
            p["jam_operasional_str"] = jadwal.ringkas(nama, hari) or "jam buka tidak diketahui"

            tutup_mingguan = jadwal.hari_tutup(nama)
            p["hari_tutup"] = tutup_mingguan

            if hari is not None and jadwal.buka_pada_hari(nama, hari) is False:
                p["peringatan"] = (f"TUTUP pada hari {HARI_NAMA[hari]} "
                                   f"(libur tiap {', '.join(tutup_mingguan)})")
            elif status is False:
                p["peringatan"] = (f"TUTUP saat rencana kunjungan "
                                   f"({p['jam_operasional_str']})")
            elif tutup_mingguan and hari is None:
                p["peringatan"] = f"Tutup tiap {', '.join(tutup_mingguan)}"
            else:
                p["peringatan"] = None

            hasil.append(p)
            jam_sekarang += durasi_per_tempat + jeda_perjalanan
            continue

        status = is_open_at(p.get(hour_col), jam_sekarang)
        p["sumber_jam"] = "operational-hour" if status is not None else None
        p["hari_tutup"] = []
        parsed = parse_operational_hour(p.get(hour_col))
        if parsed:
            if parsed == (0.0, 24.0):
                p["jam_operasional_str"] = "buka 24 jam"
            else:
                p["jam_operasional_str"] = f"buka {_decimal_to_jam(parsed[0])}-{_decimal_to_jam(parsed[1])}"
        else:
            p["jam_operasional_str"] = "jam buka tidak diketahui"

        if status is False:
            if parsed:
                p["peringatan"] = (f"TUTUP saat rencana kunjungan "
                                   f"({p['jam_operasional_str']})")
            else:
                p["peringatan"] = "Tutup pada jam kunjungan"
        elif status is None:
            p["peringatan"] = "Jam operasional tidak diketahui"
        else:
            p["peringatan"] = None

        hasil.append(p)
        jam_sekarang += durasi_per_tempat + jeda_perjalanan
    return hasil


SLOT_MAKAN = [
    {"nama": "Sarapan",     "jam": 7.0,  "ikon": "☕"},
    {"nama": "Makan siang", "jam": 12.5, "ikon": "🍛"},
    {"nama": "Makan malam", "jam": 18.5, "ikon": "🍽️"},
]
WINDOW_WISATA_PAGI = (8.5, 11.5)
WINDOW_WISATA_SORE = (14.0, 17.5)


def _sebar_jam(n, awal, akhir):
    """Sebar n kunjungan merata di rentang [awal, akhir]. Satu kunjungan -> di awal."""
    if n <= 0:
        return []
    if n == 1:
        return [awal]
    langkah = (akhir - awal) / (n - 1)
    return [round(awal + i * langkah, 2) for i in range(n)]


def jadwal_wisata_harian(n_wisata):
    """Jam kunjungan untuk n wisata dalam sehari, dibagi ke sesi pagi & sore."""
    n_pagi = math.ceil(n_wisata / 2)
    n_sore = n_wisata - n_pagi
    return (_sebar_jam(n_pagi, *WINDOW_WISATA_PAGI)
            + _sebar_jam(n_sore, *WINDOW_WISATA_SORE))


def opsi_sepadan(utama, kolam, n_opsi=3):
    """Susun beberapa pilihan SEPADAN untuk satu keputusan yang boleh diganti turis"""
    if not utama:
        return []
    batas_max = utama.get("harga_max") or 0
    tengah = utama.get("harga_tengah") or 0
    try:
        rating_utama = float(utama.get("place-rating") or 0)
    except (TypeError, ValueError):
        rating_utama = 0.0
    batas_bawah = tengah * 0.5

    def _rating(r):
        try:
            return float(r.get("place-rating") or 0)
        except (TypeError, ValueError):
            return 0.0

    dalam_budget = [
        r for r in (kolam or [])
        if r.get("place-name") != utama.get("place-name")
        and (r.get("harga_max") or 0) <= batas_max
    ]
    sepadan = [r for r in dalam_budget if (r.get("harga_tengah") or 0) >= batas_bawah]

    def _urut(daftar):
        return sorted(daftar, key=lambda r: (abs(_rating(r) - rating_utama), -_rating(r)))

    opsi = [dict(utama, rekomendasi=True)]
    sudah = {utama.get("place-name")}
    for daftar in (_urut(sepadan), _urut(dalam_budget)):
        for r in daftar:
            if len(opsi) >= n_opsi:
                break
            if r.get("place-name") in sudah:
                continue
            sudah.add(r.get("place-name"))
            opsi.append(dict(r, rekomendasi=False))
    return opsi


def susun_agenda_harian(wisata_terurut, resto_hari, kolam_resto=None, n_opsi=3,
                        jadwal=None, hari=None):
    """Rangkai satu hari menjadi agenda kronologis 07:00-19:00."""
    agenda = []
    resto_urut = sorted(resto_hari or [], key=lambda r: r.get("harga_tengah") or 0)
    for slot, utama in zip(SLOT_MAKAN, resto_urut):
        agenda.append({
            "jenis": "makan",
            "slot": slot["nama"],
            "ikon": slot["ikon"],
            "jam": slot["jam"],
            "jam_str": _decimal_to_jam(slot["jam"]),
            "opsi": opsi_sepadan(utama, kolam_resto, n_opsi),
        })

    jam_wisata = jadwal_wisata_harian(len(wisata_terurut or []))
    for w in assign_visit_times(wisata_terurut or [], jadwal_jam=jam_wisata,
                                jadwal=jadwal, hari=hari):
        agenda.append({
            "jenis": "wisata",
            "jam": w["jam_kunjungan"],
            "jam_str": w["jam_kunjungan_str"],
            "data": w,
        })

    agenda.sort(key=lambda a: a["jam"])
    return agenda


def _decimal_to_jam(dec):
    """Ubah jam desimal (14.5) jadi string 'HH:MM' (14:30)."""
    if dec is None:
        return "??:??"
    dec = dec % 24
    h = int(dec)
    m = int(round((dec - h) * 60))
    if m == 60:
        h += 1; m = 0
    return f"{h:02d}:{m:02d}"


MODA = ("jalan_kaki", "motor", "mobil", "umum")

HARGA_BBM_PER_LITER = 10_000

TARIF_MODA = {
    "jalan_kaki": {
        "label": "Jalan kaki",
        "km_per_liter": None,
        "biaya_per_km": 0,
        "porsi_feri": 0.0,
        "batas_km_per_hari": 15,
    },
    "motor": {
        "label": "Naik motor",
        "km_per_liter": 45,
        "biaya_per_km": round(HARGA_BBM_PER_LITER / 45 / 25) * 25,
        "porsi_feri": 0.10,
        "batas_km_per_hari": 180,
    },
    "mobil": {
        "label": "Naik mobil",
        "km_per_liter": 12,
        "biaya_per_km": round(HARGA_BBM_PER_LITER / 12 / 50) * 50,
        "porsi_feri": 1.0,
        "batas_km_per_hari": 400,
    },
    "umum": {
        "label": "Angkutan umum",
        "km_per_liter": None,
        "biaya_per_km": 0,
        "porsi_feri": 0.0,
        "batas_km_per_hari": 250,
    },
}


def _muat_tarif_transport(data_dir):
    """Baca tarif dari transportasi_typed.csv."""
    cadangan = (72_500, 3_500, 250_000)
    try:
        df = pd.read_csv(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-transportasi_typed.csv")
    except Exception:
        return cadangan

    try:
        jenis = df["jenis-mobil"].astype(str)
        feri = df[jenis.str.contains("ferry", case=False, na=False)]
        darat = df[~jenis.str.contains("ferry", case=False, na=False)]

        if len(darat):
            tengah = (darat["harga_min"] + darat["harga_max"]) / 2
            tarif_umum = int(tengah.median())
        else:
            tarif_umum = cadangan[0]

        feri_min = int(feri["harga_min"].min()) if len(feri) else cadangan[1]
        feri_max = int(feri["harga_max"].max()) if len(feri) else cadangan[2]
        return tarif_umum, feri_min, feri_max
    except Exception:
        return cadangan


def hitung_biaya_transport(km_total, n_days, n_orang, moda, n_penyeberangan=0,
                           data_dir=DATA_DIR):
    """Estimasi biaya perjalanan darat + feri untuk satu rencana."""
    moda = moda if moda in TARIF_MODA else "mobil"
    t = TARIF_MODA[moda]
    tarif_umum, feri_min, feri_max = _muat_tarif_transport(data_dir)
    n_orang = max(int(n_orang), 1)
    n_days = max(int(n_days), 1)
    km_total = max(float(km_total or 0), 0.0)

    if moda == "umum":
        biaya_darat = tarif_umum * n_orang * n_days
        bbm = 0
        liter = 0.0
    else:
        bbm = int(round(km_total * t["biaya_per_km"]))
        biaya_darat = bbm
        liter = round(km_total / t["km_per_liter"], 2) if t["km_per_liter"] else 0.0

    tarif_feri_satuan = int(round(feri_min + (feri_max - feri_min) * t["porsi_feri"]))
    pengali_feri = n_orang if moda in ("jalan_kaki", "umum") else 1
    biaya_feri = tarif_feri_satuan * int(n_penyeberangan or 0) * pengali_feri

    km_per_hari = km_total / n_days
    return {
        "moda": moda,
        "label": t["label"],
        "biaya_bbm": int(bbm),
        "liter_bbm": liter,
        "biaya_darat": int(biaya_darat),
        "biaya_feri": int(biaya_feri),
        "total": int(biaya_darat + biaya_feri),
        "tarif_per_km": t["biaya_per_km"],
        "tarif_umum_per_orang_per_hari": tarif_umum if moda == "umum" else 0,
        "tarif_feri_satuan": tarif_feri_satuan,
        "n_penyeberangan": int(n_penyeberangan or 0),
        "km_total": round(km_total, 2),
        "km_per_hari": round(km_per_hari, 1),
        "realistis": km_per_hari <= t["batas_km_per_hari"],
        "batas_km_per_hari": t["batas_km_per_hari"],
    }


PELABUHAN_KOORD = {
    "Ajibata":   (2.62741, 98.93649),
    "Ambarita":  (2.66930, 98.85349),
    "Muara":     (2.33091, 98.95373),
    "Simanindo": (2.68806, 98.82070),
    "Sipinggan": (2.25786, 98.85484),
    "Tigaras":   (2.78620, 98.79752),
    "Tomok":     (2.65756, 98.83372),
}

PELABUHAN_SAMOSIR = {"Tomok", "Ambarita", "Simanindo", "Sipinggan"}
PELABUHAN_MAINLAND = {"Ajibata", "Muara", "Tigaras"}

SAMOSIR_KABUPATEN = ["kabupaten samosir", "kab. samosir", "kab samosir"]
SAMOSIR_KECAMATAN = ["simanindo", "pangururan", "nainggolan", "onan runggu",
                     "ronggur nihuta", "sitio-tio", "sitiotio", "harian",
                     "sianjur mula", "palipi"]


def sisi_danau(place):
    """Tentukan tempat di 'samosir' atau 'mainland' (deteksi ketat via alamat)."""
    alamat = str(place.get("address", "")).lower()
    if any(k in alamat for k in SAMOSIR_KABUPATEN):
        return "samosir"
    if any(k in alamat for k in SAMOSIR_KECAMATAN):
        return "samosir"
    return "mainland"


def _pelabuhan_terdekat(lat, lon, kandidat):
    """Pelabuhan terdekat dari sekumpulan kandidat, beserta jaraknya."""
    best = min(kandidat, key=lambda p: haversine_km(lat, lon, *PELABUHAN_KOORD[p]))
    return best, round(haversine_km(lat, lon, *PELABUHAN_KOORD[best]), 2)


class FerryDetector:
    def __init__(self, data_dir=DATA_DIR):
        df = pd.read_csv(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-transportasi_typed.csv")
        ferry = df[df["jenis-mobil"] == "Ferry"].copy()
        self.rute = {}
        for _, r in ferry.iterrows():
            d = str(r["direction"])
            if " ke " not in d:
                continue
            a, b = [x.strip() for x in d.split(" ke ")]
            if a in PELABUHAN_KOORD and b in PELABUHAN_KOORD:
                self.rute[(a, b)] = {
                    "asal": a, "tujuan": b,
                    "nama": r["transport-name"],
                    "jam": r.get("operational-hour"),
                    "harga_min": r.get("harga_min"),
                    "harga_max": r.get("harga_max"),
                }

    def cari_feri(self, dari_place, ke_place):
        """Cek apakah perpindahan dari 'dari_place' ke 'ke_place' butuh feri."""
        sisi_a = sisi_danau(dari_place)
        sisi_b = sisi_danau(ke_place)

        if sisi_a == sisi_b:
            return None

        lat_a, lon_a = dari_place["latitude"], dari_place["longitude"]
        lat_b, lon_b = ke_place["latitude"], ke_place["longitude"]

        if sisi_a == "mainland":
            pel_asal, jarak_ke_pel_asal = _pelabuhan_terdekat(lat_a, lon_a, PELABUHAN_MAINLAND)
            pel_tujuan, jarak_dari_pel_tujuan = _pelabuhan_terdekat(lat_b, lon_b, PELABUHAN_SAMOSIR)
        else:
            pel_asal, jarak_ke_pel_asal = _pelabuhan_terdekat(lat_a, lon_a, PELABUHAN_SAMOSIR)
            pel_tujuan, jarak_dari_pel_tujuan = _pelabuhan_terdekat(lat_b, lon_b, PELABUHAN_MAINLAND)

        feri = self.rute.get((pel_asal, pel_tujuan)) or self.rute.get((pel_tujuan, pel_asal))

        if feri is None:
            return {
                "butuh_feri": True,
                "rute_tersedia": False,
                "pelabuhan_asal": pel_asal,
                "pelabuhan_tujuan": pel_tujuan,
                "catatan": "Perlu menyeberang, tapi tidak ada rute feri langsung "
                           "antara pelabuhan terdekat di data. Mungkin perlu transit.",
            }

        return {
            "butuh_feri": True,
            "rute_tersedia": True,
            "pelabuhan_asal": pel_asal,
            "pelabuhan_tujuan": pel_tujuan,
            "jarak_ke_pelabuhan_km": jarak_ke_pel_asal,
            "jarak_dari_pelabuhan_km": jarak_dari_pel_tujuan,
            "nama_feri": feri["nama"],
            "jam_operasional": feri["jam"],
            "ongkos_min": feri["harga_min"],
            "ongkos_max": feri["harga_max"],
        }


def format_info_feri(feri):
    """Format info feri jadi teks yang jujur & informatif untuk ditampilkan."""
    if feri is None:
        return None
    if not feri.get("rute_tersedia"):
        return f"[Perlu menyeberang via {feri['pelabuhan_asal']}->{feri['pelabuhan_tujuan']}, {feri['catatan']}]"
    lo, hi = feri["ongkos_min"], feri["ongkos_max"]
    return (f"FERI: {feri['pelabuhan_asal']} -> {feri['pelabuhan_tujuan']} "
            f"({feri['nama_feri']}) | jam {feri['jam_operasional']} | "
            f"ongkos Rp{lo:,.0f}-Rp{hi:,.0f} (tergantung pejalan/kendaraan)")


KULINER_KHAS_DEFAULT = [
    "Dali ni Horbo", "Saksang", "Naniarsik", "Babi Panggang Karo",
    "Manuk Napinadar", "Dengke Mas na Niura", "Na Tinombur", "Mie Gomak",
    "Tanggo tanggo", "Mie Sop", "Sira Pege", "Sambal Tuktuk",
]

POLA_NAMA_LOKAL = r"\b(BPK|RM|Lapo|Kedai|Warung|Rumah Makan|Pondok)\b"


def muat_kuliner_khas(data_dir):
    """Muat daftar kuliner khas dari file kuliner (bukan hardcode)."""
    try:
        kul = pd.read_csv(f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_-kuliner_typed.csv")
        return kul["kuliner-name"].dropna().tolist()
    except Exception:
        return KULINER_KHAS_DEFAULT


def _sinyal_kuliner_khas(recommend_menu, kuliner_khas):
    """Sinyal 1: apakah menu menyebut kuliner khas Batak? Return (bool, daftar)."""
    m = str(recommend_menu).lower()
    kata_kunci = {
        "Dali ni Horbo": ["dali ni horbo", "dali"],
        "Saksang": ["saksang"],
        "Naniarsik": ["arsik", "naniarsik"],
        "Babi Panggang Karo": ["babi panggang", "bpk"],
        "Manuk Napinadar": ["napinadar", "manuk pinadar"],
        "Dengke Mas na Niura": ["naniura", "na niura", "dengke"],
        "Na Tinombur": ["tinombur", "tombur"],
        "Mie Gomak": ["mie gomak", "mi gomak"],
        "Tanggo tanggo": ["tanggo"],
        "Mie Sop": ["mie sop", "mi sop"],
        "Sira Pege": ["sira pege"],
        "Sambal Tuktuk": ["sambal tuktuk", "tuk tuk"],
    }
    cocok = []
    for nama in kuliner_khas:
        kunci = kata_kunci.get(nama, [nama.lower()])
        if any(k in m for k in kunci):
            cocok.append(nama)
    return (len(cocok) > 0, cocok)


def _sinyal_nama_lokal(place_name):
    """Sinyal 2: apakah nama berpola usaha lokal (BPK/RM/Lapo/dll)?"""
    return bool(re.search(POLA_NAMA_LOKAL, str(place_name), flags=re.IGNORECASE))


def _sinyal_harga_terjangkau(harga_min, ambang=25000):
    """Sinyal 3: apakah harga terjangkau (indikasi usaha kecil)?"""
    try:
        return float(harga_min) <= ambang
    except (TypeError, ValueError):
        return False


def skor_umkm(place, kuliner_khas, ambang_harga=25000):
    """Skor UMKM 0.0-1.0: kuliner khas (0.5) + nama lokal (0.3) + murah (0.2)."""
    khas, daftar_khas = _sinyal_kuliner_khas(place.get("recommend-menu", ""), kuliner_khas)
    lokal = _sinyal_nama_lokal(place.get("place-name", ""))
    murah = _sinyal_harga_terjangkau(place.get("harga_min"), ambang_harga)

    skor = (0.5 * khas) + (0.3 * lokal) + (0.2 * murah)

    return {
        "skor_umkm": round(skor, 3),
        "sinyal_kuliner_khas": khas,
        "kuliner_khas_disajikan": daftar_khas,
        "sinyal_nama_lokal": lokal,
        "sinyal_harga_terjangkau": murah,
        "is_umkm_kuat": skor >= 0.5,
    }


def analisis_dampak_lokal(restos_terpilih, kuliner_khas, n_orang: int = 1):
    """Level 3: analisis distribusi dampak lokal dari itinerary (metrik JUJUR)."""
    if not restos_terpilih:
        return {"status": "kosong"}

    detail = []
    umkm_kuat = 0
    semua_kuliner_khas = set()
    nama_unik = set()

    for r in restos_terpilih:
        s = skor_umkm(r, kuliner_khas)
        detail.append({"nama": r["place-name"], **s})
        if s["is_umkm_kuat"]:
            umkm_kuat += 1
        semua_kuliner_khas.update(s["kuliner_khas_disajikan"])
        nama_unik.add(r["place-name"])

    total = len(restos_terpilih)
    n_unik = len(nama_unik)

    est_ke_lokal = sum(
        (r.get("harga_tengah") or r.get("harga_min") or 0)
        for r in restos_terpilih
        if skor_umkm(r, kuliner_khas)["is_umkm_kuat"]
    ) * max(int(n_orang), 1)

    return {
        "status": "ok",
        "total_kunjungan_makan": total,
        "usaha_unik_dikunjungi": n_unik,
        "umkm_lokal_otentik": umkm_kuat,
        "proporsi_umkm": round(umkm_kuat / total * 100, 1) if total else 0,
        "ragam_kuliner_khas": len(semua_kuliner_khas),
        "daftar_kuliner_khas": sorted(semua_kuliner_khas),
        "sebaran_merata": n_unik / total if total else 0,
        "estimasi_kasar_ke_usaha_lokal": int(est_ke_lokal),
        "detail": detail,
    }


KABUPATEN_TOBA = [
    "Toba", "Simalungun", "Karo", "Samosir",
    "Pakpak Bharat", "Tapanuli Utara", "Dairi", "Humbang Hasundutan",
]

ALIAS_KABUPATEN = {
    "north tapanuli": "Tapanuli Utara",
    "toba samosir": "Toba",
}

KECAMATAN_KE_KABUPATEN = {
    "balige": "Toba", "laguboti": "Toba", "porsea": "Toba",
    "tampahan": "Toba", "ajibata": "Toba", "lumban julu": "Toba",
    "pangururan": "Samosir", "simanindo": "Samosir", "ronggur nihuta": "Samosir",
    "nainggolan": "Samosir", "harian": "Samosir", "palipi": "Samosir",
    "dolok pardamean": "Simalungun", "sidamanik": "Simalungun",
    "purba": "Simalungun", "tonduhan": "Simalungun",
    "girsang sipangan bolon": "Simalungun", "tapian dolok": "Simalungun",
    "silahisabungan": "Dairi", "sitinjo": "Dairi", "lae parira": "Dairi",
    "tarutung": "Tapanuli Utara", "muara": "Tapanuli Utara",
    "paranginan": "Humbang Hasundutan", "bakti raja": "Humbang Hasundutan",
    "baktiraja": "Humbang Hasundutan", "dolok sanggul": "Humbang Hasundutan",
    "lintong nihuta": "Humbang Hasundutan", "pakkat": "Humbang Hasundutan",
    "tara bintang": "Humbang Hasundutan",
    "merek": "Karo", "kabanjahe": "Karo", "berastagi": "Karo",
    "tigapanah": "Karo",
}


def deteksi_kabupaten(alamat):
    """Tebak kabupaten dari teks alamat. None bila tidak bisa dipastikan."""
    a = str(alamat or "")
    if not a.strip():
        return None
    low = a.lower()

    for k in KABUPATEN_TOBA:
        if re.search(r"kab(?:upaten|\.)?\s+" + re.escape(k.lower()), low):
            return k

    for alias, k in ALIAS_KABUPATEN.items():
        if re.search(re.escape(alias) + r"\s+regency", low):
            return k
    for k in KABUPATEN_TOBA:
        if re.search(re.escape(k.lower()) + r"\s+regency", low):
            return k

    for seg in a.split(","):
        bersih = re.sub(r"\s+\d{5}$", "", seg.strip()).strip().lower()
        for k in KABUPATEN_TOBA:
            if bersih == k.lower():
                return k

    for kec, k in KECAMATAN_KE_KABUPATEN.items():
        if re.search(r"kec(?:amatan|\.)?\s+" + re.escape(kec) + r"\b", low):
            return k

    return None


JENIS_FASILITAS = [
    {"kunci": "spbu",      "label": "SPBU",          "kolom": "Fasilitas Umum_SPBU"},
    {"kunci": "atm",       "label": "Bank & ATM",    "kolom": "Fasilitas Umum_Bank & ATM"},
    {"kunci": "kesehatan", "label": "Rumah Sakit",   "kolom": "Fasilitas Umum_Rumah Sakit/Puskesmas"},
    {"kunci": "apotek",    "label": "Apotek",        "kolom": "Fasilitas Umum_Apotik/Toko Obat"},
    {"kunci": "swalayan",  "label": "Swalayan",      "kolom": "Fasilitas Umum_Swalayan"},
    {"kunci": "pasar",     "label": "Pasar",         "kolom": "Fasilitas Umum_Pasar Tradisional"},
    {"kunci": "ibadah",    "label": "Rumah Ibadah",  "kolom": "Fasilitas Umum_Rumah Ibadah"},
    {"kunci": "pelabuhan", "label": "Pelabuhan",     "kolom": "Fasilitas Umum_Pelabuhan"},
    {"kunci": "penukaran", "label": "Money Changer", "kolom": "Fasilitas Umum_Money Changer"},
]


def _pisah_nama_alamat(teks):
    """Pecah "BNI Parapat (Sisingamangaraja No.215, Tiga Raja)" jadi nama & alamat."""
    t = str(teks or "").strip()
    if not t:
        return None
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", t, re.DOTALL)
    if m:
        nama = m.group(1).strip()
        alamat = re.sub(r"\s+", " ", m.group(2)).strip()
        return {"nama": nama or t, "alamat": alamat or None}
    return {"nama": re.sub(r"\s+", " ", t), "alamat": None}


class FasilitasUmum:
    """Daftar fasilitas umum per kabupaten."""

    def __init__(self, data_dir=DATA_DIR):
        self.per_kabupaten = {}
        try:
            df = pd.read_csv(
                f"{data_dir}/Dataset_HackathonTourism_-_IT_DEL__1_"
                f"-Info_Seputar_Danau_Toba_typed.csv")
        except Exception:
            return

        for _, r in df.iterrows():
            kab = str(r.get("Nama Kabupaten") or "").strip()
            if not kab:
                continue
            cocok = next((k for k in KABUPATEN_TOBA if k.lower() == kab.lower()), None)
            if cocok is None:
                continue
            simpan = self.per_kabupaten.setdefault(cocok, {})
            for jenis in JENIS_FASILITAS:
                nilai = r.get(jenis["kolom"])
                if nilai is None or str(nilai).strip().lower() in ("", "nan"):
                    continue
                daftar = simpan.setdefault(jenis["kunci"], [])
                for potong in str(nilai).split("\n"):
                    item = _pisah_nama_alamat(potong)
                    if item and not any(x["nama"] == item["nama"] for x in daftar):
                        daftar.append(item)

    def kabupaten_dari_alamat(self, alamat_list):
        """Kumpulan kabupaten unik yang tersentuh sederet alamat, urut stabil."""
        hasil = []
        for a in alamat_list or []:
            k = deteksi_kabupaten(a)
            if k and k not in hasil:
                hasil.append(k)
        return hasil

    def untuk_kabupaten(self, kabupaten, maks_per_jenis=4, hanya=None):
        """Daftar fasilitas untuk sekumpulan kabupaten, dikelompokkan per jenis."""
        kabupaten = [k for k in (kabupaten or []) if k in self.per_kabupaten]
        if not kabupaten:
            return []

        hasil = []
        for jenis in JENIS_FASILITAS:
            if hanya and jenis["kunci"] not in hanya:
                continue

            antrian = [
                [{**f, "kabupaten": kab}
                 for f in self.per_kabupaten.get(kab, {}).get(jenis["kunci"], [])]
                for kab in kabupaten
            ]
            total = sum(len(a) for a in antrian)
            if not total:
                continue

            item = []
            posisi = 0
            while len(item) < maks_per_jenis and any(posisi < len(a) for a in antrian):
                for a in antrian:
                    if posisi < len(a) and len(item) < maks_per_jenis:
                        item.append(a[posisi])
                posisi += 1

            hasil.append({
                "kunci": jenis["kunci"],
                "label": jenis["label"],
                "jumlah": total,
                "item": item,
            })
        return hasil


def _fmt_harga(item, per_malam=False):
    lo, mid, hi = item["harga_min"], item["harga_tengah"], item["harga_max"]
    suffix = "/malam" if per_malam else ""
    if lo == hi:
        return f"Rp{mid:,.0f}{suffix}"
    return f"~Rp{mid:,.0f}{suffix} (kisaran Rp{lo:,.0f} - Rp{hi:,.0f})"


def tampilkan_itinerary(result, routed):
    if result["status"] != "Optimal":
        print("Tidak ada solusi:", result.get("message")); return
    print("=" * 60)
    print(f"ITINERARY — Budget Rp{result['budget_total']:,} ({result['n_days']} hari {result['n_nights']} malam, "
          f"{result.get('n_orang', 1)} orang)")
    print("=" * 60)
    if result.get("profil_turis"):
        sumber = result.get("profil_sumber", "")
        print(f"Profil turis   : {result['profil_turis']} — {result['profil_deskripsi']}")
        print(f"                 ({sumber}; budget ~Rp{result.get('estimasi_biaya_per_hari',0):,}/hari, bobot UMKM {result.get('umkm_weight_dipakai')})")
        if (result.get("profil_sumber") == "dipilih turis"
                and result.get("profil_turis") != result.get("profil_saran_budget")):
            print(f"                 (catatan: berdasar budget kami menyarankan '{result['profil_saran_budget']}', "
                  f"tapi kamu memilih '{result['profil_turis']}')")
    print(f"Estimasi biaya : ~Rp{result['total_estimasi']:,} ({result['persen_terpakai_estimasi']}% dari budget)")
    print(f"  = ~Rp{result.get('estimasi_biaya_per_hari',0):,} per hari")
    print(f"Kisaran biaya  : Rp{result['total_min']:,} - Rp{result['total_max']:,}")
    print(f"Sisa (estimasi): ~Rp{result['sisa_estimasi']:,}")
    print(f"(Biaya makan sudah dikali {result.get('n_orang',1)} orang; "
          f"kamar hotel: {result.get('n_kamar',1)} kamar)")
    h = result["hotel"][0]
    if result.get("hotel_gratis_pulang_hari"):
        print(f"\nHOTEL (titik acuan, TIDAK menginap - trip pulang-hari): {h['place-name']} | "
              f"rating {h['place-rating']} | biaya: Rp0 (tidak dikenakan)")
    else:
        print(f"\nHOTEL (base): {h['place-name']} | {_fmt_harga(h, per_malam=True)} x "
              f"{result.get('n_kamar',1)} kamar | rating {h['place-rating']}")


    sumber = routed.get("sumber_jarak", "haversine")
    label_sumber = {"osrm": "jarak jalan asli (OSRM)",
                    "haversine": "estimasi garis lurus (OSRM tidak tersedia)",
                    "campuran": "campuran (sebagian OSRM, sebagian estimasi)"}.get(sumber, sumber)
    print(f"Sumber perhitungan jarak: {label_sumber}")
    print(f"Total jarak tempuh seluruh trip: ~{routed['total_jarak_semua_hari_km']} km")
    for day in routed["days"]:
        dur = f", ~{day['total_durasi_menit']:.0f} menit di jalan" if day.get("total_durasi_menit") else ""
        print(f"\n--- HARI {day['hari']} (tempuh ~{day['total_jarak_km']} km{dur}) ---")
        print("  Wisata (urut terdekat | 'Tiba' = estimasi jam kedatangan, dibandingkan dengan jam buka tempat):")
        dijadwalkan = assign_visit_times(day["wisata_terurut"], jam_mulai=9.0)
        for i, w in enumerate(dijadwalkan, 1):
            dur_w = f", ~{w['durasi_menit']:.0f} mnt" if w.get("durasi_menit") else ""
            status = f"  [!] {w['peringatan']}" if w.get("peringatan") else f"  [OK, {w.get('jam_operasional_str','')}]"
            print(f"    Tiba ~{w['jam_kunjungan_str']} | {i}. {w['place-name']} | {_fmt_harga(w)} | rating {w['place-rating']}  (+{w['jarak_dari_sebelumnya_km']} km{dur_w}){status}")
        print("  Makan:")
        for r in day["resto"]:
            print(f"    - {r['place-name']} | {_fmt_harga(r)}")
        if day.get("penyeberangan"):
            print("  Penyeberangan feri:")
            for p in day["penyeberangan"]:
                teks = format_info_feri(p["info"])
                print(f"    ({p['dari']} -> {p['ke']})")
                print(f"      {teks}")

    dl = result.get("dampak_lokal")
    if dl and dl.get("status") == "ok":
        print(f"\n{'='*60}")
        print("DAMPAK EKONOMI LOKAL (usaha lokal & keotentikan Batak)")
        print(f"{'='*60}")
        print(f"  Usaha lokal otentik dikunjungi : {dl['umkm_lokal_otentik']} dari {dl['total_kunjungan_makan']} kunjungan makan ({dl['proporsi_umkm']}%)")
        print(f"  Usaha unik (sebaran kunjungan)  : {dl['usaha_unik_dikunjungi']} tempat berbeda")
        print(f"  Ragam kuliner khas Batak        : {dl['ragam_kuliner_khas']} jenis")
        if dl["daftar_kuliner_khas"]:
            print(f"    ({', '.join(dl['daftar_kuliner_khas'])})")
        print(f"  Estimasi kasar dana ke usaha lokal: ~Rp{dl['estimasi_kasar_ke_usaha_lokal']:,}")
        print(f"    (catatan: estimasi kasar harga x kunjungan, bukan dampak ekonomi terverifikasi)")


