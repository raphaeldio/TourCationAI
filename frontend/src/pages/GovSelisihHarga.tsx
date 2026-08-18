import {
  ArrowDownRight,
  ArrowUpRight,
  Database,
  Minus,
  Ruler,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ambilSelisihHarga, rupiah } from "../apiIntel";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import type { PosisiHarga, SelisihHarga } from "../typesIntel";

/**
 * Selisih estimasi dataset terhadap harga terlapor UMKM — seri KEEMPAT.
 *
 * Halaman ini sengaja TIDAK memakai grafik. Bukan karena grafik selalu buruk,
 * melainkan karena n di sini satuan sampai puluhan: batang atau donat atas
 * tiga kategori dengan total 12 usaha membesarkan pola yang belum tentu ada.
 * Cacah dan tabel menyatakan hal yang sama tanpa melebihkannya, dan begitu
 * datanya benar-benar tebal, grafik bisa ditambahkan tanpa mengubah payload.
 *
 * Angka utama halaman ini adalah POSISI, bukan besaran selisih — lihat
 * peringatan satuan yang dirender di atas setiap angka rupiah.
 */

const IKON: Record<PosisiHarga, typeof ArrowDownRight> = {
  "DI BAWAH": ArrowDownRight,
  "DI DALAM": Minus,
  "DI ATAS": ArrowUpRight,
};

// Warna menyatakan ARAH, bukan penilaian baik/buruk. "Di bawah estimasi" bukan
// kabar buruk bagi wisatawan dan bukan kabar baik bagi dinas — ia temuan.
const WARNA: Record<PosisiHarga, string> = {
  "DI BAWAH": "text-brand-sage-ink bg-brand-sage/15",
  "DI DALAM": "text-ink-soft bg-ink/[0.06]",
  "DI ATAS": "text-brand-amber-ink bg-brand-amber/20",
};

const URUTAN_POSISI: PosisiHarga[] = ["DI BAWAH", "DI DALAM", "DI ATAS"];

