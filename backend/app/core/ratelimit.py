"""Pembatasan laju untuk endpoint berbiaya (yang memanggil OpenAI).

Endpoint ILP tidak dibatasi: seluruh komputasinya lokal dan tidak berbiaya.
Yang dijaga hanya /api/ai-search, /api/translate, dan /api/translate-ui karena
tiap panggilan memakai kuota OpenAI pemilik kunci.

Dua lapis: kuota per alamat IP, dan pagu harian menyeluruh sebagai jaring
terakhir bila header X-Forwarded-For dipalsukan.

Batas: penyimpanan ada di memori proses. Dengan lebih dari satu worker atau
instance, pencacah tidak dibagi dan reset saat restart.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from .config import env_int

# Batas per pemanggil dalam satu jam. Diset lewat env agar bisa dilonggarkan
# saat demo.
KUOTA_PER_IP = {
    "ai-search": env_int("RATE_AI_SEARCH_PER_JAM", 15),
    "translate": env_int("RATE_TRANSLATE_PER_JAM", 40),
    # Satu kali ganti bahasa kini memakan BEBERAPA permintaan: klien memecah
    # kamus ~513 string menjadi 4 batch berisi 150. Bawaannya dinaikkan
    # 12 -> 40 supaya jumlah pergantian bahasa per jam (10) tetap sebanding
    # dengan sebelum pemecahan itu ada. Hasilnya di-cache di localStorage
    # dengan kunci berversi, jadi kembali ke bahasa yang pernah dipakai
    # tidak memakan kuota sama sekali.
    "translate-ui": env_int("RATE_TRANSLATE_UI_PER_JAM", 40),
    # Narasi AI dashboard. Angkanya kecil karena hasilnya di-cache: pada FAKTA
    # yang sama, panggilan kedua dan seterusnya tidak menyentuh kuota sama
    # sekali (cache diperiksa SEBELUM pembatasan laju).
    "insight": env_int("RATE_INSIGHT_PER_JAM", 6),
    "gap": env_int("RATE_GAP_PER_JAM", 6),
    "advisor": env_int("RATE_ADVISOR_PER_JAM", 10),
    "simulasi": env_int("RATE_SIMULASI_PER_JAM", 12),
}
JENDELA_DETIK = 3600
# Pagu seluruh pengguna per 24 jam; 0 berarti tanpa pagu.
PAGU_HARIAN = env_int("RATE_PAGU_HARIAN", 400)

_riwayat: dict[str, deque] = defaultdict(deque)
_riwayat_global: deque = deque()


def alamat_klien(request: Request) -> str:
    """IP asli pemanggil. Di belakang proxy (Vercel/Render) alamat soket adalah
    milik proxy, sehingga entri pertama X-Forwarded-For yang dipakai."""
    maju = request.headers.get("x-forwarded-for")
    if maju:
        return maju.split(",")[0].strip()
    return request.client.host if request.client else "tak-dikenal"


def batasi(request: Request, nama_endpoint: str, user_id: str | None = None) -> None:
    """Naikkan pencacah; lempar HTTP 429 bila kuota terlampaui.

    Bila `user_id` ada, ember dihitung per PENGGUNA, bukan per IP. Alasannya
    praktis: di belakang NAT kampus — persis situasi hari penjurian — seluruh
    juri berbagi satu alamat IP, sehingga ember IP akan menghabiskan kuota
    orang lain. Identitas dari token jauh lebih tepat daripada alamat soket.
    Pemanggil anonim tetap dihitung per IP karena itu satu-satunya yang ada.
    """
    sekarang = time.time()

    if PAGU_HARIAN > 0:
        while _riwayat_global and sekarang - _riwayat_global[0] > 86400:
            _riwayat_global.popleft()
        if len(_riwayat_global) >= PAGU_HARIAN:
            raise HTTPException(
                429, "Pagu harian fitur AI pada demo ini sudah tercapai. "
                     "Seluruh fitur lain (itinerary, rute, peta, biaya, dampak "
                     "UMKM) tetap berjalan normal.")

    kuota = KUOTA_PER_IP.get(nama_endpoint, 20)
    identitas = f"u:{user_id}" if user_id else f"ip:{alamat_klien(request)}"
    kunci = f"{nama_endpoint}:{identitas}"
    antrean = _riwayat[kunci]
    while antrean and sekarang - antrean[0] > JENDELA_DETIK:
        antrean.popleft()
    if len(antrean) >= kuota:
        if not antrean:
            # kuota 0 = fitur sengaja dimatikan lewat environment variable
            raise HTTPException(
                429, "Fitur AI dinonaktifkan pada demo ini. Seluruh fitur lain "
                     "(itinerary, rute, peta, biaya, dampak UMKM) tetap berjalan.")
        sisa_menit = int((JENDELA_DETIK - (sekarang - antrean[0])) / 60) + 1
        raise HTTPException(
            429, f"Terlalu banyak permintaan. Batas {kuota} per jam untuk fitur "
                 f"ini. Coba lagi dalam ~{sisa_menit} menit.")

    antrean.append(sekarang)
    if PAGU_HARIAN > 0:
        _riwayat_global.append(sekarang)
