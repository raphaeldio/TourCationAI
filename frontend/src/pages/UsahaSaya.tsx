import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Info,
  Loader2,
  MessageSquareQuote,
  Plus,
  ShieldAlert,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";

import NarasiAI from "../components/NarasiAI";
import { useT } from "../i18n";
import Bintang from "../components/Bintang";
import Reveal from "../components/Reveal";
import { rupiah } from "../apiIntel";
import { ambilProfilPublik } from "../apiKomunitas";
import {
  ambilAdvisor,
  ambilDashboardUmkm,
  nonaktifkanProduk,
  perbaruiUsaha,
  tambahProduk,
} from "../apiUmkm";
import type { ProfilPublik } from "../typesKomunitas";
import type { DashboardUmkm, Produk, StatusHarga } from "../typesUmkm";

const WARNA_STATUS: Record<StatusHarga, string> = {
  OK: "bg-brand-sage/15 text-brand-sage-ink",
  SUSPECT: "bg-brand-amber/20 text-brand-amber-ink",
  FLAGGED: "bg-rose-100 text-rose-700",
};

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
          {sub && <p className="mt-0.5 text-xs text-ink-faint">{t(sub)}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

function Angka({ label, nilai, nada }: { label: string; nilai: string; nada?: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{t(label)}</p>
      <p className={`mt-1 font-display text-lg font-extrabold tabular-nums ${nada ?? "text-ink"}`}>
        {nilai}
      </p>
    </div>
  );
}

/** Baris satu produk: harga, status pemeriksaan, dan skor verifikasinya. */
function BarisProduk({
  p,
  sibuk,
  onNonaktif,
}: {
  p: Produk;
  sibuk: boolean;
  onNonaktif: (id: string) => void;
}) {
  const t = useT();
  const skor = p.skor_verifikasi ?? 0;
  return (
    <li className="rounded-xl border border-ink/5 bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{p.nama}</span>
            {p.harga_status && (
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS[p.harga_status]}`}
              >
                {t(p.harga_status)}
              </span>
            )}
            {p.is_kuliner_khas && (
              <span className="rounded-lg bg-brand-sand/25 px-2 py-0.5 text-[10px] font-bold text-brand-sand-ink">
                {t("KULINER KHAS")}
              </span>
            )}
            {!p.aktif && (
              <span className="rounded-lg bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink-faint">
                {t("NONAKTIF")}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {rupiah(p.harga)}
            {p.kategori ? ` · ${p.kategori}` : ""}
            {p.robust_z != null ? ` · z = ${p.robust_z.toFixed(2)}` : ""}
          </p>
        </div>
        {p.aktif && (
          <button
            type="button"
            disabled={sibuk}
            onClick={() => onNonaktif(p.id)}
            className="sentuh flex items-center gap-1.5 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" aria-hidden /> {t("Nonaktifkan")}
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/5">
          <span
            className={`block h-full rounded-full ${
              p.harga_terverifikasi ? "bg-brand-sage" : "bg-brand-amber"
            }`}
            style={{ width: `${Math.round(skor * 100)}%` }}
          />
        </span>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-soft">
          {(skor * 100).toFixed(0)}%
        </span>
        <span
          className={`shrink-0 text-[11px] font-bold ${
            p.harga_terverifikasi ? "text-brand-sage-ink" : "text-ink-faint"
          }`}
        >
          {p.harga_terverifikasi ? t("harga terverifikasi") : t("belum terverifikasi")}
        </span>
      </div>

      {p.harga_alasan && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{t(p.harga_alasan)}</p>
      )}
    </li>
  );
}

/**
 * Ulasan yang MASUK ke usaha ini.
 *
 * Dibaca dari `/api/umkm-publik/{id}` — endpoint publik yang sama dengan yang
 * dilihat wisatawan, bukan jalur khusus pemilik. Itu disengaja: pemilik melihat
 * persis apa yang dilihat calon pembeli, dan tidak ada versi kedua yang bisa
 * diam-diam menyimpang. Konsekuensinya identitas penilai tetap tidak tampak di
 * sini, karena router memang tidak pernah mengirimkannya.
 */
function UlasanMasuk({ businessId }: { businessId: string }) {
  const t = useT();
  const [profil, setProfil] = useState<ProfilPublik | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilProfilPublik(businessId)
      .then((d) => !batal && setProfil(d))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, [businessId]);

  if (galat) {
    return (
      <Kartu judul="Ulasan Masuk">
        <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">{galat}</p>
      </Kartu>
    );
  }

  if (!profil) return <div className="skel h-48 rounded-2xl" />;

  const { ringkas_rating: r, trust, ulasan } = profil;
  const berkomentar = ulasan.filter((u) => (u.komentar ?? "").trim());

  return (
    <Kartu
      judul="Ulasan Masuk"
      sub="Penilaian wisatawan atas usaha Anda — identitas penilai tidak ditampilkan"
      aksi={
        <span className="rounded-lg bg-brand-sage/15 px-2.5 py-1 text-[11px] font-extrabold text-brand-sage-ink">
          {t(trust.label)}
        </span>
      }
    >
      {r.n === 0 ? (
        <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs leading-relaxed text-ink-faint">
          {t(
            "Belum ada penilaian. Usaha tanpa rating tetap muncul di slot Rekomendasi Lainnya — justru di situlah penilaian pertama biasanya datang.",
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                {r.rata?.toFixed(1)}
              </p>
              <Bintang nilai={r.rata ?? 0} ukuran="sm" />
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {r.n} {t("penilaian")} · {r.n_puas} {t("puas")}
              </p>
            </div>

            <div className="min-w-[160px] flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((b) => {
                const n = r.sebaran[String(b)] ?? 0;
                return (
                  <div key={b} className="flex items-center gap-2">
                    <span className="w-3 text-[10px] tabular-nums text-ink-faint">{b}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/5">
                      <span
                        className="block h-full rounded-full bg-brand-amber"
                        style={{ width: `${r.n ? (n / r.n) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-5 text-right text-[10px] tabular-nums text-ink-faint">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {berkomentar.length === 0 ? (
              <li className="rounded-xl bg-ink/[0.03] p-3 text-center text-[11px] text-ink-faint">
                {t("Semua penilaian masuk tanpa komentar tertulis.")}
              </li>
            ) : (
              berkomentar.map((u) => (
                <li key={u.id} className="rounded-xl border border-ink/5 bg-surface-2/50 p-3">
                  <p className="flex items-center gap-2">
                    <Bintang nilai={u.rating} ukuran="sm" />
                    <span className="text-[10px] text-ink-faint">
                      {u.updated_at.slice(0, 10)}
                    </span>
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
                    <MessageSquareQuote
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint"
                      aria-hidden
                    />
                    {u.komentar}
                  </p>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </Kartu>
  );
}

export default function UsahaSaya() {
  const t = useT();
  const [data, setData] = useState<DashboardUmkm | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState("");
  const [kategori, setKategori] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [khas, setKhas] = useState(false);
  const [jamBuka, setJamBuka] = useState("");

  async function muat() {
    try {
      const d = await ambilDashboardUmkm();
      setData(d);
      setJamBuka(d.usaha.jam_buka ?? "");
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }

  useEffect(() => {
    void muat();
  }, []);

  async function jalankan(aksi: () => Promise<unknown>, sukses: string) {
    setSibuk(true);
    setPesan(null);
    try {
      await aksi();
      await muat();
      setPesan(sukses);
    } catch (e) {
      setPesan((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (galat) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-amber-900">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Belum bisa menampilkan usaha")}
        </p>
        <p className="mt-1 text-sm text-amber-800">{galat}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="skel h-8 w-56 rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skel h-72 rounded-2xl" />
      </div>
    );
  }

  const { usaha, produk, referensi_harga: ref, ringkas } = data;
  const aktif = produk.filter((p) => p.aktif);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
            <Store className="h-6 w-6 text-brand-sage-ink" aria-hidden />
            {usaha.place_name}
          </h1>
          <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
            {usaha.kabupaten ?? t("Kabupaten belum diisi")}
            {usaha.verified
              ? ` · ${t("usaha terverifikasi")}`
              : ` · ${t("menunggu verifikasi admin")}`}
          </p>
        </div>
        {usaha.verified && (
          <span className="flex items-center gap-1.5 rounded-xl bg-brand-sage/15 px-3 py-2 text-xs font-bold text-brand-sage-ink">
            <BadgeCheck className="h-4 w-4" aria-hidden /> {t("Terverifikasi")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Angka label={t("Produk aktif")} nilai={String(ringkas.n_produk)} />
        <Angka
          label={t("Harga terverifikasi")}
          nilai={String(ringkas.n_harga_terverifikasi)}
          nada="text-brand-sage-ink"
        />
        <Angka
          label={t("Harga ditandai")}
          nilai={String(ringkas.n_bermasalah)}
          nada={ringkas.n_bermasalah ? "text-rose-700" : undefined}
        />
        <Angka
          label={t("Skor verifikasi rata-rata")}
          nilai={ringkas.skor_rata2 != null ? `${(ringkas.skor_rata2 * 100).toFixed(0)}%` : "-"}
        />
      </div>

      {pesan && (
        <p className="rounded-xl bg-ink/[0.04] p-3 text-xs text-ink-soft sm:text-sm">{pesan}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Kartu
            judul="Produk & Harga"
            sub={`${aktif.length} ${t("produk aktif · harga dinilai terhadap sebaran rumah makan sekitar")}`}
          >
            {produk.length === 0 ? (
              <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
                {t("Belum ada produk. Tambahkan lewat formulir di samping.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {produk.map((p) => (
                  <BarisProduk
                    key={p.id}
                    p={p}
                    sibuk={sibuk}
                    onNonaktif={(id) =>
                      void jalankan(() => nonaktifkanProduk(id), t("Produk dinonaktifkan."))
                    }
                  />
                ))}
              </ul>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
              <span>{t(data.catatan_harga)}</span>
            </p>
          </Kartu>
        </Reveal>

        <div className="space-y-4">
          <Reveal index={1}>
            <Kartu judul="Tambah Produk" sub="Harga langsung diperiksa saat disimpan">
              <form
                className="space-y-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void jalankan(async () => {
                    await tambahProduk({
                      nama,
                      harga: Number(harga || 0),
                      kategori: kategori || null,
                      deskripsi: deskripsi || null,
                      is_kuliner_khas: khas,
                    });
                    setNama("");
                    setHarga("");
                    setKategori("");
                    setDeskripsi("");
                    setKhas(false);
                  }, t("Produk tersimpan dan harganya sudah dinilai."));
                }}
              >
                <input
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder={t("Nama produk (mis. Naniura Ikan Mas)")}
                  className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                />
                <input
                  required
                  type="number"
                  min={0}
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                  placeholder={t("Harga (Rupiah)")}
                  className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-brand-sage"
                />
                <input
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  placeholder={t("Kategori (mis. Makanan Utama)")}
                  className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                />
                <textarea
                  rows={3}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder={t("Keterangan singkat (menaikkan skor kelengkapan)")}
                  className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                />
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={khas}
                    onChange={(e) => setKhas(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/20"
                  />
                  {t("Kuliner khas Batak")}
                </label>
                <button
                  type="submit"
                  disabled={sibuk}
                  className="sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-3 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
                >
                  {sibuk ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                  {t("Simpan produk")}
                </button>
              </form>
            </Kartu>
          </Reveal>

          {ref && (
            <Reveal index={2}>
              <Kartu
                judul="Harga Pembanding"
                sub={`${t("Sebaran")} ${ref.n} ${t("rumah makan di")} ${ref.grup}`}
              >
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [t("Bawah (p25)"), ref.p25],
                    [t("Median"), ref.median],
                    [t("Atas (p75)"), ref.p75],
                  ].map(([label, nilai]) => (
                    <div key={label as string} className="rounded-xl bg-surface-2/60 p-2.5">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">
                        {rupiah(nilai as number)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                  {t("Dihitung dari")} {ref.n_titik_harga}{" "}
                  {t(
                    "titik harga nyata pada dataset — kedua ujung pita harga tiap rumah makan, bukan titik tengahnya.",
                  )}
                </p>
              </Kartu>
            </Reveal>
          )}

          <Reveal index={3}>
            <Kartu judul="Jam Buka" sub="Ikut menyusun skor kelengkapan tiap produk">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void jalankan(
                    () => perbaruiUsaha({ jam_buka: jamBuka }),
                    t("Jam buka diperbarui; skor produk dihitung ulang."),
                  );
                }}
              >
                <input
                  value={jamBuka}
                  onChange={(e) => setJamBuka(e.target.value)}
                  placeholder={t("mis. 08.00 - 21.00")}
                  className="flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                />
                <button
                  type="submit"
                  disabled={sibuk}
                  className="sentuh rounded-xl border border-ink/10 px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50"
                >
                  {t("Simpan")}
                </button>
              </form>
            </Kartu>
          </Reveal>
        </div>
      </div>

      <Reveal>
        <UlasanMasuk businessId={usaha.id} />
      </Reveal>

      <Reveal>
        <NarasiAI
          judul="Penasihat Bisnis AI"
          sub="Saran berbasis harga, permintaan nyata, dan musim wilayah Anda"
          muat={ambilAdvisor}
          bagian={[
            { kunci: "produk_potensial", label: "Produk berpotensi" },
            { kunci: "analisis_harga", label: "Analisis harga" },
            { kunci: "saran_promo", label: "Saran promo" },
            { kunci: "prediksi_kunjungan", label: "Perkiraan kunjungan" },
            { kunci: "peluang", label: "Peluang" },
          ]}
        />
      </Reveal>

      {ringkas.n_bermasalah > 0 && (
        <Reveal>
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden />
            <p className="text-xs leading-relaxed text-rose-800 sm:text-sm">
              <strong>
                {ringkas.n_bermasalah} {t("harga ditandai.")}
              </strong>{" "}
              {t(
                "Produk tersebut tetap tampil di halaman ini, tetapi tidak ditandai terverifikasi kepada wisatawan dan tidak ikut dihitung dalam statistik harga daerah sampai harganya diperbaiki atau didukung penilaian komunitas.",
              )}
            </p>
          </div>
        </Reveal>
      )}
    </div>
  );
}
