import { AlertTriangle, Megaphone, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  ambilPengumumanKelola,
  terbitkanPengumuman,
  ubahPengumuman,
  type PengumumanBaru,
} from "../apiKomunitas";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import type { JenisPengumuman, Pengumuman } from "../typesKomunitas";

const JENIS: JenisPengumuman[] = ["KEBIJAKAN", "BANTUAN", "PELATIHAN", "EVENT", "LAINNYA"];

const WARNA_JENIS: Record<JenisPengumuman, string> = {
  KEBIJAKAN: "bg-brand-sage/15 text-brand-sage-ink",
  BANTUAN: "bg-brand-amber/20 text-brand-amber-ink",
  PELATIHAN: "bg-brand-sand/20 text-brand-sand-ink",
  EVENT: "bg-ink/5 text-ink-soft",
  LAINNYA: "bg-ink/5 text-ink-faint",
};

const KABUPATEN = [
  "Toba", "Simalungun", "Karo", "Samosir",
  "Pakpak Bharat", "Tapanuli Utara", "Dairi", "Humbang Hasundutan",
];

const KELAS_INPUT =
  "sentuh w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-sage";

const KOSONG: PengumumanBaru = {
  jenis: "KEBIJAKAN", judul: "", isi: "", instansi: "",
  kabupaten: "", nilai_bantuan: null, cara_daftar: "", tenggat: "",
};

export default function GovPengumuman() {
  const t = useT();
  const [data, setData] = useState<Pengumuman[]>([]);
  const [form, setForm] = useState<PengumumanBaru>(KOSONG);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    try {
      setData((await ambilPengumumanKelola()).pengumuman);
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

  const ubah = <K extends keyof PengumumanBaru>(k: K, v: PengumumanBaru[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function terbitkan() {
    setSibuk(true);
    setPesan(null);
    try {
      await terbitkanPengumuman({
        ...form,
        kabupaten: form.kabupaten || null,
        instansi: form.instansi || null,
        cara_daftar: form.cara_daftar || null,
        tenggat: form.tenggat || null,
        nilai_bantuan: form.jenis === "BANTUAN" ? form.nilai_bantuan : null,
      });
      setForm(KOSONG);
      setPesan(t("Pengumuman diterbitkan."));
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
          {t("Pengumuman untuk UMKM")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Kebijakan, program bantuan, pelatihan, dan agenda yang perlu diketahui pelaku usaha")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ── Formulir ─────────────────────────────────────────────── */}
        <Reveal className="xl:col-span-1">
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-extrabold text-ink">
              <Plus className="h-4 w-4 text-brand-sage-ink" aria-hidden />
              {t("Terbitkan Pengumuman")}
            </h2>

            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t("Jenis")}
                </span>
                <select
                  className={KELAS_INPUT}
                  value={form.jenis}
                  onChange={(e) => ubah("jenis", e.target.value as JenisPengumuman)}
                >
                  {JENIS.map((j) => (
                    <option key={j} value={j}>{t(j)}</option>
                  ))}
                </select>
              </label>

              <input
                className={KELAS_INPUT}
                value={form.judul}
                onChange={(e) => ubah("judul", e.target.value)}
                placeholder={t("Judul pengumuman")}
              />
              <textarea
                rows={5}
                className={KELAS_INPUT}
                value={form.isi}
                onChange={(e) => ubah("isi", e.target.value)}
                placeholder={t("Isi pengumuman")}
              />
              <input
                className={KELAS_INPUT}
                value={form.instansi ?? ""}
                onChange={(e) => ubah("instansi", e.target.value)}
                placeholder={t("Nama instansi penerbit")}
              />

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t("Wilayah sasaran")}
                </span>
                <select
                  className={KELAS_INPUT}
                  value={form.kabupaten ?? ""}
                  onChange={(e) => ubah("kabupaten", e.target.value)}
                >
                  <option value="">{t("Seluruh kabupaten")}</option>
                  {KABUPATEN.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>

              {form.jenis === "BANTUAN" && (
                <>
                  <input
                    type="number"
                    min={0}
                    className={KELAS_INPUT}
                    value={form.nilai_bantuan ?? ""}
                    onChange={(e) => ubah("nilai_bantuan", Number(e.target.value) || null)}
                    placeholder={t("Nilai bantuan (Rupiah)")}
                  />
                  <textarea
                    rows={3}
                    className={KELAS_INPUT}
                    value={form.cara_daftar ?? ""}
                    onChange={(e) => ubah("cara_daftar", e.target.value)}
                    placeholder={t("Cara mendaftar")}
                  />
                </>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">
                  {t("Tenggat (opsional)")}
                </span>
                <input
                  type="date"
                  className={KELAS_INPUT}
                  value={form.tenggat ?? ""}
                  onChange={(e) => ubah("tenggat", e.target.value)}
                />
              </label>

              <button
                type="button"
                disabled={sibuk || !form.judul.trim() || !form.isi.trim()}
                onClick={() => void terbitkan()}
                className="sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-3 text-sm font-extrabold text-on-sage-ink disabled:opacity-50"
              >
                <Megaphone className="h-4 w-4" aria-hidden />
                {sibuk ? t("Menerbitkan...") : t("Terbitkan")}
              </button>

              {pesan && (
                <p className="rounded-xl bg-ink/[0.04] p-2.5 text-xs text-ink-soft">{pesan}</p>
              )}
            </div>
          </section>
        </Reveal>

        {/* ── Daftar ───────────────────────────────────────────────── */}
        <div className="space-y-3 xl:col-span-2">
          {galat && (
            <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {galat}
            </p>
          )}

          {memuat ? (
            [0, 1].map((i) => <div key={i} className="skel h-32 rounded-2xl" />)
          ) : data.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink-faint">
              {t("Belum ada pengumuman yang diterbitkan.")}
            </p>
          ) : (
            data.map((p, i) => (
              <Reveal key={p.id} index={Math.min(i, 7)}>
                <article
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    p.aktif ? "border-ink/10" : "border-ink/5 opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-extrabold text-ink sm:text-base">
                        {p.judul}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {p.instansi ?? "—"} ·{" "}
                        {p.kabupaten ?? t("Seluruh kabupaten")} ·{" "}
                        {p.created_at.slice(0, 10)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_JENIS[p.jenis]}`}
                    >
                      {t(p.jenis)}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft sm:text-sm">
                    {p.isi}
                  </p>

                  {p.nilai_bantuan != null && (
                    <p className="mt-2 text-xs font-bold text-brand-amber-ink">
                      {t("Nilai bantuan")}: Rp {p.nilai_bantuan.toLocaleString("id-ID")}
                    </p>
                  )}
                  {p.tenggat && (
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {t("Tenggat")}: {p.tenggat}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void ubahPengumuman(p.id, !p.aktif).then(muat)}
                    className="sentuh mt-3 rounded-xl border border-ink/15 px-3 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5"
                  >
                    {p.aktif ? t("Arsipkan") : t("Tayangkan lagi")}
                  </button>
                </article>
              </Reveal>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
