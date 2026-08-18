"""Resolusi path repo dan impor engine.

Modul ini WAJIB diimpor lebih dulu oleh modul lain yang membutuhkan `engine`,
karena di sinilah root repo disisipkan ke sys.path.

engine.py berada di root repo (satu tingkat di atas backend/), bukan di dalam
paket ini. Penyisipan sys.path membuat `import engine` berhasil apa pun
direktori kerja saat uvicorn dijalankan.
"""

import os
import sys

# backend/app/core/paths.py -> naik tiga tingkat = root repo
ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import engine  # noqa: E402,F401  (harus setelah sys.path diatur; di-reexport)

DATA_DIR = os.path.join(ROOT, "data")

__all__ = ["ROOT", "DATA_DIR", "engine"]