function Kartu({
  judul,
  sub,
  children,
}: {
  judul: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">{t(judul)}</h2>
        {sub && <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{t(sub)}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({
  label,
  nilai,
  sub,
  nada,
}: {
  label: string;
  nilai: string;
  sub?: string;
  nada?: string;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{t(label)}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${nada ?? "text-ink"}`}>
        {nilai}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-faint">{t(sub)}</p>}
    </div>
  );
}

function Lencana({ posisi }: { posisi: PosisiHarga }) {
  const t = useT();
  const Ikon = IKON[posisi];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA[posisi]}`}
    >
      <Ikon className="h-3 w-3" aria-hidden />
      {t(posisi)}
    </span>
  );
}

export default function GovSelisihHarga() {
  const t = useT();
  const [data, setData] = useState<SelisihHarga | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilSelisihHarga()
      .then((d) => !batal && setData(d))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  if (galat) {
    return (
      <div className="mx-auto max-w-6xl">
        <Kartu judul="Selisih Harga">
          <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">{galat}</p>
        </Kartu>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="skel h-8 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skel h-72 rounded-2xl" />
      </div>
    );
  }

  if (!data.aktif) {
    return (
      <div className="mx-auto max-w-6xl">
        <Kartu
          judul="Selisih Harga"
          sub="Perbandingan estimasi dataset dengan harga yang dilaporkan pemilik usaha"
        >
          <p className="rounded-xl bg-ink/[0.03] p-6 text-center text-xs leading-relaxed text-ink-faint">
            {t(data.alasan)}
          </p>
        </Kartu>
      </div>
    );
  }

  const { nasional, kabupaten, usaha, ambang } = data;
  const adaData = nasional.n_usaha > 0;
  const terisi = kabupaten.filter((k) => k.n_usaha > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Reveal>
        <div>
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Selisih Harga Lapangan")}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-faint">
            {t(
              "Membandingkan estimasi kisaran dataset dengan harga yang benar-benar dilaporkan pemilik usaha dan dinilai wajar oleh komunitas. Selisih ini tidak bisa dihitung selama kedua angka masih dilebur menjadi satu.",
            )}
          </p>
        </div>
      </Reveal>

      {/* Peringatan satuan diletakkan DI ATAS angka, bukan sebagai catatan kaki:
          pembaca yang berhenti di kartu pertama tetap harus melihatnya. */}
      <Reveal>
        <div className="flex gap-3 rounded-2xl border border-brand-amber/40 bg-brand-amber/[0.08] p-4">
          <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink" aria-hidden />
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-amber-ink">
              {t("Dua satuan yang tidak sama")}
            </p>
            <p className="text-[11px] leading-relaxed text-ink-soft">
              {t(
                "Estimasi dataset adalah pita harga makan per orang; harga terlapor adalah harga satu item menu. Karena itu angka yang dipertanggungjawabkan di halaman ini adalah POSISI — apakah harga terlapor jatuh di bawah, di dalam, atau di atas pita estimasi usaha itu sendiri. Besaran rupiah di bawah hanya indikasi arah.",
              )}
            </p>
          </div>
        </div>
      </Reveal>

      {!adaData ? (
        <Reveal>
          <Kartu judul="Belum ada usaha terpasangkan">
            <p className="rounded-xl bg-ink/[0.03] p-6 text-center text-xs leading-relaxed text-ink-faint">
              {t(
                "Belum ada usaha yang punya harga terverifikasi sekaligus cocok dengan nama tempat di dataset. Angka akan muncul begitu ada UMKM yang mengklaim usahanya, mengisi menu, dan harganya lolos penilaian komunitas.",
              )}
            </p>
          </Kartu>
        </Reveal>
      ) : (
        <>
          <Reveal>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile
                label="Usaha terpasangkan"
                nilai={String(nasional.n_usaha)}
                sub={`${nasional.n_produk} harga terverifikasi`}
              />
              {URUTAN_POSISI.map((p) => (
                <Tile
                  key={p}
                  label={p === "DI DALAM" ? "Di dalam pita" : p === "DI BAWAH" ? "Di bawah pita" : "Di atas pita"}
                  nilai={String(nasional.posisi[p])}
                  sub={`dari ${nasional.n_usaha} usaha`}
                  nada={
                    p === "DI BAWAH"
                      ? "text-brand-sage-ink"
                      : p === "DI ATAS"
                        ? "text-brand-amber-ink"
                        : "text-ink"
                  }
                />
              ))}
            </div>
          </Reveal>

          <Reveal>
            <Kartu
              judul="Median selisih"
              sub="Angka kedua, bukan angka utama — baca peringatan satuan di atas"
            >
              {nasional.cukup_untuk_median ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
                    {nasional.selisih_rupiah! >= 0 ? "+" : "−"}
                    {rupiah(Math.abs(nasional.selisih_rupiah!))}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-ink-soft">
                    {nasional.selisih_persen! >= 0 ? "+" : "−"}
                    {Math.abs(nasional.selisih_persen!).toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {t("terhadap titik tengah pita estimasi, berpasangan per usaha")}
                  </span>
                </div>
              ) : (
                <p className="rounded-xl bg-ink/[0.03] p-4 text-xs leading-relaxed text-ink-faint">
                  {t("Belum diterbitkan: perlu minimal")} {ambang.min_usaha_median}{" "}
                  {t("usaha terpasangkan, saat ini")} {nasional.n_usaha}
                  {t(". Cacah posisi di atas tetap berlaku — ia hitungan, bukan estimasi sebaran.")}
                </p>
              )}
            </Kartu>
          </Reveal>

          {terisi.length > 0 && (
            <Reveal>
              <Kartu judul="Per kabupaten" sub="Hanya kabupaten yang sudah punya usaha terpasangkan">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b border-ink/10 text-left text-[10px] uppercase tracking-wide text-ink-faint">
                        <th className="pb-2 pr-3 font-semibold">{t("Kabupaten")}</th>
                        <th className="pb-2 pr-3 text-right font-semibold">{t("Usaha")}</th>
                        <th className="pb-2 pr-3 text-right font-semibold">{t("Di bawah")}</th>
                        <th className="pb-2 pr-3 text-right font-semibold">{t("Di dalam")}</th>
                        <th className="pb-2 pr-3 text-right font-semibold">{t("Di atas")}</th>
                        <th className="pb-2 text-right font-semibold">{t("Median selisih")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terisi.map((k) => (
                        <tr key={k.kabupaten} className="border-b border-ink/5 last:border-0">
                          <td className="py-2 pr-3 font-semibold text-ink">{k.kabupaten}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">
                            {k.n_usaha}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-brand-sage-ink">
                            {k.posisi["DI BAWAH"]}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">
                            {k.posisi["DI DALAM"]}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-brand-amber-ink">
                            {k.posisi["DI ATAS"]}
                          </td>
                          <td className="py-2 text-right tabular-nums text-ink-soft">
                            {k.cukup_untuk_median ? (
                              <>
                                {k.selisih_persen! >= 0 ? "+" : "−"}
                                {Math.abs(k.selisih_persen!).toFixed(1)}%
                              </>
                            ) : (
                              <span className="text-ink-faint">{t("n terlalu kecil")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Kartu>
            </Reveal>
          )}

          <Reveal>
            <Kartu
              judul="Rincian per usaha"
              sub="Terurut dari selisih paling negatif — harga terlapor paling jauh di bawah estimasi"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-[10px] uppercase tracking-wide text-ink-faint">
                      <th className="pb-2 pr-3 font-semibold">{t("Usaha")}</th>
                      <th className="pb-2 pr-3 font-semibold">{t("Kabupaten")}</th>
                      <th className="pb-2 pr-3 text-right font-semibold">{t("Pita estimasi")}</th>
                      <th className="pb-2 pr-3 text-right font-semibold">{t("Terlapor")}</th>
                      <th className="pb-2 pr-3 font-semibold">{t("Posisi")}</th>
                      <th className="pb-2 text-right font-semibold">{t("Selisih")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usaha.map((u) => (
                      <tr key={`${u.nama}-${u.kabupaten}`} className="border-b border-ink/5 last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-ink">{u.nama}</span>
                          <span className="ml-1.5 text-[10px] text-ink-faint">
                            {u.n_produk} {t("harga")}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-ink-soft">{u.kabupaten}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-ink-faint">
                          {rupiah(u.estimasi_min)} – {rupiah(u.estimasi_max)}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-ink">
                          {rupiah(u.terlapor_median)}
                        </td>
                        <td className="py-2 pr-3">
                          <Lencana posisi={u.posisi} />
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-soft">
                          {u.selisih_persen >= 0 ? "+" : "−"}
                          {Math.abs(u.selisih_persen).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kartu>
          </Reveal>
        </>
      )}

      <Reveal>
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface-2/40 p-4">
          <div className="flex gap-2.5">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            <p className="text-[11px] leading-relaxed text-ink-soft">
              <span className="font-bold">{data.usaha_tanpa_pasangan_dataset}</span>{" "}
              {t(
                "usaha terdaftar punya harga terverifikasi tetapi namanya tidak ada di dataset, jadi tidak punya pita estimasi untuk dibandingkan. Itu bukan galat — dataset memang tidak memuat seluruh usaha di kawasan.",
              )}
            </p>
          </div>
          <div className="flex gap-2.5 border-t border-ink/10 pt-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
            <p className="text-[11px] leading-relaxed text-ink-faint">{t(data.metodologi)}</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
