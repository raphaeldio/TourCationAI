"""Antrean notifikasi untuk dinas — outbox, bukan pengiriman langsung.

KENAPA OUTBOX. Pemicu notifikasi di sini adalah persetujuan klaim usaha: sebuah
keputusan administratif yang sudah sah begitu tersimpan. Pengiriman surel bisa
gagal karena hal-hal di luar kendali aplikasi — SMTP mati, kredensial kedaluwarsa,
kuota habis — dan kegagalan itu TIDAK BOLEH menggagalkan persetujuannya. Barisnya
ditulis lebih dulu; pengiriman menyusul, dan boleh gagal berkali-kali tanpa
kehilangan apa pun.

Konsekuensi yang disengaja: tanpa SMTP terkonfigurasi pun sistem tetap utuh.
Notifikasi menumpuk berstatus ANTRE dan tetap terbaca dinas sebagai kotak masuk
di dashboard. Surel hanya salah satu cara mengantarkan; tabelnya sendiri yang
menjadi catatan resmi bahwa dinas sudah diberi tahu.

Memakai `smtplib` pustaka standar, bukan layanan pihak ketiga. Untuk volume
hitungan puluhan per bulan, satu dependensi dan satu akun SaaS tidak sepadan.
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional

from ..core import config
from ..db import supabase as db

_log = logging.getLogger(__name__)

# Satu putaran pengiriman tidak pernah menghabiskan seluruh antrean sekaligus:
# permintaan HTTP yang memicunya tidak boleh menggantung karena kebetulan ada
# 500 notifikasi tertunda.
BATAS_SEKALI_KIRIM = 20

# Di atas ini baris berhenti dicoba lagi. Antrean yang mencoba selamanya akan
# menutupi notifikasi baru di belakangnya.
MAKS_PERCOBAAN = 5

JENIS_TERTUNDA = "VERIFIKASI_TERTUNDA"
JENIS_TERVERIFIKASI = "USAHA_TERVERIFIKASI"


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


def antre(
    jenis: str,
    judul: str,
    isi: str,
    kabupaten: Optional[str],
    business_id: Optional[str] = None,
) -> int:
    """Masukkan notifikasi ke antrean. Mengembalikan jumlah baris yang ditulis.

    TIDAK PERNAH MELEMPAR. Pemanggilnya selalu sedang menyelesaikan sesuatu yang
    lebih penting — menyetujui klaim, menandai usaha terverifikasi — dan gagal
    memberi tahu bukan alasan untuk membatalkan keputusannya.

    Baris ganda ditangani indeks unik `notifikasi_gov_tanpa_ganda` di database,
    bukan pemeriksaan di sini: dua permintaan yang tiba bersamaan akan lolos dari
    pemeriksaan-lalu-tulis apa pun yang ditulis di Python.
    """
    tujuan = config.email_notifikasi_gov(kabupaten)
    if not tujuan or not db.aktif():
        return 0

    ditulis = 0
    for alamat in tujuan:
        try:
            db.sisipkan("notifikasi_gov", {
                "jenis": jenis,
                "kabupaten": kabupaten,
                "business_id": business_id,
                "tujuan_email": alamat,
                "judul": judul,
                "isi": isi,
            })
            ditulis += 1
        except Exception as e:  # noqa: BLE001
            # Bentrok indeks unik berarti notifikasinya memang sudah ada — itu
            # hasil yang benar, bukan kegagalan.
            _log.info("Notifikasi %s untuk %s dilewati: %s", jenis, alamat, e)
    return ditulis


def _kirim_satu(baris: dict, pengaturan: dict) -> None:
    pesan = EmailMessage()
    pesan["Subject"] = baris["judul"]
    pesan["From"] = pengaturan["dari"]
    pesan["To"] = baris["tujuan_email"]
    pesan.set_content(baris["isi"])

    with smtplib.SMTP(pengaturan["host"], pengaturan["port"], timeout=15) as smtp:
        if pengaturan["tls"]:
            smtp.starttls()
        if pengaturan["pengguna"]:
            smtp.login(pengaturan["pengguna"], pengaturan["sandi"])
        smtp.send_message(pesan)


def pengiriman_aktif() -> bool:
    """Apakah surel benar-benar bisa dikirim, bukan sekadar diantrekan."""
    return config.smtp_terkonfigurasi()


def kirim_tertunda(batas: int = BATAS_SEKALI_KIRIM) -> dict:
    """Coba kirim antrean. Selalu mengembalikan ringkasan, tidak pernah melempar."""
    if not db.aktif():
        return {"aktif": False, "alasan": "Basis data belum dikonfigurasi."}
    if not config.smtp_terkonfigurasi():
        return {
            "aktif": False,
            "alasan": (
                "SMTP belum dikonfigurasi. Notifikasi tetap tercatat dan terbaca "
                "di kotak masuk dashboard; hanya pengiriman surelnya yang mati."
            ),
        }

    pengaturan = config.smtp()
    try:
        antrean = db.pilih("notifikasi_gov", {
            "select": "id,judul,isi,tujuan_email,percobaan",
            "status": "eq.ANTRE",
            "percobaan": f"lt.{MAKS_PERCOBAAN}",
            "order": "created_at.asc",
            "limit": str(batas),
        })
    except Exception as e:  # noqa: BLE001
        _log.warning("Antrean notifikasi gagal dibaca: %s", e)
        return {"aktif": False, "alasan": "Antrean notifikasi belum bisa dibaca."}

    terkirim = gagal = 0
    for baris in antrean:
        percobaan = int(baris.get("percobaan") or 0) + 1
        try:
            _kirim_satu(baris, pengaturan)
        except Exception as e:  # noqa: BLE001 — satu gagal, sisanya jalan terus
            gagal += 1
            _log.warning("Notifikasi %s gagal dikirim: %s", baris["id"], e)
            _tandai(baris["id"], {
                "percobaan": percobaan,
                "galat": str(e)[:400],
                # Baru dinyatakan GAGAL setelah kesempatannya benar-benar habis.
                # Sebelum itu ia tetap ANTRE supaya putaran berikutnya mencobanya.
                "status": "GAGAL" if percobaan >= MAKS_PERCOBAAN else "ANTRE",
            })
            continue

        terkirim += 1
        _tandai(baris["id"], {
            "status": "TERKIRIM",
            "percobaan": percobaan,
            "galat": None,
            "terkirim_at": _sekarang(),
        })

    return {"aktif": True, "diperiksa": len(antrean), "terkirim": terkirim, "gagal": gagal}


def _tandai(notif_id: str, isi: dict) -> None:
    try:
        db.perbarui("notifikasi_gov", {"id": f"eq.{notif_id}"}, isi)
    except Exception as e:  # noqa: BLE001 — gagal mencatat != gagal mengirim
        _log.warning("Status notifikasi %s gagal ditulis: %s", notif_id, e)


def kotak_masuk(kabupaten: Optional[str], batas: int = 50) -> list[dict]:
    """Notifikasi untuk satu wilayah, apa pun status pengirimannya.

    Status pengiriman ikut ditampilkan dengan sengaja: petugas berhak tahu bahwa
    sebuah pemberitahuan tercatat tetapi surelnya belum sampai, alih-alih
    mengira tidak ada apa-apa.
    """
    if not db.aktif():
        return []
    params = {
        "select": "id,jenis,judul,isi,kabupaten,business_id,status,created_at,terkirim_at",
        "order": "created_at.desc",
        "limit": str(batas),
    }
    if kabupaten:
        params["kabupaten"] = f"eq.{kabupaten}"
    try:
        return db.pilih("notifikasi_gov", params)
    except Exception as e:  # noqa: BLE001
        _log.warning("Kotak masuk notifikasi gagal dibaca: %s", e)
        return []
