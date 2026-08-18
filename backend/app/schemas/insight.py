"""Bentuk narasi AI yang diterima dari model — lapisan ketiga pertahanan.

Model dipanggil dalam JSON mode, lalu hasilnya DIVALIDASI ke kelas di bawah.
`extra="ignore"` membuang kunci asing tanpa ribut: kalau model mengarang field
baru — atau sebuah injeksi berhasil membuatnya menjawab dengan struktur lain —
yang sampai ke frontend tetap hanya bentuk yang kita tentukan di sini.

Setiap daftar berisi butir bertiga bagian. `angka_pendukung` sengaja bertipe
list[str], bukan angka: model tidak boleh menghitung, ia hanya menyalin angka
yang sudah jadi dari blok FAKTA, dan menyimpannya sebagai teks membuat itu
jelas sekaligus mencegah pembulatan diam-diam.
"""

from pydantic import BaseModel, ConfigDict


class _Dasar(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Butir(_Dasar):
    judul: str = ""
    alasan: str = ""
    angka_pendukung: list[str] = []


class NarasiInsight(_Dasar):
    """F1 — Dashboard intelijen pemerintah."""

    ringkasan: str = ""
    tren_muncul: list[Butir] = []
    tumbuh_cepat: list[Butir] = []
    menurun: list[Butir] = []
    kategori_diminati: list[Butir] = []
    analisis_umkm: str = ""
    rekomendasi_promosi: list[Butir] = []
    rekomendasi_pembangunan: list[Butir] = []


class NarasiGap(_Dasar):
    """F2 — Analisis kesenjangan wilayah."""

    ringkasan: str = ""
    celah: list[Butir] = []
    prioritas: list[Butir] = []
    potensi_investasi: list[Butir] = []
    rekomendasi: list[Butir] = []


class NarasiAdvisor(_Dasar):
    """F3 — Penasihat bisnis UMKM."""

    ringkasan: str = ""
    produk_potensial: list[Butir] = []
    saran_promo: list[Butir] = []
    analisis_harga: str = ""
    prediksi_kunjungan: str = ""
    peluang: list[Butir] = []


class NarasiSimulasi(_Dasar):
    """F4 — Penjelasan hasil simulasi kebijakan."""

    ringkasan: str = ""
    insight: list[Butir] = []
    tindak_lanjut: list[Butir] = []
