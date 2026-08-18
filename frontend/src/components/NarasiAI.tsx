import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { ButirNarasi, HasilNarasi } from "../typesIntel";
import { useT } from "../i18n";

/** Satu bagian narasi yang akan dirender, dipetakan dari kunci JSON-nya. */
export interface BagianNarasi {
  kunci: string;
  label: string;
}

interface Props {
  judul: string;
  sub?: string;
  /** Pemanggil endpoint. Dibungkus useCallback di sisi pemanggil.
   *
   *  Bertipe `object` alih-alih `Record<string, unknown>` supaya keempat
   *  bentuk narasi yang konkret (NarasiInsight, NarasiGap, ...) bisa lewat:
   *  interface tanpa index signature tidak assignable ke Record, sedangkan
   *  ke `object` bisa. Pembacaan per kunci ditangani di dalam komponen.
   */
  muat: () => Promise<HasilNarasi<object>>;
  bagian: BagianNarasi[];
  /** Ambil begitu komponen muncul. Dipakai untuk narasi yang deterministik
   *  dan di-cache global (F1/F2); yang bergantung parameter dibiarkan manual. */
  otomatis?: boolean;
}

function isButir(x: unknown): x is ButirNarasi {
  return typeof x === "object" && x !== null && "judul" in x;
}

function Butir({ b }: { b: ButirNarasi }) {
  return (
    <li className="rounded-xl border border-ink/5 bg-surface-2/50 p-3">
      <p className="text-sm font-semibold text-ink">{b.judul}</p>
      {b.alasan && (
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{b.alasan}</p>
      )}
      {b.angka_pendukung?.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1.5">
          {b.angka_pendukung.map((a, i) => (
            <span
              key={i}
              className="rounded-lg bg-brand-sage/12 px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand-sage-ink"
            >
              {a}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

/** Kartu narasi AI.
 *
 * Dirancang supaya ketiadaan AI tidak pernah terlihat seperti kerusakan:
 * `narasi_status: "AI nonaktif"` dirender sebagai catatan tenang, bukan galat
 * merah. Seluruh angka pada halaman ini sudah dihitung tanpa AI.
 */
export default function NarasiAI({ judul, sub, muat, bagian, otomatis = false }: Props) {
  const t = useT();
  const [hasil, setHasil] = useState<HasilNarasi<object> | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const jalankan = useCallback(async () => {
    setSibuk(true);
    setGalat(null);
    try {
      setHasil(await muat());
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }, [muat]);

  useEffect(() => {
    if (otomatis) void jalankan();
  }, [otomatis, jalankan]);

  const narasi = (hasil?.narasi ?? null) as Record<string, unknown> | null;
  const nonaktif = hasil?.narasi_status === "AI nonaktif";

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
            <Sparkles className="h-4 w-4 text-brand-amber-ink" aria-hidden />
            {t(judul)}
          </h2>
          {sub && <p className="mt-0.5 text-xs text-ink-faint">{t(sub)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {hasil?.dari_cache && (
            <span className="rounded-lg bg-ink/5 px-2 py-1 text-[10px] font-bold text-ink-faint">
              {t("dari cache")}
            </span>
          )}
          <button
            type="button"
            onClick={() => void jalankan()}
            disabled={sibuk}
            className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/10 px-3 py-2 text-xs font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            {sibuk ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {hasil ? t("Muat ulang") : t("Buat penjelasan")}
          </button>
        </div>
      </div>

      {galat && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{galat}</span>
        </p>
      )}

      {nonaktif && (
        <p className="rounded-xl bg-ink/[0.03] p-3 text-xs leading-relaxed text-ink-faint sm:text-sm">
          {t(
            hasil?.catatan ??
              "Penjelasan AI tidak aktif. Seluruh angka di halaman ini tetap lengkap.",
          )}
        </p>
      )}

      {!hasil && !sibuk && !galat && (
        <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
          {t(
            "Angka di halaman ini sudah lengkap tanpa AI. Tekan tombol di atas untuk menambahkan penjelasan naratif.",
          )}
        </p>
      )}

      {sibuk && !hasil && (
        <div className="space-y-2">
          <div className="skel h-4 w-full rounded-lg" />
          <div className="skel h-4 w-11/12 rounded-lg" />
          <div className="skel h-20 w-full rounded-xl" />
        </div>
      )}

      {narasi && (
        <div className="space-y-4">
          {typeof narasi.ringkasan === "string" && narasi.ringkasan && (
            <p className="text-sm leading-relaxed text-ink-soft">{narasi.ringkasan}</p>
          )}

          {bagian.map(({ kunci, label }) => {
            const isi = narasi[kunci];

            if (typeof isi === "string") {
              return isi ? (
                <div key={kunci}>
                  <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    {t(label)}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{isi}</p>
                </div>
              ) : null;
            }

            const daftar = Array.isArray(isi) ? isi.filter(isButir) : [];
            if (!daftar.length) return null;
            return (
              <div key={kunci}>
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {t(label)}
                </h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {daftar.map((b, i) => (
                    <Butir key={i} b={b} />
                  ))}
                </ul>
              </div>
            );
          })}

          <p className="border-t border-ink/5 pt-3 text-[11px] leading-relaxed text-ink-faint">
            {t(
              "Disusun AI dari angka yang sudah dihitung sistem. Model tidak melakukan perhitungan sendiri — setiap angka di atas disalin dari data yang ditampilkan pada halaman ini.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
