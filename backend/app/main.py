"""API FastAPI yang membungkus engine.py sebagai JSON untuk frontend React.

Tidak ada logika perencanaan di paket ini — seluruhnya milik engine.py.

    GET  /api/health        cek hidup
    GET  /api/meta          minat, profil, gaya jelajah untuk form UI
    GET  /api/languages     daftar bahasa penerjemah
    POST /api/itinerary     solver ILP + rute harian
    POST /api/ai-search     tanya-jawab dibumikan pada itinerary aktif
    POST /api/translate     terjemah teks bebas
    POST /api/translate-ui  terjemah label antarmuka

Menjalankan dari root repo:
    uvicorn backend.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import JUDUL_APP, VERSI_APP, asal_diizinkan
from .routers import (
    admin,
    ai_search,
    auth,
    gov,
    health,
    intel,
    itinerary,
    komunitas,
    languages,
    meta,
    perjalanan,
    simulasi,
    translate,
    umkm,
)


def create_app() -> FastAPI:
    app = FastAPI(title=JUDUL_APP, version=VERSI_APP)

    # Vite dev server jalan di 5173; longgarkan CORS untuk pengembangan lokal.
    # Bawaannya "*" seperti sebelumnya; bisa dipersempit lewat ALLOWED_ORIGINS.
    # allow_credentials sengaja dibiarkan mati — kombinasi "*" + credentials
    # ditolak browser, dan autentikasi memakai header Authorization, bukan cookie.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=asal_diizinkan(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Urutan pendaftaran menentukan urutan path di skema OpenAPI; dipertahankan
    # sama persis dengan urutan definisi pada backend/main.py sebelum dipecah.
    app.include_router(health.router)
    app.include_router(meta.router)
    app.include_router(languages.router)
    app.include_router(translate.router)
    app.include_router(itinerary.router)
    app.include_router(ai_search.router)
    # Router baru didaftarkan SETELAH tujuh endpoint asli supaya urutan path
    # pada skema OpenAPI yang lama tidak bergeser.
    app.include_router(intel.router)
    app.include_router(simulasi.router)
    app.include_router(umkm.router)
    app.include_router(auth.router)
    app.include_router(komunitas.router)
    app.include_router(perjalanan.router)
    app.include_router(admin.router)
    # Router GOV menulis (verifikasi usaha); intel hanya membaca. Sengaja
    # dipisah supaya berkas yang berbahaya tidak bersembunyi di dalam yang aman.
    app.include_router(gov.router)

    return app


app = create_app()
