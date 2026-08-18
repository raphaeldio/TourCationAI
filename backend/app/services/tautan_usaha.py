"""Menautkan tempat pada itinerary utama ke akun UMKM yang mengklaimnya.

Jembatannya `place_name_norm` — kolom ternormalisasi pada `umkm_business` yang
memang dibuat sebagai kunci join ke nama tempat di CSV. Konvensi normalisasinya
sama persis dengan yang dipakai `services/kompetitor.py`: `analytics.kunci_nama()`
atas nama CSV dibandingkan dengan `place_name_norm`. Satu konvensi, dua pemakai
— kalau suatu saat berubah, keduanya harus berubah bersama.

Sebelum ini, satu-satunya tempat yang bisa dinilai wisatawan adalah kartu di
slot "Rekomendasi Lainnya", karena hanya kartu itu yang membawa `business_id`.
Rumah makan pada rencana utama datang dari CSV dan hanya membawa nama, jadi
tidak ada yang bisa dituju `PUT /api/umkm-publik/{id}/rating`. Modul ini
menutup celah itu tanpa menyentuh payload rencana.

Aturan yang dipegang, sama dengan slot pemerataan:

  * **Tidak pernah menyunting `days`, `agenda`, `summary`, atau `hotel`.**
    Hasilnya ditempel sebagai satu kunci baru di tingkat atas. Rute, biaya, dan
    agenda sudah final saat modul ini dipanggil.
  * **Tidak pernah melempar.** Gangguan database berarti kunci itu kosong dan
    tombol penilaian tidak muncul — itinerary tetap utuh.
"""

import logging
from typing import Optional

from ..db import supabase as db
from .analytics import kunci_nama
from .rating import label_trust

_log = logging.getLogger(__name__)

# Batas nama yang dicari sekali jalan. Rencana terpanjang pun jauh di bawah ini;
# angkanya ada supaya satu payload aneh tidak pernah menjadi kueri raksasa.
MAKS_NAMA = 60


def _nama_tempat_makan(payload: dict) -> list[str]:
    """Nama rumah makan pada rencana, termasuk opsi yang belum dipilih.

    Hanya tempat makan: daftar usaha yang bisa diklaim
    (`/api/auth/usaha-tersedia`) memang berasal dari metadata resto, jadi nama
    wisata dan hotel tidak akan pernah cocok dengan `umkm_business`.
    """
    nama: list[str] = []
    for hari in payload.get("days") or []:
        for a in hari.get("agenda") or []:
            if a.get("kind") != "makan":
                continue
            for o in a.get("options") or []:
                n = (o.get("name") or "").strip()
                if n and n not in nama:
                    nama.append(n)
    return nama[:MAKS_NAMA]


def peta_usaha(nama: list[str], user_id: Optional[str] = None) -> dict[str, dict]:
    """{nama tempat di CSV -> ringkasan usaha yang mengklaimnya}.

    Dikunci nama ASLI, bukan bentuk ternormalisasinya: yang dipegang frontend
    adalah `place.name` apa adanya, dan memaksanya menormalisasi ulang berarti
    konvensi kunci join harus hidup di dua bahasa sekaligus.
    """
    if not nama or not db.aktif():
        return {}

    try:
        usaha = db.pilih("umkm_business", {
            "select": "id,place_name,place_name_norm,kabupaten",
            "limit": "500",
        })
        if not usaha:
            return {}

        ids = ",".join(u["id"] for u in usaha)
        skor = db.pilih("trust_score", {
            "business_id": f"in.({ids})",
            "select": "business_id,skor,n_rating,rata_rating",
            "limit": "500",
        })
        milik_saya = db.pilih("umkm_rating", {
            "business_id": f"in.({ids})",
            "user_id": f"eq.{user_id}",
            "select": "business_id,rating",
            "limit": "500",
        }) if user_id else []
    except Exception as e:  # noqa: BLE001 — tanpa tautan jauh lebih baik dari 500
        _log.warning("Gagal menautkan usaha ke itinerary: %s", e)
        return {}

    per_skor = {s["business_id"]: s for s in skor}
    per_rating = {r["business_id"]: r.get("rating") for r in milik_saya}
    # `place_name_norm` kolom generated; kalau baris lama belum terisi, nama
    # aslinya dinormalisasi di sini supaya tautannya tidak hilang begitu saja.
    per_norm = {
        (u.get("place_name_norm") or kunci_nama(u.get("place_name"))): u
        for u in usaha
    }

    hasil: dict[str, dict] = {}
    for n in nama:
        u = per_norm.get(kunci_nama(n))
        if not u:
            continue
        s = per_skor.get(u["id"]) or {}
        n_rating = int(s.get("n_rating") or 0)
        hasil[n] = {
            "business_id": u["id"],
            "nama": u.get("place_name") or n,
            "kabupaten": u.get("kabupaten"),
            "skor_kepercayaan": round(float(s.get("skor") or 0), 3),
            "label_kepercayaan": label_trust(float(s.get("skor") or 0)),
            "n_rating": n_rating,
            "rata_rating": s.get("rata_rating"),
            "rating_saya": per_rating.get(u["id"]),
        }
    return hasil


def lampirkan(payload: dict, user_id: Optional[str] = None) -> dict:
    """Sisipkan `usaha_tertaut` ke payload itinerary."""
    try:
        payload["usaha_tertaut"] = peta_usaha(_nama_tempat_makan(payload), user_id)
    except Exception as e:  # noqa: BLE001
        _log.warning("Tautan usaha dilewati: %s", e)
        payload["usaha_tertaut"] = {}
    return payload
