import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { useT } from "../i18n";

/** Batas tunggu sebelum menyerah dan menampilkan penjelasan. */
const BATAS_TUNGGU_MS = 12_000;

/**
 * Tujuan pengalihan sesudah OAuth Google.
 *
 * supabase-js sendiri yang menukar kode di URL menjadi sesi (opsi
 * detectSessionInUrl); halaman ini menunggu profil termuat lalu mengarahkan
 * ke dashboard sesuai peran.
 *
 * Versi pertama halaman ini menunggu TANPA BATAS ketika profil gagal diambil,
 * karena `profil === null` dipakai untuk dua keadaan berbeda: "masih dimuat"
 * dan "gagal". Backend yang mati membuat pengguna terjebak di layar berputar
 * tanpa satu pun petunjuk. Sekarang kegagalan punya pesan sendiri, dan ada
 * batas waktu sebagai jaring terakhir bila ada keadaan yang tak terduga.
 */
export default function AuthCallback() {
  const { memuat, sesi, profil, galatProfil, muatUlangProfil } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [kehabisanWaktu, setKehabisanWaktu] = useState(false);
  const [mencoba, setMencoba] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setKehabisanWaktu(true), BATAS_TUNGGU_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (memuat) return;
    if (!sesi) {
      navigate("/masuk", { replace: true });
      return;
    }
    if (!profil) return; // masih dimuat, atau gagal — ditangani di bawah
    if (profil.boleh.gov) navigate("/gov", { replace: true });
    else if (profil.boleh.umkm) navigate("/umkm", { replace: true });
    else navigate("/akun", { replace: true });
  }, [memuat, sesi, profil, navigate]);

  async function cobaLagi() {
    setMencoba(true);
    setKehabisanWaktu(false);
    await muatUlangProfil();
    setMencoba(false);
  }

  const bermasalah = Boolean(galatProfil) || kehabisanWaktu;

  if (sesi && bermasalah && !profil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-paper px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-amber/20">
            <AlertTriangle className="h-6 w-6 text-brand-amber-ink" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-lg font-extrabold text-ink">
            {t("Masuk berhasil, tapi profil belum terbaca")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {t(
              galatProfil ??
                "Server tidak membalas dalam waktu yang wajar. Pastikan backend berjalan di port 8000.",
            )}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={cobaLagi}
              disabled={mencoba}
              className="sentuh flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-bold text-on-sage-ink disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${mencoba ? "animate-spin" : ""}`}
                aria-hidden
              />
              {mencoba ? t("Mencoba...") : t("Coba lagi")}
            </button>
            <Link
              to="/"
              className="sentuh flex flex-1 items-center justify-center rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-bold text-ink no-underline"
            >
              {t("Ke beranda")}
            </Link>
          </div>

          <p className="mt-4 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-faint">
            {t(
              "Sesi Google Anda sudah tersimpan. Begitu backend hidup, cukup tekan tombol Coba lagi — tidak perlu mengulang proses masuk.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-paper px-4">
      <Loader2 className="h-7 w-7 animate-spin text-brand-sage-ink" aria-hidden />
      <p className="text-sm font-semibold text-ink-soft">{t("Menyiapkan akun Anda...")}</p>
    </div>
  );
}
