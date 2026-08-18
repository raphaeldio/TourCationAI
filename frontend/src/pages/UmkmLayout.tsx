import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Star,
  Store,
  Utensils,
} from "lucide-react";
import { Outlet } from "react-router-dom";

import DashboardLayout from "../components/DashboardLayout";
import { PaketProvider } from "../paket";

/**
 * Urutannya mengikuti alur kerja pemilik usaha, bukan urutan pembangunan fitur:
 * lihat keadaan (Beranda) → isi dan rawat dagangan (Usaha & Produk) → dengar
 * kata pengunjung (Umpan Balik) → periksa posisi (Analisis Pasar) → urusan
 * dengan dinas (Suara) → urusan dengan kami (Langganan).
 *
 * Umpan Balik ditaruh sebelum Analisis Pasar dengan sengaja: pendapat orang yang
 * baru saja datang lebih mendesak — dan lebih bisa ditindaklanjuti — daripada
 * posisi relatif terhadap kompetitor.
 *
 * Empat yang pertama adalah yang muncul di navigasi bawah pada ponsel; sisanya
 * masuk laci lewat tombol "Lainnya" (lihat DashboardLayout).
 */
const NAV = [
  { ke: "/umkm", label: "Beranda", ikon: LayoutDashboard },
  { ke: "/umkm/usaha", label: "Usaha & Produk", ikon: Utensils },
  { ke: "/umkm/umpan-balik", label: "Umpan Balik", ikon: Star },
  { ke: "/umkm/analisis", label: "Analisis Pasar", ikon: BarChart3 },
  { ke: "/umkm/suara", label: "Suara & Pengumuman", ikon: MessageSquare },
  { ke: "/umkm/langganan", label: "Langganan", ikon: CreditCard },
];

export default function UmkmLayout() {
  return (
    // Status paket dimuat sekali di sini: navigasi, beranda, dan tiap halaman
    // fitur sama-sama perlu tahu apa yang termasuk paket berjalan.
    <PaketProvider>
      <DashboardLayout
        judulProduk="TourCation"
        subJudul="Dashboard UMKM"
        ikonProduk={Store}
        nav={NAV}
        namaPengguna="Pemilik Usaha"
        peranPengguna="UMKM Mitra"
        placeholderCari="Cari produk atau pesanan..."
      >
        <Outlet />
      </DashboardLayout>
    </PaketProvider>
  );
}
