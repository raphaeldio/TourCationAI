import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GayaJelajahOption,
  Itinerary,
  MinatOption,
  PlanForm,
  ProfilOption,
} from "./types";
import { fetchMeta, planItinerary } from "./api";
import { simpanPerjalanan } from "./apiPerjalanan";
import { useAuth } from "./auth";
import { exportItineraryPdf } from "./exportPdf";
import { hitungDampak } from "./dampak";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AiAnalysis from "./components/AiAnalysis";
import ItineraryBoard from "./components/ItineraryBoard";
import RekomendasiLainnya from "./components/RekomendasiLainnya";
import SidePanel from "./components/SidePanel";
import UmkmImpact from "./components/UmkmImpact";
import IntelligenceSection from "./components/IntelligenceSection";
import TranslatorBot from "./components/TranslatorBot";

const DEFAULT_FORM: PlanForm = {
  budget_total: 5_000_000,
  n_days: 3,
  n_orang: 2,
  minat_wisata: ["Alam", "Budaya"],
  max_attractions_per_day: 3,
  profil_pilihan: null,
  include_penginapan: true,
  origin: null,
  moda: "mobil",
  gaya_jelajah: "Dekat-dekat",
  // Hari ini sebagai default agar filter libur mingguan langsung aktif.
  tanggal_mulai: new Date().toISOString().slice(0, 10),
  hotel_pilihan: null,   // null = sistem memilih sendiri lewat ILP
};

