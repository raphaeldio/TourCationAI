"""Klien PostgREST tipis di atas httpx.

Sengaja TIDAK memakai SDK `supabase` untuk Python: pohon dependensinya berat
sementara yang dibutuhkan hanya beberapa panggilan HTTP. Ini sekitar 40 baris.

Seluruh panggilan memakai kunci service_role dan MELEWATI RLS. Itu disengaja:
penegakan peran tinggal di satu tempat — dependency require_role() pada
FastAPI — sehingga tidak ada dua sumber kebenaran yang bisa berbeda.
"""

from typing import Any, Optional

import httpx

from ..core.config import supabase_service_key, supabase_url


class SupabaseTidakDikonfigurasi(RuntimeError):
    """Dilempar bila SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi."""


def aktif() -> bool:
    """True bila kredensial tersedia. Dipakai untuk degradasi yang anggun."""
    return bool(supabase_url() and supabase_service_key())


def _kepala() -> dict:
    kunci = supabase_service_key()
    if not (supabase_url() and kunci):
        raise SupabaseTidakDikonfigurasi(
            "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diset di .env."
        )
    return {
        "apikey": kunci,
        "Authorization": f"Bearer {kunci}",
        "Content-Type": "application/json",
    }


def _url(tabel: str) -> str:
    return f"{supabase_url().rstrip('/')}/rest/v1/{tabel}"


def pilih(tabel: str, params: Optional[dict] = None, batas_waktu: float = 8.0) -> list[dict]:
    with httpx.Client(timeout=batas_waktu) as c:
        r = c.get(_url(tabel), headers=_kepala(), params=params or {})
        r.raise_for_status()
        return r.json()


def sisipkan(tabel: str, data: Any, kembalikan: bool = False,
             batas_waktu: float = 8.0) -> list[dict]:
    kepala = _kepala()
    kepala["Prefer"] = "return=representation" if kembalikan else "return=minimal"
    with httpx.Client(timeout=batas_waktu) as c:
        r = c.post(_url(tabel), headers=kepala, json=data)
        r.raise_for_status()
        return r.json() if kembalikan and r.content else []


def perbarui(tabel: str, params: dict, data: dict, kembalikan: bool = False,
             batas_waktu: float = 8.0) -> list[dict]:
    kepala = _kepala()
    kepala["Prefer"] = "return=representation" if kembalikan else "return=minimal"
    with httpx.Client(timeout=batas_waktu) as c:
        r = c.patch(_url(tabel), headers=kepala, params=params, json=data)
        r.raise_for_status()
        return r.json() if kembalikan and r.content else []


def hapus(tabel: str, params: dict, batas_waktu: float = 8.0) -> None:
    """DELETE dengan filter PostgREST.

    `params` WAJIB berisi filter. PostgREST sendiri menolak DELETE tanpa filter,
    tetapi mengandalkan itu berarti satu perubahan konfigurasi di sisi lain bisa
    berubah jadi penghapusan seluruh tabel — jadi diperiksa di sini juga.
    """
    if not params:
        raise ValueError("hapus() menolak permintaan tanpa filter.")
    with httpx.Client(timeout=batas_waktu) as c:
        r = c.delete(_url(tabel), headers=_kepala(), params=params)
        r.raise_for_status()


def tabel_hilang(galat: BaseException) -> bool:
    """True bila galat ini berarti relasi atau kolomnya belum ada di database.

    Dipisahkan ke sini karena bentuk galatnya adalah pengetahuan tentang
    PostgREST, bukan tentang fitur mana pun:

        relasi tak dikenal  -> 404
        kolom tak dikenal   -> 400 dengan SQLSTATE 42703

    Keduanya berarti hal yang sama bagi pemanggil — skema belum dimigrasi — dan
    itu bukan kesalahan pengguna. Tanpa pembedaan ini, tabel yang belum dibuat
    tampil sebagai "500 Internal Server Error" yang tidak memberi tahu siapa pun
    apa yang harus dilakukan.
    """
    if not isinstance(galat, httpx.HTTPStatusError):
        return False
    kode = galat.response.status_code
    if kode == 404:
        return True
    if kode != 400:
        return False
    try:
        return galat.response.json().get("code") == "42703"
    except Exception:  # noqa: BLE001 — body bukan JSON berarti bukan kasus ini
        return False


def satu(tabel: str, params: Optional[dict] = None) -> Optional[dict]:
    baris = pilih(tabel, {**(params or {}), "limit": "1"})
    return baris[0] if baris else None


def cacah(tabel: str, params: Optional[dict] = None, batas_waktu: float = 8.0) -> int:
    """Jumlah baris tanpa menariknya.

    PostgREST mengembalikan totalnya di header `content-range` ("0-0/1234")
    bila diminta `Prefer: count=exact`. Dipakai untuk angka total supaya tidak
    perlu mengunduh ribuan baris hanya untuk menghitungnya.
    """
    kepala = _kepala()
    kepala["Prefer"] = "count=exact"
    kepala["Range-Unit"] = "items"
    kepala["Range"] = "0-0"
    with httpx.Client(timeout=batas_waktu) as c:
        r = c.get(_url(tabel), headers=kepala, params={**(params or {}), "select": "id"})
        r.raise_for_status()
        total = r.headers.get("content-range", "").split("/")[-1]
        return int(total) if total.isdigit() else 0
