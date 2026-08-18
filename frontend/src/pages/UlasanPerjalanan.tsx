import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Flag,
  Landmark,
  MapPin,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ambilDetailUlasan, kirimUlasan } from "../apiPerjalanan";
import Bintang from "../components/Bintang";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import {
  LABEL_BIAYA,
  LABEL_KATEGORI,
  LABEL_STATUS_LAPORAN,
  LABEL_TINGKAT,
  LABEL_WAKTU,
} from "../labelPerjalanan";
import type {
  AkurasiBiaya,
  AkurasiWaktu,
  DetailUlasan,
  KategoriLaporan,
  LaporanBaru,
  TingkatLaporan,
} from "../typesPerjalanan";

const IKON_JENIS = { wisata: MapPin, resto: Building2, hotel: Landmark };

/** Draft laporan di layar; `kunci` hanya untuk React, tidak dikirim ke server. */
interface DraftLaporan extends LaporanBaru {
  kunci: number;
}

/**
 * Halaman ulasan pasca-perjalanan.
 *
 * Satu formulir, tiga muara — dan pembagiannya dijelaskan apa adanya kepada
 * wisatawan, bukan disembunyikan. Alasannya bukan sekadar transparansi: orang
 * yang tahu keluhan jalan rusak sampai ke dinas dan bukan ke pemilik warung
 * akan menulis keluhan yang berguna bagi dinas.
 *
 * Nama tempat TIDAK PERNAH diketik. Seluruh daftarnya datang dari server
 * (`itinerary_place` perjalanan ini), karena nama yang masuk laporan harus sama
 * persis dengan yang dipakai dataset agar bisa dijoin ke `umkm_business` dan
 * diagregasi per kabupaten. Kolom teks bebas untuk nama tempat akan memecah
 * agregat itu tanpa ada yang menyadarinya.
 */
