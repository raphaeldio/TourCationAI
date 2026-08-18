import {
  BookmarkCheck,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Route,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ambilPerjalananSaya } from "../apiPerjalanan";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { cn } from "../lib/utils";
import type { Perjalanan } from "../typesPerjalanan";

/** Berapa perjalanan yang ditampilkan langsung di dalam menu. */
const PRATINJAU = 3;

/**
 * Menu akun di navbar: profil ringkas + perjalanan yang tersimpan.
 *
 * **Sengaja tanpa pustaka menu.** Catatan lama di Navbar sudah menetapkan
 * alasannya dan masih berlaku: satu dropdown Radix menambah ~32 KB gz ke
 * halaman depan — halaman yang pertama dibuka setiap pengunjung, termasuk yang
 * belum punya akun dan tidak akan pernah membuka menu ini. Perilaku yang
 * benar-benar dibutuhkan cuma tiga: klik untuk buka, klik di luar untuk tutup,
 * Escape untuk tutup. Ketiganya di bawah 20 baris.
 *
 * **Daftar perjalanan diambil saat menu DIBUKA, bukan saat navbar dirender.**
 * Kalau diambil di mount, setiap kunjungan ke halaman depan menembak
 * `/api/saya/perjalanan` walau menunya tidak pernah disentuh — permintaan yang
 * tidak pernah dibaca siapa pun. Sekali diambil, hasilnya dipakai ulang.
 */
export default function MenuAkun({ scrolled }: { scrolled: boolean }) {
  const t = useT();
  const { sesi, profil, keluar } = useAuth();
  const [buka, setBuka] = useState(false);
  const [perjalanan, setPerjalanan] = useState<Perjalanan[] | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  const muat = useCallback(async () => {
    try {
      const d = await ambilPerjalananSaya();
      setPerjalanan(d.perjalanan);
    } catch {
      // Menu tetap berguna tanpa daftar perjalanan: profil dan tautannya utuh.
      // Menampilkan galat di dalam menu navbar hanya menakuti tanpa memberi
      // jalan keluar.
      setPerjalanan([]);
    }
  }, []);

  useEffect(() => {
    if (buka && perjalanan === null) void muat();
  }, [buka, perjalanan, muat]);

  // Tutup saat klik di luar atau Escape. `mousedown`, bukan `click`: dengan
  // `click`, menekan tautan di dalam menu kadang menutup menu sebelum
  // navigasinya jalan.
  useEffect(() => {
    if (!buka) return;
    const onLuar = (e: MouseEvent) => {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    document.addEventListener("mousedown", onLuar);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onLuar);
      document.removeEventListener("keydown", onEsc);
    };
  }, [buka]);

  const kelasPemicu = cn(
    "sentuh flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold no-underline transition",
    scrolled
      ? "border-ink/10 bg-ink/[0.05] text-ink hover:border-brand-sage/45"
      : "border-white/35 bg-white/20 text-white backdrop-blur-md hover:border-white/60",
  );

  // Belum masuk: tetap tautan biasa, tanpa menu. Tidak ada yang bisa
  // ditampilkan di dalamnya, dan menu kosong lebih membingungkan daripada
  // tombol yang langsung menuju halaman masuk.
  if (!sesi) {
    return (
      <Link to="/masuk" title={t("Masuk")} className={kelasPemicu}>
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{t("Masuk")}</span>
      </Link>
    );
  }

  const tersimpan = (perjalanan ?? []).filter((p) => p.disimpan);
  const aktif = tersimpan.filter(
    (p) => p.status === "AKAN_DATANG" || p.status === "BERJALAN",
  );
  const perluUlasan = (perjalanan ?? []).filter((p) => p.boleh_diulas);
  const nama = profil?.email?.split("@")[0] ?? t("penjelajah");
  const keDashboard =
    profil?.peran === "UMKM" ? "/umkm" : profil?.peran === "GOV" || profil?.peran === "ADMIN" ? "/gov" : null;

  return (
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-haspopup="menu"
        title={t("Akun & perjalanan saya")}
        className={kelasPemicu}
      >
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{profil?.peran ?? t("Akun")}</span>
        {/* Titik penanda muncul hanya bila ada yang menunggu tindakan. Lencana
            berangka untuk sekadar "punya 3 perjalanan" akan selalu menyala dan
            berhenti berarti apa pun. */}
        {perluUlasan.length > 0 && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand-amber"
            aria-label={t("Ada perjalanan yang menunggu ulasan")}
          />
        )}
      </button>

      {buka && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl shadow-brand-forest/15"
        >
          {/* Profil ringkas */}
          <div className="border-b border-ink/[0.07] px-4 py-3">
            <p className="truncate text-sm font-bold text-ink">{nama}</p>
            <p className="truncate text-[11px] text-ink-faint">{profil?.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-brand-sage/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-sage-ink">
                {profil?.peran ?? "USER"}
              </span>
              {profil?.kabupaten && (
                <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                  {profil.kabupaten}
                </span>
              )}
            </div>
          </div>

          {/* Perjalanan tersimpan */}
          <div className="border-b border-ink/[0.07] px-2 py-2">
            <p className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                <BookmarkCheck className="h-3 w-3" aria-hidden />
                {t("Perjalanan Tersimpan")}
              </span>
              {perjalanan !== null && (
                <span className="text-[10px] font-bold text-ink-soft">
                  {tersimpan.length}
                </span>
              )}
            </p>

            {perjalanan === null ? (
              <div className="space-y-1 px-2 py-1">
                {[0, 1].map((i) => (
                  <div key={i} className="skel h-8 rounded-lg" />
                ))}
              </div>
            ) : tersimpan.length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] leading-relaxed text-ink-faint">
                {t(
                  "Belum ada. Susun rencana lalu tekan Simpan Perjalanan untuk menemukannya di sini.",
                )}
              </p>
            ) : (
              <ul>
                {/* Yang aktif diutamakan tampil; itu yang sedang dipakai. */}
                {[...aktif, ...tersimpan.filter((p) => !aktif.includes(p))]
                  .slice(0, PRATINJAU)
                  .map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/perjalanan/${p.id}`}
                        onClick={() => setBuka(false)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-ink/[0.04]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-ink">
                            {p.judul ||
                              (p.kabupaten_tersentuh ?? []).join(" · ") ||
                              t("Kawasan Danau Toba")}
                          </span>
                          <span className="block text-[10px] text-ink-faint">
                            {p.n_days} {t("hari")}
                            {p.tanggal_mulai ? ` · ${p.tanggal_mulai}` : ""}
                            {p.boleh_diulas && ` · ${t("menunggu ulasan")}`}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-3.5 w-3.5 shrink-0 text-ink-faint"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}

            <Link
              to="/saya"
              onClick={() => setBuka(false)}
              className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-brand-sage-ink no-underline transition-colors hover:bg-ink/[0.04]"
            >
              <Route className="h-3.5 w-3.5" aria-hidden />
              {t("Lihat semua perjalanan")}
            </Link>
          </div>

          {/* Tautan akun */}
          <div className="px-2 py-2">
            {keDashboard && (
              <Link
                to={keDashboard}
                onClick={() => setBuka(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink no-underline transition-colors hover:bg-ink/[0.04]"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                {t("Dashboard")}
              </Link>
            )}
            <Link
              to="/akun"
              onClick={() => setBuka(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink no-underline transition-colors hover:bg-ink/[0.04]"
            >
              <UserRound className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
              {t("Akun Saya")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setBuka(false);
                void keluar();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t("Keluar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
