import { Loader2, ShieldAlert } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth, type Peran } from "../auth";
import { useT } from "../i18n";

interface Props {
  peran: Peran[];
}

/**
 * Penjaga route berbasis peran.
 *
 * Ini kenyamanan antarmuka, BUKAN batas keamanan. Batas yang sesungguhnya
 * ada di dependency wajib_peran() pada FastAPI: memalsukan state di peramban
 * hanya akan menampilkan kerangka halaman kosong, karena setiap permintaan
 * data tetap dijawab 403 oleh server.
 */
export default function ProtectedRoute({ peran }: Props) {
  const { memuat, sesi, profil, galatProfil, siap } = useAuth();
  const lokasi = useLocation();
  const t = useT();

  if (!siap) {
    return (
      <PesanBlokir
        judul={t("Login belum dikonfigurasi")}
        pesan={t(
          "Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi di frontend/.env, sehingga halaman berperan tidak dapat dibuka.",
        )}
      />
    );
  }

  // Profil gagal diambil (backend mati / salah konfigurasi) harus terlihat.
  // Menahannya di layar berputar membuat pengguna menunggu tanpa petunjuk.
  if (sesi && !profil && galatProfil) {
    return <PesanBlokir judul={t("Profil tidak terbaca")} pesan={t(galatProfil)} />;
  }

  if (memuat || (sesi && !profil)) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-surface-paper">
        <Loader2 className="h-6 w-6 animate-spin text-brand-sage-ink" aria-hidden />
        <span className="text-sm font-semibold text-ink-soft">{t("Memeriksa akses...")}</span>
      </div>
    );
  }

  if (!sesi) {
    return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;
  }

  // Onboarding biodata: satu kali, sebelum halaman berperan apa pun terbuka.
  //
  // Diletakkan di sini karena ProtectedRoute adalah satu-satunya tempat yang
  // dilewati SETIAP halaman untuk pengguna yang sudah masuk. Menaruhnya di
  // Masuk.tsx saja tidak cukup: sesi Supabase bertahan di localStorage, jadi
  // pengunjung berikutnya masuk langsung ke /saya atau /umkm tanpa pernah
  // melewati halaman masuk.
  //
  // `/biodata` sendiri dikecualikan — tanpa itu halaman tujuannya memantulkan
  // dirinya sendiri tanpa henti.
  //
  // `biodata_lengkap` bisa `undefined` bila backend-nya versi lama; itu
  // diperlakukan sebagai SUDAH lengkap. Memblokir seluruh aplikasi karena satu
  // field yang tidak dikenali adalah kegagalan yang jauh lebih besar daripada
  // onboarding yang terlewat.
  if (profil && profil.biodata_lengkap === false && lokasi.pathname !== "/biodata") {
    return <Navigate to="/biodata" replace state={{ dari: lokasi.pathname }} />;
  }

  const boleh = profil ? peran.includes(profil.peran) : false;
  if (!boleh) {
    return (
      <PesanBlokir
        judul={t("Akses ditolak")}
        pesan={
          `${t("Halaman ini memerlukan peran")} ${peran.join(` ${t("atau")} `)}. ` +
          `${t("Peran akun Anda saat ini")} ${profil?.peran ?? "USER"}.`
        }
        tautanAkun
      />
    );
  }

  return <Outlet />;
}

function PesanBlokir({
  judul,
  pesan,
  tautanAkun = false,
}: {
  judul: string;
  pesan: string;
  tautanAkun?: boolean;
}) {
  // Komponen ini berada di lingkup modul, di luar ProtectedRoute — jadi ia
  // butuh hook-nya sendiri; `judul` dan `pesan` sudah diterjemahkan pemanggil.
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-paper px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-amber/20">
          <ShieldAlert className="h-6 w-6 text-brand-amber-ink" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-lg font-extrabold text-ink">{judul}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pesan}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {tautanAkun && (
            <Link
              to="/akun"
              className="sentuh flex items-center justify-center rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-bold text-on-sage-ink no-underline"
            >
              {t("Ajukan peran")}
            </Link>
          )}
          <Link
            to="/"
            className="sentuh flex items-center justify-center rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-bold text-ink no-underline"
          >
            {t("Kembali ke beranda")}
          </Link>
        </div>
      </div>
    </div>
  );
}
