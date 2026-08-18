import { ArrowUpRight, BarChart3, CreditCard, MessageSquare, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { useT } from "../i18n";

interface Pintasan {
  ke: string;
  label: string;
  /** Apa yang bisa dikerjakan di sana — ditulis sebagai pekerjaan, bukan fitur. */
  guna: string;
  ikon: LucideIcon;
}

const PINTASAN: Pintasan[] = [
  {
    ke: "/umkm/usaha",
    label: "Usaha & Produk",
    guna: "Daftarkan menu dan harga",
    ikon: Utensils,
  },
  {
    ke: "/umkm/analisis",
    label: "Analisis Pasar",
    guna: "Riwayat, posisi harga, ekspor",
    ikon: BarChart3,
  },
  {
    ke: "/umkm/suara",
    label: "Suara & Pengumuman",
    guna: "Kirim kendala ke dinas",
    ikon: MessageSquare,
  },
  {
    ke: "/umkm/langganan",
    label: "Langganan",
    guna: "Paket Anda dan isinya",
    ikon: CreditCard,
  },
];

/**
 * Peta isi dashboard, ditaruh di layar pertama.
 *
 * Alasannya bukan hiasan: seluruh halaman di produk ini hidup di balik menu
 * samping yang pada ponsel tersembunyi di laci. Orang yang baru pertama masuk
 * tidak punya cara menduga bahwa ada halaman analisis pasar — dan halaman yang
 * tidak pernah ditemukan sama saja dengan halaman yang tidak dibangun.
 *
 * Isinya sengaja SELURUH halaman, bukan yang berbayar saja, dan tiap ubin
 * menyebut pekerjaannya alih-alih namanya: "Daftarkan menu dan harga" bisa
 * dipahami tanpa pernah membuka aplikasi ini, "Usaha & Produk" tidak.
 */
export default function PintasanFitur() {
  const t = useT();

  return (
    <nav aria-label={t("Pintasan halaman")} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {PINTASAN.map((p) => (
        <Link
          key={p.ke}
          to={p.ke}
          className="sentuh group flex items-start gap-2.5 rounded-2xl border border-ink/10 bg-white p-3 no-underline shadow-sm transition-colors hover:border-brand-sage/50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-sage/12">
            <p.ikon className="h-4 w-4 text-brand-sage-ink" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-extrabold text-ink">{t(p.label)}</span>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
              {t(p.guna)}
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
