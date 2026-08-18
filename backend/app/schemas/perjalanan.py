"""Skema ulasan pasca-perjalanan.

Satu permintaan membawa tiga hal sekaligus — penilaian rencana, laporan
lapangan, dan penilaian usaha — karena di layar semuanya satu formulir dengan
satu tombol kirim. Memecahnya jadi tiga permintaan akan menghasilkan keadaan
setengah jadi yang tidak bisa diperbaiki pengguna.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class LaporanReq(BaseModel):
    """Satu pengamatan lapangan atas satu tempat dalam rencana.

    `place_name` divalidasi di service terhadap `itinerary_place` perjalanan
    ini — nama yang tidak ada dalam rencana tidak akan tersimpan. Karena itu
    field ini aman diterima apa adanya dari klien: ia bukan sumber kebenaran,
    hanya penunjuk ke baris yang sudah ada.
    """

    place_name: str = Field(max_length=200)
    kategori: Literal[
        "AKSES_JALAN", "FASILITAS_UMUM", "KEBERSIHAN", "PAPAN_PENUNJUK",
        "SINYAL_KOMUNIKASI", "KEAMANAN", "TARIF_TIDAK_RESMI",
        "JAM_OPERASIONAL", "LAINNYA",
    ] = "LAINNYA"
    tingkat: Literal["RINGAN", "SEDANG", "BERAT"] = "SEDANG"
    isi: Optional[str] = Field(default=None, max_length=1500)


class PenilaianUsahaReq(BaseModel):
    """Penilaian satu usaha yang benar-benar disinggahi perjalanan ini."""

    business_id: str = Field(max_length=64)
    rating: int = Field(ge=1, le=5)
    komentar: Optional[str] = Field(default=None, max_length=1000)


class UlasanPerjalananReq(BaseModel):
    skor_keseluruhan: int = Field(ge=1, le=5)

    # Dua sumbu akurasi rencana. Opsional: wisatawan yang hanya ingin memberi
    # bintang tidak boleh dipaksa menilai hal yang tidak ia perhatikan, dan
    # jawaban asal-asalan lebih merusak agregat daripada kolom kosong.
    akurasi_biaya: Optional[Literal[
        "JAUH_LEBIH_MURAH", "LEBIH_MURAH", "SESUAI",
        "LEBIH_MAHAL", "JAUH_LEBIH_MAHAL",
    ]] = None
    akurasi_waktu: Optional[Literal["TERLALU_PADAT", "PAS", "TERLALU_LONGGAR"]] = None

    # Ulasan dari rencana yang batal dipakai tetap disimpan — ia menjelaskan
    # kenapa rencana tidak terpakai — tetapi laporan lapangannya tidak pernah
    # masuk agregat pemerintah.
    jadi_berangkat: bool = True

    catatan: Optional[str] = Field(default=None, max_length=2000)
    laporan: Optional[list[LaporanReq]] = None
    penilaian: Optional[list[PenilaianUsahaReq]] = None


class SimpanPerjalananReq(BaseModel):
    """Simpan rencana yang sedang dilihat.

    `payload` dikirim dari klien apa adanya — itu memang rencana yang baru saja
    server kirimkan, dan menyimpan bentuk yang DILIHAT pengguna lebih benar
    daripada menyusunnya ulang di server. Kepemilikan `itinerary_id`-nya
    diperiksa terhadap `itinerary_log`, jadi payload tidak bisa dititipkan ke
    perjalanan orang lain.
    """

    judul: Optional[str] = Field(default=None, max_length=120)
    payload: dict


class TanggapanLaporanReq(BaseModel):
    status: Literal["BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"]
    tanggapan: Optional[str] = Field(default=None, max_length=2000)
