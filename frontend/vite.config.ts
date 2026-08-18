import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const akar = path.dirname(fileURLToPath(import.meta.url));

// Frontend memanggil backend FastAPI di :8000. Proxy /api supaya di dev tidak
// perlu urus CORS dan URL bisa relatif ("/api/...").
export default defineConfig({
  plugins: [react()],
  // Alias "@/" dipakai berkas baru (termasuk komponen dari shadcn & ReactBits).
  // Import relatif yang sudah ada tetap berfungsi — keduanya bisa berdampingan,
  // jadi tidak ada migrasi massal yang perlu dilakukan.
  resolve: {
    alias: { "@": path.resolve(akar, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  // CATATAN: jangan tambahkan manualChunks untuk recharts.
  //
  // Menaruhnya di chunk bernama justru membuat Rollup menjadikannya dependensi
  // STATIS dari entry, sehingga index.html ikut mem-preload-nya dan halaman "/"
  // menanggung ~156 KB gz yang seharusnya hanya dimuat saat dashboard dibuka.
  // Pemisahan otomatis Vite sudah menghormati batas dynamic import pada
  // React.lazy — biarkan ia bekerja sendiri.
});
