import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Itinerary } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import AiSearch from "./AiSearch";
import GaleriSection from "./GaleriSection";
import { HERO_FOTO } from "../config";
import { useT } from "../i18n";

interface Props {
  itinerary: Itinerary | null;
  seed: string | null;
  onSeedConsumed: () => void;
  /** Gulir ke bagian perencana. */
  onViewPlanner: () => void;
  /** Diteruskan ke kotak AI agar biaya makan dihitung dari pilihan turis. */
  pick: Record<string, number>;
}

/**
 * Hero + galeri dalam satu section: foto setinggi layar dengan judul dan kotak
 * pencarian AI di atasnya, lalu galeri destinasi di bawahnya.
 */
export default function Hero({ itinerary, seed, onSeedConsumed, onViewPlanner, pick }: Props) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Parallax lembut: foto bergerak lebih lambat dari isi saat digulir.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);

  return (
    <section
      id="home"
      ref={ref}
      /* Dirender di luar wadah `.app` agar penuh selebar peramban. */
      className="relative isolate w-full overflow-hidden"
    >
      {/* Foto setinggi satu layar; svh agar bilah alamat seluler tidak memotong. */}
      <div className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 pb-16 pt-32 text-center">
        <motion.div style={{ y: bgY }} className="absolute inset-0 -z-10 scale-110">
          <img
            src={HERO_FOTO}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Overlay: menjaga teks terbaca + meleburkan tepi bawah ke warna halaman. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-forest/60 via-brand-forest/30 to-surface-paper" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-surface-paper to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="gradient" className="gap-1.5 px-3.5 py-1.5">
            <Sparkles className="h-3 w-3" />
            #1 AI-Powered Travel Experience
          </Badge>
        </motion.div>

        <motion.h1
          className="mt-6 max-w-4xl font-display text-[clamp(2.2rem,5.6vw,4.2rem)] font-extrabold leading-[1.04] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(12,59,46,0.45)]"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
        >
          {t("Discover the Magic of")}
          <br />
          <span className="gradient-text">Danau Toba</span>
        </motion.h1>

        <motion.div
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          <AiSearch itinerary={itinerary} seed={seed} onSeedConsumed={onSeedConsumed} pick={pick} />
        </motion.div>

        <motion.div
          className="mt-7"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34 }}
        >
          <Button variant="glass" size="lg" onClick={onViewPlanner}>
            {t("Susun Perjalanan")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* Galeri destinasi: rel yang bisa digeser mendatar. */}
      <div id="galeri" className="relative scroll-mt-24 bg-surface-paper px-5 pb-16 pt-6">
        {/* Pita tenun penanda pergantian bagian. */}
        <div className="ulos-band absolute inset-x-0 top-0 opacity-60" aria-hidden />
        <GaleriSection />
      </div>
    </section>
  );
}
