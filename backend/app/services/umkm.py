"""Orkestrasi data UMKM: usaha, produk, penilaian harga, skor verifikasi.

Router tetap tipis; seluruh urutan baca-hitung-tulis ada di sini. Aturan yang
dipegang modul ini: keputusan status harga TIDAK PERNAH datang dari basis data
atau dari pengguna — ia selalu dihitung ulang oleh `price_check` dari harga
yang tersimpan. Nilai di tabel adalah jejak keputusan, bukan sumbernya.
"""

from typing import Optional

from fastapi import HTTPException

from ..core.paths import engine
from ..db import supabase as db
from . import price_check


def pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


def usaha_milik(user_id: str, wajib: bool = True) -> Optional[dict]:
    """Baris usaha milik pemanggil.

    404 bila belum ada: itu terjadi ketika akun sudah berperan UMKM tetapi
    approval admin belum sempat membuatkan barisnya. Pesannya diarahkan ke
    tindakan yang bisa diambil pengguna, bukan sekadar "not found".
    """
    pastikan_db()
    baris = db.satu("umkm_business", {"owner_id": f"eq.{user_id}", "select": "*"})
    if not baris and wajib:
        raise HTTPException(
            404,
            "Belum ada usaha yang tertaut ke akun Anda. Ajukan klaim usaha "
            "lebih dulu lewat halaman Akun.",
        )
    return baris


def usaha_dari_id(business_id: str) -> Optional[dict]:
    return db.satu("umkm_business", {"id": f"eq.{business_id}", "select": "*"})


def produk_milik(product_id: str, user_id: str) -> tuple[dict, dict]:
    """Produk beserta usahanya, dengan pemeriksaan kepemilikan.

    404 dipakai — bukan 403 — untuk produk milik orang lain: membedakan
    "tidak ada" dari "ada tapi bukan punyamu" membocorkan keberadaan baris
    kepada siapa pun yang mau menebak id.
    """
    pastikan_db()
    produk = db.satu("umkm_product", {"id": f"eq.{product_id}", "select": "*"})
    if not produk:
        raise HTTPException(404, "Produk tidak ditemukan.")
    usaha = usaha_dari_id(produk["business_id"])
    if not usaha or usaha.get("owner_id") != user_id:
        raise HTTPException(404, "Produk tidak ditemukan.")
    return produk, usaha


def rekap_suara(product_id: str) -> tuple[int, int]:
    """(n_setuju, n_suara). Abstain (0) tidak dihitung di kedua sisi."""
    suara = db.pilih("price_feedback", {
        "select": "vote",
        "product_id": f"eq.{product_id}",
        "limit": "1000",
    })
    setuju = sum(1 for s in suara if s.get("vote") == 1)
    total = sum(1 for s in suara if s.get("vote") in (1, -1))
    return setuju, total


def rekap_suara_banyak(
    product_ids: list[str], user_id: Optional[str] = None
) -> dict[str, dict]:
    """Rekap suara untuk sekumpulan produk sekaligus, plus suara pemanggil.

    Versi jamak dari `rekap_suara`. Memanggil yang tunggal di dalam perulangan
    berarti satu perjalanan jaringan per produk — pada daftar menu, itu belasan
    permintaan untuk data yang muat dalam satu kueri.
    """
    if not product_ids:
        return {}
    baris = db.pilih("price_feedback", {
        "select": "product_id,reporter_id,vote",
        "product_id": f"in.({','.join(product_ids)})",
        "limit": "2000",
    })

    hasil = {pid: {"setuju": 0, "total": 0, "suara_saya": None} for pid in product_ids}
    for b in baris:
        r = hasil.get(b["product_id"])
        if r is None:
            continue
        if b.get("vote") == 1:
            r["setuju"] += 1
        if b.get("vote") in (1, -1):
            r["total"] += 1
        if user_id and b.get("reporter_id") == user_id:
            r["suara_saya"] = b.get("vote")
    return hasil


def produk_publik(business_id: str, user_id: Optional[str] = None) -> list[dict]:
    """Menu yang boleh dilihat siapa pun, untuk menilai kewajaran harganya.

    Sengaja BUKAN `daftar_produk` yang dipangkas di router: yang tampil ke
    publik dipilih di satu tempat, sehingga menambah kolom internal pada jalur
    pemilik tidak diam-diam ikut membocorkannya ke halaman publik.

    `harga_alasan` dan `harga_terverifikasi` tidak ikut — keduanya catatan
    internal bagi pemilik, dan menyiarkan "harga ini ditandai" ke wisatawan
    menghukum usaha sebelum komunitas sempat menimbang. Median pembanding tetap
    dikirim, justru supaya penilaian yang diminta punya dasar.
    """
    produk = daftar_produk(business_id, hanya_aktif=True)
    suara = rekap_suara_banyak([p["id"] for p in produk], user_id)
    return [
        {
            "id": p["id"],
            "nama": p["nama"],
            "deskripsi": p.get("deskripsi"),
            "harga": p.get("harga"),
            "kategori": p.get("kategori"),
            "is_kuliner_khas": bool(p.get("is_kuliner_khas")),
            "label_verifikasi": p.get("label_verifikasi"),
            "skor_verifikasi": p.get("skor_verifikasi"),
            "harga_median_referensi": p.get("harga_median_referensi"),
            "suara": suara.get(p["id"], {"setuju": 0, "total": 0, "suara_saya": None}),
        }
        for p in produk
    ]


