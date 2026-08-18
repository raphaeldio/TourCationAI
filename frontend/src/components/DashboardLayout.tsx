import { LogOut, Menu, MoreHorizontal, Route, Search, UserCog, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../auth";
import { useT } from "../i18n";
import { cn } from "../lib/utils";

export interface ItemNav {
  ke: string;
  label: string;
  ikon: LucideIcon;
  lencana?: string | number;
}

interface Props {
  judulProduk: string;
  subJudul: string;
  ikonProduk: LucideIcon;
  nav: ItemNav[];
  namaPengguna: string;
  peranPengguna: string;
  children: React.ReactNode;
  /** Ditampilkan di bilah atas pada layar lebar. */
  placeholderCari?: string;
}

/**
 * Kerangka dashboard, disusun MOBILE-FIRST.
 *
 * Layar sempit  : bilah atas ringkas + navigasi tetap di BAWAH (jempol mudah
 *                 menjangkau), konten diberi padding bawah agar tidak tertutup.
 * Layar >= lg   : sidebar kiri tetap seperti pada referensi desain, navigasi
 *                 bawah disembunyikan.
 *
 * Menu laci hanya dipakai untuk item sekunder di layar sempit; item utama
 * selalu terlihat di navigasi bawah supaya tidak ada yang tersembunyi di balik
 * hamburger — pola yang terbukti lebih mudah dipakai di ponsel.
 */
export default function DashboardLayout({
  judulProduk,
  subJudul,
  ikonProduk: IkonProduk,
  nav,
  namaPengguna,
  peranPengguna,
  children,
  placeholderCari = "Cari...",
}: Props) {
  const [laciTerbuka, setLaciTerbuka] = useState(false);
  const lokasi = useLocation();
  const { profil, keluar } = useAuth();
  // Judul, subjudul, dan label navigasi diterjemahkan DI SINI, bukan di tiap
  // layout pemanggil: propnya berisi teks Indonesia, dan menerjemahkannya di
  // satu titik render membuat GovLayout maupun UmkmLayout ikut tercakup tanpa
  // masing-masing perlu memanggil useT() sendiri.
  const t = useT();

  // Identitas nyata dari sesi bila ada; prop hanya jadi cadangan supaya
  // komponen ini tetap bisa dirender di luar konteks login.
  const nama = profil?.email?.split("@")[0] ?? namaPengguna;
  const peran = profil?.peran ?? peranPengguna;

  // Tutup laci setiap kali pindah halaman; kalau tidak, ia tetap menutupi
  // konten tujuan setelah navigasi.
  useEffect(() => setLaciTerbuka(false), [lokasi.pathname]);

  // Navigasi bawah memuat empat item; sisanya dijangkau lewat tombol
  // "Lainnya" yang membuka laci. Tanpa tombol itu, item kelima dan seterusnya
  // hanya bisa ditemukan lewat hamburger di pojok atas — dan pengguna ponsel
  // yang belum pernah membuka aplikasi ini tidak akan menduga ada menu di sana.
  const utama = nav.slice(0, 4);
  const sisa = nav.slice(4);

  const tautan = (item: ItemNav, mode: "sidebar" | "laci") => (
    <NavLink
      key={item.ke}
      to={item.ke}
      end
      className={({ isActive }) =>
        cn(
          "sentuh flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
          mode === "laci" && "text-base",
          isActive
            ? "bg-brand-sage/15 text-brand-sage-ink"
            : "text-ink-soft hover:bg-ink/5 hover:text-ink",
        )
      }
    >
      <item.ikon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{t(item.label)}</span>
      {item.lencana != null && (
        <span className="rounded-full bg-brand-amber px-2 py-0.5 text-[11px] font-bold text-on-amber">
          {item.lencana}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="dash min-h-screen bg-surface-paper">
      {/* ── Sidebar (lg ke atas) ─────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink/10 bg-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-5 py-5 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sage-ink">
            <IkonProduk className="h-5 w-5 text-on-sage-ink" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-extrabold text-ink">
              {t(judulProduk)}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              {t(subJudul)}
            </span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">{nav.map((i) => tautan(i, "sidebar"))}</nav>

        <div className="space-y-1 border-t border-ink/10 p-3">
          {/* Pemilik UMKM dan pegawai dinas juga berwisata. Tanpa tautan ini,
              satu-satunya jalan ke perjalanan tersimpan adalah navbar halaman
              depan — yang tidak pernah terlihat dari dalam dashboard. */}
          <Link
            to="/saya"
            className="sentuh flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-ink/5"
          >
            <Route className="h-5 w-5" aria-hidden />
            {t("Perjalanan Saya")}
          </Link>
          <Link
            to="/akun"
            className="sentuh flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-ink/5"
          >
            <UserCog className="h-5 w-5" aria-hidden />
            {t("Akun saya")}
          </Link>
          <button
            type="button"
            onClick={keluar}
            className="sentuh flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition-colors hover:bg-ink/5"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            {t("Keluar")}
          </button>
        </div>
      </aside>

      {/* ── Bilah atas ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/95 backdrop-blur lg:pl-60">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setLaciTerbuka(true)}
            className="sentuh -ml-2 flex items-center justify-center rounded-xl px-2 text-ink-soft lg:hidden"
            aria-label={t("Buka menu")}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>

          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 no-underline lg:hidden"
            aria-label={t(judulProduk)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-sage-ink">
              <IkonProduk className="h-4 w-4 text-on-sage-ink" aria-hidden />
            </span>
            <span className="truncate font-display text-sm font-extrabold text-ink">
              {t(judulProduk)}
            </span>
          </Link>

          <div className="relative ml-auto hidden max-w-md flex-1 lg:ml-0 lg:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <input
              type="search"
              placeholder={t(placeholderCari)}
              className="h-10 w-full rounded-xl border border-ink/10 bg-surface-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-sage"
            />
          </div>

          <Link to="/akun" className="ml-auto flex items-center gap-2.5 no-underline lg:ml-4">
            <span className="hidden text-right sm:block">
              <span className="block max-w-[160px] truncate text-xs font-bold leading-tight text-ink">
                {nama}
              </span>
              <span className="block text-[10px] leading-tight text-ink-faint">{peran}</span>
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-sand/25 text-xs font-extrabold text-brand-sand-ink"
              aria-hidden
            >
              {nama.slice(0, 2).toUpperCase()}
            </span>
          </Link>
        </div>
      </header>

      {/* ── Laci navigasi (layar sempit) ─────────────────────────────── */}
      {laciTerbuka && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-brand-forest/40"
            onClick={() => setLaciTerbuka(false)}
            aria-label={t("Tutup menu")}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="font-display text-base font-extrabold text-ink">{t(judulProduk)}</span>
              <button
                type="button"
                onClick={() => setLaciTerbuka(false)}
                className="sentuh flex items-center justify-center rounded-xl px-2 text-ink-soft"
                aria-label={t("Tutup menu")}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3">{nav.map((i) => tautan(i, "laci"))}</nav>
            <div className="space-y-1 border-t border-ink/10 p-3">
              <Link
                to="/saya"
                onClick={() => setLaciTerbuka(false)}
                className="sentuh flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline"
              >
                <Route className="h-5 w-5" aria-hidden />
                {t("Perjalanan Saya")}
              </Link>
              <Link
                to="/akun"
                onClick={() => setLaciTerbuka(false)}
                className="sentuh flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline"
              >
                <UserCog className="h-5 w-5" aria-hidden />
                {t("Akun saya")}
              </Link>
              <button
                type="button"
                onClick={keluar}
                className="sentuh flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-soft"
              >
                <LogOut className="h-5 w-5" aria-hidden />
                {t("Keluar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Konten ───────────────────────────────────────────────────── */}
      <main className="px-4 pb-24 pt-4 sm:px-6 sm:pb-8 sm:pt-6 lg:pb-10 lg:pl-[264px] lg:pr-6">
        {children}
      </main>

      {/* ── Navigasi bawah (layar sempit) ────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 backdrop-blur lg:hidden">
        <ul className="flex">
          {utama.map((item) => (
            <li key={item.ke} className="flex-1">
              <NavLink
                to={item.ke}
                end
                className={({ isActive }) =>
                  cn(
                    "sentuh relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors",
                    isActive ? "text-brand-sage-ink" : "text-ink-faint",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.ikon className="h-5 w-5" aria-hidden />
                    <span className="max-w-full truncate px-1">{t(item.label)}</span>
                    {isActive && (
                      <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-sage-ink" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          {sisa.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setLaciTerbuka(true)}
                aria-expanded={laciTerbuka}
                className={cn(
                  "sentuh relative flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors",
                  sisa.some((i) => i.ke === lokasi.pathname)
                    ? "text-brand-sage-ink"
                    : "text-ink-faint",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate px-1">{t("Lainnya")}</span>
                {sisa.some((i) => i.ke === lokasi.pathname) && (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-sage-ink" />
                )}
              </button>
            </li>
          )}
        </ul>
        {/* Ruang aman untuk indikator gestur iOS. */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
