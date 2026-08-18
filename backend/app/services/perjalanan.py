"""Perjalanan milik wisatawan dan ulasan pasca-perjalanan.

Sampai modul ini ada, itinerary adalah **rencana**, bukan bukti perjalanan:
tidak ada satu pun state yang mencatat rencana benar-benar dijalankan. Bahannya
sebetulnya sudah lengkap sejak Fase awal — `itinerary_log` menyimpan `user_id`,
`tanggal_mulai`, dan `n_days` — yang belum ada hanya penafsirannya.

    Perjalanan SELESAI bila tanggal_mulai + n_days sudah lewat.

Konsekuensi yang perlu diketahui: itinerary yang disusun **tanpa login** tidak
akan pernah bisa diulas, karena `user_id`-nya null dan tidak ada cara sah
mengaitkannya ke siapa pun belakangan. Itu bukan cacat yang perlu ditambal —
mengaitkannya lewat tebakan (session, IP, kemiripan parameter) justru merusak
sifat anonim yang sengaja dipegang `itinerary_log`.

Tiga hal yang dijaga modul ini, dan sebaiknya tetap dijaga:

  * **Ulasan tidak pernah membuat tempat baru.** Yang bisa dinilai dan
    dilaporkan hanya tempat yang memang tercatat di `itinerary_place` untuk
    perjalanan itu. Inilah yang membuat penilaiannya *bersaksi* dan bukan
    sekadar pendapat orang yang belum pernah datang.
  * **Satu perjalanan satu ulasan**, ditegakkan indeks unik di database dengan
    alasan yang sama seperti `umkm_rating`: pemeriksaan aplikasi punya celah
    balapan, indeks unik tidak.
  * **Ulasan yang menyatakan tidak jadi berangkat tetap disimpan, tetapi
    laporan lapangannya tidak pernah masuk agregat pemerintah.** Alasan sebuah
    rencana batal dipakai itu berharga; pengamatan lapangan dari orang yang
    tidak pergi tidak.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from ..core.sanitasi import bersihkan
from ..db import supabase as db
from .analytics import kunci_nama
from .lapangan import KATEGORI_LAPANGAN, TINGKAT
from .migrasi import jaga
from .rating import hitung_trust

_log = logging.getLogger(__name__)

# Batas daftar perjalanan yang ditarik sekali jalan untuk satu akun.
BATAS_PERJALANAN = 50

# Berapa laporan lapangan yang boleh menyertai satu ulasan. Pagar kewarasan,
# bukan kuota: perjalanan 5 hari pun jarang menghasilkan lebih dari belasan.
MAKS_LAPORAN = 30

AKURASI_BIAYA = [
    "JAUH_LEBIH_MURAH", "LEBIH_MURAH", "SESUAI", "LEBIH_MAHAL", "JAUH_LEBIH_MAHAL",
]
AKURASI_WAKTU = ["TERLALU_PADAT", "PAS", "TERLALU_LONGGAR"]


def _pastikan_db() -> None:
    if not db.aktif():
        raise HTTPException(503, "Basis data belum dikonfigurasi di server.")


# ---------------------------------------------------------------------------
# Status perjalanan
# ---------------------------------------------------------------------------
def _tanggal(nilai) -> Optional[date]:
    if not nilai:
        return None
    try:
        return date.fromisoformat(str(nilai)[:10])
    except ValueError:
        return None


def status_perjalanan(baris: dict, hari_ini: Optional[date] = None) -> dict:
    """Status satu perjalanan beserta tanggal selesainya.

    `tanggal_mulai` bersifat opsional pada `/api/itinerary`, jadi sebagian
    baris tidak punya tanggal sama sekali. Untuk baris itu status yang benar
    adalah TANPA_TANGGAL — **bukan** SELESAI hasil menebak dari `created_at`.
    Rencana yang disusun tanpa tanggal biasanya perencanaan "kapan-kapan", dan
    menganggapnya sudah dijalani hanya karena seminggu berlalu akan memasukkan
    perjalanan yang tidak pernah terjadi ke dalam bukti lapangan dinas.

    Ulasannya tetap dibuka (lihat `boleh_diulas`) dengan syarat waktunya sudah
    mungkin secara fisik, dan wisatawan sendiri yang menyatakan jadi berangkat
    atau tidak lewat `jadi_berangkat`.
    """
    hari_ini = hari_ini or datetime.now(timezone.utc).date()
    n_days = max(int(baris.get("n_days") or 1), 1)

    mulai = _tanggal(baris.get("tanggal_mulai"))
    if mulai is not None:
        selesai = mulai + timedelta(days=n_days - 1)
        if hari_ini > selesai:
            status = "SELESAI"
        elif hari_ini < mulai:
            status = "AKAN_DATANG"
        else:
            status = "BERJALAN"
        return {
            "status": status,
            "tanggal_mulai": mulai.isoformat(),
            "tanggal_selesai": selesai.isoformat(),
            "tanggal_diperkirakan": False,
        }

    # Tanpa tanggal: acuan satu-satunya adalah kapan rencananya dibuat, dan itu
    # hanya dipakai untuk memastikan perjalanannya *mungkin* sudah lewat.
    dibuat = _tanggal(baris.get("created_at")) or hari_ini
    perkiraan_selesai = dibuat + timedelta(days=n_days - 1)
    return {
        "status": "TANPA_TANGGAL",
        "tanggal_mulai": None,
        "tanggal_selesai": None,
        "tanggal_diperkirakan": True,
        "mungkin_selesai": hari_ini > perkiraan_selesai,
    }


def boleh_diulas(info: dict) -> bool:
    """Ulasan dibuka untuk perjalanan yang sudah lewat, atau yang tanpa tanggal
    tetapi rentang harinya sudah mustahil masih berjalan."""
    if info["status"] == "SELESAI":
        return True
    return info["status"] == "TANPA_TANGGAL" and bool(info.get("mungkin_selesai"))


# ---------------------------------------------------------------------------
# Daftar perjalanan
# ---------------------------------------------------------------------------
def daftar_perjalanan(user_id: str) -> list[dict]:
    """Perjalanan milik pemanggil, terbaru dulu, dengan status dan tanda ulas.

    Hanya itinerary yang solvernya berhasil (`status = 'Optimal'`) yang
    ditampilkan. Permintaan yang gagal tetap tercatat untuk analitik dinas —
    kombinasi budget/durasi yang selalu gagal adalah sinyal kesenjangan — tapi
    tidak ada yang bisa diulas dari rencana yang tidak pernah tersusun.
    """
    _pastikan_db()
    baris = db.pilih("itinerary_log", {
        "user_id": f"eq.{user_id}",
        "status": "eq.Optimal",
        "select": (
            "id,created_at,tanggal_mulai,n_days,n_nights,n_orang,budget_total,"
            "total_estimasi,profil,kabupaten_tersentuh,hotel_name,n_agenda"
        ),
        "order": "created_at.desc",
        "limit": str(BATAS_PERJALANAN),
    })
    if not baris:
        return []

    ids = ",".join(b["id"] for b in baris)
    with jaga():
        sudah = db.pilih("perjalanan_ulasan", {
            "itinerary_id": f"in.({ids})",
            "select": "id,itinerary_id,skor_keseluruhan,created_at",
            "limit": str(BATAS_PERJALANAN),
        })
    per_itinerary = {u["itinerary_id"]: u for u in sudah}

    # Judul dan tanda simpan dilampirkan di sini, bukan lewat permintaan kedua
    # dari UI: inbox perlu membedakan rencana yang sengaja disimpan dari yang
    # cuma pernah tersusun, dan itu satu kueri jamak.
    from .simpanan import peta_judul

    simpanan = peta_judul([b["id"] for b in baris])

    hari_ini = datetime.now(timezone.utc).date()
    hasil = []
    for b in baris:
        info = status_perjalanan(b, hari_ini)
        ulasan = per_itinerary.get(b["id"])
        simpan = simpanan.get(b["id"])
        hasil.append({
            **b,
            **info,
            "disimpan": simpan is not None,
            "judul": (simpan or {}).get("judul"),
            "disimpan_pada": (simpan or {}).get("disimpan_pada"),
            "sudah_diulas": ulasan is not None,
            "skor_ulasan": (ulasan or {}).get("skor_keseluruhan"),
            "boleh_diulas": boleh_diulas(info) and ulasan is None,
            # Hanya rencana yang tersimpan payload-nya bisa dibuka kembali.
            # Sisanya tetap tampil di riwayat sebagai jejak, tanpa tautan yang
            # menjanjikan halaman yang tidak akan bisa dirender.
            "boleh_dibuka": simpan is not None,
        })
    return hasil


# ---------------------------------------------------------------------------
# Detail untuk formulir ulasan
# ---------------------------------------------------------------------------
def _perjalanan_milik(itinerary_id: str, user_id: str) -> dict:
    """Baris itinerary milik pemanggil.

    404 — bukan 403 — untuk perjalanan orang lain, mengikuti alasan yang sama
    dengan `umkm.produk_milik`: membedakan "tidak ada" dari "ada tapi bukan
    punyamu" membocorkan keberadaan baris kepada siapa pun yang mau menebak id.
    """
    _pastikan_db()
    baris = db.satu("itinerary_log", {
        "id": f"eq.{itinerary_id}",
        "select": (
            "id,user_id,created_at,tanggal_mulai,n_days,n_nights,n_orang,"
            "budget_total,total_estimasi,profil,kabupaten_tersentuh,hotel_name"
        ),
    })
    if not baris or baris.get("user_id") != user_id:
        raise HTTPException(404, "Perjalanan tidak ditemukan.")
    return baris


def _tempat_perjalanan(itinerary_id: str) -> list[dict]:
    """Tempat yang benar-benar masuk rencana ini.

    Hanya `dipilih = true`: opsi rumah makan yang ditawarkan tapi tidak dipakai
    memang tercatat (selisihnya berguna bagi dashboard UMKM), tetapi wisatawan
    tidak pernah ke sana sehingga tidak ada yang bisa ia nilai di sana.
    """
    return db.pilih("itinerary_place", {
        "itinerary_id": f"eq.{itinerary_id}",
        "dipilih": "is.true",
        "select": "jenis,place_name,kabupaten,hari,slot,place_type",
        "order": "hari.asc",
        "limit": "400",
    })


def _usaha_tertaut(tempat: list[dict], user_id: str) -> dict[str, dict]:
    """{place_name -> ringkasan usaha} untuk tempat yang diklaim akun UMKM.

    Jembatannya `place_name_norm`, konvensi join yang sama dengan
    `tautan_usaha.peta_usaha` dan chokepoint harga di `solver_state`. Bedanya
    di sini sumber namanya `itinerary_place`, bukan payload yang dipegang
    frontend — jadi daftar ini tidak bisa dikarang dari sisi klien.
    """
    nama = [t["place_name"] for t in tempat if t.get("place_name")]
    if not nama:
        return {}
    try:
        usaha = db.pilih("umkm_business", {
            "select": "id,place_name,place_name_norm,kabupaten",
            "limit": "500",
        })
        if not usaha:
            return {}
        ids = ",".join(u["id"] for u in usaha)
        milik_saya = db.pilih("umkm_rating", {
            "business_id": f"in.({ids})",
            "user_id": f"eq.{user_id}",
            "select": "business_id,rating,komentar",
            "limit": "500",
        })
    except Exception as e:  # noqa: BLE001 — tanpa tautan jauh lebih baik dari 500
        _log.warning("Gagal menautkan usaha ke perjalanan: %s", e)
        return {}

    per_norm = {
        (u.get("place_name_norm") or kunci_nama(u.get("place_name"))): u for u in usaha
    }
    per_rating = {r["business_id"]: r for r in milik_saya}

    hasil: dict[str, dict] = {}
    for n in nama:
        u = per_norm.get(kunci_nama(n))
        if not u:
            continue
        r = per_rating.get(u["id"]) or {}
        hasil[n] = {
            "business_id": u["id"],
            "nama": u.get("place_name") or n,
            "kabupaten": u.get("kabupaten"),
            "rating_saya": r.get("rating"),
            "komentar_saya": r.get("komentar"),
        }
    return hasil


def detail_ulasan(itinerary_id: str, user_id: str) -> dict:
    """Isi halaman ulasan: perjalanan, tempatnya, dan ulasan yang sudah ada.

    Daftar tempat dikirim dari server supaya wisatawan tidak perlu mengetik
    nama tempat sama sekali — dan supaya nama yang masuk laporan pasti sama
    persis dengan yang dipakai dataset, yang membuatnya bisa dijoin ke
    `umkm_business` dan diagregasi per kabupaten.
    """
    perjalanan = _perjalanan_milik(itinerary_id, user_id)
    info = status_perjalanan(perjalanan)
    tempat = _tempat_perjalanan(itinerary_id)
    with jaga():
        ulasan = db.satu("perjalanan_ulasan", {
            "itinerary_id": f"eq.{itinerary_id}", "select": "*",
        })

        laporan = []
        if ulasan:
            laporan = db.pilih("laporan_lapangan", {
                "ulasan_id": f"eq.{ulasan['id']}",
                "select": "id,place_name,kabupaten,jenis,kategori,tingkat,isi,"
                          "status,tanggapan,ditanggapi_pada,created_at",
                "order": "created_at.asc",
                "limit": str(MAKS_LAPORAN),
            })

    return {
        "perjalanan": {**perjalanan, **info},
        "boleh_diulas": boleh_diulas(info),
        "tempat": tempat,
        "usaha_tertaut": _usaha_tertaut(tempat, user_id),
        "ulasan": ulasan,
        "laporan": laporan,
        "pilihan": {
            "akurasi_biaya": AKURASI_BIAYA,
            "akurasi_waktu": AKURASI_WAKTU,
            "kategori_laporan": KATEGORI_LAPANGAN,
            "tingkat": TINGKAT,
        },
    }


# ---------------------------------------------------------------------------
# Penyimpanan
# ---------------------------------------------------------------------------
def _simpan_rating_bersaksi(business_id: str, user_id: str, nilai: int,
                            komentar: Optional[str], itinerary_id: str) -> None:
    """Rating dari perjalanan nyata, ditulis ke tabel rating yang sama.

    Sengaja TIDAK memakai tabel terpisah. Dua sumber rating untuk satu usaha
    berarti dua rata-rata yang bisa berbeda, dan pemilik warung yang melihat
    dua angka berlainan di dua halaman tidak akan percaya keduanya. Yang
    membedakannya cukup satu kolom: `itinerary_id`.

    Kolom itu murni pelabelan — rumus `trust_score` tidak berubah sedikit pun.
    """
    sekarang = datetime.now(timezone.utc).isoformat()
    isi = {
        "rating": nilai,
        "komentar": komentar,
        "itinerary_id": itinerary_id,
        "updated_at": sekarang,
    }
    lama = db.satu("umkm_rating", {
        "business_id": f"eq.{business_id}",
        "user_id": f"eq.{user_id}",
        "select": "id",
    })
    if lama:
        db.perbarui("umkm_rating", {
            "business_id": f"eq.{business_id}", "user_id": f"eq.{user_id}",
        }, isi)
    else:
        try:
            db.sisipkan("umkm_rating", {
                "business_id": business_id, "user_id": user_id,
                "created_at": sekarang, **isi,
            })
        except Exception as e:  # noqa: BLE001
            # Balapan dua permintaan bersamaan; indeks unik sudah menolak yang
            # kedua. Perlakukan sebagai pembaruan, sama seperti rating.py.
            if "umkm_rating_satu_per_akun" not in str(e):
                raise
            db.perbarui("umkm_rating", {
                "business_id": f"eq.{business_id}", "user_id": f"eq.{user_id}",
            }, isi)
    hitung_trust(business_id)


def simpan_ulasan(itinerary_id: str, user_id: str, req) -> dict:
    """Simpan ulasan perjalanan + laporan lapangan + penilaian usaha sekaligus.

    Satu panggilan, bukan tiga. Wisatawan mengisi satu formulir dan menekan satu
    tombol; membaginya jadi tiga permintaan berarti ada keadaan setengah jadi
    yang harus dijelaskan ke pengguna ("penilaian tersimpan, laporan gagal")
    padahal ia tidak punya cara memperbaikinya.

    Yang TIDAK dilakukan di sini, dan sebaiknya tetap tidak: laporan
    TARIF_TIDAK_RESMI tidak pernah otomatis menandai harga usaha mana pun.
    Keputusan OK/SUSPECT/FLAGGED tetap milik `price_check` yang murni statistik.
    Keputusan yang bisa digerakkan sepuluh akun tidak bisa dipertanggungjawabkan
    ke pemilik warung yang harganya ditandai.
    """
    perjalanan = _perjalanan_milik(itinerary_id, user_id)
    info = status_perjalanan(perjalanan)
    if not boleh_diulas(info):
        raise HTTPException(
            400,
            "Perjalanan ini belum selesai. Ulasan bisa diberikan setelah "
            "tanggal terakhir perjalanan terlewati.",
        )
    with jaga():
        if db.satu("perjalanan_ulasan",
                   {"itinerary_id": f"eq.{itinerary_id}", "select": "id"}):
            raise HTTPException(409, "Perjalanan ini sudah pernah diulas.")

    tempat = _tempat_perjalanan(itinerary_id)
    # Kunci ternormalisasi supaya "RM. Sipiso-piso" dan "RM Sipiso piso"
    # dianggap tempat yang sama; nama yang disimpan tetap bentuk aslinya.
    per_nama = {kunci_nama(t["place_name"]): t for t in tempat if t.get("place_name")}
    usaha = _usaha_tertaut(tempat, user_id)
    per_usaha = {u["business_id"]: u for u in usaha.values()}

    sekarang = datetime.now(timezone.utc).isoformat()
    with jaga():
        baris = db.sisipkan("perjalanan_ulasan", {
            "itinerary_id": itinerary_id,
            "user_id": user_id,
            "skor_keseluruhan": req.skor_keseluruhan,
            "akurasi_biaya": req.akurasi_biaya,
            "akurasi_waktu": req.akurasi_waktu,
            "jadi_berangkat": req.jadi_berangkat,
            "catatan": bersihkan(req.catatan, 2000, "Catatan perjalanan"),
            "created_at": sekarang,
            "updated_at": sekarang,
        }, kembalikan=True)
    if not baris:
        raise HTTPException(500, "Ulasan gagal disimpan.")
    ulasan = baris[0]

    # -- laporan lapangan ---------------------------------------------------
    laporan_baris = []
    for lap in (req.laporan or [])[:MAKS_LAPORAN]:
        asal = per_nama.get(kunci_nama(lap.place_name))
        if not asal:
            # Tempat yang tidak ada di rencana ini ditolak diam-diam alih-alih
            # 400: satu nama yang tidak cocok tidak boleh membatalkan seluruh
            # ulasan yang sudah tersimpan barisnya.
            _log.info("Laporan untuk tempat di luar rencana diabaikan: %s",
                      lap.place_name)
            continue
        laporan_baris.append({
            "ulasan_id": ulasan["id"],
            "itinerary_id": itinerary_id,
            "place_name": asal["place_name"],
            "kabupaten": asal.get("kabupaten"),
            "jenis": asal.get("jenis"),
            "kategori": lap.kategori,
            "tingkat": lap.tingkat,
            "isi": bersihkan(lap.isi, 1500, "Isi laporan"),
        })
    if laporan_baris:
        try:
            db.sisipkan("laporan_lapangan", laporan_baris)
        except Exception as e:  # noqa: BLE001
            _log.warning("Gagal menyimpan laporan lapangan: %s", e)

    # -- penilaian usaha ----------------------------------------------------
    n_rating = 0
    ditolak: list[str] = []
    for pen in (req.penilaian or []):
        u = per_usaha.get(pen.business_id)
        if not u:
            # Usaha yang tidak tersentuh perjalanan ini tidak boleh dinilai
            # lewat jalur bersaksi. Jalur rating biasa tetap terbuka baginya.
            ditolak.append(pen.business_id)
            continue
        try:
            _simpan_rating_bersaksi(
                pen.business_id, user_id, pen.rating,
                bersihkan(pen.komentar, 1000, "Komentar penilaian"), itinerary_id,
            )
            n_rating += 1
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            _log.warning("Gagal menyimpan penilaian bersaksi: %s", e)
            ditolak.append(pen.business_id)

    return {
        "ulasan": ulasan,
        "n_laporan": len(laporan_baris),
        "n_penilaian": n_rating,
        "penilaian_ditolak": ditolak,
        "catatan": (
            "Penilaian usaha masuk ke skor kepercayaan; laporan lapangan masuk "
            "ke kotak masuk dinas dan tidak pernah menyentuh skor usaha mana pun."
        ),
    }


def ulasan_saya(user_id: str, batas: int = 50) -> list[dict]:
    """Riwayat ulasan perjalanan milik pemanggil, untuk halaman /saya."""
    _pastikan_db()
    with jaga():
        baris = db.pilih("perjalanan_ulasan", {
            "user_id": f"eq.{user_id}",
            "select": "id,itinerary_id,skor_keseluruhan,akurasi_biaya,"
                      "akurasi_waktu,jadi_berangkat,catatan,created_at",
            "order": "created_at.desc",
            "limit": str(batas),
        })
    return baris or []


__all__ = [
    "AKURASI_BIAYA",
    "AKURASI_WAKTU",
    "MAKS_LAPORAN",
    "boleh_diulas",
    "daftar_perjalanan",
    "detail_ulasan",
    "simpan_ulasan",
    "status_perjalanan",
    "ulasan_saya",
]
