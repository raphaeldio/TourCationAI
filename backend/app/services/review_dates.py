"""Rekonstruksi tanggal ulasan dari label relatif Google.

Kolom `published-at` pada dataset ulasan berisi teks relatif ("a day ago",
"3 weeks ago", "6 months ago", "Edited a year ago"), sedangkan `scraped-at-date`
berisi tanggal absolut. Perkiraan tanggal = scraped_at - offset.

ATURAN KEJUJURAN YANG TIDAK BOLEH DILANGGAR
-------------------------------------------
Label "a year ago" (4.131 baris) dan "2 years ago" (3.536 baris) adalah
*point mass* milik Google: ia berarti "antara 12 dan 24 bulan lalu", bukan
tanggal tertentu. Menyebarkannya ke bulan-bulan individual akan mengarang tren
yang tidak ada di data.

Karena itu hanya offset < 365 hari yang menghasilkan bucket bulanan. Sisanya
masuk ke `baseline_12_24` dan hanya dipakai sebagai penyebut YoY yang kasar.

Setiap tampilan yang memakai angka dari modul ini WAJIB diberi label
"proksi permintaan dari volume ulasan — bukan jumlah kunjungan".
"""

import re
from datetime import date, datetime, timedelta

# Dataset memuat label dalam DUA bahasa, dan campurannya.
#
#   Inggris    : "a day ago", "3 weeks ago", "Edited a year ago"
#   Indonesia  : "3 bulan lalu di", "setahun lalu", "diedit 2 tahun lalu di"
#   Campuran   : "5 hari ago"   (satuan Indonesia + akhiran Inggris)
#
# Awalan sunting: "Edited" / "diedit".
# Kuantitas satu: angka, "a"/"an", atau awalan "se-" yang MENYATU dengan
# satuannya ("setahun", "sebulan", "seminggu").
# Ekor setelah "lalu"/"ago" dibiarkan bebas — banyak baris berakhir " di"
# (potongan dari "di Google").
#
# Mengabaikan varian Indonesia akan membuang 2.147 baris (~10% dataset ulasan),
# dan yang terbuang justru bukan hanya point mass tahunan: 427 baris di antaranya
# adalah label bulanan yang seharusnya masuk seri tren.
_POLA = re.compile(
    r"^(?:diedit|edited)?\s*"
    r"(?:(\d+)|(an?)|(se))?\s*"
    r"(detik|menit|jam|hari|minggu|bulan|tahun|"
    r"second|minute|hour|day|week|month|year)s?"
    r"\s+(?:lalu|ago)\b",
    re.IGNORECASE,
)

# Hari per satuan. Bulan & tahun memakai panjang rata-rata supaya akumulasi
# offset besar tidak melenceng jauh.
_HARI_PER_SATUAN = {
    "second": 1 / 86400, "detik": 1 / 86400,
    "minute": 1 / 1440,  "menit": 1 / 1440,
    "hour": 1 / 24,      "jam": 1 / 24,
    "day": 1.0,          "hari": 1.0,
    "week": 7.0,         "minggu": 7.0,
    "month": 30.44,      "bulan": 30.44,
    "year": 365.25,      "tahun": 365.25,
}

# Ambang "masih bisa dipetakan ke bulan tertentu".
AMBANG_HARI_BULANAN = 365.0


def offset_hari(teks) -> float | None:
    """Ubah label relatif jadi jumlah hari. None bila formatnya tak dikenal."""
    if teks is None:
        return None
    teks = str(teks).strip()
    if not teks or teks.lower() in ("nan", "none"):
        return None
    m = _POLA.match(teks)
    if not m:
        return None
    angka, artikel, se, satuan = m.group(1), m.group(2), m.group(3), m.group(4)
    # "a"/"an" (Inggris) dan "se-" (Indonesia) sama-sama berarti satu.
    jumlah = float(angka) if angka else 1.0
    if not angka and not artikel and not se:
        jumlah = 1.0  # satuan telanjang, mis. "bulan lalu"
    return jumlah * _HARI_PER_SATUAN[satuan.lower()]


def _ke_tanggal(nilai) -> date | None:
    if nilai is None:
        return None
    teks = str(nilai).strip()
    if not teks or teks.lower() in ("nan", "none"):
        return None
    try:
        return datetime.strptime(teks[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def perkiraan_tanggal(published_at, scraped_at) -> date | None:
    """Perkiraan tanggal ulasan. None bila salah satu bagian tak terbaca."""
    hari = offset_hari(published_at)
    dasar = _ke_tanggal(scraped_at)
    if hari is None or dasar is None:
        return None
    return dasar - timedelta(days=hari)


def bucket_bulan(published_at, scraped_at, acuan: date | None = None) -> int | None:
    """Indeks bulan ke belakang dari `acuan`: 0 = bulan terakhir, 11 = ke-12.

    Mengembalikan None untuk ulasan berumur >= 12 bulan (point mass Google) dan
    untuk label yang tidak terbaca. Pemanggil menghitungnya sebagai baseline.
    """
    hari = offset_hari(published_at)
    if hari is None or hari >= AMBANG_HARI_BULANAN:
        return None

    dasar = _ke_tanggal(scraped_at)
    if dasar is None:
        return None

    # Bila acuan diberikan (tanggal scrape terbaru di seluruh dataset), geser
    # offset supaya bucket antar-berkas dengan tanggal scrape berbeda sejajar.
    if acuan is not None:
        hari += (acuan - dasar).days
        if hari < 0:
            hari = 0.0
        if hari >= AMBANG_HARI_BULANAN:
            return None

    indeks = int(hari // 30.44)
    return min(indeks, 11)


def klasifikasi_umur(published_at) -> str:
    """Kategori kasar: 'bulanan' (<12 bln), 'baseline' (12-24+ bln), 'tak_terbaca'."""
    hari = offset_hari(published_at)
    if hari is None:
        return "tak_terbaca"
    return "bulanan" if hari < AMBANG_HARI_BULANAN else "baseline"
