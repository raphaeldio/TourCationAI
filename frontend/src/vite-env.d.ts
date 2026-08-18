/// <reference types="vite/client" />

// Tanpa deklarasi ini, tsconfig strict menolak akses import.meta.env.VITE_*.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VIDEO_URL?: string;
  readonly VITE_HERO_MEDIA_URL?: string;
  readonly VITE_HERO_FOTO_URL?: string;
  readonly VITE_BRAND_LOGO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
