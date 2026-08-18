import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  MessageSquarePlus,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { bukaPerjalanan, hapusSimpanan } from "../apiPerjalanan";
import Bintang from "../components/Bintang";
import ItineraryBoard from "../components/ItineraryBoard";
import { useT } from "../i18n";
import { LABEL_STATUS_PERJALANAN } from "../labelPerjalanan";
import type { Itinerary } from "../types";
import type { PerjalananTersimpan as Tersimpan } from "../typesPerjalanan";

/**
 * Membuka kembali rencana yang disimpan.
 *
 * Solver TIDAK dipanggil di sini, dan itu keputusan yang menentukan: payload
 * dirender apa adanya seperti saat disimpan. Menyusun ulang akan menghasilkan
 * rencana yang berbeda begitu dataset, harga acuan, atau bobot jarak berubah —
 * dan rencana yang berubah sendiri setelah disimpan bukan rencana yang
 * disimpan.
 *
 * Konsekuensinya harus diterima jujur: rencana lama bisa memuat tempat yang
 * kini tutup atau harga yang sudah bergeser. Itu justru sifat yang benar untuk
 * catatan perjalanan — dan pergeseran itulah yang wisatawan laporkan lewat
 * ulasan (kategori JAM_OPERASIONAL menangkapnya secara khusus).
 */
export default function PerjalananTersimpan() {
  const t = useT();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<Tersimpan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  // Pilihan rumah makan ikut tersimpan di payload, jadi rencana yang dibuka
  // kembali sama dengan yang ditutup — bukan rekomendasi awal server.
  const [pick, setPick] = useState<Record<string, number>>({});

  const muat = useCallback(async () => {
    try {
      const d = await bukaPerjalanan(id);
      setData(d);
      const p = (d.payload as { pick?: Record<string, number> })?.pick;
      setPick(p && typeof p === "object" ? p : {});
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const itinerary = (data?.payload ?? null) as Itinerary | null;

  async function buang() {
    setSibuk(true);
    try {
      await hapusSimpanan(id);
      navigate("/saya");
    } catch (e) {
      setGalat((e as Error).message);
      setSibuk(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-paper px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/saya"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Perjalanan Saya")}
        </Link>

        {galat ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
              <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat data")}
            </p>
            <p className="mt-1 text-sm text-rose-700">{galat}</p>
          </div>
        ) : !data ? (
          <div className="space-y-3">
            <div className="skel h-24 rounded-2xl" />
            <div className="skel h-96 rounded-2xl" />
          </div>
        ) : (
          <>
            <header className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
                    {data.judul || t("Rencana Perjalanan")}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      {t(LABEL_STATUS_PERJALANAN[data.status])}
                    </span>
                    {data.tanggal_mulai && (
                      <span>
                        · {data.tanggal_mulai} → {data.tanggal_selesai}
                      </span>
                    )}
                    <span>· {t("disimpan")} {data.disimpan_pada.slice(0, 10)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {data.sudah_diulas ? (
                    <Link
                      to={`/perjalanan/${id}/ulasan`}
                      className="sentuh flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink no-underline transition-colors hover:bg-ink/5"
                    >
                      <Star className="h-3.5 w-3.5 text-brand-amber" aria-hidden />
                      {data.skor_ulasan != null && (
                        <Bintang nilai={data.skor_ulasan} ukuran="sm" />
                      )}
                      {t("Lihat ulasan")}
                    </Link>
                  ) : data.boleh_diulas ? (
                    <Link
                      to={`/perjalanan/${id}/ulasan`}
                      className="sentuh flex items-center gap-2 rounded-xl bg-brand-sage-ink px-3.5 py-2 text-xs font-bold text-on-sage-ink no-underline"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                      {t("Beri Ulasan")}
                    </Link>
                  ) : (
                    <span className="rounded-xl bg-ink/[0.04] px-3 py-2 text-[11px] text-ink-faint">
                      {t("Bisa diulas setelah perjalanan selesai")}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void buang()}
                    disabled={sibuk}
                    title={t("Hapus dari Perjalanan Saya")}
                    className="sentuh rounded-xl border border-ink/15 p-2 text-ink-faint transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-faint">
                {t(
                  "Rencana ini ditampilkan apa adanya seperti saat disimpan — tidak disusun ulang. Harga dan jam buka bisa sudah bergeser sejak itu; laporkan lewat ulasan bila Anda menemukan perbedaannya.",
                )}
              </p>
            </header>

            {/* Papan yang sama dengan halaman depan. Tanpa onExport dan
                onSimpan: rencana ini sudah tersimpan, dan mengekspornya dari
                sini berarti menduplikasi jalur yang sudah ada di halaman
                penyusunan. Penggantian hotel juga tidak ditawarkan — itu
                menyusun ULANG rencana, yang justru merusak arti "tersimpan". */}
            <div className="mt-4">
              <ItineraryBoard
                itinerary={itinerary}
                planning={false}
                pick={pick}
                setPick={setPick}
                punyaAkun
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
