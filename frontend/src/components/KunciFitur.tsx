import { ArrowRight, Check, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { useT } from "../i18n";
import { NAMA_PAKET, PAKET_MINIMAL, usePaket, type FiturPaket } from "../paket";

interface Props {
  fitur: FiturPaket;
  judul: string;
  /** Satu kalimat: apa yang fitur ini jawab, bukan apa namanya. */
  deskripsi: string;
  /** Contoh konkret isi fiturnya. Inilah yang membuat kunci terasa seperti
   *  etalase, bukan tembok. */
  poin: string[];
  ikon?: LucideIcon;
}

/**
 * Kartu fitur yang belum termasuk paket berjalan.
 *
 * Dua hal yang sengaja TIDAK dilakukan komponen ini:
 *
 *   * **Tidak tampil seperti galat.** Merah dan segitiga peringatan berarti ada
 *     yang rusak. Yang terjadi di sini bukan kerusakan — datanya ada, paketnya
 *     saja belum memuatnya — dan pengguna baru yang mengira produknya error
 *     tidak akan mencoba lagi.
 *   * **Tidak menyembunyikan isinya.** Daftar `poin` menyebutkan apa yang akan
 *     muncul di tempat kartu ini. Fitur yang hanya berupa nama tidak pernah
 *     jadi alasan siapa pun menaikkan paket.
 *
 * Harga diambil dari katalog yang sudah dimuat konteks paket, jadi angkanya
 * tidak pernah menyimpang dari halaman /bisnis.
 */
export default function KunciFitur({ fitur, judul, deskripsi, poin, ikon: Ikon = Lock }: Props) {
  const t = useT();
  const { katalog, langganan } = usePaket();

  const perlu = PAKET_MINIMAL[fitur];
  const tier = katalog.find((p) => p.kunci === perlu);

  return (
    <section className="rounded-2xl border border-dashed border-brand-sage/50 bg-brand-sage/[0.05] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
            <Ikon className="h-5 w-5 shrink-0 text-brand-sage-ink" aria-hidden />
            {t(judul)}
          </p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-soft sm:text-sm">
            {t(deskripsi)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-amber/20 px-3 py-1.5 text-[11px] font-extrabold text-brand-amber-ink">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {t("Paket")} {t(NAMA_PAKET[perlu])}
        </span>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {poin.map((p) => (
          <li
            key={p}
            className="flex items-start gap-2 rounded-xl border border-ink/5 bg-white/70 p-3 text-xs leading-relaxed text-ink-soft"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-sage-ink" aria-hidden />
            <span>{t(p)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          to="/umkm/langganan"
          className="sentuh flex items-center gap-1.5 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-extrabold text-on-sage-ink no-underline"
        >
          {t("Lihat paket")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        {tier && (
          <p className="text-xs text-ink-faint">
            {t(NAMA_PAKET[perlu])}{" "}
            <strong className="text-ink-soft">
              Rp {tier.harga_bulanan.toLocaleString("id-ID")}
            </strong>
            /{t("bln")}
            {langganan && ` · ${t("paket Anda")} ${t(NAMA_PAKET[langganan.plan])}`}
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        {t(
          "Naik paket menambah kedalaman insight — bukan posisi Anda di rekomendasi wisatawan.",
        )}
      </p>
    </section>
  );
}
