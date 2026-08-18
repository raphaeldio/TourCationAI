"""Konteks yang disuntikkan ke prompt /api/ai-search.

Dua sumber: ringkasan itinerary aktif dan cuplikan dataset (metadata + ulasan)
untuk tempat yang disebut dalam pertanyaan.

Prinsip yang dipegang di sini: SELURUH aritmetika dikerjakan di Python, bukan
diserahkan ke model. Subtotal makan per hari dan total keseluruhan dihitung di
`ringkas_konteks` lalu disodorkan jadi angka siap kutip.
"""

import os

from ..core.paths import DATA_DIR
from .solver_state import get_solver

_ULASAN_CACHE: dict = {}


def _muat_ulasan():
    """Muat tabel review & kuliner sekali, simpan di cache proses."""
    if _ULASAN_CACHE:
        return _ULASAN_CACHE
    import pandas as pd

    def _rd(nama):
        try:
            return pd.read_csv(os.path.join(DATA_DIR, nama))
        except Exception:  # noqa: BLE001 — file boleh tidak ada
            return pd.DataFrame()

    _ULASAN_CACHE["wisata"] = _rd("Dataset_HackathonTourism_-_IT_DEL__1_-wisata-v2_typed.csv")
    _ULASAN_CACHE["resto_hotel"] = _rd("Dataset_HackathonTourism_-_IT_DEL__1_-resto-hotel-v2_typed.csv")
    _ULASAN_CACHE["kuliner"] = _rd("Dataset_HackathonTourism_-_IT_DEL__1_-kuliner_typed.csv")
    return _ULASAN_CACHE


def _tempat_dalam_itinerary(it: dict) -> list:
    """Semua (jenis, nama) tempat dalam itinerary: wisata, resto opsi, hotel."""
    tempat, sudah = [], set()

    def _tambah(jenis, nama):
        if nama and nama not in sudah:
            sudah.add(nama)
            tempat.append((jenis, nama))

    _tambah("hotel", (it.get("hotel") or {}).get("name"))
    for d in it.get("days", []):
        for a in d.get("agenda", []):
            if a.get("kind") == "wisata":
                _tambah("wisata", (a.get("place") or {}).get("name"))
            else:
                for o in a.get("options", []):
                    _tambah("resto", o.get("name"))
    return tempat


def _skor_kecocokan(pertanyaan_lc: str, nama: str) -> int:
    """Seberapa yakin pertanyaan menyebut tempat ini. 0 = tidak disebut."""
    nama_lc = nama.lower()
    if nama_lc in pertanyaan_lc:
        return 100
    # kata khas nama (>=4 huruf, bukan kata umum) yang muncul di pertanyaan
    umum = {"danau", "toba", "pulau", "desa", "bukit", "pantai", "hotel",
            "resto", "restoran", "rumah", "makan", "wisata", "taman", "air",
            "batu", "kopi", "cafe", "coffee", "warung"}
    skor = 0
    for kata in nama_lc.replace("(", " ").replace(")", " ").split():
        if len(kata) >= 4 and kata not in umum and kata in pertanyaan_lc:
            skor += 1
    return skor


