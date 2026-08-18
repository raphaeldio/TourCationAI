"""Ekspor CSV untuk pemilik usaha (Fase 10).

`Paket.ekspor_csv` dijanjikan sejak Fase 9 pada tier PRO dan belum pernah
dibangun. Modul ini yang mengisinya.

Tiga keputusan yang menentukan bentuknya:

1. **CSV disusun `csv.writer`, bukan f-string.** Nama produk ditulis pemilik
   warung dan boleh memuat koma, tanda kutip, atau baris baru; perangkaian
   manual akan menggeser kolom pada baris pertama yang memuatnya. Modul standar
   sudah menangani seluruh pelolosan itu.

2. **BOM UTF-8 di awal berkas.** Excel di Windows — yang hampir pasti dipakai
   pemilik usaha — membaca CSV tanpa BOM sebagai ANSI, sehingga "Mie Gomak
   Spesial" bisa muncul rusak. Tiga byte ini yang membedakan berkas yang
   langsung terbaca dari berkas yang harus diimpor lewat wizard.

3. **Ekspor hanya membaca, tidak menghitung ulang apa pun.** Angkanya persis
   yang tampil di layar. Berkas yang berbeda dari halaman asalnya membuat
   keduanya sama-sama tidak bisa dipercaya.

Yang TIDAK pernah ikut terekspor: identitas penilai. `price_feedback.reporter_id`
dan `umkm_rating.user_id` tinggal di server. Pemilik usaha berhak atas angkanya,
bukan atas nama orang yang memberi.
"""

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Iterable, Optional

from ..db import supabase as db

_log = logging.getLogger(__name__)

# Nama jenis ekspor -> judul kolomnya. Dipakai router untuk memvalidasi
# permintaan sekaligus menyusun nama berkas, jadi daftarnya hanya ada di sini.
JENIS = ("produk", "penilaian", "riwayat")


def _tulis(judul: Iterable[str], baris: Iterable[Iterable]) -> str:
    penampung = io.StringIO()
    penulis = csv.writer(penampung, lineterminator="\n")
    penulis.writerow(list(judul))
    penulis.writerows([list(b) for b in baris])
    # U+FEFF ditulis sebagai escape supaya terlihat di kode; lihat
    # keputusan (2) pada docstring modul.
    return "\ufeff" + penampung.getvalue()


def nama_berkas(jenis: str, usaha: dict) -> str:
    """Nama berkas yang bisa dibaca manusia di folder Unduhan.

    Karakter selain huruf dan angka dijadikan garis bawah: nama usaha ikut
    masuk ke header HTTP, dan tanda kutip di dalamnya akan memutus header
    Content-Disposition.
    """
    aman = "".join(
        c if c.isalnum() else "_" for c in (usaha.get("place_name") or "usaha")
    ).strip("_")[:40] or "usaha"
    tanggal = datetime.now(timezone.utc).date().isoformat()
    return f"tourcation_{jenis}_{aman}_{tanggal}.csv"


def _produk(business_id: str) -> str:
    from . import umkm as svc

    produk = svc.daftar_produk(business_id)
    return _tulis(
        [
            "nama", "kategori", "harga", "aktif", "kuliner_khas",
            "status_harga", "robust_z", "median_referensi",
            "skor_verifikasi", "label_verifikasi", "harga_terverifikasi",
            "dibuat", "deskripsi",
        ],
        [
            [
                p.get("nama"),
                p.get("kategori") or "",
                p.get("harga"),
                "ya" if p.get("aktif") else "tidak",
                "ya" if p.get("is_kuliner_khas") else "tidak",
                p.get("harga_status") or "",
                p.get("robust_z") if p.get("robust_z") is not None else "",
                p.get("harga_median_referensi") or "",
                p.get("skor_verifikasi") if p.get("skor_verifikasi") is not None else "",
                p.get("label_verifikasi") or "",
                "ya" if p.get("harga_terverifikasi") else "tidak",
                str(p.get("created_at") or "")[:10],
                (p.get("deskripsi") or "").replace("\n", " "),
            ]
            for p in produk
        ],
    )


