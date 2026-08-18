import {
  BadgeCheck,
  Bell,
  Inbox,
  Loader2,
  MailWarning,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ambilDaftarVerifikasi, ambilKotakMasukGov, putuskanVerifikasi } from "../apiGov";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import type { DaftarVerifikasi, KotakMasukGov, UsahaVerifikasi } from "../typesGov";

/**
 * Verifikasi identitas usaha oleh dinas kabupaten.
 *
 * Halaman ini menulis, tidak seperti sisa dashboard pemerintah yang membaca.
 * Karena itu dua hal ditekankan di layar dan tidak boleh dihilangkan saat
 * merapikan tampilan:
 *
 *   1. **Batas kewenangannya.** Yang diverifikasi adalah identitas usaha, BUKAN
 *      hak berusahanya. Usaha yang belum terverifikasi tetap beroperasi penuh.
 *      Tanpa kalimat itu, petugas wajar mengira menahan tombol sama dengan
 *      menutup warung — dan sebagian akan memakainya begitu.
 *   2. **Kecilnya pengaruh.** Verifikasi bernilai 0,05 dari skor verifikasi
 *      harga. Petugas yang mengira sedang menentukan peringkat akan menimbang
 *      keputusannya dengan taruhan yang salah.
 */

function Kartu({
  judul,
  sub,
  aksi,
  children,
}: {
  judul: string;
  sub?: string;
  aksi?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">{t(judul)}</h2>
          {sub && <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{t(sub)}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, nilai, nada }: { label: string; nilai: string; nada?: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{t(label)}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${nada ?? "text-ink"}`}>
        {nilai}
      </p>
    </div>
  );
}

function BarisUsaha({
  u,
  sibuk,
  onPutus,
}: {
  u: UsahaVerifikasi;
  sibuk: boolean;
  onPutus: (id: string, setuju: boolean, catatan: string) => void;
}) {
  const t = useT();
  const [catatan, setCatatan] = useState("");
  const [buka, setBuka] = useState(false);
  const sudah = Boolean(u.verified);

  return (
    <li className="rounded-xl border border-ink/5 bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{u.place_name}</span>
            {sudah ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-brand-sage/15 px-2 py-0.5 text-[10px] font-bold text-brand-sage-ink">
                <BadgeCheck className="h-3 w-3" aria-hidden /> {t("Terverifikasi")}
              </span>
            ) : (
              <span className="rounded-lg bg-brand-amber/20 px-2 py-0.5 text-[10px] font-bold text-brand-amber-ink">
                {t("Menunggu")}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {u.kabupaten ?? t("kabupaten belum diisi")}
            {u.alamat ? ` · ${u.alamat}` : ""}
            {u.telepon ? ` · ${u.telepon}` : ""}
          </p>
          {u.verifikasi_catatan && (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              {t("Catatan petugas")}: {u.verifikasi_catatan}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={sibuk}
          onClick={() => setBuka((b) => !b)}
          className="sentuh shrink-0 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50"
        >
          {sudah ? t("Cabut verifikasi") : t("Verifikasi")}
        </button>
      </div>

      {buka && (
        <div className="mt-2.5 space-y-2 border-t border-ink/10 pt-2.5">
          <label className="block text-[11px] font-bold text-ink-soft" htmlFor={`cat-${u.id}`}>
            {sudah
              ? t("Alasan pencabutan — tercatat permanen di jejak audit")
              : t("Dasar verifikasi, mis. nomor NIB atau tanggal kunjungan")}
          </label>
          <textarea
            id={`cat-${u.id}`}
            rows={2}
            maxLength={400}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full rounded-lg border border-ink/10 bg-white p-2 text-xs text-ink outline-none focus:border-ink/30"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sibuk}
              onClick={() => {
                onPutus(u.id, !sudah, catatan);
                setBuka(false);
                setCatatan("");
              }}
              className={`sentuh rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-opacity disabled:opacity-50 ${
                sudah ? "bg-rose-700" : "bg-brand-sage-ink"
              }`}
            >
              {sudah ? t("Ya, cabut") : t("Ya, tandai terverifikasi")}
            </button>
            <button
              type="button"
              onClick={() => setBuka(false)}
              className="sentuh rounded-lg border border-ink/10 px-3 py-1.5 text-[11px] font-bold text-ink-soft"
            >
              {t("Batal")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function GovVerifikasi() {
  const t = useT();
  const [data, setData] = useState<DaftarVerifikasi | null>(null);
  const [kotak, setKotak] = useState<KotakMasukGov | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const d = await ambilDaftarVerifikasi();
      setData(d);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
    // Kotak masuk dimuat terpisah dan kegagalannya tidak menutupi daftar utama:
    // pemberitahuan adalah pelengkap, verifikasi adalah pekerjaannya.
    try {
      setKotak(await ambilKotakMasukGov());
    } catch {
      setKotak(null);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function putus(id: string, setuju: boolean, catatan: string) {
    setSibuk(true);
    setPesan(null);
    try {
      await putuskanVerifikasi(id, setuju, catatan);
      setPesan(setuju ? t("Usaha ditandai terverifikasi.") : t("Verifikasi dicabut."));
      await muat();
    } catch (e) {
      setPesan((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (galat) {
    return (
      <div className="mx-auto max-w-5xl">
        <Kartu judul="Verifikasi Usaha">
          <div className="flex gap-3 rounded-xl border border-brand-amber/40 bg-brand-amber/[0.08] p-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-soft">{t(galat)}</p>
          </div>
        </Kartu>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="skel h-8 w-64 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skel h-72 rounded-2xl" />
      </div>
    );
  }

  const menunggu = data.usaha.filter((u) => !u.verified);
  const sudah = data.usaha.filter((u) => u.verified);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Reveal>
        <div>
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Verifikasi Usaha")}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-faint">
            {data.wilayah
              ? `${t("Wilayah kerja Anda")}: ${data.wilayah}`
              : t("Seluruh kabupaten (akun admin)")}
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div className="flex gap-3 rounded-2xl border border-ink/10 bg-surface-2/40 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
          <p className="text-[11px] leading-relaxed text-ink-soft">{t(data.catatan)}</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Usaha di wilayah" nilai={String(data.ringkas.n_usaha)} />
          <Tile
            label="Menunggu verifikasi"
            nilai={String(data.ringkas.n_menunggu)}
            nada="text-brand-amber-ink"
          />
          <Tile
            label="Terverifikasi"
            nilai={String(data.ringkas.n_terverifikasi)}
            nada="text-brand-sage-ink"
          />
        </div>
      </Reveal>

      {pesan && (
        <p className="rounded-xl bg-ink/[0.03] p-3 text-xs text-ink-soft">
          {sibuk && <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" aria-hidden />}
          {pesan}
        </p>
      )}

      <Reveal>
        <Kartu
          judul="Menunggu verifikasi"
          sub="Usaha sudah bisa mengisi menu dan tetap muncul di platform selama menunggu"
        >
          {menunggu.length === 0 ? (
            <p className="rounded-xl bg-ink/[0.03] p-6 text-center text-xs text-ink-faint">
              {t("Tidak ada usaha yang menunggu verifikasi di wilayah Anda.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {menunggu.map((u) => (
                <BarisUsaha key={u.id} u={u} sibuk={sibuk} onPutus={putus} />
              ))}
            </ul>
          )}
        </Kartu>
      </Reveal>

      {sudah.length > 0 && (
        <Reveal>
          <Kartu judul="Sudah terverifikasi" sub="Bisa dicabut bila keadaannya berubah">
            <ul className="space-y-2">
              {sudah.map((u) => (
                <BarisUsaha key={u.id} u={u} sibuk={sibuk} onPutus={putus} />
              ))}
            </ul>
          </Kartu>
        </Reveal>
      )}

      <Reveal>
        <Kartu
          judul="Pemberitahuan"
          sub="Tercatat di sini lebih dulu; surel hanya salah satu cara mengantarkannya"
          aksi={
            kotak && !kotak.pengiriman_surel_aktif ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-brand-amber/20 px-2 py-1 text-[10px] font-bold text-brand-amber-ink">
                <MailWarning className="h-3 w-3" aria-hidden /> {t("Surel belum aktif")}
              </span>
            ) : undefined
          }
        >
          {!kotak || kotak.notifikasi.length === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-ink/[0.03] p-6 text-center text-xs text-ink-faint">
              <Inbox className="h-4 w-4" aria-hidden />
              {t("Belum ada pemberitahuan untuk wilayah ini.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {kotak.notifikasi.map((n) => (
                <li key={n.id} className="rounded-xl border border-ink/5 bg-surface-2/50 p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    {n.jenis === "VERIFIKASI_TERTUNDA" ? (
                      <Store className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                    )}
                    <span className="text-xs font-semibold text-ink">{n.judul}</span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        n.status === "TERKIRIM"
                          ? "bg-brand-sage/15 text-brand-sage-ink"
                          : n.status === "GAGAL"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-ink/[0.06] text-ink-soft"
                      }`}
                    >
                      {t(n.status)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-ink-faint">
                    {n.isi}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Kartu>
      </Reveal>
    </div>
  );
}
