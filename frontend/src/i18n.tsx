import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bahasa } from "./types";
import { fetchLanguages, translateUI } from "./api";
import { EN } from "./locales/en";

/**
 * Multibahasa. Kuncinya adalah teks Indonesia itu sendiri, jadi terjemahan yang
 * belum tersedia jatuh ke teks asli, bukan layar kosong.
 *
 * EN memakai kamus statis (locales/en.ts); bahasa lain diterjemahkan sekali
 * lewat /api/translate-ui lalu di-cache di localStorage.
 */

const KUNCI_BAHASA = "tourcation.lang";
const KUNCI_KAMUS = (kode: string) => `tourcation.dict.${kode}`;

interface I18nValue {
  lang: string;
  langs: Bahasa[];
  setLang: (kode: string) => void;
  t: (teks: string) => string;
  memuat: boolean;
  galat: string | null;
}

const I18nContext = createContext<I18nValue>({
  lang: "id",
  langs: [],
  setLang: () => {},
  t: (s) => s,
  memuat: false,
  galat: null,
});

/** Didaftar eksplisit agar satu panggilan cukup untuk seluruh situs. */
export const STRING_UI: string[] = [
  // Navbar & footer
  "Home", "Perjalanan", "Galeri", "AI Guide", "Dampak UMKM", "Ekspor PDF", "Plan Trip",
  "Unduh rencana sebagai PDF",
  "Ke beranda", "Dibuat untuk penjelajah modern", "Bahasa",
  // Section galeri
  "Sekilas Danau Toba", "Lihat Sendiri Keindahannya",
  "Kaldera vulkanik terbesar di dunia, danau sepanjang 100 kilometer, dan budaya Batak yang hidup di tepiannya.",
  "Geser untuk menjelajah — klik kartu untuk melihat selengkapnya",
  "Sebelumnya", "Berikutnya", "Putar", "Tutup",
  "Pulau Samosir", "Pulau seluas Singapura di tengah danau",
  "Bukit Holbung", "Punggung bukit hijau menghadap perairan",
  "Air Terjun Sipiso-piso", "Terjunan 120 meter di ujung utara kaldera",
  "Desa Tomok", "Rumah bolon dan makam batu raja Batak",
  // Halaman detail galeri
  "Halaman ini masih disiapkan. Konten lengkapnya segera hadir.",
  "Halaman tidak ditemukan", "Destinasi yang kamu cari tidak ada dalam galeri.",
  // Pilihan penginapan
  "Pilihan penginapan", "rata-rata ke wisata", "rencana saat ini", "total",
  "Lihat {n} hotel teratas lainnya", "Sembunyikan hotel lain",
  "Mengganti penginapan menyusun ulang seluruh rencana — wisata, urutan rute, dan biayanya ikut berubah.",
  // Transportasi
  "Transportasi", "Angkutan umum", "Dipakai", "Jalan kaki", "Motor", "Mobil",
  "Tarif per orang per hari dari data operator antarkota.",
  "Tanpa biaya BBM. Feri dihitung tarif pejalan kaki.",
  "Biaya BBM dihitung dari jarak rute dan ikut membatasi budget.",
  "Feri", "Jarak rencana ini terlalu jauh untuk moda tersebut", "batas wajar",
  // Hero
  "Discover the Magic of", "Susun Perjalanan", "Scroll",
  "Tanya AI soal Danau Toba…", "Salin", "Tersalin",
  "Susun rencana agar jawabannya lebih spesifik.",
  "AI menyusun perjalananmu di danau vulkanik terbesar Asia Tenggara — itinerari personal, rute harian yang efisien, dan pilihan kuliner yang berpihak pada UMKM lokal.",
  // Panel Atur Perjalanan
  "Atur Perjalanan", "Budget Total (Rp)", "Durasi (Hari)", "Jumlah Orang",
  "Wisata Per Hari", "Minat Wisata", "Gaya Pengalaman", "Saran AI",
  "Dipilihkan dari budget per hari", "Susun Rencana", "AI menyusun rencana…",
  "Dijamin tidak melebihi budget", "Mendukung UMKM & wisata lokal",
  "Penginapan", "Termasuk", "Tidak", "malam", "tanpa menginap",
  "Gunakan lokasi saya", "Perbarui lokasi saya",
  "Hotel tidak dibiayai. Rute berangkat dari titik acuan pilihanmu.",
  "Tanpa lokasi, rute tetap berpangkal di hotel acuan terdekat.",
  "Meminta izin lokasi…", "Titik acuan: lokasi Anda saat ini.",
  "Izin lokasi ditolak. Rute akan berpangkal di hotel acuan.",
  "Tips Lokal",
  // Papan itinerary
  "Perjalanan Dioptimalkan AI", "Hari", "Malam", "Orang", "Profil", "Umum",
  "Estimasi Biaya", "Sisa Budget", "Total Jarak", "Per Hari", "per orang",
  "dari budget", "melebihi budget", "destinasi", "Titik Keberangkatan",
  "Titik rute harian", "Tanpa penginapan", "Titik acuan",
  "Koordinat tidak tersedia",
  "Rute harian berangkat dan kembali ke titik ini. Tidak ada biaya penginapan.",
  "Wisata", "Sarapan", "Makan siang", "Makan malam", "pilihan sepadan",
  "rekomendasi AI", "Gratis masuk", "per grup", "Highly Rated", "Kembalikan",
  "AI sedang menyusun…", "Siap menyusun rencana", "Mulai dari",
  "Alam", "Budaya", "Rohani", "Rekreasi",
  "Alam & Petualangan", "Budaya & Akar Tradisi", "Ziarah & Refleksi",
  "Rekreasi & Keluarga", "Eksplorasi", "Eksplorasi Campuran",
  // Peta
  "Peta Rute", "Peta rute muncul setelah rencana disusun.",
  "Destinasi Terdekat", "Total Biaya Wisata", "Total Biaya BBM",
  "Perlu menyeberang", "Buka di Google Maps", "Titik berangkat", "Perhentian",
  "Singgahan tambahan", "Cari lokasi", "Gunakan lokasiku",
  "Kembali berangkat dari hotel", "Lokasi Saya",
  // Analisis AI
  "Di balik layar", "Analisis", "Budget Solver", "Route Optimizer",
  "Time-Aware Filter", "Ferry Detector", "UMKM Scorer", "Modul",
  "Wisata terpilih", "Resto terpilih", "Total agenda", "Ragam kuliner khas",
  "Tanya AI", "Tanpa feri", "penyeberangan",
  // Dampak UMKM
  "Dampak Ekonomi Lokal", "Dampak", "Usaha Lokal Otentik",
  "Ragam Kuliner Khas", "Usaha Unik Dikunjungi",
  "Porsi kunjungan ke usaha lokal", "Kuliner khas Batak dalam rencana ini",
  "Belum ada rencana untuk diukur",
  // Penerjemah
  "Penerjemah AI", "Siap menerjemahkan", "Menerjemahkan…",
  "Ketik teks untuk diterjemahkan…", "Hapus percakapan", "Tukar bahasa",
  "Rekam suara", "Berhenti merekam", "Mendengarkan…", "Terjemahkan",
  "Dengarkan", "Enter kirim · Shift+Enter baris baru",
];