export default function App() {
  const { sesi } = useAuth();
  const [minat, setMinat] = useState<MinatOption[]>([]);
  const [profil, setProfil] = useState<ProfilOption[]>([]);
  const [gayaJelajah, setGayaJelajah] = useState<GayaJelajahOption[]>([]);
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pertanyaan yang dikirim dari kartu analisis ke kotak pencarian di hero.
  const [seed, setSeed] = useState<string | null>(null);
  // Pilihan tempat makan per slot. Diangkat ke App karena section Dampak UMKM,
  // analisis AI, dan ekspor PDF sama-sama bergantung padanya.
  const [pick, setPick] = useState<Record<string, number>>({});
  const [statusSimpan, setStatusSimpan] = useState<"menyimpan" | "tersimpan" | null>(null);

  useEffect(() => {
    setPick({});
    // Rencana baru berarti simpanan sebelumnya tidak lagi relevan; tanpa reset,
    // tombolnya tetap berbunyi "Tersimpan" untuk rencana yang belum disimpan.
    setStatusSimpan(null);
  }, [itinerary]);

  // Dampak UMKM mengikuti pilihan turis, bukan rekomendasi awal server.
  const dampak = useMemo(() => hitungDampak(itinerary, pick), [itinerary, pick]);

  useEffect(() => {
    fetchMeta()
      .then((m) => {
        setMinat(m.minat);
        setProfil(m.profil);
        setGayaJelajah(m.gaya_jelajah ?? []);
      })
      .catch(() => {
        setMinat([]);
        setProfil([]);
        setGayaJelajah([]);
      });
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Penanda, bukan pemanggilan langsung: elemen #planner baru ada setelah
  // itinerary ter-render, jadi gulirnya dijalankan di useEffect di bawah.
  const mintaGulirKeHasil = useRef(false);

  useEffect(() => {
    if (!itinerary || !mintaGulirKeHasil.current) return;
    mintaGulirKeHasil.current = false;
    scrollTo("planner");
  }, [itinerary, scrollTo]);

  /** @param gulirKeHasil bawa layar ke papan itinerary begitu rencana jadi. */
  const plan = async (override?: PlanForm, gulirKeHasil = false) => {
    const f = override ?? form;
    setPlanning(true);
    setError(null);
    try {
      const it = await planItinerary(f);
      if (it.status !== "Optimal") {
        setItinerary(null);
        setError(it.message || "Solver tidak menemukan solusi. Coba naikkan budget atau durasi.");
      } else {
        mintaGulirKeHasil.current = gulirKeHasil;
        setItinerary(it);
      }
    } catch (e) {
      setItinerary(null);
      setError((e as Error).message || "Gagal menghubungi server.");
    } finally {
      setPlanning(false);
    }
  };

  /** Ganti penginapan: rencana disusun ULANG karena hotel adalah acuan jarak. */
  const pilihHotel = useCallback(
    (nama: string) => {
      const f = { ...form, hotel_pilihan: nama };
      setForm(f);
      void plan(f);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  /** Susun ulang dari awal. Pilihan hotel dilepas agar sistem mencari lagi. */
  const rencanaBaru = () => {
    const f = { ...form, hotel_pilihan: null };
    setForm(f);
    void plan(f, true);
  };

  const exportTrip = () => {
    if (!itinerary) return;
    // `pick` diteruskan supaya biaya di PDF sama dengan yang tampil di layar.
    exportItineraryPdf(itinerary, dampak, pick);
  };

  /**
   * Simpan rencana ke inbox. Yang dikirim adalah payload yang SEDANG DILIHAT,
   * termasuk `pick` — pilihan rumah makan turis ikut tersimpan supaya rencana
   * yang dibuka kembali sama dengan yang ia tutup, bukan rekomendasi awal
   * server.
   */
  const simpanTrip = async () => {
    if (!itinerary?.itinerary_id) return;
    setStatusSimpan("menyimpan");
    try {
      await simpanPerjalanan(itinerary.itinerary_id, { ...itinerary, pick });
      setStatusSimpan("tersimpan");
    } catch (e) {
      setStatusSimpan(null);
      setError((e as Error).message);
    }
  };

  // Kartu analisis mengirim pertanyaan ke kotak AI di hero, lalu menggulir ke sana.
  const tanyaAI = useCallback(
    (q: string) => {
      setSeed(q);
      scrollTo("home");
    },
    [scrollTo],
  );

  return (
    <div className="min-h-screen">
      <Navbar onPlanTrip={() => scrollTo("planner")} />

      {/* Di luar `.app` agar hero mengisi penuh lebar peramban. */}
      <Hero
        itinerary={itinerary}
        seed={seed}
        onSeedConsumed={() => setSeed(null)}
        onViewPlanner={() => scrollTo("planner")}
        pick={pick}
      />

      {/* Sisa halaman tetap di dalam `.app` (lebar 1400px + padding sisi). */}
      <div className="app">
        <div className="dash grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
          <ItineraryBoard
            itinerary={itinerary}
            planning={planning}
            pick={pick}
            setPick={setPick}
            onPilihHotel={pilihHotel}
            // Ekspor PDF digerbangi akun. Fungsinya tidak diteruskan sama sekali
            // bagi pemanggil anonim — kalau hanya tombolnya yang disembunyikan,
            // jalur ekspornya tetap hidup di dalam komponen.
            onExport={sesi ? exportTrip : undefined}
            onSimpan={itinerary?.itinerary_id ? () => void simpanTrip() : undefined}
            punyaAkun={Boolean(sesi)}
            statusSimpan={statusSimpan}
          />
          <SidePanel
            minat={minat}
            profil={profil}
            gayaJelajah={gayaJelajah}
            form={form}
            setForm={setForm}
            onPlan={() => void rencanaBaru()}
            planning={planning}
            error={error}
            itinerary={itinerary}
          />
        </div>

        {/* Sengaja SAUDARA ItineraryBoard, bukan di dalamnya: blok ini juga
            ditempel setelah payload final di backend, dan tidak memengaruhi
            satu angka pun pada rencana di atas. */}
        <RekomendasiLainnya blok={itinerary?.rekomendasi_lainnya} />

        <AiAnalysis itinerary={itinerary} onTanya={tanyaAI} dampak={dampak} />

        <UmkmImpact dampak={dampak} />

        <IntelligenceSection />

        <footer className="glass footer mt-10 flex items-center justify-between rounded-2xl px-5 py-4 text-xs text-ink-faint">
          <span>© 2026 TourCation AI · Danau Toba AI Tourism</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-brand-amber" />
            Dibuat untuk penjelajah modern
          </span>
        </footer>
      </div>

      <TranslatorBot />
    </div>
  );
}
