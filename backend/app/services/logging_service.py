"""Pencatatan itinerary ke Postgres — fire-and-forget.

Dijalankan lewat `BackgroundTasks` setelah respons dikirim, sehingga waktu
tanggap `/api/itinerary` tidak ikut menanggung latensi database. Seluruh isi
modul ini dibungkus try/except berlapis dan TIDAK PERNAH melempar: kegagalan
mencatat tidak boleh menggagalkan penyusunan rencana perjalanan. Itu urutan
kepentingan yang benar — turis butuh itinerary-nya, analitik bisa menunggu.

Yang dicatat sengaja dibatasi pada field permintaan, ringkasan respons, dan
tabel fakta tempat. Tanpa PII, tanpa payload mentah: anonimitas jadi sifat
skema, bukan tambalan saat laporan diekspor.
"""

import logging
import math
import re
from typing import Any, Optional

from ..core.paths import engine
from ..db import supabase as db

_log = logging.getLogger(__name__)

# Pagar aman: satu itinerary 5 hari menghasilkan ~40 baris tempat. Batas ini
# hanya menahan permintaan ekstrem agar satu penyisipan tidak jadi raksasa.
_MAKS_TEMPAT = 400

_POLA_TANGGAL = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _f(nilai: Any) -> Optional[float]:
    """Angka pecahan yang aman di-JSON. NaN/inf/teks gagal -> None.

    Nilai dari pandas kerap berupa numpy.float64 atau NaN; keduanya membuat
    json stdlib menghasilkan keluaran yang ditolak PostgREST.
    """
    if nilai is None or isinstance(nilai, bool):
        return None
    try:
        angka = float(nilai)
    except (TypeError, ValueError):
        return None
    return angka if math.isfinite(angka) else None


def _i(nilai: Any) -> Optional[int]:
    angka = _f(nilai)
    return int(angka) if angka is not None else None


def _teks(nilai: Any, maks: int = 200) -> Optional[str]:
    if nilai is None:
        return None
    s = str(nilai).strip()
    return s[:maks] if s else None


def _tanggal(nilai: Any) -> Optional[str]:
    """Terima hanya "YYYY-MM-DD"; selain itu None supaya kolom date tidak tolak."""
    s = _teks(nilai, 10)
    return s if s and _POLA_TANGGAL.match(s) else None


def _kabupaten(alamat: Any) -> Optional[str]:
    try:
        return engine.deteksi_kabupaten(alamat) or None
    except Exception:  # noqa: BLE001 — deteksi kabupaten tak boleh menggagalkan log
        return None


def _baris_log(req: dict, payload: dict, user_id: Optional[str]) -> dict:
    """Satu baris itinerary_log dari permintaan + ringkasan respons."""
    ringkas = payload.get("summary") or {}
    analisis = payload.get("analisis") or {}
    dampak = payload.get("dampak_lokal") or {}
    hotel = payload.get("hotel") or {}

    # Urutan kabupaten dipertahankan seperti urutan hari agar terbaca sebagai
    # alur perjalanan, bukan sekadar himpunan.
    kabupaten: list[str] = []
    for hari in payload.get("days") or []:
        for k in hari.get("kabupaten") or []:
            if k and k not in kabupaten:
                kabupaten.append(k)

    minat = req.get("minat_wisata")
    return {
        "user_id": user_id,
        "budget_total": _i(req.get("budget_total")),
        "n_days": _i(req.get("n_days")),
        "n_nights": _i(req.get("n_nights")),
        "n_orang": _i(req.get("n_orang")),
        "minat": [str(m)[:80] for m in minat] if isinstance(minat, list) else None,
        "profil": _teks(ringkas.get("profil") or req.get("profil_pilihan"), 80),
        "gaya_jelajah": _teks(req.get("gaya_jelajah"), 40),
        "moda": _teks(req.get("moda"), 40),
        "tanggal_mulai": _tanggal(req.get("tanggal_mulai")),
        "max_attractions_per_day": _i(req.get("max_attractions_per_day")),
        "status": _teks(payload.get("status"), 60),
        "total_estimasi": _i(ringkas.get("total_estimasi")),
        "total_jarak_km": _f(analisis.get("total_jarak_km")),
        "persen_terpakai": _f(ringkas.get("persen_terpakai")),
        "n_agenda": _i(analisis.get("n_agenda")),
        "total_penyeberangan": _i(analisis.get("total_penyeberangan")),
        "umkm_weight": _f(ringkas.get("umkm_weight")),
        "proporsi_umkm": _f(dampak.get("proporsi_umkm")),
        "ragam_kuliner_khas": _i(dampak.get("ragam_kuliner_khas")),
        "estimasi_ke_usaha_lokal": _i(dampak.get("estimasi_kasar_ke_usaha_lokal")),
        "kabupaten_tersentuh": kabupaten or None,
        "hotel_name": _teks(hotel.get("name")),
        "hotel_kabupaten": _kabupaten(hotel.get("address")),
    }


