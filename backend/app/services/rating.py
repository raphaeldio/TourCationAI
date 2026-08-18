"""Rating publik UMKM dan skor kepercayaan tingkat usaha.

**Satu akun satu rating.** Batas itu ditegakkan indeks unik
`umkm_rating_satu_per_akun` di database, bukan pemeriksaan di sini. Alasannya
langsung: pemeriksaan aplikasi ("sudah ada belum?" lalu "sisipkan") punya celah
balapan — dua permintaan bersamaan sama-sama melihat kosong lalu sama-sama
menyisipkan. Indeks unik tidak punya celah itu. Kode di bawah menangani
pelanggarannya sebagai *pembaruan*, bukan sebagai galat: mengubah pendapat itu
sah, menumpuk suara tidak.

Skor kepercayaan di sini adalah tingkat USAHA, berbeda dari `verification_score`
yang bersifat per-PRODUK. Keduanya dipakai bersama: harga yang wajar pada usaha
yang tidak dipercaya publik tetap patut dicurigai, dan sebaliknya.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from ..db import supabase as db

_log = logging.getLogger(__name__)

# Rating >= 4 dihitung sebagai "puas". Ambangnya sengaja tinggi: pada skala 1-5
# nilai 3 adalah sikap netral, dan memperlakukannya sebagai dukungan membuat
# hampir semua usaha tampak dipercaya.
AMBANG_PUAS = 4

# Konstanta Wilson pada tingkat kepercayaan 95%.
Z = 1.96
Z2 = Z * Z          # 3,8416
SETENGAH_Z2 = Z2 / 2  # 1,9208


def _wilson_bawah(n_pos: int, n: int) -> float:
    """Batas bawah Wilson untuk proporsi.

    Dipakai — bukan rata-rata sederhana — karena rata-rata memperlakukan satu
    rating bintang lima sama meyakinkannya dengan lima puluh rating bintang
    lima. Batas bawah menghukum ketidaktahuan: usaha baru harus MENDAPATKAN
    kepercayaan, bukan mewarisinya.

    Perilaku pada ujungnya, diukur bukan diperkirakan:

        n=0            -> 0,000   (belum ada bukti sama sekali)
        1 dari 1 puas  -> 0,167
        5 dari 5 puas  -> 0,511
        20 dari 20     -> 0,810
        3 dari 5 puas  -> 0,229
        0 dari 5 puas  -> 0,000

    Perhatikan bahwa n=0 menghasilkan tepat NOL, bukan nilai tengah. Itu
    disengaja: komponen komunitas berbobot 0,50 pada skor akhir, sehingga usaha
    tanpa rating memang jatuh ke kategori "PERLU PEMBINAAN" — dan justru itulah
    yang membuatnya memenuhi syarat slot "Rekomendasi Lainnya".
    """
    penyebut = n + Z2
    p = (n_pos + SETENGAH_Z2) / penyebut
    return max(0.0, p - Z * math.sqrt(p * (1 - p) / penyebut))


def daftar_rating(business_id: str, batas: int = 50) -> list[dict]:
    if not db.aktif():
        return []
    try:
        return db.pilih("umkm_rating", {
            "business_id": f"eq.{business_id}",
            "select": "id,user_id,rating,komentar,created_at,updated_at",
            "order": "updated_at.desc",
            "limit": str(batas),
        })
    except Exception as e:  # noqa: BLE001
        _log.warning("Gagal membaca rating: %s", e)
        return []


def rating_saya(business_id: str, user_id: str) -> Optional[dict]:
    if not db.aktif():
        return None
    return db.satu("umkm_rating", {
        "business_id": f"eq.{business_id}",
        "user_id": f"eq.{user_id}",
        "select": "id,rating,komentar,created_at,updated_at",
    })


def simpan_rating(business_id: str, user_id: str, nilai: int,
                  komentar: Optional[str]) -> dict:
    """Sisipkan rating baru, atau perbarui milik akun ini bila sudah ada.

    Pemilik usaha tidak boleh menilai usahanya sendiri — itu bukan sinyal
    komunitas, itu iklan.
    """
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")
    if not 1 <= nilai <= 5:
        raise HTTPException(400, "Rating harus di antara 1 dan 5.")

    usaha = db.satu("umkm_business", {"id": f"eq.{business_id}", "select": "id,owner_id"})
    if not usaha:
        raise HTTPException(404, "Usaha tidak ditemukan.")
    if usaha.get("owner_id") == user_id:
        raise HTTPException(403, "Pemilik tidak dapat menilai usahanya sendiri.")

    sekarang = datetime.now(timezone.utc).isoformat()
    isi = {"rating": nilai, "komentar": komentar, "updated_at": sekarang}

    lama = rating_saya(business_id, user_id)
    if lama:
        db.perbarui("umkm_rating", {
            "business_id": f"eq.{business_id}",
            "user_id": f"eq.{user_id}",
        }, isi)
        aksi = "diperbarui"
    else:
        try:
            db.sisipkan("umkm_rating", {
                "business_id": business_id, "user_id": user_id,
                "created_at": sekarang, **isi,
            })
            aksi = "dibuat"
        except Exception as e:  # noqa: BLE001
            # Balapan dua permintaan bersamaan mendarat di sini. Indeks unik
            # sudah menolak yang kedua; perlakukan sebagai pembaruan supaya
            # pengguna tidak melihat galat untuk tindakan yang wajar.
            if "umkm_rating_satu_per_akun" not in str(e):
                raise
            db.perbarui("umkm_rating", {
                "business_id": f"eq.{business_id}",
                "user_id": f"eq.{user_id}",
            }, isi)
            aksi = "diperbarui"

    ringkas = hitung_trust(business_id)
    return {"aksi": aksi, "rating": nilai, "trust": ringkas}


def hapus_rating(business_id: str, user_id: str) -> dict:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")
    db.hapus("umkm_rating", {
        "business_id": f"eq.{business_id}",
        "user_id": f"eq.{user_id}",
    })
    return {"status": "dihapus", "trust": hitung_trust(business_id)}


# ---------------------------------------------------------------------------
# Skor kepercayaan
# ---------------------------------------------------------------------------
def ringkas_rating(business_id: str) -> dict:
    baris = daftar_rating(business_id, batas=1000)
    n = len(baris)
    if not n:
        return {"n": 0, "rata": None, "n_puas": 0, "sebaran": {str(i): 0 for i in range(1, 6)}}
    nilai = [int(b["rating"]) for b in baris]
    sebaran = {str(i): sum(1 for v in nilai if v == i) for i in range(1, 6)}
    return {
        "n": n,
        "rata": round(sum(nilai) / n, 2),
        "n_puas": sum(1 for v in nilai if v >= AMBANG_PUAS),
        "sebaran": sebaran,
    }


def _kelengkapan(usaha: dict, ada_produk: bool) -> float:
    return (
        0.25 * bool((usaha.get("deskripsi") or "").strip())
        + 0.25 * bool((usaha.get("jam_buka") or "").strip())
        + 0.25 * bool(usaha.get("verified"))
        + 0.25 * bool(ada_produk)
    )


def hitung_trust(business_id: str) -> dict:
    """Hitung ulang skor kepercayaan usaha lalu simpan.

        SKOR = 0,50 · komunitas + 0,30 · produk + 0,20 · kelengkapan

    `komunitas` adalah batas bawah Wilson atas proporsi rating >= 4, jadi ia
    naik seiring BUKTI, bukan seiring keberuntungan. `produk` adalah rerata
    skor verifikasi produk aktif — menyambungkan kepercayaan usaha dengan
    kewajaran harganya. `kelengkapan` menghargai profil yang benar-benar diisi.
    """
    if not db.aktif():
        return {"skor": 0.0, "n_rating": 0, "rata_rating": None, "komponen": {}}

    r = ringkas_rating(business_id)
    komunitas = _wilson_bawah(r["n_puas"], r["n"])

    usaha = db.satu("umkm_business", {
        "id": f"eq.{business_id}",
        "select": "id,deskripsi,jam_buka,verified",
    }) or {}

    produk = db.pilih("umkm_product", {
        "business_id": f"eq.{business_id}",
        "aktif": "is.true",
        "select": "id",
        "limit": "200",
    })
    skor_produk = 0.0
    if produk:
        ids = ",".join(p["id"] for p in produk)
        nilai = db.pilih("verification_score", {
            "product_id": f"in.({ids})",
            "select": "skor",
            "limit": "200",
        })
        if nilai:
            skor_produk = sum(float(x["skor"] or 0) for x in nilai) / len(nilai)

    kelengkapan = _kelengkapan(usaha, bool(produk))
    skor = 0.50 * komunitas + 0.30 * skor_produk + 0.20 * kelengkapan

    komponen = {
        "komunitas": round(komunitas, 4),
        "produk": round(skor_produk, 4),
        "kelengkapan": round(kelengkapan, 4),
        "n_rating": r["n"],
        "n_puas": r["n_puas"],
    }
    isi = {
        "skor": round(skor, 4),
        "komponen": komponen,
        "n_rating": r["n"],
        "rata_rating": r["rata"],
        "dihitung_pada": datetime.now(timezone.utc).isoformat(),
    }
    try:
        if db.satu("trust_score", {"business_id": f"eq.{business_id}", "select": "business_id"}):
            db.perbarui("trust_score", {"business_id": f"eq.{business_id}"}, isi)
        else:
            db.sisipkan("trust_score", {"business_id": business_id, **isi})
    except Exception as e:  # noqa: BLE001 — skor gagal disimpan != permintaan gagal
        _log.warning("Gagal menyimpan trust score: %s", e)

    return {**isi, "label": label_trust(skor), "sebaran": r["sebaran"]}


def label_trust(skor: float) -> str:
    if skor >= 0.70:
        return "TERPERCAYA"
    if skor >= 0.40:
        return "BERKEMBANG"
    return "PERLU PEMBINAAN"


def trust_usaha(business_id: str) -> dict:
    """Skor tersimpan; hitung ulang bila belum pernah ada."""
    if not db.aktif():
        return {"skor": 0.0, "label": label_trust(0.0), "n_rating": 0, "rata_rating": None}
    baris = db.satu("trust_score", {
        "business_id": f"eq.{business_id}",
        "select": "skor,komponen,n_rating,rata_rating,dihitung_pada",
    })
    if not baris:
        return hitung_trust(business_id)
    return {**baris, "label": label_trust(float(baris.get("skor") or 0))}
