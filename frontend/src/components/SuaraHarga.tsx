import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

import { rupiah } from "../apiIntel";
import { ambilProfilPublik } from "../apiKomunitas";
import { beriSuara } from "../apiUmkm";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import type { ProdukPublik, Suara } from "../typesKomunitas";

/**
 * Menu satu usaha beserta penilaian komunitas atas kewajaran harganya.
 *
 * Dirender hanya saat pengguna membukanya, bukan ikut termuat bersama kartu:
 * daftar rekomendasi bisa berisi beberapa usaha, dan memuat menunya semua di
 * muka berarti beberapa permintaan untuk data yang mungkin tidak pernah dilihat.
 *
 * Suara di sini bukan rating usaha. Rating menjawab "usaha ini bagus?",
 * sedangkan suara menjawab "harga ini wajar?".
 *
 * Yang ditentukan suara ada dua, dan keduanya BUKAN mesin penyusun itinerary —
 * harga UMKM tidak pernah menyentuh solver (lihat `services/solver_state.py`):
 *
 *   1. apakah harga ini ditandai terverifikasi kepada wisatawan berikutnya;
 *   2. apakah ia ikut dihitung dalam statistik harga daerah yang dibaca
 *      pemerintah (`services/selisih_harga.py`).
 *
 * Keduanya lebih langsung terlihat daripada pengaruh lewat ILP yang buram.
 */
export default function SuaraHarga({ businessId }: { businessId: string }) {
  const t = useT();
  const { sesi } = useAuth();
  const [produk, setProduk] = useState<ProdukPublik[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilProfilPublik(businessId)
      .then((d) => !batal && setProduk(d.produk))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, [businessId]);

  async function pilih(p: ProdukPublik, suara: Suara) {
    // Menekan tombol yang sama dua kali berarti menarik pendapat, bukan
    // menumpuk suara kedua — backend memperlakukan 0 sebagai abstain.
    const nilai: Suara = p.suara.suara_saya === suara ? 0 : suara;
    setSibuk(p.id);
    setGalat(null);
    try {
      const hasil = await beriSuara(p.id, nilai);
      setProduk((daftar) =>
        (daftar ?? []).map((x) =>
          x.id === p.id
            ? { ...x, suara: { ...hasil.suara, suara_saya: nilai === 0 ? null : nilai } }
            : x,
        ),
      );
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(null);
    }
  }

  if (galat && !produk) {
    return <p className="mt-2 text-[11px] text-ink-faint">{galat}</p>;
  }

  if (!produk) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t("Memuat menu...")}
      </p>
    );
  }

  if (produk.length === 0) {
    return (
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        {t("Usaha ini belum mendaftarkan produk, jadi belum ada harga untuk dinilai.")}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {produk.map((p) => {
        const milikSaya = p.suara.suara_saya;
        return (
          <div key={p.id} className="rounded-lg bg-ink/[0.03] p-2">
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-xs font-semibold text-ink">{p.nama}</span>
              <span className="text-xs font-extrabold tabular-nums text-ink">
                {rupiah(p.harga)}
              </span>
            </p>

            <p className="mt-0.5 text-[10px] text-ink-faint">
              {p.kategori ? `${p.kategori} · ` : ""}
              {p.harga_median_referensi
                ? `${t("median sekitar")} ${rupiah(p.harga_median_referensi)}`
                : t("belum ada pembanding")}
              {p.suara.total > 0
                ? ` · ${p.suara.setuju}/${p.suara.total} ${t("menilai wajar")}`
                : ` · ${t("belum ada penilaian harga")}`}
            </p>

            {sesi ? (
              <div className="mt-1.5 flex gap-1.5">
                {([
                  { nilai: 1 as Suara, ikon: ThumbsUp, label: "Wajar" },
                  { nilai: -1 as Suara, ikon: ThumbsDown, label: "Kemahalan" },
                ]).map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    disabled={sibuk === p.id}
                    aria-pressed={milikSaya === o.nilai}
                    onClick={() => void pilih(p, o.nilai)}
                    className={`sentuh flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                      milikSaya === o.nilai
                        ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                        : "border-ink/10 text-ink-soft hover:border-ink/25"
                    }`}
                  >
                    <o.ikon className="h-3 w-3" aria-hidden />
                    {t(o.label)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[10px] text-ink-faint">
                {t("Masuk untuk ikut menilai kewajaran harga.")}
              </p>
            )}
          </div>
        );
      })}

      {galat && <p className="text-[11px] text-rose-700">{galat}</p>}
    </div>
  );
}