def _tempat(itinerary_id: str, jenis: str, p: dict, dipilih: bool,
            hari: Optional[int], slot: Optional[str]) -> Optional[dict]:
    nama = _teks(p.get("name"))
    if not nama:
        return None
    return {
        "itinerary_id": itinerary_id,
        "jenis": jenis,
        "place_name": nama,
        "kabupaten": _kabupaten(p.get("address")),
        "place_type": _teks(p.get("type"), 80),
        "harga_tengah": _i(p.get("price_per_person")),
        "rating": _f(p.get("rating")),
        "dipilih": dipilih,
        "hari": hari,
        "slot": slot,
    }


def _baris_tempat(itinerary_id: str, payload: dict) -> list[dict]:
    """Tabel fakta: setiap tempat yang muncul di rencana.

    Opsi rumah makan yang TIDAK terpilih ikut dicatat dengan `dipilih=false`.
    Itu disengaja: selisih antara "ditawarkan" dan "dipilih" adalah sinyal
    paling berguna bagi dashboard UMKM nanti, dan hilang kalau hanya pemenang
    yang disimpan.
    """
    baris: list[dict] = []

    hotel = payload.get("hotel")
    if hotel:
        h = _tempat(itinerary_id, "hotel", hotel, True, None, "menginap")
        if h:
            baris.append(h)

    for hari in payload.get("days") or []:
        nomor = _i(hari.get("day"))
        for item in hari.get("agenda") or []:
            if item.get("kind") == "wisata":
                w = _tempat(itinerary_id, "wisata", item.get("place") or {},
                            True, nomor, _teks(item.get("time"), 40))
                if w:
                    baris.append(w)
            else:
                slot = _teks(item.get("slot") or item.get("time"), 40)
                for urut, opsi in enumerate(item.get("options") or []):
                    # options[0] adalah pilihan bawaan yang ditampilkan UI;
                    # sisanya alternatif sepadan yang bisa ditukar turis.
                    r = _tempat(itinerary_id, "resto", opsi, urut == 0, nomor, slot)
                    if r:
                        baris.append(r)

    return baris[:_MAKS_TEMPAT]


def catat_itinerary(req: dict, payload: dict,
                    user_id: Optional[str] = None) -> Optional[str]:
    """Simpan satu itinerary; kembalikan id-nya bila berhasil.

    Tidak pernah melempar. Kegagalan mencatat tidak boleh menggagalkan
    penyusunan rencana — turis butuh itinerary-nya, analitik bisa menunggu.

    **Nilai kembaliannya dipakai dua cara yang berbeda.** Saat dijalankan
    sebagai BackgroundTasks (pemanggil anonim), tidak ada yang membacanya dan
    satu-satunya jejak kegagalan adalah log server. Saat dipanggil LANGSUNG
    (pemanggil sudah masuk), id ini ikut dikirim ke klien sebagai
    `itinerary_id` — dan itu satu-satunya cara tombol Simpan punya sasaran.

    `None` berarti pencatatan gagal. Klien menanggapinya dengan menonaktifkan
    tombol Simpan, bukan dengan menampilkan galat: rencananya sendiri utuh.
    """
    if not db.aktif():
        return None

    try:
        hasil = db.sisipkan("itinerary_log", _baris_log(req, payload, user_id),
                            kembalikan=True)
        itinerary_id = (hasil[0] or {}).get("id") if hasil else None
        if not itinerary_id:
            return None

        tempat = _baris_tempat(itinerary_id, payload)
        if tempat:
            db.sisipkan("itinerary_place", tempat)
        return itinerary_id
    except Exception as e:  # noqa: BLE001 — analitik tidak boleh mengganggu layanan
        _log.warning("Gagal mencatat itinerary: %s", e)
        return None
