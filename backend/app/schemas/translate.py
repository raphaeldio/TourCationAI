from typing import List

from pydantic import BaseModel


class TranslateReq(BaseModel):
    text: str
    source: str = "id"   # kode ISO-639-1, atau "auto" untuk deteksi otomatis
    target: str = "en"


class TranslateUIReq(BaseModel):
    strings: List[str]
    target: str = "en"
