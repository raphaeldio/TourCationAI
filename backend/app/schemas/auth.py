from typing import Literal, Optional

from pydantic import BaseModel, Field


class KlaimPeranReq(BaseModel):
    """Permohonan naik peran. USER tidak bisa memohon jadi ADMIN.

    GOV masih diterima skemanya agar permintaan lama tetap terbaca, tetapi
    endpoint /api/auth/klaim menolaknya: peran GOV ditentukan oleh alamat surel
    dinas, bukan oleh antrean persetujuan.
    """

    requested_role: Literal["UMKM", "GOV"]
    # UMKM: nama usaha yang diklaim (dicocokkan ke resto-metadata).
    umkm_place_name: Optional[str] = Field(default=None, max_length=200)
    # Sisa dari jalur GOV lama; disimpan untuk baris permohonan yang sudah ada.
    instansi: Optional[str] = Field(default=None, max_length=200)
    kabupaten: Optional[str] = Field(default=None, max_length=100)
    alasan: Optional[str] = Field(default=None, max_length=1000)


class BiodataReq(BaseModel):
    """Biodata pengguna.

    Hanya `nama_lengkap` yang wajib. Sisanya opsional dengan sengaja: formulir
    onboarding yang menahan pengguna sampai delapan kolom terisi akan diisi
    asal-asalan, dan data karangan lebih buruk daripada kolom kosong.

    `avatar_url` diterima dari klien karena nilainya berasal dari metadata
    Google, bukan dari ketikan pengguna — tetapi ia tetap dibatasi panjangnya
    dan tetap melewati sanitasi seperti field lain.
    """

    nama_lengkap: str = Field(min_length=1, max_length=120)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    telepon: Optional[str] = Field(default=None, max_length=40)
    kota_asal: Optional[str] = Field(default=None, max_length=100)
    negara: Optional[str] = Field(default=None, max_length=100)
    bahasa_utama: Optional[str] = Field(default=None, max_length=60)
    # "YYYY-MM-DD". Kewajaran tanggalnya diperiksa di router; batasan yang sama
    # juga ditegakkan database supaya jalur mana pun tidak bisa melewatinya.
    tanggal_lahir: Optional[str] = Field(default=None, max_length=10)
    # Opsi ketiga wajib ada: memaksa memilih salah satu dari dua membuat
    # sebagian orang mengisi data yang tidak benar.
    jenis_kelamin: Optional[
        Literal["LAKI_LAKI", "PEREMPUAN", "TIDAK_DISEBUTKAN"]
    ] = None


class KeputusanPeranReq(BaseModel):
    setuju: bool
    catatan: Optional[str] = Field(default=None, max_length=1000)


class AturLanggananReq(BaseModel):
    """Penetapan tier langganan oleh ADMIN.

    Pembayaran sengaja BELUM diimplementasikan pada tahap ini: gateway
    memerlukan badan hukum dan kredensial merchant yang di luar cakupan.
    Yang dibangun adalah strukturnya, dan ADMIN mengisi statusnya manual.
    """

    business_id: str
    plan: Literal["FREE", "GROWTH", "PRO"]
    # Kosong = tanpa tanggal akhir (dipakai untuk pilot).
    bulan: Optional[int] = Field(default=1, ge=0, le=36)
    catatan: Optional[str] = Field(default=None, max_length=500)
