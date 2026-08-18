import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ambilLangganan } from "./apiUmkm";
import type { KunciPaket, PaketPublik, StatusLangganan } from "./typesUmkm";

/**
 * Status paket usaha yang sedang masuk, dibagi ke seluruh halaman UMKM.
 *
 * Dipasang sekali di UmkmLayout. Tanpa ini setiap halaman memanggil
 * /api/umkm/langganan sendiri — empat permintaan untuk satu jawaban yang sama,
 * dan yang lebih buruk: navigasi tidak bisa menandai fitur mana yang terkunci
 * karena hanya isi halaman yang tahu.
 *
 * Kegagalan memuat TIDAK memblokir apa pun. `langganan` tetap null dan seluruh
 * fitur diperlakukan sebagai terkunci-tanpa-kepastian; gerbang sesungguhnya ada
 * di FastAPI, jadi tebakan optimistis di sini hanya akan berubah jadi galat
 * yang lebih membingungkan satu klik kemudian.
 */

export type FiturPaket = "advisor" | "kompetitor" | "ekspor" | "riwayat";

/** Paket terendah yang memuat tiap fitur. Cerminan PAKET di services/langganan.py. */
export const PAKET_MINIMAL: Record<FiturPaket, KunciPaket> = {
  advisor: "GROWTH",
  kompetitor: "GROWTH",
  ekspor: "PRO",
  // Riwayat tersedia di semua tier; yang berbeda hanya panjang jendelanya.
  riwayat: "FREE",
};

export const NAMA_PAKET: Record<KunciPaket, string> = {
  FREE: "Gratis",
  GROWTH: "Growth",
  PRO: "Pro",
};

interface NilaiPaket {
  langganan: StatusLangganan | null;
  katalog: PaketPublik[];
  memuat: boolean;
  galat: string | null;
  muatUlang: () => Promise<void>;
  /** Apakah paket berjalan sudah memuat fitur ini. */
  punya: (fitur: FiturPaket) => boolean;
}

const KonteksPaket = createContext<NilaiPaket>({
  langganan: null,
  katalog: [],
  memuat: true,
  galat: null,
  muatUlang: async () => {},
  punya: () => false,
});

export function PaketProvider({ children }: { children: ReactNode }) {
  const [langganan, setLangganan] = useState<StatusLangganan | null>(null);
  const [katalog, setKatalog] = useState<PaketPublik[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    setMemuat(true);
    try {
      const d = await ambilLangganan();
      setLangganan(d.langganan);
      setKatalog(d.paket);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);

  const nilai = useMemo<NilaiPaket>(() => {
    // Dibaca dari field statusnya, bukan dari nama paket: kalau suatu saat
    // isi tier berubah di services/langganan.py, halaman ikut berubah tanpa
    // ada satu pun daftar kedua yang harus diingat.
    const punya = (fitur: FiturPaket): boolean => {
      if (!langganan) return false;
      switch (fitur) {
        case "advisor":
          return langganan.kuota_advisor > 0;
        case "kompetitor":
          return langganan.analisis_kompetitor;
        case "ekspor":
          return langganan.ekspor_csv;
        case "riwayat":
          return true;
        default:
          return false;
      }
    };
    return { langganan, katalog, memuat, galat, muatUlang, punya };
  }, [langganan, katalog, memuat, galat, muatUlang]);

  return <KonteksPaket.Provider value={nilai}>{children}</KonteksPaket.Provider>;
}

export function usePaket(): NilaiPaket {
  return useContext(KonteksPaket);
}