function bacaKamus(kode: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(KUNCI_KAMUS(kode));
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function simpanKamus(kode: string, kamus: Record<string, string>) {
  try {
    localStorage.setItem(KUNCI_KAMUS(kode), JSON.stringify(kamus));
  } catch {
    /* localStorage penuh atau diblokir — abaikan, cukup jalan tanpa cache */
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(
    () => localStorage.getItem(KUNCI_BAHASA) || "id",
  );
  const [langs, setLangs] = useState<Bahasa[]>([]);
  const [kamus, setKamus] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    fetchLanguages()
      .then(setLangs)
      .catch(() => setLangs([]));
  }, []);

  // EN statis, ID kosong (bahasa dasar), sisanya cache lalu AI.
  useEffect(() => {
    let batal = false;
    setGalat(null);

    if (lang === "id") {
      setKamus({});
      return;
    }
    if (lang === "en") {
      setKamus(EN);
      return;
    }

    const tersimpan = bacaKamus(lang);
    if (tersimpan) {
      setKamus(tersimpan);
      return;
    }

    setMemuat(true);
    translateUI(STRING_UI, lang)
      .then((m) => {
        if (batal) return;
        setKamus(m);
        simpanKamus(lang, m);
      })
      .catch((e: Error) => {
        if (batal) return;
        setKamus({});
        setGalat(e.message || "Gagal memuat terjemahan.");
      })
      .finally(() => !batal && setMemuat(false));

    return () => {
      batal = true;
    };
  }, [lang]);

  const setLang = useCallback((kode: string) => {
    setLangState(kode);
    try {
      localStorage.setItem(KUNCI_BAHASA, kode);
    } catch {
      /* abaikan */
    }
    document.documentElement.lang = kode;
  }, []);

  const t = useCallback((teks: string) => kamus[teks] ?? teks, [kamus]);

  const value = useMemo<I18nValue>(
    () => ({ lang, langs, setLang, t, memuat, galat }),
    [lang, langs, setLang, t, memuat, galat],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Pintasan bila komponen hanya butuh fungsi terjemahannya. */
export function useT(): (teks: string) => string {
  return useContext(I18nContext).t;
}
