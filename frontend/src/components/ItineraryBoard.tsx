import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Users,
  Compass,
  Star,
  Clock,
  MapPin,
  Sparkles,
  Wallet,
  Route,
  RotateCcw,
  Fuel,
  AlertTriangle,
  CreditCard,
  Stethoscope,
  Pill,
  ShoppingCart,
  Store,
  Church,
  Anchor,
  Banknote,
  ChevronDown,
  FileDown,
  BookmarkPlus,
  BookmarkCheck,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  AgendaItem, DayPlan, GrupFasilitas, HotelKandidat, Itinerary,
} from "../types";
import { rp } from "../api";
import { hitungBiaya, slotKey } from "../dampak";
import { cn } from "../lib/utils";
import { useT } from "../i18n";
import { EmptyArt, VectorThumb } from "../vectors";
import PenilaianTempat from "./PenilaianTempat";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import CountUp from "./CountUp";

/** Menggeser titik spotlight kartu mengikuti kursor. */
function trackSpotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

interface Props {
  itinerary: Itinerary | null;
  planning: boolean;
  /** Pilihan makan per slot; diangkat ke App agar dampak & PDF ikut menyesuaikan. */
  pick: Record<string, number>;
  setPick: (f: (p: Record<string, number>) => Record<string, number>) => void;
  /** Ganti penginapan; menyusun ULANG rencana karena hotel adalah acuan jarak. */
  onPilihHotel?: (nama: string) => void;
  /**
   * Unduh rencana sebagai PDF. Hanya diteruskan App bila pemanggil sudah punya
   * akun — lihat `punyaAkun`.
   */
  onExport?: () => void;
  /** Simpan rencana ke inbox; null bila rencana ini tidak punya id. */
  onSimpan?: () => void;
  /**
   * Sudah masuk atau belum. Menentukan apakah Simpan dan Ekspor PDF berupa
   * tombol atau berupa ajakan masuk — bukan disembunyikan. Tombol yang hilang
   * tanpa penjelasan terbaca sebagai fitur yang rusak.
   */
  punyaAkun?: boolean;
  /** "menyimpan" | "tersimpan" | null — keadaan tombol Simpan. */
  statusSimpan?: "menyimpan" | "tersimpan" | null;
}

const TEMA: Record<string, string> = {
  Alam: "Alam & Petualangan",
  Budaya: "Budaya & Akar Tradisi",
  Rohani: "Ziarah & Refleksi",
  Rekreasi: "Rekreasi & Keluarga",
};

function temaHari(day: DayPlan): string {
  const hitung: Record<string, number> = {};
  for (const a of day.agenda) {
    if (a.kind === "wisata") hitung[a.place.kategori] = (hitung[a.place.kategori] ?? 0) + 1;
  }
  const urut = Object.entries(hitung).sort((x, y) => y[1] - x[1]);
  if (!urut.length) return "Eksplorasi";
  if (urut.length > 1 && urut[0][1] === urut[1][1]) return "Eksplorasi Campuran";
  return TEMA[urut[0][0]] ?? "Eksplorasi";
}

const IKON_FASILITAS: Record<string, typeof Fuel> = {
  spbu: Fuel,
  atm: CreditCard,
  kesehatan: Stethoscope,
  apotek: Pill,
  swalayan: ShoppingCart,
  pasar: Store,
  ibadah: Church,
  pelabuhan: Anchor,
  penukaran: Banknote,
};

/**
 * Fasilitas umum di kabupaten yang dilalui hari ini. Bukan "terdekat": data
 * sumbernya tanpa koordinat, jadi yang terjamin hanya kesamaan kabupaten.
 */
