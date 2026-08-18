import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import GaleriDetail from "./pages/GaleriDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./auth";
import { I18nProvider } from "./i18n";
import "./index.css";

// Dashboard dimuat terpisah: halaman "/" adalah yang pertama dibuka pengunjung
// dan tidak boleh ikut menanggung bundle Recharts.
const Bisnis = lazy(() => import("./pages/Bisnis"));
const Masuk = lazy(() => import("./pages/Masuk"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Akun = lazy(() => import("./pages/Akun"));
const Biodata = lazy(() => import("./pages/Biodata"));
const GovLayout = lazy(() => import("./pages/GovLayout"));
const GovDashboard = lazy(() => import("./pages/GovDashboard"));
const GapAnalysis = lazy(() => import("./pages/GapAnalysis"));
const Simulator = lazy(() => import("./pages/Simulator"));
const UmkmLayout = lazy(() => import("./pages/UmkmLayout"));
const UmkmDashboard = lazy(() => import("./pages/UmkmDashboard"));
const UsahaSaya = lazy(() => import("./pages/UsahaSaya"));
const LanggananUmkm = lazy(() => import("./pages/Langganan"));
const UmkmSuara = lazy(() => import("./pages/UmkmSuara"));
const UmkmAnalisis = lazy(() => import("./pages/UmkmAnalisis"));
const GovAspirasi = lazy(() => import("./pages/GovAspirasi"));
const GovPengumuman = lazy(() => import("./pages/GovPengumuman"));
const Saya = lazy(() => import("./pages/Saya"));
const UlasanPerjalanan = lazy(() => import("./pages/UlasanPerjalanan"));
const PerjalananTersimpan = lazy(() => import("./pages/PerjalananTersimpan"));
const GovLapangan = lazy(() => import("./pages/GovLapangan"));
const GovSelisihHarga = lazy(() => import("./pages/GovSelisihHarga"));
const GovVerifikasi = lazy(() => import("./pages/GovVerifikasi"));
const UmkmUmpanBalik = lazy(() => import("./pages/UmkmUmpanBalik"));

function Memuat() {
  return (
    <div className="min-h-screen bg-surface-paper p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="skel h-8 w-52 rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel h-32 rounded-2xl" />
          ))}
        </div>
        <div className="skel h-72 rounded-2xl" />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Memuat />}>
            <Routes>
              {/* Halaman publik — tidak berubah. */}
              <Route path="/" element={<App />} />
              <Route path="/galeri/:slug" element={<GaleriDetail />} />

              {/* Halaman harga publik — sengaja tanpa penjaga: calon pelanggan
                  harus bisa membacanya sebelum punya akun. */}
              <Route path="/bisnis" element={<Bisnis />} />

              <Route path="/masuk" element={<Masuk />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Perlu masuk, peran apa pun. */}
              <Route element={<ProtectedRoute peran={["USER", "UMKM", "GOV", "ADMIN"]} />}>
                {/* Onboarding biodata. Di dalam ProtectedRoute karena butuh
                    sesi, tetapi dikecualikan dari penjaga biodata di dalamnya
                    supaya tidak memantulkan dirinya sendiri. */}
                <Route path="/biodata" element={<Biodata />} />
                <Route path="/akun" element={<Akun />} />
                {/* Sisi wisatawan: jejak penilaian + jalan cepat menyusun rencana. */}
                <Route path="/saya" element={<Saya />} />
                {/* Ulasan pasca-perjalanan. Peran apa pun boleh: pemilik UMKM
                    dan pegawai dinas juga berwisata, dan kepemilikan perjalanan
                    ditegakkan per-baris di server, bukan lewat peran. */}
                <Route path="/perjalanan/:id/ulasan" element={<UlasanPerjalanan />} />
                {/* Membuka rencana tersimpan. Didaftarkan SESUDAH rute ulasan
                    supaya "/perjalanan/x/ulasan" tidak pernah tertangkap
                    sebagai id "x" dengan sisa path. */}
                <Route path="/perjalanan/:id" element={<PerjalananTersimpan />} />
              </Route>

              {/* Perlu peran GOV. Penjaga di sini hanya kenyamanan antarmuka;
                  penegakan sesungguhnya ada di wajib_peran() pada FastAPI. */}
              <Route element={<ProtectedRoute peran={["GOV", "ADMIN"]} />}>
                <Route path="/gov" element={<GovLayout />}>
                  <Route index element={<GovDashboard />} />
                  <Route path="gap" element={<GapAnalysis />} />
                  <Route path="simulasi" element={<Simulator />} />
                  <Route path="aspirasi" element={<GovAspirasi />} />
                  <Route path="lapangan" element={<GovLapangan />} />
                  <Route path="selisih-harga" element={<GovSelisihHarga />} />
                  <Route path="verifikasi" element={<GovVerifikasi />} />
                  <Route path="pengumuman" element={<GovPengumuman />} />
                </Route>
              </Route>

              {/* Perlu peran UMKM. */}
              <Route element={<ProtectedRoute peran={["UMKM", "ADMIN"]} />}>
                <Route path="/umkm" element={<UmkmLayout />}>
                  <Route index element={<UmkmDashboard />} />
                  <Route path="usaha" element={<UsahaSaya />} />
                  <Route path="analisis" element={<UmkmAnalisis />} />
                  <Route path="umpan-balik" element={<UmkmUmpanBalik />} />
                  <Route path="langganan" element={<LanggananUmkm />} />
                  <Route path="suara" element={<UmkmSuara />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
