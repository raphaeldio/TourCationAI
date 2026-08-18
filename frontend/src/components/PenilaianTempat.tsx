import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { simpanRating } from "../apiKomunitas";
import { useAuth } from "../auth";
import Bintang from "./Bintang";
import { useT } from "../i18n";
import SuaraHarga from "./SuaraHarga";
import type { UsahaTertaut } from "../typesKomunitas";

/**
 * Penilaian satu tempat, cukup kecil untuk ditempel di dalam kartu agenda.
 *
 * Dirender di bawah daftar pilihan makan, bukan di dalam tombol pilihannya:
 * tombol bintang di dalam tombol pilihan berarti `<button>` bersarang — HTML
 * tidak sah, dan kliknya saling rebut antara "pilih tempat ini" dan "beri
 * empat bintang".
 *
 * Yang dinilai selalu tempat yang SEDANG DIPILIH pada slot itu. Menukar
 * pilihan menukar tempat yang dinilai, dan itu memang yang diharapkan: yang
 * masuk rencana turis itulah yang ia kunjungi.
 */
export default function PenilaianTempat({ usaha }: { usaha: UsahaTertaut }) {
  const t = useT();
  const { sesi } = useAuth();
  const [nilai, setNilai] = useState<number | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  // Pilihan sesi ini menang atas yang tersimpan; tanpa itu bintangnya melompat
  // balik ke nilai lama sebelum permintaan selesai.
  const terpilih = nilai ?? usaha.rating_saya ?? 0;

  async function beri(n: number) {
    setNilai(n);
    setPesan(null);
    try {
      await simpanRating(usaha.business_id, n);
      setPesan(t("Penilaian tersimpan. Terima kasih!"));
    } catch (e) {
      setPesan((e as Error).message);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-ink/10 bg-white/60 p-2.5">
      {sesi ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint">
            {nilai == null && usaha.rating_saya != null
              ? t("Penilaian Anda saat ini")
              : t("Beri penilaian")}
          </span>
          <Bintang nilai={terpilih} onPilih={(n) => void beri(n)} ukuran="sm" />
          <span className="text-[0.68rem] text-ink-faint">
            {usaha.n_rating === 0
              ? t("Belum ada penilaian")
              : `${usaha.rata_rating?.toFixed(1)} · ${usaha.n_rating} ${t("penilaian")}`}
          </span>
        </div>
      ) : (
        <p className="text-[0.68rem] leading-relaxed text-ink-faint">
          {t("Masuk untuk memberi penilaian — satu akun satu penilaian per usaha.")}
        </p>
      )}

      {pesan && <p className="mt-1 text-[0.68rem] text-ink-soft">{pesan}</p>}

      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-expanded={menu}
        className="sentuh mt-1.5 flex w-full items-center justify-between gap-2 border-t border-ink/5 pt-1.5 text-[0.68rem] font-bold text-ink-soft hover:text-ink"
      >
        {t("Menu & kewajaran harga")}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${menu ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {menu && <SuaraHarga businessId={usaha.business_id} />}
    </div>
  );
}
