from fastapi import APIRouter

from ..core.constants import BAHASA

router = APIRouter()


@router.get("/api/languages")
def languages():
    """Daftar bahasa untuk penerjemah (dipakai dropdown & Web Speech API)."""
    return {"languages": BAHASA}
