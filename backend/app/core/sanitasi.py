"""Sanitasi teks yang disubmit pengguna sebelum masuk basis data.

Ini lapisan PERTAMA dari lima lapis pertahanan prompt injection (§5 rencana).
Teks UMKM nantinya ikut masuk ke prompt AI Advisor, jadi permukaan serangannya
nyata: nama produk adalah kanal yang dikendalikan penuh oleh orang luar.

Menolak saat TULIS, bukan saat baca, dipilih dengan sengaja. Data kotor yang
sudah terlanjur tersimpan akan mengalir ke berapa pun jalur baca yang dibuat
belakangan, dan tiap jalur baru harus ingat membersihkannya lagi. Satu gerbang
di pintu masuk jauh lebih mudah dipertahankan.

Pertahanan berikutnya — pagar berdelimiter nonce, JSON mode, dan larangan
meneruskan teks UMKM ke prompt GOV — dipasang di Fase 7 bersama endpoint AI.
"""

import re
import unicodedata

from fastapi import HTTPException

# Frasa yang tidak punya alasan sah muncul di nama produk atau deskripsi warung.
# Sengaja sempit: pola yang terlalu longgar akan menolak teks jujur, dan
# penolakan palsu pada pemilik warung jauh lebih merugikan daripada satu pola
# tambahan yang lolos ke lapisan berikutnya.
_POLA_INJEKSI = re.compile(
    r"(?i)"
    r"(?:ignore|abaikan|lupakan)\s+(?:all\s+|semua\s+|seluruh\s+)?"
    r"(?:previous|sebelumnya|instruksi|instructions?|prompt)"
    r"|system\s+prompt"
    r"|you\s+are\s+now"
    r"|kamu\s+sekarang\s+adalah"
    r"|<\s*/?\s*(?:system|assistant|user)\s*>"
)


def _buang_kendali(teks: str) -> str:
    """Buang karakter kendali dan format tak terlihat.

    Termasuk kategori Unicode Cf (mis. zero-width joiner dan penanda arah
    teks) yang bisa dipakai menyembunyikan kata dari mata peninjau sambil
    tetap terbaca utuh oleh model bahasa.
    """
    return "".join(
        c for c in teks
        if c in "\n\t" or unicodedata.category(c) not in ("Cc", "Cf")
    )


def bersihkan(nilai, maks: int, label: str, wajib: bool = False):
    """Teks yang aman disimpan, atau HTTP 400 bila mencurigakan.

    Mengembalikan None untuk masukan kosong yang tidak wajib, supaya kolom
    nullable tetap null alih-alih berisi string kosong.
    """
    if nilai is None:
        if wajib:
            raise HTTPException(400, f"{label} wajib diisi.")
        return None

    teks = _buang_kendali(str(nilai))
    teks = re.sub(r"[ \t]+", " ", teks)
    teks = re.sub(r"\n{3,}", "\n\n", teks).strip()

    if not teks:
        if wajib:
            raise HTTPException(400, f"{label} wajib diisi.")
        return None

    if len(teks) > maks:
        raise HTTPException(400, f"{label} maksimal {maks} karakter (kini {len(teks)}).")

    if _POLA_INJEKSI.search(teks):
        raise HTTPException(
            400,
            f"{label} memuat frasa yang menyerupai perintah ke sistem AI dan "
            "ditolak. Tulis nama atau keterangan apa adanya.",
        )

    # Pagar blok prompt di Fase 7 memakai delimiter '==='; membuang urutan itu
    # sejak sekarang berarti pagarnya tidak akan bisa ditutup dari dalam data.
    return teks.replace("===", "--")


__all__ = ["bersihkan"]
