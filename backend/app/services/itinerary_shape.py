"""Pembentuk respons itinerary (bentuk ramah-frontend).

Tidak ada logika perencanaan di sini — seluruhnya milik engine.py. Modul ini
hanya menerjemahkan hasil solver + rute harian menjadi bentuk yang dipakai
kartu-kartu di UI.
"""

from typing import Optional

from ..core.paths import engine
from .solver_state import get_solver, kuliner_khas


def _sinyal_umkm(p: dict) -> Optional[dict]:
    """Rincian skor UMKM tempat makan; None untuk wisata & hotel."""
    if "skor_umkm" not in p:
        return None
    detail = engine.skor_umkm(p, kuliner_khas())
    return {
        "skor": detail["skor_umkm"],
        "kuat": detail["is_umkm_kuat"],
        "kuliner_khas": detail["kuliner_khas_disajikan"],
        "nama_lokal": detail["sinyal_nama_lokal"],
        "harga_terjangkau": detail["sinyal_harga_terjangkau"],
    }


def _fmt_place(p: dict, n_orang: int) -> dict:
    """Ubah satu record tempat jadi bentuk ringkas untuk kartu di UI."""
    mid = int(p.get("harga_tengah") or 0)
    return {
        "name": p.get("place-name"),
        "type": p.get("place-type"),
        "kategori": engine.minat_dari_tipe(p.get("place-type")) or "Wisata",
        "rating": p.get("place-rating"),
        "address": p.get("address"),
        "lat": p.get("latitude"),
        "lon": p.get("longitude"),
        "price_per_person": mid,
        "price_group": mid * max(int(n_orang), 1),
        "operational_hour": p.get("operational-hour"),
        "opening_hours": p.get("jam_operasional_str"),
        "closed_days": p.get("hari_tutup") or [],
        "hours_source": p.get("sumber_jam"),
        "warning": p.get("peringatan"),
        # Dikirim mentah agar frontend bisa menghitung ulang dampak UMKM
        # saat turis menukar pilihan makannya.
        "umkm": _sinyal_umkm(p),
    }


def _destinasi_terdekat(day: dict, dipakai: set, maks: int = 3) -> list:
    """Wisata terdekat dari titik terakhir hari itu yang belum masuk rencana."""
    solver, _, _ = get_solver()
    acuan = None
    for item in day.get("agenda", []):
        if item["jenis"] != "wisata":
            continue
        w = item["data"]
        if w.get("latitude") is not None and w.get("longitude") is not None:
            acuan = (float(w["latitude"]), float(w["longitude"]))
    if acuan is None:
        return []

    kandidat = []
    for _, r in solver.attractions.iterrows():
        nama = r.get("place-name")
        lat, lon = r.get("latitude"), r.get("longitude")
        if nama in dipakai or lat is None or lon is None:
            continue
        try:
            lat, lon = float(lat), float(lon)
        except (TypeError, ValueError):
            continue
        if lat != lat or lon != lon:  # NaN
            continue
        km = engine.haversine_km(acuan[0], acuan[1], lat, lon)
        kandidat.append({"name": str(nama), "lat": lat, "lon": lon, "km": round(km, 1)})
    kandidat.sort(key=lambda x: x["km"])
    return kandidat[:maks]


def _alamat_hari(day: dict) -> list:
    """Alamat yang tersentuh satu hari, termasuk opsi makan yang belum dipilih.

    Menentukan kabupaten mana saja yang dilewati untuk pencarian fasilitas umum.
    """
    alamat = []
    for w in day.get("wisata_terurut", []):
        alamat.append(w.get("address"))
    for r in day.get("resto", []):
        alamat.append(r.get("address"))
    for item in day.get("agenda", []):
        if item.get("jenis") == "makan":
            for o in item.get("opsi", []):
                alamat.append(o.get("address"))
    return [a for a in alamat if a]


