"""Validasi harga produk UMKM — seluruhnya aritmetika, tidak ada AI di sini.

Keputusan OK/SUSPECT/FLAGGED diambil Python. Peran model bahasa nanti hanya
MENJELASKAN keputusan itu dengan kalimat manusia, tidak pernah membuatnya.
Alasannya sederhana: keputusan yang bisa berubah antar-pemanggilan tidak bisa
dipertanggungjawabkan ke pemilik warung yang harganya ditandai.

Metode: robust z pada LOGARITMA harga, dengan MAD ganda (dua sisi).
- Harga bersifat right-skewed dan selalu positif; pada skala log sebarannya
  jauh lebih simetris sehingga median dan MAD bermakna.
- MAD dipakai, bukan standar deviasi: satu harga palsu Rp 50 juta akan
  menggeser rerata dan std sedemikian rupa sampai dirinya sendiri tampak
  normal. Median hampir tidak bergerak.

DUA KOREKSI TERHADAP RANCANGAN AWAL, keduanya dipaksa oleh data:

1. Acuan memakai KEDUA ujung pita harga (`harga_min` DAN `harga_max`), bukan
   `harga_tengah`. Titik tengah ternyata adalah midpoint bucket harga Google:
   lebih dari separuh restoran jatuh persis di Rp 37.500, sehingga MAD-nya
   NOL di setiap kabupaten dan seluruh keputusan jatuh ke lantai sigma. Dengan
   kedua ujung dipakai, 117 restoran memberi 234 titik harga nyata dari
   Rp 1.000 sampai Rp 100.000 dan sebarannya kembali bermakna.

2. Sigma dihitung terpisah untuk sisi bawah dan sisi atas median. Sebaran ini
   memang tidak simetris bahkan pada skala log — 112 titik di bawah median
   berbanding 27 di atasnya. Itu temuan, bukan gangguan: harga murah adalah
   hal biasa di kawasan Danau Toba, harga mahal tidak. Konsekuensinya persis
   yang diinginkan untuk deteksi kecurangan — longgar terhadap warung murah
   (sigma 1,03), ketat terhadap harga selangit (sigma 0,60).
"""

import bisect
import math
import statistics
import threading
from dataclasses import dataclass, field
from typing import Optional

from ..core.paths import engine

# Ambang pada |z|. Dipilih longgar dengan sengaja: menandai harga jujur sebagai
# palsu merusak kepercayaan pemilik warung, sedangkan harga aneh yang lolos
# masih tertahan chokepoint di solver_state — ia tetap butuh skor verifikasi.
AMBANG_SUSPECT = 2.5
AMBANG_FLAGGED = 3.5

# Di bawah ini grup kabupaten dianggap terlalu tipis untuk jadi acuan sendiri
# dan jatuh ke pool nasional. Dihitung dalam jumlah TEMPAT, bukan titik harga.
# Toba 45 / Samosir 49 / Simalungun 19 memadai; Tapanuli Utara yang hanya
# 1 restoran jelas tidak.
MIN_ANGGOTA_GRUP = 8

# Lantai sigma pada skala log. Setelah koreksi acuan di atas, nilai MAD nyata
# berkisar 0,6-1,0 sehingga lantai ini hampir tidak pernah mengikat — ia hanya
# menahan kasus patologis grup yang seluruh harganya identik.
LANTAI_SIGMA = 0.15

# Batas kewarasan absolut, di luar jalur statistik.
HARGA_MIN = 1_000
HARGA_MAKS = 50_000_000

NASIONAL = "NASIONAL"


@dataclass(frozen=True)
class Grup:
    """Sebaran acuan satu kabupaten (atau pool nasional)."""

    nama: str
    n_tempat: int          # jumlah rumah makan penyumbang
    n_titik: int           # jumlah titik harga (2 per rumah makan)
    median: float          # rupiah
    med_ln: float
    sigma_bawah: float     # skala log untuk harga DI BAWAH median
    sigma_atas: float      # skala log untuk harga DI ATAS median
    p25: float
    p75: float
    # Titik harga acuan, terurut naik. Disimpan supaya persentil empiris bisa
    # dihitung tanpa mengasumsikan bentuk sebaran — analisis kompetitor
    # memakainya, dan mengubah z jadi persentil lewat CDF normal akan
    # menyelundupkan asumsi simetri yang justru sudah dibantah data (lihat
    # koreksi 2 di docstring modul). Beberapa ratus float per grup.
    harga_terurut: tuple[float, ...] = field(default=(), repr=False)

    def sigma(self, selisih_ln: float) -> float:
        """Skala yang berlaku untuk satu simpangan, sesuai arahnya."""
        return self.sigma_atas if selisih_ln > 0 else self.sigma_bawah

    def persentil(self, harga: float) -> Optional[float]:
        """Posisi satu harga pada sebaran acuan, 0-100. None bila tak ada acuan.

        Empiris, bukan parametrik: berapa persen titik harga acuan yang berada
        di bawah nilai ini.
        """
        if not self.harga_terurut:
            return None
        di_bawah = bisect.bisect_right(self.harga_terurut, harga)
        return round(100.0 * di_bawah / len(self.harga_terurut), 1)

    def ringkas(self) -> dict:
        return {
            "grup": self.nama,
            "n": self.n_tempat,
            "n_titik_harga": self.n_titik,
            "median": int(self.median),
            "p25": int(self.p25),
            "p75": int(self.p75),
        }


