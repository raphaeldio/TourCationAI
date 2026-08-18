import {
  Flag,
  Inbox,
  LayoutDashboard,
  Landmark,
  LineChart,
  Megaphone,
  Radar,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Outlet } from "react-router-dom";

import DashboardLayout from "../components/DashboardLayout";

// Item nav ditambahkan hanya ketika halamannya sudah ada — tautan yang
// mengarah ke halaman kosong lebih merugikan daripada menu yang pendek.
const NAV = [
  { ke: "/gov", label: "Ikhtisar", ikon: LayoutDashboard },
  { ke: "/gov/gap", label: "Kesenjangan", ikon: Radar },
  { ke: "/gov/simulasi", label: "Simulasi", ikon: LineChart },
  { ke: "/gov/aspirasi", label: "Aspirasi", ikon: Inbox },
  // Diletakkan tepat setelah Aspirasi: keduanya kotak masuk, kosakata statusnya
  // sama, dan petugas yang sama membukanya berurutan.
  { ke: "/gov/lapangan", label: "Laporan Lapangan", ikon: Flag },
  // Tepat setelah Laporan Lapangan: keduanya seri berbasis database yang
  // mengukur keadaan nyata, bukan proksi ulasan. Yang satu pengamatan
  // wisatawan, yang satu harga yang dilaporkan pemilik usaha.
  { ke: "/gov/selisih-harga", label: "Selisih Harga", ikon: Scale },
  // Satu-satunya menu dinas yang MENULIS, dan yang ditulisnya menyangkut akun
  // orang lain. Ditaruh paling bawah bersama Pengumuman — sesama tindakan,
  // terpisah dari menu-menu yang hanya menyajikan angka.
  { ke: "/gov/verifikasi", label: "Verifikasi Usaha", ikon: ShieldCheck },
  { ke: "/gov/pengumuman", label: "Pengumuman", ikon: Megaphone },
];

export default function GovLayout() {
  return (
    <DashboardLayout
      judulProduk="TourCation"
      subJudul="Dashboard Pemerintah"
      ikonProduk={Landmark}
      nav={NAV}
      namaPengguna="Dinas Pariwisata"
      peranPengguna="Pemerintah Daerah"
      placeholderCari="Cari destinasi atau kabupaten..."
    >
      <Outlet />
    </DashboardLayout>
  );
}
