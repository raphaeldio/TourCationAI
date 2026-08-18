"""Endpoint intelijen pariwisata (Fitur 1 & 2), tahap numerik.

Tidak ada LLM dan tidak ada kunci API di seluruh berkas ini. Itu disengaja:
dashboard harus tetap tampil utuh saat OPENAI_API_KEY tidak ada. Narasi AI
ditambahkan di router terpisah dan sifatnya melengkapi, bukan menentukan.

Tulang punggungnya aritmetika atas CSV. Tiga endpoint menambahkan seri
berbasis database — `/live`, `/lapangan`, `/selisih-harga` — dan ketiganya
memakai kontrak yang sama: SELALU 200, dan `{"aktif": false}` bila database
mati, sehingga kartunya cukup disembunyikan tanpa merusak sisa dashboard.

Empat seri itu tidak pernah dijumlahkan satu sama lain. Volume ulasan adalah
proksi permintaan berskala ribuan; cacah perencanaan masih puluhan; laporan
lapangan satuan; selisih harga bersatuan rupiah. Mereka berdampingan.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.paths import engine
from ..core.security import Pengguna, wajib_peran
from ..schemas.insight import NarasiGap, NarasiInsight
from ..services import ai_fakta
from ..services import lapangan as lap
from ..services import selisih_harga as sh
from ..services.ai_insight import hasilkan
from ..services.analytics import get_intel
from ..services.gap import analisis_gap
from ..services.live import statistik_live

# Seluruh endpoint intelijen memerlukan peran GOV (ADMIN selalu lolos).
# Diterapkan di tingkat router supaya endpoint baru tidak bisa lupa dijaga —
# kelalaian yang paling mudah terjadi ketika fitur ditambah belakangan.
router = APIRouter(prefix="/api/intel", dependencies=[Depends(wajib_peran("GOV"))])


@router.get("/ringkas")
def intel_ringkas():
    """Angka utama untuk kartu KPI dashboard pemerintah."""
    intel = get_intel()
    return {
        "ringkas": intel.ringkas(),
        "destinasi_populer": [
            {
                "nama": t["nama"],
                "kabupaten": t["kabupaten"],
                "kategori": t["kategori"],
                "rating": t["rating"],
                "ulasan_12_bulan": t["ulasan_12_bulan"],
                "status_tren": t["status_tren"],
            }
            for t in intel.tempat_teratas(10, jenis="wisata")
        ],
        "umkm_populer": [
            {
                "nama": t["nama"],
                "kabupaten": t["kabupaten"],
                "rating": t["rating"],
                "skor_umkm": t.get("skor_umkm"),
                "umkm_kuat": t.get("umkm_kuat"),
                "ulasan_12_bulan": t["ulasan_12_bulan"],
            }
            for t in intel.tempat_teratas(10, jenis="umkm")
        ],
    }


@router.get("/kabupaten")
def intel_kabupaten():
    """Agregat lengkap per kabupaten (tabel + peta + radar)."""
    intel = get_intel()
    return {
        "kabupaten": intel.daftar_kabupaten(),
        "urutan": engine.KABUPATEN_TOBA,
        "peringatan_proksi": intel.ringkas()["peringatan_proksi"],
    }


@router.get("/tren")
def intel_tren(batas: int = Query(8, ge=1, le=30)):
    """Seri 12 bulan + daftar destinasi yang naik dan turun.

    Bucket bulanan hanya memuat ulasan berumur < 12 bulan. Ulasan "a year ago"
    dan "2 years ago" adalah point mass Google dan sengaja TIDAK disebar ke
    bulan — ia hanya dipakai sebagai penyebut YoY kasar.
    """
    intel = get_intel()

    seri_nasional = [0] * 12
    for s in intel.kab.values():
        for i, n in enumerate(s["ulasan_bulanan"]):
            seri_nasional[i] += n

    def ringkas_tempat(t):
        return {
            "nama": t["nama"],
            "kabupaten": t["kabupaten"],
            "kategori": t["kategori"],
            "pertumbuhan": t["pertumbuhan"],
            "z": t["z"],
            "ulasan_12_bulan": t["ulasan_12_bulan"],
            "ulasan_6_terakhir": t["ulasan_6_terakhir"],
            "ulasan_6_sebelumnya": t["ulasan_6_sebelumnya"],
            "status_tren": t["status_tren"],
        }

    return {
        # indeks 0 = bulan terakhir; dibalik agar grafik terbaca kiri->kanan
        "seri_nasional": list(reversed(seri_nasional)),
        "label_seri": [f"B-{i}" for i in range(11, -1, -1)],
        "tumbuh_cepat": [ringkas_tempat(t) for t in intel.tren_tempat("NAIK CEPAT", batas)],
        "menurun": [ringkas_tempat(t) for t in intel.tren_tempat("TURUN", batas)],
        "per_kabupaten": [
            {
                "kabupaten": s["kabupaten"],
                "seri": list(reversed(s["ulasan_bulanan"])),
                "ulasan_12_bulan": s["ulasan_12_bulan"],
                "pertumbuhan": s["pertumbuhan"],
                "status_tren": s["status_tren"],
            }
            for s in intel.daftar_kabupaten()
        ],
        "metodologi": (
            "Proksi permintaan dari volume ulasan, bukan jumlah kunjungan. "
            "Pertumbuhan = rasio 6 bulan terakhir terhadap 6 bulan sebelumnya "
            "(Laplace-smoothed); status hanya diberikan bila n >= 30 dan |z| >= 1,64."
        ),
    }


@router.get("/gap")
def intel_gap():
    """Analisis kesenjangan + prioritas pengembangan per kabupaten."""
    return analisis_gap()


@router.get("/live")
def intel_live(hari: int = Query(30, ge=1, le=365)):
    """Seri kedua: perencanaan nyata dari log itinerary.

    Sengaja endpoint terpisah dari /tren. Mencampur cacah itinerary dengan
    volume ulasan akan menghasilkan angka tak bersatuan; dashboard menampilkan
    keduanya berdampingan, bukan dijumlahkan.

    Selalu 200 — bila database mati, isinya `{"aktif": false}` dan kartu live
    di UI cukup disembunyikan tanpa mengganggu sisa dashboard.
    """
    return statistik_live(hari)


@router.get("/lapangan")
def intel_lapangan(
    hari: int = Query(180, ge=1, le=730),
    kabupaten: Optional[str] = Query(None),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Seri KETIGA: pengamatan langsung wisatawan yang perjalanannya selesai.

    Jendela bawaannya 180 hari, jauh lebih panjang daripada 30 hari milik
    `/live`. Bukan karena kurang penting, justru sebaliknya: laporan lapangan
    datang satuan, bukan puluhan, sehingga jendela sebulan hampir selalu
    menghasilkan nol dan grafik yang selalu kosong akan dibaca sebagai "tidak
    ada masalah" — kesimpulan yang persis terbalik dari yang benar.

    Selalu 200. Bila database mati isinya `{"aktif": false}` dan kartunya cukup
    disembunyikan; seluruh angka CSV di dashboard tetap tampil.

    Angka di sini **tidak pernah dijumlahkan** dengan volume ulasan maupun
    cacah itinerary. Ia berdampingan, bukan bertambah — lihat `metodologi`
    pada jawabannya.
    """
    wilayah = kabupaten or (None if pengguna.peran == "ADMIN" else pengguna.kabupaten)
    return lap.agregat(hari, wilayah)


