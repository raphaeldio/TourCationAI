import { AlertTriangle, Inbox, MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ambilKotakMasuk, tanggapiAspirasi } from "../apiKomunitas";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import type { Aspirasi, RingkasAspirasi, StatusAspirasi } from "../typesKomunitas";

const WARNA_STATUS: Record<StatusAspirasi, string> = {
  BARU: "bg-brand-amber/20 text-brand-amber-ink",
  DIBACA: "bg-ink/5 text-ink-soft",
  DITINDAKLANJUTI: "bg-brand-sage/15 text-brand-sage-ink",
  SELESAI: "bg-brand-sage/25 text-brand-sage-ink",
  DITOLAK: "bg-rose-100 text-rose-700",
};

const SARINGAN: (StatusAspirasi | "SEMUA")[] = [
  "SEMUA", "BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK",
];

/**
 * Kotak masuk aspirasi UMKM untuk dinas.
 *
 * Penyaringan wilayah dilakukan di server, bukan di sini: pegawai dinas
 * kabupaten hanya menerima aspirasi wilayahnya. Menyaring di UI berarti
 * datanya tetap terkirim ke browser lebih dulu.
 */
export default function GovAspirasi() {
  const t = useT();
  const [data, setData] = useState<Aspirasi[]>([]);
  const [ringkas, setRingkas] = useState<RingkasAspirasi | null>(null);
  const [wilayah, setWilayah] = useState<string | null>(null);
  const [saring, setSaring] = useState<StatusAspirasi | "SEMUA">("SEMUA");
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [buka, setBuka] = useState<string | null>(null);
  const [balasan, setBalasan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async (status: string) => {
    setMemuat(true);
    try {
      const d = await ambilKotakMasuk(status);
      setData(d.aspirasi);
      setRingkas(d.ringkas);
      setWilayah(d.kabupaten);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(saring);
  }, [muat, saring]);

  async function kirim(id: string, status: StatusAspirasi) {
    setSibuk(true);
    try {
      await tanggapiAspirasi(id, status, balasan || undefined);
      setBalasan("");
      setBuka(null);
      await muat(saring);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (galat && !data.length) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat data")}
        </p>
        <p className="mt-1 text-sm text-rose-700">{galat}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Aspirasi UMKM")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {wilayah
            ? `${t("Keluhan dan usulan dari pelaku usaha di")} ${wilayah}`
            : t("Keluhan dan usulan dari pelaku usaha di seluruh kawasan")}
        </p>
      </div>

      {ringkas && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: t("Total masuk"), v: ringkas.total },
            { k: t("Belum ditangani"), v: ringkas.belum_ditangani, sorot: true },
            { k: t("Ditindaklanjuti"), v: ringkas.per_status.DITINDAKLANJUTI },
            { k: t("Selesai"), v: ringkas.per_status.SELESAI },
          ].map((b) => (
            <div key={b.k} className="rounded-xl border border-ink/5 bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">{b.k}</p>
              <p
                className={`mt-1 font-display text-xl font-extrabold tabular-nums ${
                  b.sorot && b.v > 0 ? "text-brand-amber-ink" : "text-ink"
                }`}
              >
                {b.v}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="gulir-x -mx-1 px-1">
        <div className="flex gap-1.5">
          {SARINGAN.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSaring(s)}
              className={`sentuh shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                saring === s
                  ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                  : "border-ink/10 bg-white text-ink-soft hover:border-ink/25"
              }`}
            >
              {t(s)}
            </button>
          ))}
        </div>
      </div>

      {memuat ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel h-24 rounded-2xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink-faint">
          <Inbox className="mx-auto mb-2 h-8 w-8" aria-hidden />
          {t("Belum ada aspirasi pada saringan ini.")}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((a, i) => (
            <Reveal key={a.id} index={Math.min(i, 7)}>
              <li className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-extrabold text-ink sm:text-base">
                      {a.judul}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {a.nama_usaha ?? "—"} · {a.kabupaten ?? "—"} ·{" "}
                      {a.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <span className="rounded-lg bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                      {t(a.kategori)}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS[a.status]}`}
                    >
                      {t(a.status)}
                    </span>
                  </div>
                </div>

                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft sm:text-sm">
                  {a.isi}
                </p>

                {a.tanggapan && (
                  <div className="mt-3 rounded-xl border-l-2 border-brand-sage bg-brand-sage/[0.07] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sage-ink">
                      <MessageSquare className="h-3 w-3" aria-hidden />
                      {t("Tanggapan dinas")}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                      {a.tanggapan}
                    </p>
                  </div>
                )}

                {buka === a.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={3}
                      value={balasan}
                      onChange={(e) => setBalasan(e.target.value)}
                      placeholder={t("Tulis tanggapan untuk pelaku usaha...")}
                      className="w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(["DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"] as StatusAspirasi[]).map(
                        (s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={sibuk}
                            onClick={() => void kirim(a.id, s)}
                            className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                          >
                            <Send className="h-3 w-3" aria-hidden />
                            {t(s)}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() => { setBuka(null); setBalasan(""); }}
                        className="sentuh rounded-xl px-3 py-2 text-xs font-bold text-ink-faint"
                      >
                        {t("Batal")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setBuka(a.id); setBalasan(a.tanggapan ?? ""); }}
                    className="sentuh mt-3 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink-soft transition-colors hover:bg-ink/5"
                  >
                    {a.tanggapan ? t("Ubah tanggapan") : t("Tanggapi")}
                  </button>
                )}
              </li>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