def nilai_produk(produk: dict, usaha: dict) -> dict:
    """Periksa harga, catat flag, hitung ulang skor verifikasi, simpan.

    Dipanggil setiap kali harga berubah DAN setiap kali ada suara masuk —
    keduanya menggeser skor. Idempoten: memanggilnya dua kali pada keadaan
    yang sama menghasilkan skor yang sama.
    """
    kabupaten = usaha.get("kabupaten") or engine.deteksi_kabupaten(usaha.get("alamat"))
    harga = int(produk.get("harga") or 0)

    hasil = price_check.periksa(harga, kabupaten)
    n_setuju, n_suara = rekap_suara(produk["id"])

    verifikasi = price_check.skor_verifikasi(
        z=hasil["robust_z"],
        n_setuju=n_setuju,
        n_suara=n_suara,
        ada_deskripsi=len((produk.get("deskripsi") or "").strip()) >= 20,
        ada_jam_buka=bool((usaha.get("jam_buka") or "").strip()),
        usaha_terverifikasi=bool(usaha.get("verified")),
        ada_kategori=bool((produk.get("kategori") or "").strip()),
    )

    # `status` ikut disimpan di komponen karena chokepoint di solver_state
    # menyaring lewat satu tabel ini; tanpa itu ia perlu menggabungkan
    # price_flag secara manual dan mencari baris terbaru per produk.
    komponen = {
        **verifikasi["komponen"],
        "status": hasil["status"],
        "robust_z": hasil["robust_z"],
        "label": verifikasi["label"],
        "n_referensi": hasil["n_referensi"],
    }

    db.sisipkan("price_flag", {
        "product_id": produk["id"],
        "business_id": usaha["id"],
        "harga_diajukan": harga,
        "harga_median_referensi": hasil["harga_median_referensi"],
        "n_referensi": hasil["n_referensi"],
        "robust_z": hasil["robust_z"],
        "metode": hasil["metode"],
        "status": hasil["status"],
        "alasan": hasil["alasan"],
    })

    # verification_score ber-PK product_id: satu baris per produk, ditimpa.
    sudah = db.satu("verification_score", {
        "product_id": f"eq.{produk['id']}", "select": "product_id"})
    isi = {"skor": verifikasi["skor"], "komponen": komponen}
    if sudah:
        db.perbarui("verification_score", {"product_id": f"eq.{produk['id']}"}, isi)
    else:
        db.sisipkan("verification_score", {"product_id": produk["id"], **isi})

    return {**hasil, "verifikasi": verifikasi}


def _peta_penilaian(ids: list[str]) -> tuple[dict, dict]:
    """(skor per produk, flag terbaru per produk) untuk sekumpulan produk."""
    if not ids:
        return {}, {}
    daftar = ",".join(ids)

    skor = db.pilih("verification_score", {
        "select": "product_id,skor,komponen",
        "product_id": f"in.({daftar})",
        "limit": "500",
    })
    flag = db.pilih("price_flag", {
        "select": "product_id,status,alasan,robust_z,harga_median_referensi,n_referensi,created_at",
        "product_id": f"in.({daftar})",
        "order": "created_at.desc",
        "limit": "1000",
    })

    terbaru: dict[str, dict] = {}
    for f in flag:  # sudah terurut terbaru lebih dulu
        terbaru.setdefault(f["product_id"], f)
    return {s["product_id"]: s for s in skor}, terbaru


def daftar_produk(business_id: str, hanya_aktif: bool = False) -> list[dict]:
    """Produk beserta status harga dan skor verifikasinya."""
    params = {
        "select": "*",
        "business_id": f"eq.{business_id}",
        "order": "created_at.desc",
        "limit": "500",
    }
    if hanya_aktif:
        params["aktif"] = "is.true"
    produk = db.pilih("umkm_product", params)

    skor, flag = _peta_penilaian([p["id"] for p in produk])

    hasil = []
    for p in produk:
        s = skor.get(p["id"]) or {}
        komponen = s.get("komponen") or {}
        # Kolom numeric bisa datang sebagai angka maupun string tergantung
        # serialisasi; dipaksa float supaya perbandingan di bawah tidak pernah
        # membandingkan str dengan float.
        try:
            nilai_skor = float(s.get("skor")) if s.get("skor") is not None else None
        except (TypeError, ValueError):
            nilai_skor = None
        hasil.append({
            **p,
            "harga_status": komponen.get("status") or (flag.get(p["id"]) or {}).get("status"),
            "harga_alasan": (flag.get(p["id"]) or {}).get("alasan"),
            "robust_z": komponen.get("robust_z"),
            "harga_median_referensi": (flag.get(p["id"]) or {}).get("harga_median_referensi"),
            "skor_verifikasi": nilai_skor,
            "label_verifikasi": komponen.get("label"),
            "komponen_verifikasi": komponen or None,
            # Dua pintu yang dijaga nilai ini: apakah harga ditandai
            # terverifikasi kepada wisatawan, dan apakah ia ikut dihitung dalam
            # statistik harga daerah (`services/selisih_harga.py`). Ia TIDAK
            # menentukan apa pun di mesin penyusun itinerary — harga UMKM tidak
            # pernah menyentuh solver; lihat `services/solver_state.py`.
            "harga_terverifikasi": bool(
                komponen.get("status") == "OK"
                and (nilai_skor or 0) >= price_check.AMBANG_TERVERIFIKASI
                and p.get("aktif")
            ),
        })
    return hasil
