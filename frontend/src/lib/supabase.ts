import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Klien Supabase untuk autentikasi.
 *
 * Dibuat MALAS dan boleh bernilai null: bila variabel lingkungan belum diisi,
 * seluruh halaman publik harus tetap berjalan normal dan hanya tombol masuk
 * yang dinonaktifkan. Melempar galat saat impor akan mematikan seluruh
 * aplikasi hanya karena login belum dikonfigurasi.
 *
 * Kedua nilai di bawah memang publik. Yang RAHASIA adalah service_role key,
 * dan itu hanya ada di .env root repo untuk backend — tidak pernah di sini.
 */
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KUNCI_PUBLIK = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authSiap = Boolean(URL_SUPABASE && KUNCI_PUBLIK);

let klien: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!authSiap) return null;
  if (!klien) {
    klien = createClient(URL_SUPABASE!, KUNCI_PUBLIK!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return klien;
}
