"""Verifikasi JWT Supabase dan penegakan peran (RBAC).

Rancangan yang perlu diketahui sebelum menyunting berkas ini:

* **Peran dibaca dari tabel `profiles`, bukan dari klaim JWT.** Kalau peran
  hanya diambil dari token, persetujuan admin baru berlaku setelah token
  pengguna di-refresh — bisa satu jam. Membaca dari database membuatnya
  berlaku seketika; cache 60 detik menahan biayanya di sekitar satu kueri
  per pengguna per menit.

* **PyJWT, bukan python-jose.** python-jose relatif tidak terawat dan punya
  riwayat CVE. PyJWKClient sudah membawa cache kunci sendiri, sehingga hanya
  ada satu pengambilan JWKS per proses.

* **Tujuh endpoint lama tidak diberi dependency apa pun.** Yang memakai
  berkas ini hanya router baru. `/api/itinerary` boleh memakai
  `pengguna_opsional` semata untuk melampirkan user_id pada log — itu tidak
  menggerbangi apa pun dan tetap melayani permintaan anonim.
"""

import threading
import time
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

_skema = HTTPBearer(auto_error=False)

# Cache peran: {user_id: (peran, kabupaten, kedaluwarsa_epoch)}
_CACHE_PERAN: dict[str, tuple[str, Optional[str], float]] = {}
_TTL_PERAN = 60.0
_KUNCI_CACHE = threading.Lock()

_jwk_client = None
_KUNCI_JWK = threading.Lock()


@dataclass(frozen=True)
class Pengguna:
    id: str
    email: Optional[str]
    peran: str
    kabupaten: Optional[str] = None

    @property
    def admin(self) -> bool:
        return self.peran == "ADMIN"


def _ambil_jwk_client():
    global _jwk_client
    if _jwk_client is None:
        with _KUNCI_JWK:
            if _jwk_client is None:
                url = config.supabase_url()
                if not url:
                    raise HTTPException(503, "SUPABASE_URL belum diset di server.")
                _jwk_client = jwt.PyJWKClient(
                    f"{url}/auth/v1/.well-known/jwks.json", cache_keys=True
                )
    return _jwk_client


def _bongkar_token(token: str) -> dict:
    """Verifikasi tanda tangan, masa berlaku, audience, dan issuer."""
    url = config.supabase_url()
    if not url:
        raise HTTPException(503, "Autentikasi belum dikonfigurasi di server.")

    opsi = {"require": ["exp", "sub"]}
    penerbit = f"{url}/auth/v1"
    alg = config.supabase_jwt_alg()

    try:
        if alg == "HS256":
            rahasia = config.supabase_jwt_secret()
            if not rahasia:
                raise HTTPException(503, "SUPABASE_JWT_SECRET belum diset di server.")
            return jwt.decode(
                token, rahasia, algorithms=["HS256"],
                audience="authenticated", issuer=penerbit, options=opsi,
            )
        kunci = _ambil_jwk_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token, kunci.key, algorithms=["RS256", "ES256"],
            audience="authenticated", issuer=penerbit, options=opsi,
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi sudah kedaluwarsa. Silakan masuk lagi.")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Token tidak sah: {e}")


def _kabupaten_profil(user_id: str) -> Optional[str]:
    """Wilayah kerja dari `profiles`, tanpa menyentuh peran.

    Terpisah dari pembacaan profil pada cabang USER karena tujuannya berbeda:
    di sana `role` yang dicari, di sini justru `role` HARUS diabaikan. Peran GOV
    sudah ditetapkan surelnya, dan membiarkan baris profiles ikut menimpanya
    akan membuat satu baris database bisa menurunkan — atau menaikkan — peran
    yang sumber kebenarannya ada di tempat lain.
    """
    from ..db import supabase as db

    if not db.aktif():
        return None
    try:
        baris = db.satu("profiles", {"id": f"eq.{user_id}", "select": "kabupaten"})
    except Exception:  # noqa: BLE001 — tanpa wilayah, kewenangan menyempit
        return None
    return (baris or {}).get("kabupaten")


def _peran_dari_db(user_id: str, email: Optional[str]) -> tuple[str, Optional[str]]:
    """Peran dari tabel profiles, dengan cache 60 detik."""
    sekarang = time.time()
    with _KUNCI_CACHE:
        simpan = _CACHE_PERAN.get(user_id)
        if simpan and simpan[2] > sekarang:
            return simpan[0], simpan[1]

    # Peran dari surel dievaluasi lebih dulu: ADMIN pertama harus bisa masuk
    # sebelum baris profiles ada, dan peran GOV memang ditentukan oleh alamat
    # surel dinas (lihat config.boleh_gov) — bukan oleh persetujuan admin.
    surel = (email or "").lower()
    if surel and surel in config.email_admin_awal():
        peran, kabupaten = "ADMIN", None
    elif config.boleh_gov(surel):
        # PERAN dari surel, WILAYAH dari profiles — dan keduanya memang harus
        # bersumber beda. Domain surel membuktikan "ini orang dinas", tetapi
        # tidak menyatakan dinas MANA; alamat `dishub@tobakab.go.id` tidak lebih
        # membuktikan wewenang atas Toba daripada atas Samosir.
        #
        # `profiles.kabupaten` hanya bisa ditulis lewat jalur admin — endpoint
        # biodata di `routers/auth.py` sengaja tidak memuatnya — sehingga
        # pemegang akun tidak bisa memilih wilayahnya sendiri. Itu syarat mutlak
        # agar pembatasan verifikasi per kabupaten berarti apa-apa.
        #
        # Gagal membaca berarti None, dan None berarti TIDAK BISA memverifikasi
        # apa pun (lihat services/verifikasi.py). Gagal tertutup, bukan terbuka.
        peran, kabupaten = "GOV", _kabupaten_profil(user_id)
    else:
        peran, kabupaten = "USER", None
        from ..db import supabase as db
        if db.aktif():
            try:
                baris = db.satu("profiles", {
                    "id": f"eq.{user_id}",
                    "select": "role,kabupaten",
                })
                if baris:
                    peran = baris.get("role") or "USER"
                    kabupaten = baris.get("kabupaten")
            except Exception:  # noqa: BLE001
                # Gangguan database tidak boleh menaikkan hak akses siapa pun;
                # jatuh ke peran paling rendah.
                peran, kabupaten = "USER", None

    with _KUNCI_CACHE:
        _CACHE_PERAN[user_id] = (peran, kabupaten, sekarang + _TTL_PERAN)
    return peran, kabupaten