function PanelFasilitas({
  grup,
  kabupaten,
}: {
  grup: GrupFasilitas[];
  kabupaten: string[];
}) {
  const t = useT();
  const [buka, setBuka] = useState(false);

  if (!grup.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-ink/[0.07] bg-surface-2 p-4">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        className="flex w-full items-center gap-2 text-left"
      >
        <MapPin className="h-4 w-4 shrink-0 text-brand-sage-ink" />
        <span className="font-display text-sm font-bold text-ink">
          {t("Fasilitas Umum")}
        </span>
        <span className="text-[0.7rem] text-ink-faint">
          {t("di")} {kabupaten.join(", ")}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300",
            buka && "rotate-180",
          )}
        />
      </button>

      {!buka && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {grup.map((g) => {
            const Ikon = IKON_FASILITAS[g.kunci] ?? MapPin;
            return (
              <span
                key={g.kunci}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-ink-soft"
              >
                <Ikon className="h-3 w-3 text-brand-sage-ink" />
                {t(g.label)}
                <span className="text-ink-faint">{g.jumlah}</span>
              </span>
            );
          })}
        </div>
      )}

      {buka && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {grup.map((g) => {
            const Ikon = IKON_FASILITAS[g.kunci] ?? MapPin;
            return (
              <div key={g.kunci} className="rounded-xl border border-ink/[0.07] bg-white p-3">
                <div className="flex items-center gap-1.5">
                  <Ikon className="h-3.5 w-3.5 text-brand-sage-ink" />
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink">
                    {t(g.label)}
                  </span>
                  {g.jumlah > g.item.length && (
                    <span className="ml-auto text-[0.62rem] text-ink-faint">
                      {g.item.length} {t("dari")} {g.jumlah}
                    </span>
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {g.item.map((f) => (
                    <li key={`${f.kabupaten}-${f.nama}`} className="text-xs leading-snug">
                      <span className="font-medium text-ink-soft">{f.nama}</span>
                      <span className="text-ink-faint"> · {f.kabupaten}</span>
                      {f.alamat && (
                        <span className="block text-[0.66rem] text-ink-faint">{f.alamat}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[0.62rem] leading-relaxed text-ink-faint">
        {t("Daftar ini berdasarkan kabupaten yang dilalui, bukan jarak — data sumbernya tidak memuat koordinat.")}
      </p>
    </div>
  );
}

/**
 * Penginapan yang bisa dipilih turis: tiga teratas tampil, sisanya di dropdown.
 *
 * Yang dibandingkan bukan harga kamar, melainkan akibatnya pada seluruh rencana
 * — total biaya dan kedekatan wisata, masing-masing dari ILP penuh per kandidat.
 */
function PilihanHotel({
  kandidat,
  onPilih,
  planning,
}: {
  kandidat: HotelKandidat[];
  onPilih?: (nama: string) => void;
  planning: boolean;
}) {
  const t = useT();
  // Dropdown tertutup lagi tiap kali daftar kandidat berganti (rencana baru).
  const [buka, setBuka] = useState(false);
  useEffect(() => setBuka(false), [kandidat]);

  if (kandidat.length < 2 || !onPilih) return null;

  // Pembanding = kandidat terpilih, agar selisih terbaca sebagai dampak pindah.
  const acuan = kandidat.find((k) => k.terpilih) ?? kandidat[0];

  // Hotel yang sedang dipakai selalu ditarik ke kartu utama.
  const utama = kandidat.slice(0, 3);
  let sisa = kandidat.slice(3);
  if (!utama.some((k) => k.terpilih)) {
    const iAktif = sisa.findIndex((k) => k.terpilih);
    if (iAktif > -1) {
      const aktif = sisa[iAktif];
      utama[2] = aktif;
      sisa = [...kandidat.slice(2, 3), ...sisa.filter((_, i) => i !== iAktif)];
    }
  }

  const kartu = (k: HotelKandidat) => {
    const selisih = k.total_estimasi - acuan.total_estimasi;
    return (
      <button
        key={k.name}
        type="button"
        disabled={planning || k.terpilih}
        onClick={() => onPilih(k.name)}
        className={cn(
          "rounded-xl border p-3 text-left transition",
          "disabled:cursor-default",
          k.terpilih
            ? "border-brand-sage/60 bg-white shadow-[0_0_0_1px_hsl(var(--brand-sage)/0.25)]"
            : "border-ink/10 bg-white/60 hover:-translate-y-0.5 hover:border-brand-sage/45 hover:bg-white",
          planning && !k.terpilih && "opacity-50",
        )}
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className="line-clamp-2 text-xs font-bold leading-snug text-ink">
            {k.name}
          </span>
          {k.terpilih && (
            <Badge variant="success" className="shrink-0">
              {t("Dipakai")}
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[0.68rem] text-ink-soft">
          <Star className="h-3 w-3 fill-amber-400 text-amber-600" />
          {k.rating ?? "–"} · {rp(k.price)}/{t("malam")}
        </div>
        <div className="mt-1.5 space-y-0.5 text-[0.66rem] text-ink-faint">
          <div className="flex items-center gap-1">
            <Route className="h-3 w-3" />
            {k.jarak_rata2_wisata} km {t("rata-rata ke wisata")}
          </div>
          <div className="flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {/* Sengaja SELISIH, bukan total. Angka total tiap kandidat
                memakai perkiraan transport dari solver, sedangkan angka
                besar di ringkasan sudah direkonsiliasi dengan jarak rute
                sungguhnya — menampilkan keduanya membuat dua nominal
                berbeda untuk rencana yang sama. Selisih antar-kandidat
                tetap sah karena semuanya dihitung dengan cara yang sama. */}
            {k.terpilih || selisih === 0 ? (
              t("rencana saat ini")
            ) : (
              <span
                className={cn(
                  "font-bold",
                  selisih < 0 ? "text-brand-sage-ink" : "text-brand-amber-ink",
                )}
              >
                {selisih < 0 ? "−" : "+"}
                {rp(Math.abs(selisih))} {t("total")}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="mt-3">
      <p className="mb-2 text-[0.62rem] font-bold uppercase tracking-wider text-ink-faint">
        {t("Pilihan penginapan")}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">{utama.map(kartu)}</div>

      {sisa.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setBuka((v) => !v)}
            aria-expanded={buka}
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border",
              "border-ink/10 bg-white/60 px-3 py-2 text-[0.7rem] font-bold text-ink-soft",
              "transition hover:border-brand-sage/45 hover:bg-white",
            )}
          >
            {buka
              ? t("Sembunyikan hotel lain")
              : t("Lihat {n} hotel teratas lainnya").replace(
                  "{n}",
                  String(sisa.length),
                )}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", buka && "rotate-180")}
            />
          </button>

          <AnimatePresence initial={false}>
            {buka && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 grid gap-2 sm:grid-cols-3">{sisa.map(kartu)}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <p className="mt-1.5 text-[0.62rem] leading-relaxed text-ink-faint">
        {t(
          "Mengganti penginapan menyusun ulang seluruh rencana — wisata, urutan rute, dan biayanya ikut berubah.",
        )}
      </p>
    </div>
  );
}

export default function ItineraryBoard({
  itinerary,
  planning,
  pick,
  setPick,
  onPilihHotel,
  onExport,
  onSimpan,
  punyaAkun = false,
  statusSimpan = null,
}: Props) {
  // Hari yang sedang dibuka lewat tombol berjajar.
  const [activeDay, setActiveDay] = useState(1);

  // Teks antarmuka mengikuti bahasa situs (lihat i18n.tsx).
  const t = useT();

  // Rencana baru -> kembali ke Hari 1 dan buang pilihan makan yang lama.
  useEffect(() => {
    setActiveDay(1);
  }, [itinerary]);

  /**
   * Seluruh turunan biaya dalam satu panggilan. Dihitung di `dampak.ts` supaya
   * papan ini dan ekspor PDF memakai angka yang sama persis.
   */
  const biaya = useMemo(
    () => (itinerary ? hitungBiaya(itinerary, pick) : null),
    [itinerary, pick],
  );
  const deltaMakan = biaya?.delta ?? 0;

  if (planning && !itinerary) {
    return (
      <Card className="p-7">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-amber-ink">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          AI sedang menyusun…
        </div>
        <div className="skel title mb-4 h-10 w-3/5 rounded-xl" />
        {[0, 1, 2, 3].map((i) => (
          <div className="skel card mb-3 h-[86px] rounded-xl" key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </Card>
    );
  }

  if (!itinerary) {
    return (
      <Card variant="glow" className="grain relative overflow-hidden p-10" id="planner">
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <EmptyArt />
          </motion.div>
          <div>
            <Badge variant="gradient" className="mb-3">
              Siap menyusun rencana
            </Badge>
            <h2 className="font-display text-2xl font-extrabold text-ink">
              Mulai dari <span className="gradient-text">Atur Perjalanan</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              Isi budget, durasi, jumlah orang, dan minat wisata di panel sebelah. Engine menyusun
              agenda harian 07:00–19:00 yang dijamin tidak melebihi budget.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const s = itinerary.summary;
  const totalKm =
    Math.round(itinerary.days.reduce((acc, d) => acc + (d.distance_km ?? 0), 0) * 10) / 10;
  const nDest = itinerary.days.reduce((acc, d) => acc + d.n_wisata, 0);

  // Angka mengikuti pilihan makan pengguna, bukan rekomendasi awal solver.
  // `biaya` sudah dihitung di atas; non-null di sini karena `itinerary` ada.
  const b = biaya!;
  const totalEstimasi = b.total;
  const sisaEstimasi = b.sisa;
  const persenTerpakai = b.persen;
  const lewatBudget = b.lewat;

  const dayAktif =
    itinerary.days.find((d) => d.day === activeDay) ?? itinerary.days[0];
  const acuan = itinerary.titik_acuan;
  const tertaut = itinerary.usaha_tertaut ?? {};

  const renderItem = (a: AgendaItem, day: number, i: number) => {
    if (a.kind === "wisata") {
      return (
        <motion.div
          className="icard spotlight card-glow group flex gap-3.5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5 hover:-translate-y-0.5"
          onMouseMove={trackSpotlight}
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <VectorThumb kind={a.place.kategori} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.65rem] font-bold tracking-wider text-ink-faint">
                {a.time} · {t("Wisata")}
              </span>
              <Badge variant="default">{t(a.place.kategori)}</Badge>
              {a.place.rating != null && a.place.rating >= 4.7 && (
                <Badge variant="success">{t("Highly Rated")}</Badge>
              )}
            </div>
            <h4 className="mt-1 font-display text-base font-bold text-ink">{a.place.name}</h4>
            <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
              <Star className="h-3 w-3 fill-amber-400 text-amber-600" />
              {a.place.rating ?? "–"} ·{" "}
              {a.place.price_per_person > 0 ? `${rp(a.place.price_group)} / ${t("per grup")}` : t("Gratis masuk")}
            </div>
            {/* Jam buka: pakai versi kaya dari dataset waktu operasional bila
                tersedia (ia tahu hari), kalau tidak jatuh ke kolom lama. */}
            {(a.place.opening_hours || a.place.operational_hour) && (
              <div className="mt-1.5 flex items-center gap-1 text-xs italic text-brand-amber-ink/80">
                <Clock className="h-3 w-3" />
                {t(a.place.opening_hours || a.place.operational_hour || "")}
                {a.place.closed_days && a.place.closed_days.length > 0 && (
                  <span className="not-italic text-ink-faint">
                    · {t("libur")} {a.place.closed_days.map((d) => t(d)).join(", ")}
                  </span>
                )}
              </div>
            )}
            {/* Peringatan tutup: tempat tetap ditampilkan, tapi turis diberi
                tahu supaya bisa menukarnya sendiri. */}
            {a.place.warning && (
              <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-600/30 bg-amber-500/10 px-2 py-1.5 text-[0.7rem] font-medium text-amber-800">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                {t(a.place.warning)}
              </div>
            )}
          </div>
        </motion.div>
      );
    }
    const key = slotKey(day, a.slot);
    const sel = pick[key] ?? 0;
    // Tempat makan yang sedang dipilih, bila pemiliknya sudah mengklaimnya di
    // TourCation. Peta ini ditempel backend lewat `place_name_norm` dan hanya
    // berisi usaha yang benar-benar bisa menerima penilaian.
    const usahaTerpilih = tertaut[a.options[sel]?.name ?? ""];
    return (
      <motion.div
        className="icard spotlight card-glow group flex gap-3.5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3.5 hover:-translate-y-0.5"
        onMouseMove={trackSpotlight}
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        <VectorThumb kind="makan" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-bold tracking-wider text-ink-faint">
              {a.time} · {t(a.slot).toUpperCase()}
            </span>
            <Badge variant="success">{a.options.length} {t("pilihan sepadan")}</Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {a.options.map((o, j) => {
              // Selisih terhadap rekomendasi, terlihat sebelum ditekan.
              const dv = (o.price_group ?? 0) - (a.options[0]?.price_group ?? 0);
              return (
                <button
                  key={j}
                  type="button"
                  className={
                    "opt flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition " +
                    (j === sel
                      ? "border-brand-sage/45 bg-brand-sage/12 text-ink"
                      : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:border-ink/20")
                  }
                  onClick={() => setPick((p) => ({ ...p, [key]: j }))}
                >
                  <span
                    className={
                      "h-3 w-3 shrink-0 rounded-full border " +
                      (j === sel ? "border-brand-amber bg-brand-amber" : "border-ink/20")
                    }
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {o.name}
                    {j === 0 ? ` · ${t("rekomendasi AI")}` : ""}
                  </span>
                  {dv !== 0 && (
                    <span
                      className={
                        "shrink-0 text-[0.68rem] font-bold " +
                        (dv > 0 ? "text-amber-600" : "text-emerald-600")
                      }
                    >
                      {dv > 0 ? "+" : "−"}
                      {rp(Math.abs(dv))}
                    </span>
                  )}
                  {/* Angka ini ESTIMASI KISARAN dari dataset kawasan, bukan harga
                      menu. Harga menu sungguhan — yang ditulis pemiliknya dan
                      dinilai komunitas — muncul di panel usaha di bawah daftar
                      ini. Keduanya sengaja tidak pernah digabung; lihat
                      `services/solver_state.py`. Awalan "est." yang membedakan
                      keduanya di layar, jadi jangan dihapus saat merapikan. */}
                  <span
                    className="shrink-0 text-ink-faint"
                    title={t("Estimasi kisaran dari dataset kawasan, bukan harga menu")}
                  >
                    <Star className="mr-0.5 inline h-3 w-3 fill-amber-400 text-amber-600" />
                    {o.rating ?? "–"} · {t("est.")} {rp(o.price_group)}
                  </span>
                </button>
              );
            })}
          </div>

          {usahaTerpilih && <PenilaianTempat usaha={usahaTerpilih} />}
        </div>
      </motion.div>
    );
  };

  return (
    <Card className="order-2 scroll-mt-24 p-6 md:p-7 lg:order-1" id="planner">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-sand-ink">
            <Sparkles className="h-3.5 w-3.5" />
            {t("Perjalanan Dioptimalkan AI")}
          </div>

          {/* Rencana sudah jadi dan terpampang di bawah — di sinilah turis
              berada saat ingin menyimpan atau mengunduhnya.

              Bagi yang belum masuk, keduanya tidak disembunyikan melainkan
              diganti satu ajakan masuk yang menyebut apa yang didapat. Tombol
              yang hilang tanpa penjelasan terbaca sebagai fitur yang rusak;
              tombol mati tanpa alasan terbaca sebagai bug. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {punyaAkun ? (
              <>
                {onSimpan && (
                  <Button
                    size="sm"
                    variant={statusSimpan === "tersimpan" ? "outline" : "default"}
                    onClick={onSimpan}
                    disabled={statusSimpan === "menyimpan"}
                    title={t("Simpan rencana ke Perjalanan Saya")}
                  >
                    {statusSimpan === "tersimpan" ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <BookmarkPlus className="h-4 w-4" />
                    )}
                    {statusSimpan === "menyimpan"
                      ? t("Menyimpan…")
                      : statusSimpan === "tersimpan"
                        ? t("Tersimpan")
                        : t("Simpan Perjalanan")}
                  </Button>
                )}
                {onExport && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onExport}
                    title={t("Unduh rencana sebagai PDF")}
                  >
                    <FileDown className="h-4 w-4" />
                    {t("Ekspor PDF")}
                  </Button>
                )}
              </>
            ) : (
              <Link
                to="/masuk"
                className="sentuh flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink no-underline transition-colors hover:bg-ink/5"
                title={t("Masuk untuk menyimpan rencana dan mengunduh PDF")}
              >
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {t("Masuk untuk simpan & ekspor PDF")}
              </Link>
            )}
          </div>
        </div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Danau Toba <span className="gradient-text">Heritage</span>
        </h1>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-brand-sand-ink" />
            {s.n_days} {t("Hari")}{s.n_nights > 0 ? `, ${s.n_nights} ${t("Malam")}` : ` · ${t("Trip pulang-hari")}`}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-brand-sand-ink" />
            {s.n_orang} {t("Orang")}
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-600" />
            {t("Profil")} {t(s.profil)}
          </span>
          <span className="flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-brand-sand-ink" />
            {s.minat?.length ? s.minat.join(" & ") : "Umum"}
          </span>
        </div>
      </motion.div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { icon: Wallet, k: t("Estimasi Biaya"), n: totalEstimasi, fmt: rp, d: `${persenTerpakai}% ${t("dari budget")}` },
          {
            icon: Wallet,
            k: t("Sisa Budget"),
            n: sisaEstimasi,
            fmt: rp,
            d: lewatBudget ? t("melebihi budget") : `${t("dari budget")} ${rp(s.budget_total)}`,
          },
          { icon: Route, k: t("Total Jarak"), n: totalKm, fmt: (x: number) => `${x} km`, d: `${nDest} ${t("destinasi")}` },
          {
            icon: Wallet,
            k: t("Per Hari"),
            n: b.per_hari,
            fmt: rp,
            // Keterangan di bawah nilai HARIAN wajib memakai penyebut harian.
            // Sebelumnya di sini tertulis `per_orang` — biaya satu orang untuk
            // SELURUH perjalanan — sehingga pada 3 hari / 2 orang keterangannya
            // (Rp 2,5 jt) justru lebih besar daripada nilai yang diterangkan
            // (Rp 1,67 jt). Dua penyebut berbeda disajikan seolah yang satu
            // memperjelas yang lain.
            d: `${rp(b.per_orang_per_hari)} / ${t("orang / hari")}`,
          },
        ].map(({ icon: Icon, k, n, fmt, d }, i) => (
          <motion.div
            key={k}
            className="spotlight card-glow rounded-2xl border border-ink/10 bg-ink/[0.04] p-3.5"
            onMouseMove={trackSpotlight}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-wider text-ink-faint">
              <Icon className="h-3 w-3" />
              {k}
            </div>
            <div
              className={
                "mt-1 font-display text-lg font-bold " +
                (k === "Sisa Budget" && lewatBudget ? "text-red-600" : "text-ink")
              }
            >
              <CountUp value={n} format={fmt} />
            </div>
            <div className="text-[0.65rem] text-ink-faint">{d}</div>
          </motion.div>
        ))}
      </div>

      {/* Rincian biaya transportasi — sudah termasuk di Estimasi Biaya. */}
      {itinerary.transport && (
        <div className="mt-2.5 rounded-xl border border-ink/10 bg-ink/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-soft">
              <Fuel className="h-3.5 w-3.5 text-brand-amber-ink" />
              {t(itinerary.transport.label)}
            </span>
            <span className="text-ink-faint">
              {itinerary.transport.moda === "umum"
                ? `${rp(itinerary.transport.tarif_umum_per_orang_per_hari)} / ${t("per orang")} / ${t("Hari")}`
                : `${rp(itinerary.transport.tarif_per_km)} / km × ${itinerary.transport.km_total} km`}
            </span>
            {itinerary.transport.n_penyeberangan > 0 && (
              <span className="text-ink-faint">
                {t("Feri")} {itinerary.transport.n_penyeberangan}× ={" "}
                {rp(itinerary.transport.biaya_feri)}
              </span>
            )}
            <span className="ml-auto font-display text-sm font-bold text-ink">
              {rp(itinerary.transport.total)}
            </span>
          </div>

          {!itinerary.transport.realistis && (
            <p className="mt-2 text-[0.68rem] leading-relaxed text-amber-700">
              {t("Jarak rencana ini terlalu jauh untuk moda tersebut")} —{" "}
              {itinerary.transport.km_per_hari} km/{t("Hari")}, {t("batas wajar")}{" "}
              {itinerary.transport.batas_km_per_hari} km/{t("Hari")}.
            </p>
          )}
        </div>
      )}

      {/* Umpan balik saat pengguna mengganti pilihan makan */}
      <AnimatePresence>
        {deltaMakan !== 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={
                "mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs " +
                (lewatBudget
                  ? "border-red-400/30 bg-red-500/10 text-red-700"
                  : "border-amber-400/25 bg-amber-400/5 text-amber-800")
              }
            >
              <span>
                Pilihan makanmu mengubah estimasi{" "}
                <b>
                  {deltaMakan > 0 ? "+" : "−"}
                  {rp(Math.abs(deltaMakan))}
                </b>{" "}
                dari rekomendasi AI.
                {lewatBudget && " Total kini melebihi budget."}
              </span>
              <button
                type="button"
                onClick={() => setPick(() => ({}))}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 font-semibold transition hover:bg-ink/[0.07]"
              >
                <RotateCcw className="h-3 w-3" />
                {t("Kembalikan")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="spotlight card-glow mt-5 flex gap-3.5 rounded-2xl border border-brand-sage/25 bg-gradient-to-br from-brand-sage/12 to-brand-sand/8 p-4 hover:-translate-y-0.5"
        onMouseMove={trackSpotlight}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Tanpa penginapan, hotel tidak direkomendasikan sama sekali — yang
            tampil adalah titik acuan keberangkatan (lokasi turis). */}
        <VectorThumb kind={itinerary.hotel ? "hotel" : "travel"} />
        <div className="min-w-0 flex-1">
          {itinerary.hotel ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge>{t("Penginapan")}</Badge>
                <Badge variant="success">{t("Titik rute harian")}</Badge>
              </div>
              <h4 className="mt-1 font-display text-lg font-bold text-ink">
                {itinerary.hotel.name}
              </h4>
              <div className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-600" />
                {itinerary.hotel.rating ?? "–"} ·{" "}
                {`${rp(itinerary.hotel.price)}/${t("malam")} × ${s.n_nights} ${t("malam")}`}
              </div>
              {itinerary.hotel.address && (
                <div className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                  <MapPin className="h-3 w-3" />
                  {itinerary.hotel.address}
                </div>
              )}
              <PilihanHotel
                kandidat={itinerary.hotel_kandidat ?? []}
                onPilih={onPilihHotel}
                planning={planning}
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge>{t("Titik Keberangkatan")}</Badge>
                <Badge variant="success">{t("Tanpa penginapan")}</Badge>
              </div>
              <h4 className="mt-1 font-display text-lg font-bold text-ink">
                {t(acuan?.["place-name"] ?? "Titik acuan")}
              </h4>
              <div className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                <MapPin className="h-3 w-3" />
                {acuan
                  ? `${acuan.latitude.toFixed(5)}, ${acuan.longitude.toFixed(5)}`
                  : t("Koordinat tidak tersedia")}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                {t("Rute harian berangkat dan kembali ke titik ini. Tidak ada biaya penginapan.")}
              </p>
            </>
          )}
        </div>
      </motion.div>

      {/* Hari dipilih lewat tombol berjajar; agenda baru muncul saat ditekan. */}
      <div
        className="mt-7 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Pilih hari perjalanan"
      >
        {itinerary.days.map((d) => {
          const aktif = d.day === activeDay;
          return (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => setActiveDay(d.day)}
              className={
                "relative rounded-2xl border px-4 py-2.5 text-left transition " +
                (aktif
                  ? "border-transparent text-on-sage-ink"
                  : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:border-ink/20 hover:text-ink")
              }
            >
              {aktif && (
                <motion.span
                  layoutId="day-tab-active"
                  className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-brand-sage-ink to-brand-forest shadow-lg shadow-brand-forest/25"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="block font-display text-sm font-bold">{t("Hari")} {d.day}</span>
              <span
                className={
                  "block text-[0.66rem] " + (aktif ? "text-white/80" : "text-ink-faint")
                }
              >
                {d.n_wisata} {t("Wisata")} · ~{d.distance_km ?? 0} km
              </span>
            </button>
          );
        })}
      </div>

      {dayAktif && (
        <AnimatePresence mode="wait">
          <motion.section
            key={dayAktif.day}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-5"
            role="tabpanel"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-amber/50 bg-brand-amber/10 text-xs font-bold text-brand-amber-ink">
                {dayAktif.day}
              </span>
              <h3 className="font-display text-lg font-bold text-ink">
                {t(temaHari(dayAktif))}
                {dayAktif.weekday && (
                  <span className="ml-2 text-sm font-semibold text-ink-faint">
                    · {t(dayAktif.weekday)}
                  </span>
                )}
              </h3>
              <span className="ml-auto text-xs text-ink-faint">
                ~{dayAktif.distance_km ?? 0} km
                {dayAktif.drive_minutes ? ` · ${Math.round(dayAktif.drive_minutes)} mnt` : ""}
              </span>
            </div>

            <div className="relative ml-3.5 mt-3 flex flex-col gap-3 pl-6">
              {/* Garis waktu bergradient, memudar di ujung bawah */}
              <span className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-brand-amber/60 via-brand-sage/25 to-transparent" />
              {dayAktif.agenda.map((a, i) => renderItem(a, dayAktif.day, i))}
            </div>

            {/* MODUL 7 — SPBU, ATM, rumah sakit, dll di kabupaten hari ini */}
            <PanelFasilitas
              grup={dayAktif.fasilitas ?? []}
              kabupaten={dayAktif.kabupaten ?? []}
            />
          </motion.section>
        </AnimatePresence>
      )}
    </Card>
  );
}
