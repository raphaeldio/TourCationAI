"""Konstanta yang dipakai lintas router."""

# Label ditulis dalam bahasa masing-masing; `stt` dipakai Web Speech API.
BAHASA = [
    {"code": "id", "label": "Indonesia",  "stt": "id-ID"},
    {"code": "en", "label": "English",    "stt": "en-US"},
    {"code": "ar", "label": "العربية",     "stt": "ar-SA"},
    {"code": "zh", "label": "中文",        "stt": "zh-CN"},
    {"code": "ja", "label": "日本語",      "stt": "ja-JP"},
    {"code": "ko", "label": "한국어",      "stt": "ko-KR"},
    {"code": "fr", "label": "Français",   "stt": "fr-FR"},
    {"code": "de", "label": "Deutsch",    "stt": "de-DE"},
    {"code": "es", "label": "Español",    "stt": "es-ES"},
    {"code": "pt", "label": "Português",  "stt": "pt-PT"},
    {"code": "ru", "label": "Русский",    "stt": "ru-RU"},
    {"code": "it", "label": "Italiano",   "stt": "it-IT"},
    {"code": "nl", "label": "Nederlands", "stt": "nl-NL"},
    {"code": "tr", "label": "Türkçe",     "stt": "tr-TR"},
    {"code": "vi", "label": "Tiếng Việt", "stt": "vi-VN"},
    {"code": "th", "label": "ภาษาไทย",    "stt": "th-TH"},
    {"code": "ms", "label": "Melayu",     "stt": "ms-MY"},
    {"code": "btk", "label": "Batak Toba", "stt": "id-ID"},
]

NAMA_BAHASA = {b["code"]: b["label"] for b in BAHASA}