def _penilaian(business_id: str, sejak: str) -> str:
    """Rating wisatawan + suara kewajaran harga, keduanya tanpa identitas.

    Digabung dalam satu berkas karena keduanya menjawab pertanyaan yang sama
    dari sisi pemilik — "apa kata orang tentang usaha saya" — dan memisahkannya
    memaksa pemakainya menggabungkan dua berkas di spreadsheet hanya untuk
    membacanya berdampingan.
    """
    from . import umkm as svc

    baris: list[list] = []

    try:
        rating = db.pilih("umkm_rating", {
            "business_id": f"eq.{business_id}",
            "created_at": f"gte.{sejak}",
            "select": "rating,komentar,created_at,updated_at",
            "order": "created_at.desc",
            "limit": "2000",
        })
    except Exception as e:  # noqa: BLE001 — satu sumber gagal, berkas tetap terbit
        _log.warning("Ekspor penilaian: rating gagal dibaca: %s", e)
        rating = []

    for r in rating:
        baris.append([
            str(r.get("created_at") or "")[:10],
            "RATING",
            "",
            r.get("rating"),
            (r.get("komentar") or "").replace("\n", " "),
        ])

    produk = svc.daftar_produk(business_id)
    peta = {p["id"]: p["nama"] for p in produk}
    if peta:
        try:
            suara = db.pilih("price_feedback", {
                "product_id": f"in.({','.join(peta)})",
                "created_at": f"gte.{sejak}",
                "select": "product_id,vote,komentar,created_at",
                "order": "created_at.desc",
                "limit": "2000",
            })
        except Exception as e:  # noqa: BLE001
            _log.warning("Ekspor penilaian: suara harga gagal dibaca: %s", e)
            suara = []

        arti = {1: "wajar", -1: "kemahalan", 0: "abstain"}
        for s in suara:
            baris.append([
                str(s.get("created_at") or "")[:10],
                "SUARA HARGA",
                peta.get(s.get("product_id"), ""),
                arti.get(s.get("vote"), s.get("vote")),
                (s.get("komentar") or "").replace("\n", " "),
            ])

    baris.sort(key=lambda b: b[0], reverse=True)
    return _tulis(["tanggal", "jenis", "produk", "nilai", "komentar"], baris)


def _riwayat(business_id: str, jendela_bulan: int, plan: str) -> str:
    from . import riwayat as rw
    from . import umkm as svc

    ids = [p["id"] for p in svc.daftar_produk(business_id)]
    data = rw.riwayat(business_id, jendela_bulan, plan, ids)
    return _tulis(
        [
            "bulan", "dilihat", "n_rating", "rata_rating",
            "n_suara_harga", "n_suara_wajar", "n_penilaian_harga", "n_harga_ditandai",
        ],
        [
            [
                b["bulan"], b["dilihat"], b["n_rating"],
                b["rata_rating"] if b["rata_rating"] is not None else "",
                b["n_suara"], b["n_setuju"], b["n_penilaian_harga"], b["n_ditandai"],
            ]
            for b in data["bulan"]
        ],
    )


def bangun(jenis: str, usaha: dict, jendela_bulan: int, plan: str,
           sejak: Optional[str] = None) -> str:
    """Isi CSV untuk satu jenis ekspor. Pemanggil sudah memeriksa paketnya."""
    business_id = usaha["id"]
    if jenis == "produk":
        return _produk(business_id)
    if jenis == "penilaian":
        from . import riwayat as rw
        return _penilaian(business_id, sejak or rw.sejak_iso(jendela_bulan))
    if jenis == "riwayat":
        return _riwayat(business_id, jendela_bulan, plan)
    raise ValueError(f"Jenis ekspor tidak dikenal: {jenis}")
