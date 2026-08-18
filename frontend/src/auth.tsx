import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authSiap, supabase } from "./lib/supabase";

export type Peran = "USER" | "UMKM" | "GOV" | "ADMIN";

export type JenisKelamin = "LAKI_LAKI" | "PEREMPUAN" | "TIDAK_DISEBUTKAN";

/** Biodata pengguna. Semua opsional kecuali `full_name` saat dikirim. */
export interface Biodata {
  full_name: string | null;
  avatar_url: string | null;
  telepon: string | null;
  kota_asal: string | null;
  negara: string | null;
  bahasa_utama: string | null;
  /** "YYYY-MM-DD" */
  tanggal_lahir: string | null;
  jenis_kelamin: JenisKelamin | null;
}

export interface ProfilSaya {
  id: string;
  email: string | null;
  peran: Peran;
  kabupaten: string | null;
  permohonan_tertunda: {
    id: string;
    requested_role: string;
    status: string;
    created_at: string;
  } | null;
  boleh: { gov: boolean; umkm: boolean; admin: boolean };
  /** Domain surel yang otomatis berperan GOV, mis. ["go.id"]. */
  domain_gov?: string[];
  biodata?: Biodata;
  /**
   * Pemicu halaman onboarding `/biodata`.
   *
   * Diturunkan server dari penanda waktu `biodata_lengkap_pada`, bukan dari
   * kekosongan field: mengosongkan nomor telepon tidak boleh membuat seseorang
   * dipaksa mengisi ulang formulir yang sama.
   */
  biodata_lengkap?: boolean;
}

interface NilaiAuth {
  siap: boolean;
  memuat: boolean;
  sesi: Session | null;
  profil: ProfilSaya | null;
  /** Berisi pesan bila pengambilan profil GAGAL — bukan sekadar belum selesai.
   *  Tanpa pembeda ini, halaman callback menunggu selamanya saat backend mati. */
  galatProfil: string | null;
  masukGoogle: () => Promise<void>;
  keluar: () => Promise<void>;
  muatUlangProfil: () => Promise<void>;
}

const KonteksAuth = createContext<NilaiAuth | null>(null);

/**
 * Token akses terkini untuk dilampirkan ke permintaan API.
 *
 * Dibaca dari sesi Supabase setiap kali dipakai, bukan disimpan di modul:
 * token bisa di-refresh otomatis di latar belakang, dan salinan basi akan
 * menghasilkan 401 yang membingungkan.
 */
export async function kepalaAuth(): Promise<Record<string, string>> {
  const sb = supabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<Session | null>(null);
  const [profil, setProfil] = useState<ProfilSaya | null>(null);
  const [galatProfil, setGalatProfil] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(authSiap);

  const ambilProfil = useCallback(async (aktif: Session | null) => {
    if (!aktif) {
      setProfil(null);
      setGalatProfil(null);
      return;
    }
    try {
      const r = await fetch("/api/auth/saya", {
        headers: { Authorization: `Bearer ${aktif.access_token}` },
      });
      if (r.ok) {
        setProfil((await r.json()) as ProfilSaya);
        setGalatProfil(null);
        return;
      }
      // Gangguan tidak boleh membuat pengguna tampak punya peran — profil
      // tetap null — tetapi HARUS terlihat, bukan menggantung diam-diam.
      setProfil(null);
      let pesan = `Server membalas ${r.status}.`;
      if (r.status === 503) {
        pesan =
          "Server belum dikonfigurasi untuk autentikasi (SUPABASE_URL / " +
          "SUPABASE_SERVICE_ROLE_KEY belum terbaca). Coba restart backend.";
      } else if (r.status === 401) {
        pesan = "Token tidak diterima server. Coba masuk ulang.";
      }
      setGalatProfil(pesan);
    } catch {
      setProfil(null);
      setGalatProfil(
        "Tidak dapat menghubungi server di /api. Pastikan backend berjalan " +
          "di port 8000 (uvicorn backend.main:app --port 8000).",
      );
    }
  }, []);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setMemuat(false);
      return;
    }

    let batal = false;

    sb.auth.getSession().then(async ({ data }) => {
      if (batal) return;
      setSesi(data.session);
      await ambilProfil(data.session);
      if (!batal) setMemuat(false);
    });

    const { data: langganan } = sb.auth.onAuthStateChange(async (_peristiwa, baru) => {
      if (batal) return;
      setSesi(baru);
      await ambilProfil(baru);
      if (!batal) setMemuat(false);
    });

    return () => {
      batal = true;
      langganan.subscription.unsubscribe();
    };
  }, [ambilProfil]);

  const masukGoogle = useCallback(async () => {
    const sb = supabase();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, []);

  const keluar = useCallback(async () => {
    const sb = supabase();
    if (!sb) return;
    await sb.auth.signOut();
    setProfil(null);
  }, []);

  const muatUlangProfil = useCallback(async () => {
    await ambilProfil(sesi);
  }, [ambilProfil, sesi]);

  const nilai = useMemo<NilaiAuth>(
    () => ({
      siap: authSiap,
      memuat,
      sesi,
      profil,
      galatProfil,
      masukGoogle,
      keluar,
      muatUlangProfil,
    }),
    [memuat, sesi, profil, galatProfil, masukGoogle, keluar, muatUlangProfil],
  );

  return <KonteksAuth.Provider value={nilai}>{children}</KonteksAuth.Provider>;
}

export function useAuth(): NilaiAuth {
  const nilai = useContext(KonteksAuth);
  if (!nilai) throw new Error("useAuth harus dipakai di dalam <AuthProvider>.");
  return nilai;
}
