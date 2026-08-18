import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import CountUp from "./CountUp";
import Reveal from "./Reveal";
import { cn } from "../lib/utils";

export type NadaTile = "sage" | "amber" | "sand" | "forest";

const NADA: Record<NadaTile, { chip: string; ikon: string }> = {
  sage: { chip: "bg-brand-sage/15", ikon: "text-brand-sage-ink" },
  amber: { chip: "bg-brand-amber/20", ikon: "text-brand-amber-ink" },
  sand: { chip: "bg-brand-sand/15", ikon: "text-brand-sand-ink" },
  forest: { chip: "bg-brand-forest/10", ikon: "text-brand-forest" },
};

interface Props {
  ikon: LucideIcon;
  label: string;
  nilai: number;
  format?: (n: number) => string;
  /** Perubahan relatif, mis. 0.125 untuk +12,5%. */
  delta?: number | null;
  deltaLabel?: string;
  keterangan?: string;
  nada?: NadaTile;
  index?: number;
}

/**
 * Kartu angka utama. Tata letaknya mobile-first: pada layar sempit ikon dan
 * angka menumpuk rapat, lalu melebar sendiri di layar besar.
 *
 * Meneruskan pola yang sudah dipakai di ItineraryBoard (CountUp + kartu putih)
 * supaya dashboard terasa satu produk dengan halaman perencana, bukan tempelan.
 */
export default function StatTile({
  ikon: Ikon,
  label,
  nilai,
  format,
  delta,
  deltaLabel,
  keterangan,
  nada = "sage",
  index = 0,
}: Props) {
  const warna = NADA[nada];
  const naik = (delta ?? 0) >= 0;
  const PanahTren = naik ? TrendingUp : TrendingDown;

  return (
    <Reveal index={index}>
      <div className="h-full rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              warna.chip,
            )}
          >
            <Ikon className={cn("h-5 w-5", warna.ikon)} aria-hidden />
          </span>

          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
                naik
                  ? "bg-brand-sage/15 text-brand-sage-ink"
                  : "bg-rose-100 text-rose-700",
              )}
            >
              <PanahTren className="h-3 w-3" aria-hidden />
              {naik ? "+" : ""}
              {(delta * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <p className="mt-3 text-xs font-semibold text-ink-faint sm:text-sm">{label}</p>
        <p className="mt-1 font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
          <CountUp value={nilai} format={format} />
        </p>

        {(keterangan || deltaLabel) && (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-faint sm:text-xs">
            {keterangan ?? deltaLabel}
          </p>
        )}
      </div>
    </Reveal>
  );
}
