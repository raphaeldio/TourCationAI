/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Berkas logo brand di navbar — lihat src/config.ts. */
  readonly VITE_BRAND_LOGO_URL?: string;
  /** Link video latar hero — lihat src/config.ts. */
  readonly VITE_HERO_VIDEO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
