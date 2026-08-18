import { AlertTriangle, Megaphone, MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  ambilAspirasiSaya,
  ambilPengumuman,
  kirimAspirasi,
} from "../apiKomunitas";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import type {
  Aspirasi,
  JenisPengumuman,
  KategoriAspirasi,
  Pengumuman,
  StatusAspirasi,
} from "../typesKomunitas";

const KATEGORI: KategoriAspirasi[] = [
  "INFRASTRUKTUR", "PERMODALAN", "PELATIHAN", "PROMOSI", "PERIZINAN", "LAINNYA",
];

const WARNA_STATUS: Record<StatusAspirasi, string> = {
  BARU: "bg-brand-amber/20 text-brand-amber-ink",
  DIBACA: "bg-ink/5 text-ink-soft",
  DITINDAKLANJUTI: "bg-brand-sage/15 text-brand-sage-ink",
  SELESAI: "bg-brand-sage/25 text-brand-sage-ink",
  DITOLAK: "bg-rose-100 text-rose-700",
};

const WARNA_JENIS: Record<JenisPengumuman, string> = {
  KEBIJAKAN: "bg-brand-sage/15 text-brand-sage-ink",
  BANTUAN: "bg-brand-amber/20 text-brand-amber-ink",
  PELATIHAN: "bg-brand-sand/20 text-brand-sand-ink",
  EVENT: "bg-ink/5 text-ink-soft",
  LAINNYA: "bg-ink/5 text-ink-faint",
};

const KELAS_INPUT =
  "sentuh w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-sage";

/**
 * Jalur dua arah dari sisi UMKM.
 *
 * Kiri: pengumuman dari dinas (kebijakan, bantuan, pelatihan).
 * Kanan: aspirasi yang dikirim pelaku usaha beserta tanggapannya.
 *
 * Digabung dalam satu halaman karena keduanya adalah percakapan yang sama —
 * memisahkannya membuat tanggapan dinas terasa terputus dari pengumumannya.
 */
export default function UmkmSuara() {
  const t = useT();
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([]);
  const [aspirasi, setAspirasi] = useState<Aspirasi[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);

  const [kategori, setKategori] = useState<KategoriAspirasi>("LAINNYA");
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([ambilPengumuman(), ambilAspirasiSaya()]);
      setPengumuman(p.pengumuman);
      setAspirasi(a.aspirasi);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function kirim() {
    setSibuk(true);
    setPesan(null);
    try {
      await kirimAspirasi(kategori, judul, isi);
      setJudul("");
      setIsi("");
      setPesan(t("Aspirasi terkirim. Dinas akan meninjaunya."));
      await muat();
    } catch (e) {
      setPesan((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Suara & Pengumuman")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Sampaikan kendala usaha Anda, dan ikuti kebijakan serta bantuan dari dinas")}
        </p>
      </div>

      {galat && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {galat}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Pengumuman dinas ─────────────────────────────────────── */}
        <Reveal>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <Megaphone className="h-5 w-5 text-brand-sage-ink" aria-hidden />
              {t("Dari Dinas")}
            </h2>

            {memuat ? (
              <div className="space-y-2">
                {[0, 1].map((i) => <div key={i} className="skel h-24 rounded-xl" />)}
              </div>
            ) : pengumuman.length === 0 ? (
              <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
                {t("Belum ada pengumuman untuk wilayah Anda.")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {pengumuman.map((p) => (
                  <li key={p.id} className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-extrabold text-ink">{p.judul}</p>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_JENIS[p.jenis]}`}
                      >
                        {t(p.jenis)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {p.instansi ?? "—"} · {p.created_at.slice(0, 10)}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                      {p.isi}
                    </p>
                    {p.nilai_bantuan != null && (
                      <p className="mt-1.5 text-xs font-bold text-brand-amber-ink">
                        {t("Nilai bantuan")}: Rp {p.nilai_bantuan.toLocaleString("id-ID")}
                      </p>
                    )}
                    {p.cara_daftar && (
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-ink-faint">
                        {t("Cara mendaftar")}: {p.cara_daftar}
                      </p>
                    )}
                    {p.tenggat && (
                      <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                        {t("Tenggat")}: {p.tenggat}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        {/* ── Kirim aspirasi + riwayat ─────────────────────────────── */}
        <Reveal index={1}>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <MessageSquare className="h-5 w-5 text-brand-sage-ink" aria-hidden />
              {t("Sampaikan Aspirasi")}
            </h2>

            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t("Kategori")}
                </span>
                <select
                  className={KELAS_INPUT}
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as KategoriAspirasi)}
                >
                  {KATEGORI.map((k) => (
                    <option key={k} value={k}>{t(k)}</option>
                  ))}
                </select>
              </label>
              <input
                className={KELAS_INPUT}
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder={t("Ringkas kendalanya dalam satu kalimat")}
              />
              <textarea
                rows={4}
                className={KELAS_INPUT}
                value={isi}
                onChange={(e) => setIsi(e.target.value)}
                placeholder={t("Jelaskan selengkapnya — apa kendalanya dan bantuan seperti apa yang dibutuhkan")}
              />
              <button
                type="button"
                disabled={sibuk || !judul.trim() || !isi.trim()}
                onClick={() => void kirim()}
                className="sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-extrabold text-on-sage-ink disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                {sibuk ? t("Mengirim...") : t("Kirim Aspirasi")}
              </button>
              {pesan && (
                <p className="rounded-xl bg-ink/[0.04] p-2.5 text-xs text-ink-soft">{pesan}</p>
              )}
            </div>

            {aspirasi.length > 0 && (
              <div className="mt-5 border-t border-ink/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {t("Aspirasi Anda")}
                </p>
                <ul className="mt-2 space-y-2">
                  {aspirasi.map((a) => (
                    <li key={a.id} className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{a.judul}</p>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS[a.status]}`}
                        >
                          {t(a.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {t(a.kategori)} · {a.created_at.slice(0, 10)}
                      </p>
                      {a.tanggapan && (
                        <div className="mt-2 rounded-lg border-l-2 border-brand-sage bg-brand-sage/[0.07] p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-sage-ink">
                            {t("Tanggapan dinas")}
                          </p>
                          <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                            {a.tanggapan}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </Reveal>
      </div>
    </div>
  );
}
