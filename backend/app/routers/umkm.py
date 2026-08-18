"""Dashboard & pengelolaan usaha UMKM (Fitur 3).

Peran UMKM dijaga di tingkat router untuk endpoint kepemilikan. Dua endpoint
sengaja lebih longgar dan itu disebutkan di masing-masing docstring: pemberian
suara komunitas terbuka bagi semua akun yang sudah masuk, dan sebaran harga
acuan bersifat publik karena ia hanya menerbitkan agregat CSV yang sudah
tampil di halaman lain.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from ..core.sanitasi import bersihkan
from ..core.security import (
    KonteksPaket,
    Pengguna,
    wajib_paket,
    wajib_pengguna,
    wajib_peran,
)
from ..db import supabase as db
from ..schemas.insight import NarasiAdvisor
from ..schemas.umkm import ProdukPatch, ProdukReq, SuaraReq, UsahaPatch
from ..services import ai_fakta, ekspor, kompetitor, lapangan, langganan as lang
from ..services import price_check, riwayat as rw, umkm as svc
from ..services.ai_insight import blok_data_umkm, hasilkan
from ..services.analytics import kunci_nama
from ..services.migrasi import jaga as jaga_migrasi

router = APIRouter(prefix="/api/umkm")

# Dipakai endpoint yang menuntut kepemilikan usaha.
_umkm = Depends(wajib_peran("UMKM"))


@router.get("/saya")
def dashboard_saya(pengguna: Pengguna = _umkm):
    """Seluruh isi dashboard UMKM dalam satu panggilan."""
    usaha = svc.usaha_milik(pengguna.id)
    produk = svc.daftar_produk(usaha["id"])
    grup = price_check.grup_untuk(usaha.get("kabupaten"))

    aktif = [p for p in produk if p.get("aktif")]
    terverifikasi = [p for p in aktif if p["harga_terverifikasi"]]
    bermasalah = [p for p in aktif if p.get("harga_status") in ("SUSPECT", "FLAGGED")]

    return {
        "usaha": usaha,
        "produk": produk,
        "referensi_harga": grup.ringkas() if grup else None,
        "ringkas": {
            "n_produk": len(aktif),
            "n_harga_terverifikasi": len(terverifikasi),
            "n_bermasalah": len(bermasalah),
            "skor_rata2": (
                round(sum(p["skor_verifikasi"] or 0 for p in aktif) / len(aktif), 3)
                if aktif else None
            ),
        },
        "catatan_harga": (
            "Harga ditandai terverifikasi bila berstatus OK DAN skor verifikasi "
            f">= {price_check.AMBANG_TERVERIFIKASI}. Harga yang ditandai tetap "
            "tampil di halaman Anda, hanya tidak ditandai terverifikasi kepada "
            "wisatawan dan tidak ikut dihitung dalam statistik harga daerah."
        ),
    }


@router.patch("/usaha")
def perbarui_usaha(req: UsahaPatch, pengguna: Pengguna = _umkm):
    """Perbarui profil usaha. Nama usaha tidak bisa diubah dari sini."""
    usaha = svc.usaha_milik(pengguna.id)

    isi = {
        "alamat": bersihkan(req.alamat, 200, "Alamat"),
        "deskripsi": bersihkan(req.deskripsi, 400, "Deskripsi"),
        "telepon": bersihkan(req.telepon, 40, "Telepon"),
        "jam_buka": bersihkan(req.jam_buka, 120, "Jam buka"),
        "lat": req.lat,
        "lon": req.lon,
    }
    isi = {k: v for k, v in isi.items() if v is not None}
    if not isi:
        raise HTTPException(400, "Tidak ada perubahan yang dikirim.")

    hasil = db.perbarui("umkm_business", {"id": f"eq.{usaha['id']}"}, isi, kembalikan=True)
    baru = hasil[0] if hasil else {**usaha, **isi}

    # Kelengkapan profil ikut menyusun skor verifikasi tiap produk, jadi
    # perubahan jam buka harus langsung tercermin, bukan menunggu harga diedit.
    for p in svc.daftar_produk(usaha["id"], hanya_aktif=True):
        svc.nilai_produk(p, baru)

    return {"usaha": baru}


@router.get("/referensi-harga")
def referensi_harga(kabupaten: str | None = None):
    """Sebaran harga pembanding. Publik: isinya agregat CSV, bukan data akun."""
    grup = price_check.grup_untuk(kabupaten)
    if grup is None:
        raise HTTPException(404, "Belum ada sebaran pembanding untuk wilayah itu.")
    return {
        "referensi": grup.ringkas(),
        "ambang": {
            "suspect": price_check.AMBANG_SUSPECT,
            "flagged": price_check.AMBANG_FLAGGED,
            "min_anggota_grup": price_check.MIN_ANGGOTA_GRUP,
        },
        "metode": (
            "Robust z pada logaritma harga: z = (ln h - median ln) / (1,4826 x MAD). "
            "Median dan MAD dipakai agar satu harga ekstrem tidak menggeser acuan."
        ),
    }


@router.post("/produk", status_code=201)
def tambah_produk(req: ProdukReq, pengguna: Pengguna = _umkm):
    usaha = svc.usaha_milik(pengguna.id)

    # Batas jumlah produk per paket (Fase 9). Aturannya dipegang satu helper
    # bersama karena PATCH juga bisa menaikkan jumlah produk aktif.
    lang.pastikan_batas_produk(usaha["id"], pengguna.peran)

    baris = db.sisipkan("umkm_product", {
        "business_id": usaha["id"],
        "nama": bersihkan(req.nama, 80, "Nama produk", wajib=True),
        "deskripsi": bersihkan(req.deskripsi, 400, "Deskripsi"),
        "harga": req.harga,
        "kategori": bersihkan(req.kategori, 60, "Kategori"),
        "is_kuliner_khas": req.is_kuliner_khas,
    }, kembalikan=True)
    if not baris:
        raise HTTPException(500, "Produk gagal disimpan.")

    penilaian = svc.nilai_produk(baris[0], usaha)
    return {"produk": baris[0], "penilaian": penilaian}


@router.patch("/produk/{product_id}")
def ubah_produk(product_id: str, req: ProdukPatch, pengguna: Pengguna = _umkm):
    produk, usaha = svc.produk_milik(product_id, pengguna.id)

    isi: dict = {}
    if req.nama is not None:
        isi["nama"] = bersihkan(req.nama, 80, "Nama produk", wajib=True)
    if req.deskripsi is not None:
        isi["deskripsi"] = bersihkan(req.deskripsi, 400, "Deskripsi")
    if req.kategori is not None:
        isi["kategori"] = bersihkan(req.kategori, 60, "Kategori")
    if req.harga is not None:
        isi["harga"] = req.harga
    if req.is_kuliner_khas is not None:
        isi["is_kuliner_khas"] = req.is_kuliner_khas
    if req.aktif is not None:
        # Menghidupkan kembali produk nonaktif menambah satu produk aktif,
        # persis seperti membuat produk baru — jadi batas paket diperiksa di
        # sini juga. Menonaktifkan tidak pernah diperiksa: ia hanya mengurangi.
        if req.aktif and not produk.get("aktif"):
            lang.pastikan_batas_produk(usaha["id"], pengguna.peran)
        isi["aktif"] = req.aktif
    if not isi:
        raise HTTPException(400, "Tidak ada perubahan yang dikirim.")

    hasil = db.perbarui("umkm_product", {"id": f"eq.{product_id}"}, isi, kembalikan=True)
    baru = hasil[0] if hasil else {**produk, **isi}
    penilaian = svc.nilai_produk(baru, usaha)
    return {"produk": baru, "penilaian": penilaian}


@router.delete("/produk/{product_id}")
def hapus_produk(product_id: str, pengguna: Pengguna = _umkm):
    """Nonaktifkan produk.

    Sengaja soft delete: `price_flag` dan `price_feedback` menunjuk ke produk
    ini, dan riwayat penilaian harga adalah justru bagian yang perlu bertahan
    ketika ada sengketa.
    """
    svc.produk_milik(product_id, pengguna.id)
    db.perbarui("umkm_product", {"id": f"eq.{product_id}"}, {"aktif": False})
    return {"status": "nonaktif", "product_id": product_id}


@router.post("/produk/{product_id}/suara")
def beri_suara(product_id: str, req: SuaraReq, pengguna: Pengguna = Depends(wajib_pengguna)):
    """Penilaian komunitas atas kewajaran harga.

    Terbuka untuk semua akun yang sudah masuk — itu memang gunanya: sinyal
    komunitas kehilangan artinya kalau hanya sesama pemilik usaha yang boleh
    memberi. Satu akun satu suara (bisa diubah), dan pemilik tidak boleh
    memberi suara pada produknya sendiri.
    """
    svc.pastikan_db()

    produk = db.satu("umkm_product", {"id": f"eq.{product_id}", "select": "*"})
    if not produk:
        raise HTTPException(404, "Produk tidak ditemukan.")
    usaha = svc.usaha_dari_id(produk["business_id"])
    if not usaha:
        raise HTTPException(404, "Produk tidak ditemukan.")
    if usaha.get("owner_id") == pengguna.id:
        raise HTTPException(403, "Anda tidak bisa menilai harga produk sendiri.")

    isi = {
        "vote": req.vote,
        "komentar": bersihkan(req.komentar, 300, "Komentar"),
    }
    sudah = db.satu("price_feedback", {
        "product_id": f"eq.{product_id}",
        "reporter_id": f"eq.{pengguna.id}",
        "select": "id",
    })
    if sudah:
        db.perbarui("price_feedback", {"id": f"eq.{sudah['id']}"}, isi)
    else:
        db.sisipkan("price_feedback", {
            "product_id": product_id, "reporter_id": pengguna.id, **isi})

    penilaian = svc.nilai_produk(produk, usaha)
    n_setuju, n_suara = svc.rekap_suara(product_id)
    return {
        "suara": {"setuju": n_setuju, "total": n_suara},
        "verifikasi": penilaian["verifikasi"],
    }


# ---------------------------------------------------------------------------
# Analisis kompetitor, riwayat, dan ekspor (Fase 10)
# ---------------------------------------------------------------------------
@router.get("/kompetitor")
def analisis_kompetitor(konteks: KonteksPaket = Depends(wajib_paket("GROWTH", "PRO"))):
    """Posisi usaha terhadap pesaing sekabupaten — tanpa satu pun nama.

    Berbayar karena inilah yang dibeli paket: kedalaman insight. Yang TIDAK
    dibeli tetap sama seperti sebelumnya — urutan rekomendasi tidak bergerak
    satu posisi pun karena endpoint ini dipanggil.
    """
    usaha = konteks.usaha
    produk = svc.daftar_produk(usaha["id"])
    hasil = kompetitor.analisis(usaha, produk)
    hasil["paket"] = {"plan": konteks.langganan["plan"]}
    return hasil


@router.get("/riwayat")
def riwayat_saya(pengguna: Pengguna = _umkm):
    """Seri bulanan performa usaha, sepanjang jendela paket.

    Tanpa 402: setiap paket melihat datanya sendiri, yang berbeda hanya panjang
    jendelanya. Jawabannya membawa `bulan_tersembunyi` supaya antarmuka bisa
    menyebut angka yang hilang alih-alih memotong grafik diam-diam.
    """
    usaha = svc.usaha_milik(pengguna.id)
    status = lang.status_langganan(usaha["id"])
    ids = [p["id"] for p in svc.daftar_produk(usaha["id"])]
    return rw.riwayat(usaha["id"], status["riwayat_bulan"], status["plan"], ids)


@router.get("/ekspor/{jenis}")
def ekspor_csv(
    jenis: str,
    konteks: KonteksPaket = Depends(wajib_paket("PRO")),
):
    """Unduh data usaha sendiri sebagai CSV. Tier PRO.

    Isinya hanya milik pemanggil, dan identitas penilai tidak pernah ikut —
    lihat docstring `services/ekspor.py`.
    """
    if jenis not in ekspor.JENIS:
        raise HTTPException(400, f"Jenis ekspor harus salah satu dari: {', '.join(ekspor.JENIS)}.")

    isi = ekspor.bangun(
        jenis,
        konteks.usaha,
        konteks.langganan["riwayat_bulan"],
        konteks.langganan["plan"],
    )
    nama = ekspor.nama_berkas(jenis, konteks.usaha)
    return Response(
        content=isi,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{nama}"',
            # Frontend mengunduh lewat fetch + blob (perlu header Authorization),
            # jadi nama berkasnya harus bisa dibaca dari JavaScript lintas asal.
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/langganan")
def langganan_saya(pengguna: Pengguna = _umkm):
    """Status paket usaha pemanggil, untuk tab Langganan.

    Selalu 200. Tanpa baris langganan pun jawabannya lengkap (FREE), supaya
    tabnya tetap bisa dirender alih-alih menampilkan galat.
    """
    usaha = svc.usaha_milik(pengguna.id)
    return {
        "langganan": lang.status_langganan(usaha["id"]),
        "paket": lang.daftar_paket(),
    }


@router.get("/umpan-balik")
def umpan_balik(pengguna: Pengguna = _umkm):
    """Apa yang wisatawan katakan tentang usaha ini setelah benar-benar datang.

    Dua sumber yang sengaja dipisah di jawabannya:

      * **Penilaian bersaksi** — rating yang lahir dari ulasan pasca-perjalanan
        (`umkm_rating.itinerary_id` terisi). Bedanya dengan rating biasa nyata:
        yang ini dipastikan berasal dari akun yang itinerary-nya memang memuat
        tempat ini dan tanggalnya sudah lewat.
      * **Laporan lapangan** — pengamatan yang muaranya dinas, bukan pemilik.
        Ditampilkan di sini karena pemilik berhak tahu jalan menuju tempatnya
        dilaporkan rusak: itulah yang akan ia bawa ke dinas lewat aspirasi.
        Satu kategori, JAM_OPERASIONAL, justru bisa ia perbaiki sendiri.

    Identitas penilai tidak pernah diteruskan, sama seperti `profil_publik`.
    Tanpa itu, pemilik warung kecil bisa menebak siapa yang memberi bintang
    satu — dan penilaian yang bisa ditebak pemiliknya bukan penilaian jujur.
    """
    usaha = svc.usaha_milik(pengguna.id)

    bersaksi = []
    if db.aktif():
        # `itinerary_id` dibawa migrasi umpan balik perjalanan; tanpa migrasi,
        # PostgREST membalas 42703 dan penjaga mengubahnya jadi 503 yang
        # menyebutkan berkas migrasinya — bukan 500 tanpa keterangan.
        with jaga_migrasi():
            bersaksi = [
                {k: v for k, v in r.items() if k != "user_id"}
                for r in db.pilih("umkm_rating", {
                    "business_id": f"eq.{usaha['id']}",
                    "itinerary_id": "not.is.null",
                    "select": "rating,komentar,created_at,updated_at",
                    "order": "updated_at.desc",
                    "limit": "50",
                }) or []
            ]

    norm = usaha.get("place_name_norm") or kunci_nama(usaha.get("place_name"))
    laporan = lapangan.laporan_untuk_tempat(norm)

    return {
        "penilaian_bersaksi": bersaksi,
        "n_bersaksi": len(bersaksi),
        "laporan": laporan,
        "ringkas_laporan": lapangan.ringkas_untuk_tempat(laporan),
        "catatan": (
            "Penilaian bersaksi berasal dari wisatawan yang perjalanannya "
            "memang melewati tempat ini dan sudah selesai. Ia dihitung ke skor "
            "kepercayaan dengan bobot yang sama seperti penilaian lain — "
            "penandaannya untuk transparansi, bukan untuk mengubah skor. "
            "Laporan lapangan TIDAK pernah memengaruhi skor kepercayaan maupun "
            "status harga usaha Anda; muaranya dinas."
        ),
    }


@router.post("/advisor")
def advisor(
    request: Request,
    refresh: bool = Query(False, description="Paksa buat ulang; hanya untuk ADMIN."),
    konteks: KonteksPaket = Depends(wajib_paket("GROWTH", "PRO")),
):
    """Penasihat bisnis AI untuk usaha milik pemanggil saja.

    Ini satu-satunya endpoint AI yang mengonsumsi teks tulisan pengguna, jadi
    seluruh lapisan pertahanan prompt injection bertemu di sini:

      - Teks sudah bersih sejak disimpan (core/sanitasi.py, Fase 5).
      - Angka dan teks dipisah secara FISIK: angka per produk masuk blok FAKTA,
        nama dan deskripsinya masuk blok berpagar nonce, dijembatani kunci
        produk_1, produk_2, dan seterusnya.
      - Hasil model divalidasi ke NarasiAdvisor; kunci asing dibuang.
      - Teks ini TIDAK PERNAH ikut ke prompt GOV — F1 dan F2 hanya memakan
        agregat, sehingga tidak ada jalur injeksi lintas-tenant.

    `scope` cache dikunci ke id usaha, jadi narasi satu usaha tidak mungkin
    tersaji ke usaha lain meski isinya kebetulan sama.

    Berbayar sejak Fase 9: FREE dibalas 402 oleh `wajib_paket`. Kuotanya
    dipotong HANYA ketika model benar-benar dipanggil — membuka tab berulang
    kali menyajikan narasi dari cache dan tidak mengurangi jatah sedikit pun.
    """
    pengguna, usaha = konteks.pengguna, konteks.usaha
    produk = svc.daftar_produk(usaha["id"])
    fakta, teks = ai_fakta.fakta_advisor(usaha, produk)

    def periksa_kuota() -> None:
        # Dijalankan hanya pada jalur cache-miss, tepat sebelum model dipanggil.
        if pengguna.peran == "ADMIN":
            return
        if konteks.langganan["kuota_sisa"] <= 0:
            raise HTTPException(
                429,
                detail={
                    "pesan": (
                        "Kuota AI Advisor untuk periode ini sudah habis "
                        f"({konteks.langganan['kuota_advisor']} kali per "
                        f"{lang.JENDELA_HARI} hari pada paket "
                        f"{konteks.langganan['plan']})."
                    ),
                    "kuota_advisor": konteks.langganan["kuota_advisor"],
                    "kuota_terpakai": konteks.langganan["kuota_terpakai"],
                    "upgrade_url": konteks.langganan["upgrade_url"],
                },
            )

    hasil = hasilkan(
        fitur="advisor",
        scope=usaha["id"],
        fakta=fakta,
        petunjuk=ai_fakta.PETUNJUK_ADVISOR,
        model_hasil=NarasiAdvisor,
        request=request,
        user_id=pengguna.id,
        blok_tambahan=blok_data_umkm(teks),
        refresh=refresh and pengguna.peran == "ADMIN",
        sebelum_panggil=periksa_kuota,
    )

    if not hasil.get("dari_cache") and hasil.get("narasi_status") == "ok":
        if pengguna.peran != "ADMIN":
            lang.pakai_kuota(usaha["id"])

    hasil["langganan"] = lang.status_langganan(usaha["id"])
    return hasil
