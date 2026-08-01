import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend memanggil backend FastAPI di :8000. Proxy /api supaya di dev tidak
// perlu urus CORS dan URL bisa relatif ("/api/...").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
