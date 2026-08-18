"""Titik masuk deploy — sengaja tipis.

Isi API sudah dipecah ke paket backend/app/. Berkas ini dipertahankan supaya
perintah yang sudah terpasang di render.yaml dan README tidak perlu diubah:

    uvicorn backend.main:app --host 0.0.0.0 --port $PORT

Jangan menambahkan logika di sini. Endpoint ada di backend/app/routers/,
pembentuk respons di backend/app/services/.
"""

from backend.app.main import app

__all__ = ["app"]