def _mad_sisi(simpangan: list[float]) -> float:
    """1,4826 x MAD satu sisi; 1,4826 menyamakannya dengan std pada normal."""
    if not simpangan:
        return LANTAI_SIGMA
    return max(1.4826 * statistics.median(simpangan), LANTAI_SIGMA)


def _grup(nama: str, harga: list[float], n_tempat: int) -> Optional[Grup]:
    if len(harga) < 6:
        return None
    ln = sorted(math.log(h) for h in harga)
    med_ln = statistics.median(ln)
    kuartil = statistics.quantiles(harga, n=4)
    urut = tuple(sorted(harga))
    return Grup(
        nama=nama,
        n_tempat=n_tempat,
        n_titik=len(harga),
        median=statistics.median(harga),
        med_ln=med_ln,
        sigma_bawah=_mad_sisi([med_ln - v for v in ln if v < med_ln]),
        sigma_atas=_mad_sisi([v - med_ln for v in ln if v > med_ln]),
        p25=kuartil[0],
        p75=kuartil[2],
        harga_terurut=urut,
    )


def bangun_referensi(restos) -> dict[str, Grup]:
    """Sebaran acuan dari DataFrame restoran CSV. Fungsi murni.

    Dikelompokkan **per kabupaten saja**. `place-type` sengaja tidak dipakai
    sebagai pengelompok: 147 dari 148 baris bernilai "Restoran", jadi ia tidak
    memisahkan apa pun.

    Menerima DataFrame agar tidak bergantung pada solver — pemanggilnya yang
    memastikan yang dioper adalah harga DASAR dari CSV, bukan harga yang sudah
    kena override pengguna. Acuan yang ikut bergeser mengikuti submission akan
    lumpuh persis saat paling dibutuhkan.
    """
    per_kabupaten: dict[str, list[float]] = {}
    tempat_kabupaten: dict[str, int] = {}
    semua: list[float] = []
    n_semua = 0

    for _, baris in restos.iterrows():
        # Kedua ujung pita dipakai — lihat koreksi (1) di docstring modul.
        titik = []
        for kolom in ("harga_min", "harga_max"):
            try:
                nilai = float(baris.get(kolom))
            except (TypeError, ValueError):
                continue
            if math.isfinite(nilai) and nilai > 0:
                titik.append(nilai)
        if not titik:
            continue

        semua.extend(titik)
        n_semua += 1
        kab = engine.deteksi_kabupaten(baris.get("address"))
        if kab:
            per_kabupaten.setdefault(kab, []).extend(titik)
            tempat_kabupaten[kab] = tempat_kabupaten.get(kab, 0) + 1

    hasil: dict[str, Grup] = {}
    nasional = _grup(NASIONAL, semua, n_semua)
    if nasional:
        hasil[NASIONAL] = nasional
    for kab, harga in per_kabupaten.items():
        g = _grup(kab, harga, tempat_kabupaten[kab])
        if g:
            hasil[kab] = g
    return hasil


# ---------------------------------------------------------------------------
# Akses ber-cache
# ---------------------------------------------------------------------------
_REF: Optional[dict[str, Grup]] = None
_KUNCI = threading.Lock()


def referensi() -> dict[str, Grup]:
    """Sebaran acuan, dibangun sekali per proses dari harga dasar CSV."""
    global _REF
    if _REF is None:
        with _KUNCI:
            if _REF is None:
                # Impor di dalam fungsi memutus siklus: solver_state memanggil
                # modul ini saat menerapkan override harga.
                from .solver_state import harga_dasar_restos
                _REF = bangun_referensi(harga_dasar_restos())
    return _REF


def reset_referensi() -> None:
    global _REF
    with _KUNCI:
        _REF = None


def grup_untuk(kabupaten: Optional[str]) -> Optional[Grup]:
    """Grup acuan yang berlaku. Kabupaten tipis jatuh ke pool nasional."""
    ref = referensi()
    g = ref.get(kabupaten or "")
    if g and g.n_tempat >= MIN_ANGGOTA_GRUP:
        return g
    return ref.get(NASIONAL)


