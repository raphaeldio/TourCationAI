from pydantic import BaseModel


class AISearchReq(BaseModel):
    question: str
    itinerary: dict | None = None             # konteks aktif; opsional
    picks: dict[str, int] | None = None       # "{hari}-{slot}" -> indeks opsi makan