def cuplikan_dataset(pertanyaan: str, it: dict, maks_tempat: int = 2,
                     maks_review: int = 6) -> str:
    """
    Metadata (alamat, jam, menu) + review pengunjung untuk tempat dalam
    itinerary yang disebut di pertanyaan. Kosong bila tidak ada yang cocok.
    """
    if not it or it.get("status") != "Optimal":
        return "(tidak ada)"
    p_lc = pertanyaan.lower()

    kandidat = [(s, j, n) for (j, n) in _tempat_dalam_itinerary(it)
                if (s := _skor_kecocokan(p_lc, n)) > 0]
    if not kandidat:
        return "(tidak ada tempat spesifik yang disebut)"
    kandidat.sort(key=lambda x: -x[0])
    kandidat = kandidat[:maks_tempat]

    solver, _, _ = get_solver()
    tabel = _muat_ulasan()
    blok = []
    for _, jenis, nama in kandidat:
        baris = [f"## {nama} ({jenis})"]

        # --- metadata dari tabel utama -----------------------------------
        df_meta = {"wisata": solver.attractions, "resto": solver.restos,
                   "hotel": solver.hotels}[jenis]
        # Beberapa nama di dataset punya spasi ekor.
        m = df_meta[df_meta["place-name"].astype(str).str.strip() == nama.strip()]
        if len(m):
            r = m.iloc[0]
            for kol, label in [("address", "Alamat"), ("operational-hour", "Jam"),
                               ("opening-hours", "Jam"), ("recommend-menu", "Menu rekomendasi"),
                               ("Fasilitas", "Fasilitas"), ("place-rating", "Rating"),
                               ("harga_min", "Harga min"), ("harga_max", "Harga max")]:
                v = r.get(kol)
                if v is not None and str(v) not in ("nan", "None", ""):
                    baris.append(f"{label}: {v}")

        # --- review pengunjung -------------------------------------------
        df_rev = tabel["wisata"] if jenis == "wisata" else tabel["resto_hotel"]
        if len(df_rev) and "place-name" in df_rev.columns:
            cocok = df_rev[df_rev["place-name"].astype(str).str.strip() == nama.strip()]
            # Buang review rating-saja. Pakai notna(): pada pandas 3
            # astype(str) mempertahankan NaN, bukan mengubahnya jadi "nan".
            cocok = cocok[cocok["review-text"].notna()]
            cocok = cocok[cocok["review-text"].astype(str).str.strip() != ""]
            ulasan = cocok.head(maks_review)
            if len(ulasan):
                baris.append("Review pengunjung:")
                for _, u in ulasan.iterrows():
                    teks = str(u.get("review-text", ""))[:280].replace("\n", " ")
                    baris.append(f"- (⭐{u.get('reviewer-rating', '-')}) {teks}")

        # --- kuliner khas yang disebut dalam pertanyaan (untuk resto) -----
        if jenis == "resto" and len(tabel["kuliner"]):
            cocok = tabel["kuliner"][
                tabel["kuliner"]["kuliner-name"].str.lower().apply(lambda k: k in p_lc)
            ].head(2)
            for _, k in cocok.iterrows():
                baris.append(f"Kuliner khas '{k['kuliner-name']}': "
                             f"{str(k['description'])[:280]}")

        blok.append("\n".join(baris))

    hasil = "\n\n".join(blok)
    return hasil[:7000]  # jaga ukuran prompt


def ringkas_konteks(it: dict, picks: dict | None = None) -> str:
    """Ringkas itinerary jadi teks padat untuk konteks model.

    Seluruh penjumlahan biaya dikerjakan di sini, bukan diserahkan ke model.
    """
    if not it or it.get("status") != "Optimal":
        return "Belum ada itinerary yang dibuat."
    picks = picks or {}
    s = it.get("summary", {})
    baris = [
        f"Durasi: {s.get('n_days')} hari / {s.get('n_nights')} malam, "
        f"{s.get('n_orang')} orang. Profil: {s.get('profil')}.",
        f"Budget: Rp{s.get('budget_total'):,} | Estimasi terpakai: "
        f"Rp{s.get('total_estimasi'):,} ({s.get('persen_terpakai')}%).",
        f"Hotel: {it.get('hotel', {}).get('name')} "
        f"(⭐{it.get('hotel', {}).get('rating')}).",
    ]
    makan_total = 0
    for d in it.get("days", []):
        hari = d.get("day")
        baris.append(f"\n-- Hari {hari} (~{d.get('distance_km')} km) --")
        makan_hari = 0
        for a in d.get("agenda", []):
            if a.get("kind") == "wisata":
                p = a.get("place", {})
                baris.append(
                    f"  {a.get('time')} Wisata: {p.get('name')} "
                    f"(⭐{p.get('rating')}, Rp{p.get('price_per_person'):,}/orang, "
                    f"{p.get('kategori')})")
            else:
                opsi = a.get("options") or []
                if not opsi:
                    continue
                # Opsi pertama adalah default; turis boleh menukarnya di UI.
                idx = int(picks.get(f"{hari}-{a.get('slot')}", 0) or 0)
                if not 0 <= idx < len(opsi):
                    idx = 0
                dipilih = opsi[idx]
                harga = int(dipilih.get("price_group") or 0)
                makan_hari += harga
                baris.append(
                    f"  {a.get('time')} {a.get('slot')}: {dipilih.get('name')} "
                    f"— Rp{int(dipilih.get('price_per_person') or 0):,}/orang, "
                    f"Rp{harga:,} untuk {s.get('n_orang')} orang (DIPILIH)")
                lain = [
                    f"{o.get('name')} Rp{int(o.get('price_group') or 0):,}"
                    for j, o in enumerate(opsi[:4]) if j != idx
                ]
                if lain:
                    baris.append(f"      alternatif: {'; '.join(lain)}")
        makan_total += makan_hari
        baris.append(f"  >> Subtotal makan hari {hari}: Rp{makan_hari:,}")
    if it.get("days"):
        baris.append(
            f"\nTOTAL BIAYA MAKAN SELURUH PERJALANAN: Rp{makan_total:,} "
            f"(penjumlahan seluruh subtotal harian di atas, memakai tempat makan "
            f"yang sedang dipilih turis).")
    return "\n".join(baris)
