"""Konfigurasi dari environment.

Sebelumnya `load_dotenv(..., override=True)` dipanggil ulang di SETIAP request AI
(tiga tempat di backend/main.py lama). Sekarang cukup sekali saat impor.

Konsekuensi yang perlu diketahui: menambahkan OPENAI_API_KEY ke .env saat server
sudah berjalan tidak lagi langsung terbaca — server perlu direstart. Itu memang
alur yang biasa dipakai, dan imbalannya tidak ada I/O berkas per request.
"""

import os

from .paths import ROOT


def _muat_env() -> None:
    """Baca .env di root repo. Aman bila python-dotenv atau berkasnya tidak ada."""
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover — dotenv opsional
        return
    load_dotenv(os.path.join(ROOT, ".env"), override=True)


_muat_env()


def env_int(nama: str, bawaan: int) -> int:
    """Integer dari environment; kembali ke bawaan bila kosong/tak valid."""
    try:
        return int(os.getenv(nama, bawaan))
    except (TypeError, ValueError):
        return bawaan


def kunci_openai() -> str | None:
    """Dibaca saat dipakai, bukan disimpan konstan, agar mudah diuji."""
    return os.getenv("OPENAI_API_KEY")


def model_openai() -> str:
    return os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")


def asal_diizinkan() -> list[str]:
    """Daftar origin untuk CORS. Bawaan '*' — sama seperti perilaku sebelumnya."""
    mentah = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if not mentah or mentah == "*":
        return ["*"]
    return [a.strip() for a in mentah.split(",") if a.strip()]


# ── Supabase ───────────────────────────────────────────────────────────
def supabase_url() -> str | None:
    """mis. https://xxxx.supabase.co (tanpa garis miring di akhir)."""
    nilai = os.getenv("SUPABASE_URL")
    return nilai.rstrip("/") if nilai else None


def supabase_service_key() -> str | None:
    """Kunci service_role. RAHASIA — hanya dipakai di server, tidak pernah
    dikirim ke frontend."""
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def supabase_jwt_alg() -> str:
    """RS256/ES256 (kunci asimetris, dianjurkan) atau HS256 (secret lama).

    Jalur HS256 dipertahankan sebagai jaring pengaman: bila tombol kunci
    asimetris belum diaktifkan di dashboard saat hari demo, autentikasi
    tetap bisa berjalan tanpa mengubah kode.
    """
    return os.getenv("SUPABASE_JWT_ALG", "RS256").upper()


def supabase_jwt_secret() -> str | None:
    """Hanya dipakai bila SUPABASE_JWT_ALG=HS256."""
    return os.getenv("SUPABASE_JWT_SECRET")


def email_admin_awal() -> set[str]:
    """Email yang otomatis berperan ADMIN.

    Diperlukan untuk memutus telur-dan-ayam: persetujuan peran butuh ADMIN,
    sedangkan ADMIN pertama belum ada.
    """
    mentah = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in mentah.split(",") if e.strip()}


def email_demo_gov() -> set[str]:
    """Email yang langsung berperan GOV.

    `GOV_EMAILS` adalah daftar resmi; `GOV_DEMO_EMAILS` dipertahankan sebagai
    nama lama supaya konfigurasi yang sudah terpasang tidak mendadak kehilangan
    akses saat versi ini dipasang.
    """
    mentah = f"{os.getenv('GOV_EMAILS', '')},{os.getenv('GOV_DEMO_EMAILS', '')}"
    return {e.strip().lower() for e in mentah.split(",") if e.strip()}


# Domain surel yang dianggap milik instansi pemerintah. `go.id` hanya bisa
# didaftarkan lembaga negara, jadi kepemilikannya sudah menjadi bukti.
#
# TIDAK ADA domain uji coba di sini, dan itu keputusan keamanan, bukan kelalaian.
# Peran GOV diberikan SEKETIKA saat masuk tanpa persetujuan siapa pun, dan sejak
# GOV bisa memverifikasi usaha UMKM (`services/verifikasi.py`) peran itu membawa
# kewenangan atas akun orang lain. Domain demo yang bisa didaftarkan siapa saja
# akan menjadi rantai: surel demo -> GOV seketika -> verifikasi usaha mana pun.
#
# Untuk demo, pakai `GOV_EMAILS` — daftar alamat PERSIS yang harus ditulis satu
# per satu oleh orang yang memegang konfigurasi. Itu tetap praktis untuk juri,
# tetapi tidak bisa ditumpangi orang yang kebetulan tahu nama domainnya.
_DOMAIN_GOV_BAWAAN = "go.id"


