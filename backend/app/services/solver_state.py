"""Singleton solver, ferry detector, dan fasilitas umum.

Dibangun sekali lalu dipakai ulang karena membaca CSV itu mahal. Pembangunannya
malas (lazy): request pertama yang menyentuhnya membayar ongkos baca berkas,
bukan proses startup — ini yang menjaga /api/health tetap responsif saat
instance Render baru bangun dari tidur.

HARGA UMKM TIDAK PERNAH MASUK KE SINI. Sampai Fase 10 modul ini memegang
chokepoint yang menimpa `solver.restos` dengan harga produk terverifikasi.
Mekanisme itu dicabut — bukan karena penjagaannya lemah, justru sebaliknya: ia
menuntut baseline snapshot, klip 0,25x-4x, ambang skor, dan TTL lima menit
hanya supaya aman. Yang keliru adalah premisnya. Menimpa mencampur dua jenis
angka yang tidak sebanding:

  * `solver.restos` berisi ESTIMASI KISARAN — midpoint bucket harga Google.
    Ia perkiraan, bukan hasil ukur, dan nilainya justru pada tidak bergerak:
    itinerary yang sama menghasilkan anggaran yang sama kapan pun dihitung.
  * Produk UMKM berisi HARGA TERLAPOR — harga menu sungguhan yang ditulis
    pemiliknya dan dinilai wajar/tidak oleh komunitas.

Menggabungkan keduanya menghasilkan satu angka yang bukan keduanya, sekaligus
menghapus selisih antara keduanya — padahal selisih itulah yang berguna bagi
pemerintah. Sekarang keduanya hidup berdampingan: estimasi di jalur itinerary,
harga terlapor di panel usaha (`services/umkm.py` -> `SuaraHarga.tsx`).

Konsekuensi yang disengaja: jumlah produk aktif sebuah usaha tidak lagi bisa
menggeser peringkatnya di itinerary. Selama chokepoint masih ada, `min()`/
`max()` atas produk yang lolos membuat batas produk per paket langganan — nilai
komersial — ikut menentukan `harga_min`, dan `harga_min` dibaca engine di empat
tempat: normalizer skor kualitas (:587), suku biaya ILP (:616-619), sinyal
"murah" pada skor UMKM (:1613), dan filter alternatif swap (:1260-1279). Aturan
"langganan tidak membeli peringkat" ternyata tidak bisa ditegakkan hanya dengan
memeriksa daftar impor; ia butuh jalur datanya benar-benar tidak ada.

Efek samping yang menyenangkan: siklus impor solver_state <-> price_check ikut
hilang. Yang tersisa satu arah, dan hanya di dalam fungsi.
"""

import logging
from typing import Optional

from ..core.paths import DATA_DIR, engine

_log = logging.getLogger(__name__)

_solver: Optional["engine.BudgetSolverV3"] = None
_ferry: Optional["engine.FerryDetector"] = None
_fasilitas: Optional["engine.FasilitasUmum"] = None

_KULINER_CACHE: list = []


def get_solver():
    global _solver, _ferry, _fasilitas
    if _solver is None:
        _solver = engine.BudgetSolverV3(data_dir=DATA_DIR)
        _ferry = engine.FerryDetector()
        _fasilitas = engine.FasilitasUmum(data_dir=DATA_DIR)
    return _solver, _ferry, _fasilitas


def harga_dasar_restos():
    """Harga restoran apa adanya dari CSV.

    Dipakai `price_check` untuk membangun sebaran acuan. Sejak override dicabut,
    `solver.restos` memang selalu berisi harga CSV — tidak ada lagi salinan
    baseline yang perlu dijaga terpisah. Fungsinya tetap dipertahankan karena ia
    menyatakan maksud pemanggilnya: yang diminta adalah harga DASAR, dan
    pernyataan itu harus tetap benar seandainya kelak ada lapisan lain di atas
    `restos`.
    """
    solver, _, _ = get_solver()
    return solver.restos


def kuliner_khas() -> list:
    """Daftar kuliner khas Batak, dimuat sekali per proses."""
    if not _KULINER_CACHE:
        _KULINER_CACHE.extend(engine.muat_kuliner_khas(DATA_DIR))
    return _KULINER_CACHE


def muat_ulang_solver() -> dict:
    """Bangun ulang solver dari CSV dan kosongkan sebaran acuan harga.

    Dulu endpoint admin ini menerapkan ulang override harga tanpa menunggu TTL.
    Tanpa override, yang tersisa justru lebih mendasar: memuat ulang berkas data
    tanpa merestart proses — berguna ketika CSV di `data/` diganti.

    Impor `price_check` sengaja di dalam fungsi. Sekarang tidak ada siklus yang
    perlu diputus, tetapi memuatnya di tingkat modul berarti setiap proses yang
    menyentuh solver ikut membangun sebaran acuan, dan itu ongkos yang hanya
    dibutuhkan jalur UMKM.
    """
    global _solver, _ferry, _fasilitas

    from .price_check import reset_referensi

    _solver = None
    _ferry = None
    _fasilitas = None
    _KULINER_CACHE.clear()
    reset_referensi()

    solver, _, _ = get_solver()
    _log.info("Solver dimuat ulang dari CSV: %d restoran.", len(solver.restos))
    return {
        "n_resto": int(len(solver.restos)),
        "harga_min_maks": float(solver.restos["harga_min"].max()),
        "sumber": "CSV dataset. Harga UMKM tidak pernah menimpa nilai ini.",
    }
