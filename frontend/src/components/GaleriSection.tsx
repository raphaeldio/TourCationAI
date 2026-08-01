import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import {
  GALERI,
  GALERI_DESKRIPSI,
  GALERI_JUDUL,
  GALERI_KICKER,
  type ItemGaleri,
  sampulItem,
  slugGaleri,
} from "../config";
import { useT } from "../i18n";

/**
 * Galeri foto & video sebagai rel yang bisa digeser (seret, sapuan, panah).
 * Tiap kartu mengarah ke /galeri/<slug>. Isinya diatur lewat GALERI di config.ts.
 */

/** Lebar satu kartu + jarak antar kartu; dipakai untuk lompatan tombol panah. */
const LANGKAH = 336;

export default function GaleriSection() {
  const t = useT();
  const rel = useRef<HTMLDivElement>(null);
  const [bisaKiri, setBisaKiri] = useState(false);
  const [bisaKanan, setBisaKanan] = useState(false);

  /** Panah dinonaktifkan di ujung rel supaya tidak terlihat bisa ditekan sia-sia. */
  const perbaruiPanah = useCallback(() => {
    const el = rel.current;
    if (!el) return;
    setBisaKiri(el.scrollLeft > 8);
    setBisaKanan(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    perbaruiPanah();
    window.addEventListener("resize", perbaruiPanah);
    return () => window.removeEventListener("resize", perbaruiPanah);
  }, [perbaruiPanah]);

  const geser = (arah: -1 | 1) =>
    rel.current?.scrollBy({ left: arah * LANGKAH, behavior: "smooth" });

  /* ── Seret untuk menggeser ────────────────────────────────────────────
     Rel sudah bisa di-scroll dengan trackpad dan sentuhan; yang hilang hanya
     seret dengan tetikus. Jarak seret dicatat agar lepasan yang sebenarnya
     gerakan menggeser tidak ikut membuka halaman kartu. */
  const seret = useRef({ aktif: false, mulaiX: 0, mulaiScroll: 0, jarak: 0 });

  const mulaiSeret = (e: React.PointerEvent) => {
    // Hanya tetikus: sentuhan dan pena sudah ditangani scroll bawaan browser.
    if (e.pointerType !== "mouse" || !rel.current) return;
    seret.current = {
      aktif: true,
      mulaiX: e.clientX,
      mulaiScroll: rel.current.scrollLeft,
      jarak: 0,
    };
  };

  const lanjutSeret = (e: React.PointerEvent) => {
    const s = seret.current;
    if (!s.aktif || !rel.current) return;
    const delta = e.clientX - s.mulaiX;
    s.jarak = Math.max(s.jarak, Math.abs(delta));
    rel.current.scrollLeft = s.mulaiScroll - delta;
  };

  const akhiriSeret = () => {
    seret.current.aktif = false;
  };

  /** Klik dianggap sengaja hanya bila kursor nyaris tidak bergerak. */
  const klikBersih = () => seret.current.jarak < 6;

  if (GALERI.length === 0) return null;

  // Kata terakhir judul diberi gradien, seperti judul section lain.
  const kata = GALERI_JUDUL.trim().split(" ");
  const akhir = kata.pop() ?? "";
  const awal = kata.join(" ");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-brand-sand-ink">
          {t(GALERI_KICKER)}
        </p>
        <h2 className="mt-2 font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold tracking-tight text-ink">
          {awal} <span className="gradient-text">{akhir}</span>
        </h2>
        {GALERI_DESKRIPSI && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            {t(GALERI_DESKRIPSI)}
          </p>
        )}
        {/* Ornamen belah ketupat bermotif ulos — dekoratif murni. */}
        <div className="gorga-rule mt-5" aria-hidden />
      </div>

      <motion.div
        className="relative mt-8"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55 }}
      >
        {/* Kabut tipis di kedua tepi: memberi tanda bahwa rel masih berlanjut */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-surface-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface-paper to-transparent" />

        <Panah arah="kiri" aktif={bisaKiri} onClick={() => geser(-1)} label={t("Sebelumnya")} />
        <Panah arah="kanan" aktif={bisaKanan} onClick={() => geser(1)} label={t("Berikutnya")} />

        <div
          ref={rel}
          onScroll={perbaruiPanah}
          onPointerDown={mulaiSeret}
          onPointerMove={lanjutSeret}
          onPointerUp={akhiriSeret}
          onPointerLeave={akhiriSeret}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {GALERI.map((item) => (
            <Kartu key={slugGaleri(item)} item={item} klikBersih={klikBersih} />
          ))}
        </div>
      </motion.div>

      <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.7rem] text-ink-faint">
        <PlayCircle className="h-3.5 w-3.5" />
        {t("Geser untuk menjelajah — klik kartu untuk melihat selengkapnya")}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function Panah({
  arah,
  aktif,
  onClick,
  label,
}: {
  arah: "kiri" | "kanan";
  aktif: boolean;
  onClick: () => void;
  label: string;
}) {
  const Ikon = arah === "kiri" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!aktif}
      className={[
        "absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full",
        "border border-white/60 bg-white/70 text-ink shadow-[0_10px_30px_-12px_hsl(var(--brand-forest)/0.5)]",
        "backdrop-blur-xl transition hover:bg-white/90 disabled:pointer-events-none disabled:opacity-0 sm:flex",
        arah === "kiri" ? "-left-3" : "-right-3",
      ].join(" ")}
    >
      <Ikon className="h-5 w-5" />
    </button>
  );
}

function Kartu({
  item,
  klikBersih,
}: {
  item: ItemGaleri;
  /** false bila lepasan tetikus ini sebenarnya gerakan menggeser rel. */
  klikBersih: () => boolean;
}) {
  const t = useT();
  const sampul = sampulItem(item);

  return (
    <article className="shrink-0 snap-center">
      <Link
        to={`/galeri/${slugGaleri(item)}`}
        aria-label={t(item.judul)}
        // Batalkan klik yang berasal dari seret.
        onClick={(e) => !klikBersih() && e.preventDefault()}
        draggable={false}
        className={[
          "group relative block w-[min(320px,78vw)] overflow-hidden rounded-[26px]",
          "border border-white/50 bg-white/25 shadow-[0_24px_60px_-28px_hsl(var(--brand-forest)/0.65)]",
          "backdrop-blur-xl transition duration-300 hover:-translate-y-1",
          "hover:shadow-[0_32px_70px_-26px_hsl(var(--brand-forest)/0.75)]",
        ].join(" ")}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[26px]">
          {sampul ? (
            <img
              src={sampul}
              alt={t(item.judul)}
              draggable={false}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="grain h-full w-full bg-gradient-to-br from-brand-sage/70 via-brand-sand/50 to-brand-forest/60" />
          )}

          {/* Gelap di bawah supaya teks putih tetap terbaca di foto terang */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-forest/85 via-brand-forest/10 to-transparent" />

          {/* Penanda bahwa isinya video — pemutarnya ada di halaman detail. */}
          {item.jenis === "video" && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/25 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-white/40">
                <PlayCircle className="h-7 w-7 text-white" />
              </span>
            </span>
          )}

          {/* Ikon panah muncul saat hover: penanda kartu bisa dibuka. */}
          <span className="pointer-events-none absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/20 text-white opacity-0 backdrop-blur-md transition duration-300 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" />
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-lg font-bold leading-tight text-white drop-shadow">
              {t(item.judul)}
            </h3>
            {item.keterangan && (
              <p className="mt-1 text-[0.72rem] leading-relaxed text-white/80">
                {t(item.keterangan)}
              </p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
