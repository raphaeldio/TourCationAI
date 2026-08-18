"""Klien OpenAI bersama.

Dipisah supaya ketiga endpoint AI tidak menyalin blok pemeriksaan kunci yang
sama. Pesan galatnya dipertahankan persis seperti sebelumnya karena frontend
menampilkannya apa adanya ke pengguna.

Pemeriksaan kunci dan pembuatan klien sengaja DIPISAH: pada kode sebelumnya
kunci diperiksa lebih dulu (menghasilkan HTTP 400), sedangkan konstruksi klien
terjadi di dalam blok try bersama panggilan jaringannya (menghasilkan HTTP 500
dengan pesan yang ramah). Urutan itu ikut dipertahankan di sini.
"""

import json

from fastapi import HTTPException

from .config import kunci_openai, model_openai


def ada_kunci() -> bool:
    """Apakah fitur AI aktif. Dipakai untuk degradasi, bukan untuk menolak.

    Endpoint dashboard memeriksa ini lebih dulu supaya bisa membalas 200 dengan
    `narasi: null` alih-alih 400 — seluruh angka, grafik, dan tabel harus tetap
    tampil tanpa kunci OpenAI.
    """
    return bool(kunci_openai())


def pastikan_kunci() -> str:
    """Kunci OpenAI; HTTP 400 bila belum diset. Panggil sebelum validasi lain."""
    api_key = kunci_openai()
    if not api_key:
        raise HTTPException(400, "OPENAI_API_KEY belum diset di file .env.")
    return api_key


def klien(api_key: str):
    """Klien OpenAI. Panggil di dalam blok try bersama request jaringannya.

    Klien dibuat per panggilan, sama seperti perilaku sebelumnya. Objeknya
    ringan; yang mahal adalah panggilan jaringannya.
    """
    from openai import OpenAI
    return OpenAI(api_key=api_key)


def panggil_json(system: str, user: str, *, maks_token: int = 1600,
                 suhu: float = 0.2) -> dict:
    """Panggil model dalam JSON mode dan kembalikan dict mentah.

    `response_format={"type": "json_object"}` sudah dipakai endpoint translate-ui
    dan dipertahankan di sini. Ia bukan pengaman keamanan — model masih bisa
    mengisi apa saja — tetapi menjamin hasilnya bisa di-parse, sehingga validasi
    Pydantic di lapisan berikutnya selalu punya sesuatu untuk diperiksa.

    Suhu rendah dipilih karena keluaran ini di-cache: narasi yang berbeda-beda
    tiap panggilan pada FAKTA yang sama akan membuat cache terasa seperti bug.
    """
    api_key = pastikan_kunci()
    try:
        resp = klien(api_key).chat.completions.create(
            model=model_openai(),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=suhu,
            max_tokens=maks_token,
        )
        isi = (resp.choices[0].message.content or "").strip()
    except Exception as e:  # noqa: BLE001 — pesan ramah untuk UI
        raise HTTPException(500, f"Gagal memanggil AI: {e}")

    try:
        data = json.loads(isi)
    except json.JSONDecodeError:
        raise HTTPException(502, "Model membalas dengan format yang tidak terbaca.")
    if not isinstance(data, dict):
        raise HTTPException(502, "Model membalas dengan struktur yang tidak diharapkan.")
    return data


__all__ = ["ada_kunci", "pastikan_kunci", "klien", "panggil_json", "model_openai"]