def domain_gov() -> set[str]:
    """Domain surel yang otomatis berperan GOV.

    Kosongkan `GOV_EMAIL_DOMAINS` bila hanya ingin memakai daftar alamat pada
    `GOV_EMAILS` — itu mode paling ketat.
    """
    mentah = os.getenv("GOV_EMAIL_DOMAINS", _DOMAIN_GOV_BAWAAN)
    return {d.strip().lower().lstrip("@.") for d in mentah.split(",") if d.strip()}


def boleh_gov(email: str | None) -> bool:
    """True bila surel berhak atas peran GOV tanpa persetujuan admin.

    Dua jalur: alamat persis pada daftar `GOV_EMAILS`, atau domainnya (termasuk
    subdomain, mis. `tobakab.go.id` untuk `go.id`) terdaftar di
    `GOV_EMAIL_DOMAINS`.
    """
    surel = (email or "").strip().lower()
    if "@" not in surel:
        return False
    if surel in email_demo_gov():
        return True
    domain = surel.rsplit("@", 1)[1]
    return any(domain == d or domain.endswith(f".{d}") for d in domain_gov())


# ---------------------------------------------------------------------------
# Notifikasi verifikasi usaha
# ---------------------------------------------------------------------------
# Alamat tujuan sengaja dikonfigurasi PER KABUPATEN, bukan diambil dari akun
# petugas yang kebetulan pernah masuk. Dua alasan:
#
#   1. `profiles` tidak menyimpan surel — yang ada hanya di token JWT, dan token
#      hanya muncul saat orangnya sedang membuka aplikasi. Notifikasi justru
#      dibutuhkan ketika tidak ada yang sedang membuka.
#   2. Alur dinas memang berjalan lewat kotak masuk institusi, bukan alamat
#      pribadi pegawai. Pegawai berganti; `pariwisata@tobakab.go.id` tidak.
#
# Format: "Kabupaten:alamat" dipisah koma. Contoh:
#   GOV_NOTIFIKASI_EMAILS=Toba:pariwisata@tobakab.go.id,Samosir:dpar@samosirkab.go.id
def email_notifikasi_gov(kabupaten: str | None = None) -> list[str]:
    """Alamat tujuan notifikasi untuk satu kabupaten.

    Bila kabupatennya tidak punya alamat khusus, jatuh ke daftar `GOV_EMAILS` —
    itu perilaku yang benar untuk pemasangan kecil dan untuk demo, di mana satu
    alamat menangani seluruh wilayah. Mengembalikan daftar kosong berarti tidak
    ada yang perlu dikirimi; pemanggilnya tidak boleh menganggap itu galat.
    """
    peta: dict[str, list[str]] = {}
    for butir in os.getenv("GOV_NOTIFIKASI_EMAILS", "").split(","):
        if ":" not in butir:
            continue
        wilayah, alamat = butir.split(":", 1)
        wilayah, alamat = wilayah.strip().lower(), alamat.strip().lower()
        if wilayah and "@" in alamat:
            peta.setdefault(wilayah, []).append(alamat)

    if kabupaten:
        khusus = peta.get(kabupaten.strip().lower())
        if khusus:
            return khusus

    return sorted(email_demo_gov())


def smtp_terkonfigurasi() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_DARI"))


def smtp() -> dict:
    """Pengaturan SMTP. Kosong berarti notifikasi hanya diantrekan, tidak dikirim.

    Memakai `smtplib` dari pustaka standar, bukan layanan pihak ketiga: itu
    menghindari satu dependensi dan satu akun SaaS untuk fitur yang volumenya
    hitungan puluhan per bulan.
    """
    return {
        "host": os.getenv("SMTP_HOST", ""),
        "port": int(os.getenv("SMTP_PORT", "587") or 587),
        "pengguna": os.getenv("SMTP_USER", ""),
        "sandi": os.getenv("SMTP_PASSWORD", ""),
        "dari": os.getenv("SMTP_DARI", ""),
        "tls": os.getenv("SMTP_TLS", "1").strip().lower() not in ("0", "false", "no"),
    }


# Judul & versi aplikasi dipakai di skema OpenAPI; jangan diubah tanpa alasan.
JUDUL_APP = "TobaAI API"
VERSI_APP = "1.0.0"