def build_itinerary_payload(result: dict, routed: dict) -> dict:
    _, _, fasilitas = get_solver()
    n_orang = result.get("n_orang", 1)

    # Penyaring "Destinasi Terdekat" agar tidak menyarankan tempat yang sudah masuk.
    _dipakai = set()
    for d in routed.get("days", []):
        for item in d.get("agenda", []):
            if item["jenis"] == "wisata":
                _dipakai.add(item["data"].get("place-name"))

    days = []
    for d in routed.get("days", []):
        agenda = []
        for item in d.get("agenda", []):
            if item["jenis"] == "wisata":
                agenda.append({
                    "kind": "wisata",
                    "time": item.get("jam_str"),
                    "place": _fmt_place(item["data"], n_orang),
                })
            else:
                opsi = item.get("opsi") or []
                agenda.append({
                    "kind": "makan",
                    "time": item.get("jam_str"),
                    "slot": item.get("slot"),
                    "options": [_fmt_place(o, n_orang) for o in opsi],
                })
        feri = [
            {
                "dari": p.get("dari"),
                "ke": p.get("ke"),
                "keterangan": engine.format_info_feri(p.get("info")),
            }
            for p in d.get("penyeberangan", [])
        ]
        kab_hari = fasilitas.kabupaten_dari_alamat(_alamat_hari(d))
        days.append({
            "day": d["hari"],
            "weekday": d.get("hari_nama"),
            "kabupaten": kab_hari,
            "fasilitas": fasilitas.untuk_kabupaten(kab_hari, maks_per_jenis=4),
            "distance_km": d.get("total_jarak_km"),
            "drive_minutes": d.get("total_durasi_menit"),
            "n_wisata": len(d.get("wisata_terurut", [])),
            "agenda": agenda,
            "nearby": _destinasi_terdekat(d, _dipakai),
            "penyeberangan": feri,
        })

    landmarks = sorted(
        (_fmt_place(a, n_orang) for a in result.get("attractions", [])),
        key=lambda x: (x.get("rating") or 0), reverse=True,
    )

    hotel = result["hotel"][0]
    dl = result.get("dampak_lokal") or {}

    # Cadangan transport dari solver (perkiraan pulang-pergi) diganti hitungan
    # jarak rute sebenarnya + feri, lalu seluruh total disesuaikan.
    km_nyata = float(routed.get("total_jarak_semua_hari_km") or 0)
    transport = engine.hitung_biaya_transport(
        km_total=km_nyata,
        n_days=result.get("n_days", 1),
        n_orang=n_orang,
        moda=result.get("moda", "mobil"),
        n_penyeberangan=routed.get("total_penyeberangan", 0),
        data_dir=engine.DATA_DIR,
    )
    proxy = int(result.get("transport_proxy") or 0)
    selisih = transport["total"] - proxy

    budget = int(result.get("budget_total") or 0)
    total_est = int(result.get("total_estimasi") or 0) + selisih
    total_min = int(result.get("total_min") or 0) + selisih
    total_max = int(result.get("total_max") or 0) + selisih
    sisa = budget - total_est
    n_days_ = max(int(result.get("n_days") or 1), 1)

    return {
        "status": result.get("status"),
        "summary": {
            "budget_total": budget,
            # Seluruh total di bawah sudah termasuk transport (BBM/angkutan + feri).
            "total_estimasi": total_est,
            "total_min": total_min,
            "total_max": total_max,
            "sisa_estimasi": sisa,
            "persen_terpakai": round(total_est / budget * 100, 1) if budget else 0.0,
            "per_hari": int(total_est / n_days_),
            "per_orang": int(total_est / max(n_orang, 1)),
            "n_days": result.get("n_days"),
            "n_nights": result.get("n_nights"),
            "n_orang": n_orang,
            "profil": result.get("profil_turis"),
            "profil_deskripsi": result.get("profil_deskripsi"),
            "minat": result.get("minat_wisata"),
            "umkm_weight": result.get("umkm_weight_dipakai"),
            "lewat_budget": sisa < 0,
            # diterapkan | dilonggarkan | semua buka | tanpa data
            "jam_status": result.get("jam_status"),
            "wisata_ditolak_jam": result.get("wisata_ditolak_jam") or [],
            "tanggal_mulai": result.get("tanggal_mulai"),
        },
        "transport": transport,
        # Tanpa menginap, hotel tidak direkomendasikan — titik acuan yang dipakai.
        "hotel": None if int(result.get("n_nights") or 0) <= 0 else {
            "name": hotel.get("place-name"),
            "rating": hotel.get("place-rating"),
            "address": hotel.get("address"),
            "price": int(hotel.get("harga_tengah") or 0),
            "lat": hotel.get("latitude"),
            "lon": hotel.get("longitude"),
        },
        # Delapan kandidat teratas beserta dampaknya pada rencana: total biaya
        # dan jarak rata-rata wisata, masing-masing dari ILP yang dijalankan ulang.
        "hotel_kandidat": [] if int(result.get("n_nights") or 0) <= 0 else [
            {
                "name": k.get("place-name"),
                "rating": k.get("place-rating"),
                "address": k.get("address"),
                "price": int(k.get("harga_tengah") or 0),
                "lat": k.get("latitude"),
                "lon": k.get("longitude"),
                "total_estimasi": k.get("total_estimasi"),
                "jarak_rata2_wisata": k.get("jarak_rata2_wisata"),
                "terpilih": k.get("place-name") == hotel.get("place-name"),
            }
            for k in (result.get("hotel_kandidat") or [])
        ],
        "hotel_sumber": result.get("hotel_sumber"),   # dipilih_sistem | pilihan_turis
        # Pangkal rute: hotel acuan, atau lokasi turis bila tidak menginap.
        "titik_acuan": result.get("titik_acuan") or {
            "place-name": hotel.get("place-name"),
            "latitude": hotel.get("latitude"),
            "longitude": hotel.get("longitude"),
            "jenis": "hotel",
        },
        "days": days,
        "landmarks": landmarks,
        # Ringkasan kerja tiap modul engine untuk section "Analisis AI" di UI.
        "analisis": {
            # Budget Solver (ILP)
            "solver_status": result.get("status"),
            "n_wisata_terpilih": len(result.get("attractions", [])),
            "n_resto_terpilih": len(result.get("restos", [])),
            "total_min": result.get("total_min"),
            "total_max": result.get("total_max"),
            "hotel_gratis_pulang_hari": result.get("hotel_gratis_pulang_hari", False),
            # Route Optimizer
            "sumber_jarak": routed.get("sumber_jarak"),
            "total_jarak_km": routed.get("total_jarak_semua_hari_km"),
            "osrm_aktif": routed.get("sumber_jarak") in ("osrm", "campuran"),
            # Time-Aware Filter
            "jam_agenda": "07:00-19:00",
            "n_agenda": sum(len(d["agenda"]) for d in days),
            # Ferry Detector
            "total_penyeberangan": routed.get("total_penyeberangan", 0),
            # UMKM Scorer
            "umkm_weight": result.get("umkm_weight_dipakai"),
            "profil": result.get("profil_turis"),
            "profil_deskripsi": result.get("profil_deskripsi"),
        },
        "dampak_lokal": {
            "status": dl.get("status", "kosong"),
            "total_kunjungan_makan": dl.get("total_kunjungan_makan", 0),
            "usaha_unik_dikunjungi": dl.get("usaha_unik_dikunjungi", 0),
            "umkm_lokal_otentik": dl.get("umkm_lokal_otentik", 0),
            "proporsi_umkm": dl.get("proporsi_umkm", 0),
            "ragam_kuliner_khas": dl.get("ragam_kuliner_khas", 0),
            "daftar_kuliner_khas": dl.get("daftar_kuliner_khas", []),
            "sebaran_merata": dl.get("sebaran_merata", 0),
            "estimasi_kasar_ke_usaha_lokal": dl.get("estimasi_kasar_ke_usaha_lokal", 0),
        },
    }
