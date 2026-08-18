from fastapi import APIRouter, HTTPException, Request

from ..core.config import model_openai
from ..core.llm import klien, pastikan_kunci
from ..core.ratelimit import batasi
from ..schemas.ai_search import AISearchReq
from ..services.ai_context import cuplikan_dataset, ringkas_konteks

router = APIRouter()


@router.post("/api/ai-search")
def ai_search(req: AISearchReq, request: Request):
    """Tanya-jawab seputar Danau Toba, dibumikan pada itinerary aktif.

    Angka konkret (harga, jam, jarak) hanya boleh dikutip dari konteks yang
    disuntikkan; pengetahuan umum model wajib ditandai bukan dari dataset.
    """
    batasi(request, "ai-search")
    api_key = pastikan_kunci()

    pertanyaan = (req.question or "").strip()
    if not pertanyaan:
        raise HTTPException(400, "Pertanyaan kosong.")

    konteks = ringkas_konteks(req.itinerary, req.picks)
    # Kutipan review/menu untuk tempat dalam itinerary yang disebut di pertanyaan.
    cuplikan = cuplikan_dataset(pertanyaan, req.itinerary)
    model = model_openai()

    system = (
        "Kamu asisten perjalanan TourCation AI untuk kawasan Danau Toba, "
        "Sumatera Utara. Jawab ringkas, hangat, dan dalam Bahasa Indonesia.\n\n"
        "Cara memilih sumber jawaban, berurutan:\n"
        "1) ANGKA KONKRET — harga, jam buka, jarak, rating, nama hotel, isi "
        "agenda harian — WAJIB diambil dari DATA ITINERARY dan CUPLIKAN "
        "DATASET di bawah. Jangan pernah mengarang atau memperkirakan angka "
        "yang tidak ada di sana. Kalau datanya tidak ada, katakan terus terang "
        "bahwa angkanya tidak tersedia di data aplikasi.\n"
        "   Untuk pertanyaan biaya makan, pakai baris 'Subtotal makan hari N' "
        "dan 'TOTAL BIAYA MAKAN' yang sudah dihitung di DATA ITINERARY — jangan "
        "menjumlahkan sendiri. Harga per tempat sudah untuk seluruh rombongan; "
        "sebutkan tempat mana yang dihitung agar turis bisa memeriksanya.\n"
        "2) PERTANYAAN UMUM seputar Danau Toba — budaya dan adat Batak, "
        "sejarah kaldera, transportasi dan feri, kuliner khas, cuaca dan musim "
        "terbaik, etiket saat berkunjung, tips UMKM lokal — boleh kamu jawab "
        "dari pengetahuan umummu. Saat melakukannya, beri tahu pembaca bahwa "
        "itu pengetahuan umum, bukan dari dataset aplikasi, dan sarankan "
        "verifikasi untuk hal yang berubah-ubah seperti jadwal atau tarif.\n"
        "3) DI LUAR TOPIK Danau Toba dan perjalanan — arahkan kembali dengan "
        "sopan ke hal yang bisa kamu bantu.\n\n"
        "Bila DATA ITINERARY menyatakan belum ada rencana, tetap layani "
        "pertanyaan umum seperti poin 2, lalu ajak pengguna menyusun rencana "
        "lewat panel Atur Perjalanan agar jawabanmu bisa lebih spesifik.\n\n"
        f"=== DATA ITINERARY ===\n{konteks}\n=== AKHIR DATA ===\n\n"
        f"=== CUPLIKAN DATASET ===\n{cuplikan}\n=== AKHIR CUPLIKAN ==="
    )

    try:
        client = klien(api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": pertanyaan}],
            temperature=0.3,
            max_tokens=900,
        )
        return {"answer": resp.choices[0].message.content.strip()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Gagal memanggil AI: {e}")