export default function UlasanPerjalanan() {
  const t = useT();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<DetailUlasan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [selesai, setSelesai] = useState<string | null>(null);

  const [skor, setSkor] = useState(0);
  const [biaya, setBiaya] = useState<AkurasiBiaya | null>(null);
  const [waktu, setWaktu] = useState<AkurasiWaktu | null>(null);
  const [jadiBerangkat, setJadiBerangkat] = useState(true);
  const [catatan, setCatatan] = useState("");
  const [penilaian, setPenilaian] = useState<Record<string, number>>({});
  const [laporan, setLaporan] = useState<DraftLaporan[]>([]);

  const muat = useCallback(async () => {
    try {
      const d = await ambilDetailUlasan(id);
      setData(d);
      const awal: Record<string, number> = {};
      for (const u of Object.values(d.usaha_tertaut)) {
        if (u.rating_saya) awal[u.business_id] = u.rating_saya;
      }
      setPenilaian(awal);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  // Tempat dikelompokkan per hari supaya urutannya sama dengan yang dilihat
  // wisatawan di rencananya. Hotel tidak punya nomor hari; ia diletakkan
  // terakhir dengan label sendiri, bukan dipaksa masuk hari 1.
  const perHari = useMemo(() => {
    if (!data) return [];
    const peta = new Map<number, typeof data.tempat>();
    for (const tp of data.tempat) {
      const h = tp.hari ?? 0;
      if (!peta.has(h)) peta.set(h, []);
      peta.get(h)!.push(tp);
    }
    return [...peta.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  function tambahLaporan(placeName: string) {
    setLaporan((l) => [
      ...l,
      { kunci: Date.now() + l.length, place_name: placeName, kategori: "LAINNYA", tingkat: "SEDANG", isi: "" },
    ]);
  }

  function ubahLaporan(kunci: number, patch: Partial<DraftLaporan>) {
    setLaporan((l) => l.map((x) => (x.kunci === kunci ? { ...x, ...patch } : x)));
  }

  async function kirim() {
    if (!skor) {
      setGalat(t("Beri penilaian keseluruhan terlebih dahulu."));
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const hasil = await kirimUlasan(id, {
        skor_keseluruhan: skor,
        akurasi_biaya: biaya,
        akurasi_waktu: waktu,
        jadi_berangkat: jadiBerangkat,
        catatan: catatan || null,
        laporan: laporan.map(({ kunci: _kunci, ...sisa }) => sisa),
        penilaian: Object.entries(penilaian).map(([business_id, rating]) => ({
          business_id,
          rating,
        })),
      });
      setSelesai(
        `${t("Terima kasih. Tersimpan")}: ${hasil.n_penilaian} ${t("penilaian usaha")}, ` +
          `${hasil.n_laporan} ${t("laporan lapangan")}.`,
      );
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (galat && !data) {
    return (
      <Bingkai>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
            <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat data")}
          </p>
          <p className="mt-1 text-sm text-rose-700">{galat}</p>
        </div>
      </Bingkai>
    );
  }

  if (!data) {
    return (
      <Bingkai>
        <div className="space-y-3">
          <div className="skel h-28 rounded-2xl" />
          <div className="skel h-64 rounded-2xl" />
        </div>
      </Bingkai>
    );
  }

  const p = data.perjalanan;
  const sudah = data.ulasan !== null;

  return (
    <Bingkai>
      <header className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {sudah ? t("Ulasan Perjalanan Anda") : t("Bagaimana perjalanan Anda?")}
        </h1>
        <p className="mt-1 text-xs text-ink-faint sm:text-sm">
          {(p.kabupaten_tersentuh ?? []).join(" · ") || t("Kawasan Danau Toba")}
          {" · "}
          {p.n_days} {t("hari")}
          {p.tanggal_mulai ? ` · ${p.tanggal_mulai} → ${p.tanggal_selesai}` : ""}
        </p>

        {/* Pembagian muara dijelaskan di muka. Wisatawan yang tahu keluhan
            infrastruktur sampai ke dinas menulis keluhan yang berguna bagi
            dinas — bukan keluhan yang salah alamat. */}
        <div className="mt-3 grid gap-2 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-soft sm:grid-cols-2">
          <p className="flex gap-2">
            <Bintang nilai={5} ukuran="sm" />
            <span>{t("Penilaian usaha sampai ke pemilik warung dan skor kepercayaannya.")}</span>
          </p>
          <p className="flex gap-2">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber" aria-hidden />
            <span>
              {t(
                "Laporan lapangan sampai ke dinas pariwisata secara anonim — tidak pernah memengaruhi skor usaha mana pun.",
              )}
            </span>
          </p>
        </div>
      </header>

      {selesai && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-brand-sage/40 bg-brand-sage/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-sage-ink" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-sage-ink">{selesai}</p>
            <button
              type="button"
              onClick={() => navigate("/saya")}
              className="sentuh mt-2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink"
            >
              {t("Kembali ke halaman saya")}
            </button>
          </div>
        </div>
      )}

      {sudah ? (
        <RingkasUlasan data={data} />
      ) : !data.boleh_diulas ? (
        <p className="mt-4 rounded-2xl border border-ink/10 bg-white p-6 text-sm leading-relaxed text-ink-soft">
          {t(
            "Perjalanan ini belum selesai. Ulasan bisa diberikan setelah tanggal terakhir perjalanan terlewati.",
          )}
        </p>
      ) : (
        <>
          {/* ── Penilaian rencana ─────────────────────────────────────── */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Penilaian keseluruhan")}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Bintang nilai={skor} onPilih={setSkor} ukuran="lg" />
              {skor > 0 && <span className="text-sm font-bold text-ink">{skor}/5</span>}
            </div>

            <label className="sentuh mt-4 flex items-start gap-2.5 rounded-xl bg-ink/[0.03] p-3">
              <input
                type="checkbox"
                checked={!jadiBerangkat}
                onChange={(e) => setJadiBerangkat(!e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-sage-ink"
              />
              <span className="text-xs leading-relaxed text-ink-soft">
                <strong className="text-ink">{t("Saya tidak jadi berangkat.")}</strong>{" "}
                {t(
                  "Ulasan Anda tetap tersimpan dan tetap berguna, tetapi laporan lapangannya tidak akan dipakai sebagai bukti oleh dinas.",
                )}
              </span>
            </label>

            <Pilihan
              judul={t("Biaya nyata dibanding perkiraan aplikasi")}
              opsi={data.pilihan.akurasi_biaya}
              label={(k) => t(LABEL_BIAYA[k])}
              nilai={biaya}
              onPilih={setBiaya}
            />
            <Pilihan
              judul={t("Kepadatan jadwal harian")}
              opsi={data.pilihan.akurasi_waktu}
              label={(k) => t(LABEL_WAKTU[k])}
              nilai={waktu}
              onPilih={setWaktu}
            />

            <label className="mt-4 block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                {t("Catatan bebas")}
              </span>
              <textarea
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                maxLength={2000}
                placeholder={t("Apa yang paling berkesan, dan apa yang perlu diperbaiki?")}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
              />
            </label>
          </section>

          {/* ── Tempat per hari ───────────────────────────────────────── */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Tempat yang Anda lewati")}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {t(
                "Daftar ini diambil dari rencana Anda. Hanya tempat di sini yang bisa dinilai dan dilaporkan.",
              )}
            </p>

            {perHari.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">
                {t("Tidak ada tempat tercatat pada perjalanan ini.")}
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {perHari.map(([hari, tempat], iHari) => (
                  <div key={hari}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      {hari === 0 ? t("Menginap") : `${t("Hari")} ${hari}`}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {tempat.map((tp, i) => {
                        const usaha = data.usaha_tertaut[tp.place_name];
                        const Ikon = IKON_JENIS[tp.jenis] ?? MapPin;
                        const draft = laporan.filter((l) => l.place_name === tp.place_name);
                        return (
                          <Reveal key={`${tp.place_name}-${i}`} index={Math.min(iHari + i, 7)}>
                            <li className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="flex min-w-0 items-center gap-2">
                                  <Ikon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-ink">
                                      {tp.place_name}
                                    </span>
                                    <span className="block text-[11px] text-ink-faint">
                                      {tp.kabupaten ?? "—"}
                                      {tp.slot ? ` · ${tp.slot}` : ""}
                                    </span>
                                  </span>
                                </p>
                                <button
                                  type="button"
                                  onClick={() => tambahLaporan(tp.place_name)}
                                  className="sentuh flex shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5"
                                >
                                  <Plus className="h-3 w-3" aria-hidden />
                                  {t("Laporkan masalah")}
                                </button>
                              </div>

                              {/* Penilaian hanya muncul untuk tempat yang sudah
                                  diklaim akun UMKM. Tempat wisata dan hotel dari
                                  CSV tidak punya pemilik yang bisa menerimanya. */}
                              {usaha && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/5 pt-2.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                    {t("Beri penilaian")}
                                  </span>
                                  <Bintang
                                    nilai={penilaian[usaha.business_id] ?? 0}
                                    onPilih={(n) =>
                                      setPenilaian((s) => ({ ...s, [usaha.business_id]: n }))
                                    }
                                    ukuran="sm"
                                  />
                                  {usaha.rating_saya != null && (
                                    <span className="text-[10px] text-ink-faint">
                                      {t("sebelumnya")} {usaha.rating_saya}
                                    </span>
                                  )}
                                </div>
                              )}

                              {draft.map((d) => (
                                <FormLaporan
                                  key={d.kunci}
                                  draft={d}
                                  kategori={data.pilihan.kategori_laporan}
                                  tingkat={data.pilihan.tingkat}
                                  onUbah={(patch) => ubahLaporan(d.kunci, patch)}
                                  onHapus={() =>
                                    setLaporan((l) => l.filter((x) => x.kunci !== d.kunci))
                                  }
                                />
                              ))}
                            </li>
                          </Reveal>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {galat && (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
          )}

          <button
            type="button"
            disabled={sibuk}
            onClick={() => void kirim()}
            className="sentuh mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-3 text-sm font-bold text-on-sage-ink disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            {sibuk ? t("Mengirim...") : t("Kirim Ulasan")}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            {t("Ulasan hanya bisa dikirim satu kali per perjalanan.")}
          </p>
        </>
      )}
    </Bingkai>
  );
}

// ---------------------------------------------------------------------------
function Bingkai({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-surface-paper px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/saya"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Perjalanan Saya")}
        </Link>
        {children}
      </div>
    </div>
  );
}

function Pilihan<T extends string>({
  judul,
  opsi,
  label,
  nilai,
  onPilih,
}: {
  judul: string;
  opsi: T[];
  label: (k: T) => string;
  nilai: T | null;
  onPilih: (k: T | null) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{judul}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {opsi.map((o) => (
          <button
            key={o}
            type="button"
            // Menekan pilihan yang sama membatalkannya. Pertanyaan ini opsional,
            // dan tanpa jalan mundur pengguna terpaksa mengirim jawaban yang
            // tidak ia maksud — jawaban asal-asalan lebih merusak agregat
            // daripada kolom kosong.
            onClick={() => onPilih(nilai === o ? null : o)}
            aria-pressed={nilai === o}
            className={`sentuh rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              nilai === o
                ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                : "border-ink/10 bg-white text-ink-soft hover:border-ink/25"
            }`}
          >
            {label(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormLaporan({
  draft,
  kategori,
  tingkat,
  onUbah,
  onHapus,
}: {
  draft: DraftLaporan;
  kategori: DetailUlasan["pilihan"]["kategori_laporan"];
  tingkat: TingkatLaporan[];
  onUbah: (patch: Partial<DraftLaporan>) => void;
  onHapus: () => void;
}) {
  const t = useT();
  const terpilih = kategori.find((k) => k.kode === draft.kategori);

  return (
    <div className="mt-2.5 rounded-xl border-l-2 border-brand-amber bg-brand-amber/[0.06] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-amber-ink">
          <Flag className="h-3 w-3" aria-hidden />
          {t("Laporan untuk dinas")}
        </p>
        <button
          type="button"
          onClick={onHapus}
          aria-label={t("Hapus laporan ini")}
          className="sentuh rounded text-ink-faint hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t("Jenis masalah")}
          </span>
          <select
            value={draft.kategori}
            onChange={(e) => onUbah({ kategori: e.target.value as KategoriLaporan })}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-2.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand-sage"
          >
            {kategori.map((k) => (
              <option key={k.kode} value={k.kode}>
                {t(k.label)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t("Tingkat")}
          </span>
          <select
            value={draft.tingkat}
            onChange={(e) => onUbah({ tingkat: e.target.value as TingkatLaporan })}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-2.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand-sage"
          >
            {tingkat.map((g) => (
              <option key={g} value={g}>
                {t(LABEL_TINGKAT[g])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {terpilih?.petunjuk && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">{t(terpilih.petunjuk)}</p>
      )}

      <textarea
        rows={2}
        value={draft.isi ?? ""}
        onChange={(e) => onUbah({ isi: e.target.value })}
        maxLength={1500}
        placeholder={t("Jelaskan apa yang Anda temui di lokasi...")}
        className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-brand-sage"
      />
    </div>
  );
}

/** Tampilan baca-saja untuk perjalanan yang sudah pernah diulas. */
function RingkasUlasan({ data }: { data: DetailUlasan }) {
  const t = useT();
  const u = data.ulasan!;
  return (
    <>
      <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Bintang nilai={u.skor_keseluruhan} ukuran="md" />
          <span className="text-[11px] text-ink-faint">{u.created_at.slice(0, 10)}</span>
        </div>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {u.akurasi_biaya && (
            <div className="rounded-xl bg-ink/[0.03] p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{t("Biaya")}</dt>
              <dd className="mt-0.5 font-bold text-ink">{t(LABEL_BIAYA[u.akurasi_biaya])}</dd>
            </div>
          )}
          {u.akurasi_waktu && (
            <div className="rounded-xl bg-ink/[0.03] p-2.5">
              <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{t("Jadwal")}</dt>
              <dd className="mt-0.5 font-bold text-ink">{t(LABEL_WAKTU[u.akurasi_waktu])}</dd>
            </div>
          )}
        </dl>
        {u.catatan && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {u.catatan}
          </p>
        )}
        {!u.jadi_berangkat && (
          <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-[11px] text-ink-faint">
            {t("Anda menandai perjalanan ini tidak dijalankan; laporannya tidak dipakai dinas sebagai bukti lapangan.")}
          </p>
        )}
      </section>

      {data.laporan.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-base font-extrabold text-ink">
            {t("Laporan Anda ke dinas")}
          </h2>
          <ul className="mt-3 space-y-2">
            {data.laporan.map((l) => (
              <li key={l.id} className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-ink">{l.place_name}</p>
                  <span className="rounded-lg bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                    {t(LABEL_STATUS_LAPORAN[l.status])}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {t(LABEL_KATEGORI[l.kategori])} · {t(LABEL_TINGKAT[l.tingkat])}
                </p>
                {l.isi && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{l.isi}</p>
                )}
                {l.tanggapan && (
                  <div className="mt-2 rounded-lg border-l-2 border-brand-sage bg-brand-sage/[0.07] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-brand-sage-ink">
                      {t("Tanggapan dinas")}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{l.tanggapan}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
