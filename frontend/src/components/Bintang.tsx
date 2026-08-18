import { Star } from "lucide-react";

/**
 * Pemilih / penampil rating bintang.
 *
 * Mode baca-saja dirender sebagai `<span>` biasa; mode interaktif memakai
 * `<button>` sungguhan dengan `aria-label` per bintang, bukan `<div onClick>`.
 * Bedanya nyata: tombol bisa dijangkau keyboard dan dibacakan pembaca layar,
 * sedangkan div tidak — dan memberi rating adalah aksi utama halaman ini.
 */
export default function Bintang({
  nilai,
  onPilih,
  ukuran = "md",
  label,
}: {
  nilai: number;
  onPilih?: (n: number) => void;
  ukuran?: "sm" | "md" | "lg";
  label?: string;
}) {
  const kelas = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" }[ukuran];
  const bintang = [1, 2, 3, 4, 5];

  if (!onPilih) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={label ?? `${nilai} dari 5`}>
        {bintang.map((b) => (
          <Star
            key={b}
            className={`${kelas} ${
              b <= Math.round(nilai)
                ? "fill-brand-amber text-brand-amber"
                : "text-ink-faint/40"
            }`}
            aria-hidden
          />
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {bintang.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onPilih(b)}
          aria-label={`${b} bintang`}
          aria-pressed={b === Math.round(nilai)}
          className="sentuh rounded transition-transform hover:scale-110"
        >
          <Star
            className={`${kelas} ${
              b <= nilai ? "fill-brand-amber text-brand-amber" : "text-ink-faint/40"
            }`}
            aria-hidden
          />
        </button>
      ))}
    </span>
  );
}