def lupakan_peran(user_id: str) -> None:
    """Buang cache peran satu pengguna — dipanggil sesudah admin menyetujui."""
    with _KUNCI_CACHE:
        _CACHE_PERAN.pop(user_id, None)


def pengguna_opsional(
    kredensial: Optional[HTTPAuthorizationCredentials] = Depends(_skema),
) -> Optional[Pengguna]:
    """Pengguna bila ada token sah, None bila tidak. Tidak pernah menolak.

    Dipakai endpoint publik yang ingin melampirkan identitas bila tersedia,
    seperti pencatatan itinerary.
    """
    if kredensial is None:
        return None
    try:
        isi = _bongkar_token(kredensial.credentials)
    except HTTPException:
        return None
    email = isi.get("email")
    peran, kabupaten = _peran_dari_db(isi["sub"], email)
    return Pengguna(id=isi["sub"], email=email, peran=peran, kabupaten=kabupaten)


def wajib_pengguna(
    kredensial: Optional[HTTPAuthorizationCredentials] = Depends(_skema),
) -> Pengguna:
    if kredensial is None:
        raise HTTPException(401, "Perlu masuk terlebih dahulu.")
    isi = _bongkar_token(kredensial.credentials)
    email = isi.get("email")
    peran, kabupaten = _peran_dari_db(isi["sub"], email)
    return Pengguna(id=isi["sub"], email=email, peran=peran, kabupaten=kabupaten)


def wajib_peran(*peran_diizinkan: str):
    """Dependency yang menuntut salah satu peran. ADMIN selalu lolos."""
    diizinkan = set(peran_diizinkan) | {"ADMIN"}

    def penjaga(pengguna: Pengguna = Depends(wajib_pengguna)) -> Pengguna:
        if pengguna.peran not in diizinkan:
            raise HTTPException(
                403,
                f"Akses ditolak. Perlu peran {' atau '.join(sorted(peran_diizinkan))}; "
                f"peran Anda saat ini {pengguna.peran}.",
            )
        return pengguna

    return penjaga


@dataclass(frozen=True)
class KonteksPaket:
    """Pengguna + usahanya + status langganannya, hasil satu kali pemeriksaan."""

    pengguna: Pengguna
    usaha: dict
    langganan: dict


def wajib_paket(*paket_diizinkan: str):
    """Dependency yang menuntut tier langganan tertentu.

    Membalas **402 Payment Required**, bukan 403. Perbedaannya penting bagi
    antarmuka: 403 berarti "Anda tidak berhak" — jalan buntu yang tidak bisa
    diperbaiki pengguna sendiri; 402 berarti "fitur ini berbayar" dan layak
    ditampilkan sebagai ajakan berlangganan, lengkap dengan `upgrade_url`.
    Menyamakan keduanya membuat UI tidak bisa membedakan dinding dari pintu.

    ADMIN selalu lolos, supaya demo dan pemeriksaan tidak tersandera data
    langganan.
    """
    diizinkan = set(paket_diizinkan)

    def penjaga(pengguna: Pengguna = Depends(wajib_pengguna)) -> KonteksPaket:
        # Impor di dalam fungsi: core/ tidak boleh bergantung pada services/
        # saat impor modul — itu membuat urutan impor jadi rapuh.
        from ..services import langganan as lang
        from ..services import umkm as svc

        if pengguna.peran not in ("UMKM", "ADMIN"):
            raise HTTPException(
                403,
                "Akses ditolak. Perlu peran UMKM; "
                f"peran Anda saat ini {pengguna.peran}.",
            )

        usaha = svc.usaha_milik(pengguna.id)
        status = lang.status_langganan(usaha["id"])

        if pengguna.peran != "ADMIN" and status["plan"] not in diizinkan:
            raise HTTPException(
                402,
                detail={
                    "pesan": (
                        "Fitur ini tersedia pada paket "
                        f"{' atau '.join(sorted(diizinkan))}. "
                        f"Paket Anda saat ini {status['plan']}."
                    ),
                    "paket_sekarang": status["plan"],
                    "paket_diperlukan": sorted(diizinkan),
                    "upgrade_url": status["upgrade_url"],
                },
            )

        return KonteksPaket(pengguna=pengguna, usaha=usaha, langganan=status)

    return penjaga