@router.get("/selisih-harga")
def intel_selisih_harga(
    kabupaten: Optional[str] = Query(None),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Seri KEEMPAT: selisih estimasi dataset terhadap harga terlapor UMKM.

    Pertanyaan yang dijawabnya — "apakah harga di lapangan berbeda dari yang
    tercatat?" — dulu TIDAK BISA dijawab, karena harga UMKM terverifikasi
    menimpa pita dataset di `solver.restos` dan peleburan itu menghapus
    selisihnya. Endpoint ini adalah alasan utama override tersebut dicabut.

    Angka utama pada jawabannya adalah `posisi`, bukan `selisih_rupiah`.
    Estimasi dataset adalah pita harga makan per orang; harga terlapor adalah
    harga satu item menu. Keduanya tidak sebanding langsung, jadi yang
    dipertanggungjawabkan adalah letak relatifnya terhadap pita — bukan
    besarannya. Lihat `metodologi` pada jawabannya.
    """
    wilayah = kabupaten or (None if pengguna.peran == "ADMIN" else pengguna.kabupaten)
    return sh.agregat(wilayah)


@router.post("/insight")
def intel_insight(
    request: Request,
    refresh: bool = Query(False, description="Paksa buat ulang; hanya untuk ADMIN."),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Narasi AI atas dashboard F1.

    Melengkapi, tidak menentukan: seluruh angka sudah tersedia di /ringkas dan
    /tren tanpa memanggil AI sama sekali. Endpoint ini selalu 200 — tanpa kunci
    OpenAI isinya `narasi: null` dengan status yang jelas.
    """
    return hasilkan(
        fitur="insight",
        scope="nasional",
        fakta=ai_fakta.fakta_insight(),
        petunjuk=ai_fakta.PETUNJUK_INSIGHT,
        model_hasil=NarasiInsight,
        request=request,
        user_id=pengguna.id,
        refresh=refresh and pengguna.peran == "ADMIN",
    )


@router.post("/gap/narasi")
def intel_gap_narasi(
    request: Request,
    refresh: bool = Query(False, description="Paksa buat ulang; hanya untuk ADMIN."),
    pengguna: Pengguna = Depends(wajib_peran("GOV")),
):
    """Narasi AI atas tabel kesenjangan F2. Angkanya tetap di GET /intel/gap."""
    return hasilkan(
        fitur="gap",
        scope="nasional",
        fakta=ai_fakta.fakta_gap(),
        petunjuk=ai_fakta.PETUNJUK_GAP,
        model_hasil=NarasiGap,
        request=request,
        user_id=pengguna.id,
        refresh=refresh and pengguna.peran == "ADMIN",
    )


@router.get("/kabupaten/{nama}")
def intel_detail_kabupaten(nama: str):
    """Detail satu kabupaten untuk halaman drill-down."""
    intel = get_intel()
    cocok = next((k for k in engine.KABUPATEN_TOBA if k.lower() == nama.lower()), None)
    if cocok is None:
        raise HTTPException(404, f"Kabupaten '{nama}' tidak dikenal.")

    tempat = [
        t for t in intel.tempat.values() if t.get("kabupaten") == cocok
    ]
    tempat.sort(key=lambda t: t.get("ulasan_12_bulan", 0), reverse=True)

    gap = next(
        (g for g in analisis_gap()["kabupaten"] if g["kabupaten"] == cocok), None)

    return {
        "kabupaten": intel.kab[cocok],
        "gap": gap,
        "tempat": [
            {
                "nama": t["nama"],
                "jenis": t["jenis"],
                "kategori": t["kategori"],
                "rating": t["rating"],
                "lat": t["lat"],
                "lon": t["lon"],
                "ulasan_12_bulan": t["ulasan_12_bulan"],
                "status_tren": t["status_tren"],
            }
            for t in tempat[:40]
        ],
    }