# ---------------------------------------------------------------------------
# Pemeriksaan
# ---------------------------------------------------------------------------
def periksa(harga: int, kabupaten: Optional[str]) -> dict:
    """Nilai satu harga terhadap sebarannya. Selalu mengembalikan dict."""
    if harga < HARGA_MIN or harga > HARGA_MAKS:
        return {
            "status": "FLAGGED",
            "robust_z": None,
            "harga_median_referensi": None,
            "n_referensi": 0,
            "metode": "batas_absolut",
            "alasan": (
                f"Harga di luar rentang wajar (Rp {HARGA_MIN:,} - Rp {HARGA_MAKS:,})."
            ).replace(",", "."),
            "grup": None,
        }

    g = grup_untuk(kabupaten)
    if g is None:
        return {
            "status": "OK",
            "robust_z": None,
            "harga_median_referensi": None,
            "n_referensi": 0,
            "metode": "tanpa_acuan",
            "alasan": "Belum ada sebaran pembanding; harga diterima apa adanya.",
            "grup": None,
        }

    selisih = math.log(harga) - g.med_ln
    z = selisih / g.sigma(selisih)

    if abs(z) >= AMBANG_FLAGGED:
        status = "FLAGGED"
    elif abs(z) >= AMBANG_SUSPECT:
        status = "SUSPECT"
    else:
        status = "OK"

    arah = "di atas" if z > 0 else "di bawah"
    rasio = harga / g.median if g.median else 0
    alasan = (
        f"Harga Rp {harga:,} berada {abs(z):.1f} sigma {arah} median "
        f"Rp {int(g.median):,} dari {g.n_tempat} rumah makan di {g.nama.lower()} "
        f"(sekitar {rasio:.1f}x median)."
    ).replace(",", ".")

    return {
        "status": status,
        "robust_z": round(z, 3),
        "harga_median_referensi": int(g.median),
        "n_referensi": g.n_tempat,
        "metode": "robust_z_log_mad_ganda",
        "alasan": alasan,
        "grup": g.ringkas(),
    }


# ---------------------------------------------------------------------------
# Skor verifikasi
# ---------------------------------------------------------------------------
AMBANG_TERVERIFIKASI = 0.7
AMBANG_DITINJAU = 0.4


def _wilson_bawah(n_pos: int, n: int) -> float:
    """Batas bawah Wilson 95% untuk proporsi suara setuju.

    Dengan n = 0 nilainya sekitar 0,21 — harga tanpa bukti apa pun memang
    seharusnya mulai rendah dan harus MENDAPATKAN kepercayaan, bukan
    memilikinya sejak awal. Rerata biasa akan memberi 0 (kejam ke pendatang
    baru) atau 1 (satu suara setuju langsung sempurna).
    """
    penyebut = n + 3.84
    p = (n_pos + 1.92) / penyebut
    return max(0.0, p - 1.96 * math.sqrt(p * (1 - p) / penyebut))


def skor_verifikasi(
    z: Optional[float],
    n_setuju: int,
    n_suara: int,
    ada_deskripsi: bool,
    ada_jam_buka: bool,
    usaha_terverifikasi: bool,
    ada_kategori: bool,
) -> dict:
    """Gabungkan bukti statistik, komunitas, dan kelengkapan jadi satu skor.

    Catatan penyimpangan dari rencana: komponen keempat kelengkapan di §7
    berbunyi "min <= max", padahal skema `umkm_product` menyimpan SATU kolom
    `harga`, bukan rentang. Diganti "kategori terisi" — sama-sama sinyal
    kelengkapan pengisian dan tetap berbobot 0,25.
    """
    statistik = 1.0 if z is None else max(0.0, min(1.0, 1 - abs(z) / AMBANG_FLAGGED))
    komunitas = _wilson_bawah(n_setuju, n_suara)
    kelengkapan = (
        0.25 * float(ada_deskripsi)
        + 0.25 * float(ada_jam_buka)
        + 0.25 * float(usaha_terverifikasi)
        + 0.25 * float(ada_kategori)
    )

    skor = 0.45 * statistik + 0.35 * komunitas + 0.20 * kelengkapan

    if skor >= AMBANG_TERVERIFIKASI:
        label = "TERVERIFIKASI"
    elif skor >= AMBANG_DITINJAU:
        label = "PERLU DITINJAU"
    else:
        label = "DIRAGUKAN"

    return {
        "skor": round(skor, 3),
        "label": label,
        "komponen": {
            "statistik": round(statistik, 3),
            "komunitas": round(komunitas, 3),
            "kelengkapan": round(kelengkapan, 3),
            "n_suara": n_suara,
            "n_setuju": n_setuju,
        },
    }
