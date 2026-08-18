import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Loader2 } from "lucide-react";
import { BrandLogo } from "../vectors";
import MenuAkun from "./MenuAkun";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useI18n } from "../i18n";

interface Props {
  onPlanTrip: () => void;
}

const LINKS = [
  { id: "home", label: "Home" },
  { id: "galeri", label: "Galeri" },
  { id: "planner", label: "Perjalanan" },
  { id: "ai", label: "AI Guide" },
  { id: "umkm", label: "Dampak UMKM" },
  { id: "intelligence", label: "Dashboard" },
] as const;

export default function Navbar({ onPlanTrip }: Props) {
  const [active, setActive] = useState<string>("home");
  const [scrolled, setScrolled] = useState(false);
  const { lang, langs, setLang, t, memuat } = useI18n();

  // Navbar berubah solid setelah pengguna menggulir sedikit.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: section yang paling dekat bagian atas viewport jadi aktif.
  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!sections.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-3 z-50 mx-auto flex w-[min(1400px,calc(100%-1.5rem))] items-center justify-between rounded-2xl px-5 py-3.5 transition-all duration-300",
        scrolled
          ? "border border-ink/12 bg-white/85 shadow-lg shadow-brand-forest/10 backdrop-blur-2xl"
          : "border border-transparent bg-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => goTo("home")}
        className="flex items-center gap-2.5"
        aria-label="Ke beranda"
      >
        <BrandLogo />
        <span
          className={cn(
            "font-display text-lg font-extrabold tracking-tight transition-colors",
            scrolled ? "text-ink" : "text-white drop-shadow-[0_1px_6px_rgba(12,59,46,0.5)]",
          )}
        >
          TourCation <span className="gradient-text">AI</span>
        </span>
      </button>

      <div className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => goTo(l.id)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              scrolled
                ? active === l.id
                  ? "text-ink"
                  : "text-ink-soft hover:text-ink"
                : active === l.id
                  ? "text-white"
                  : "text-white/75 hover:text-white",
            )}
          >
            {active === l.id && (
              <motion.span
                layoutId="nav-active"
                className={cn(
                  "absolute inset-0 -z-10 rounded-lg border",
                  scrolled ? "border-ink/10 bg-ink/[0.06]" : "border-white/30 bg-white/20",
                )}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {t(l.label)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Pemilih bahasa seluruh situs. Bahasa Indonesia & Inggris instan;
            bahasa lain diterjemahkan sekali lalu di-cache di peramban. */}
        <div className="relative flex items-center">
          {memuat ? (
            <Loader2 className="pointer-events-none absolute left-2 h-3.5 w-3.5 animate-spin text-brand-amber-ink" />
          ) : (
            <Globe
              className={cn(
                "pointer-events-none absolute left-2 h-3.5 w-3.5",
                scrolled ? "text-ink-soft" : "text-white/80",
              )}
            />
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t("Bahasa")}
            title={t("Bahasa")}
            className={cn(
              "appearance-none rounded-lg border py-1.5 pl-7 pr-2 text-xs font-medium outline-none transition focus:border-brand-sage/50",
              scrolled
                ? "border-ink/10 bg-ink/[0.05] text-ink hover:border-brand-sage/45"
                : "border-white/35 bg-white/20 text-white backdrop-blur-md hover:border-white/60",
            )}
          >
            {(langs.length ? langs : [{ code: "id", label: "Indonesia", stt: "id-ID" }]).map(
              (l) => (
                <option key={l.code} value={l.code} className="bg-white text-ink">
                  {l.label}
                </option>
              ),
            )}
          </select>
        </div>

        {/* Masuk / akun. Menunya ditulis sendiri, BUKAN memakai pustaka: satu
            dropdown Radix menambah ~32 KB gz ke halaman depan — halaman yang
            pertama dibuka setiap pengunjung, termasuk yang belum punya akun dan
            tidak akan pernah membukanya. Lihat MenuAkun.tsx. */}
        <MenuAkun scrolled={scrolled} />

        {/* Tombol ekspor PDF pindah ke kepala kartu itinerary: di sanalah
            perhatian turis berada begitu rencananya selesai disusun. */}
        <Button size="sm" onClick={onPlanTrip}>
          {t("Plan Trip")}
        </Button>
      </div>
    </nav>
  );
}
