import { AlertTriangle, ArrowLeft, Landmark, LogIn, Store } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { useT } from "../i18n";

/** Ikon Google resmi (SVG sebaris agar tidak menambah dependensi). */
function IkonGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Masuk() {
  const { siap, sesi, profil, memuat, masukGoogle } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  // Sudah masuk -> onboarding biodata dulu bila belum pernah, lalu dashboard
  // sesuai peran. Penjaga sesungguhnya ada di ProtectedRoute; pengalihan di
  // sini hanya menghemat satu pantulan bagi yang baru saja masuk.
  useEffect(() => {
    if (!sesi || !profil) return;
    if (profil.biodata_lengkap === false) navigate("/biodata", { replace: true });
    else if (profil.boleh.gov) navigate("/gov", { replace: true });
    else if (profil.boleh.umkm) navigate("/umkm", { replace: true });
    else navigate("/akun", { replace: true });
  }, [sesi, profil, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-paper px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Kembali ke beranda")}
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sage-ink">
            <LogIn className="h-6 w-6 text-on-sage-ink" aria-hidden />
          </span>

          <h1 className="mt-4 font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Masuk ke TourCation")}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t(
              "Perencanaan perjalanan tetap bisa dipakai tanpa masuk. Akun hanya diperlukan untuk membuka dashboard UMKM dan pemerintah.",
            )}
          </p>

          {!siap ? (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-xs leading-relaxed text-ink-soft">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink"
                aria-hidden
              />
              <span>
                {t("Login belum dikonfigurasi di lingkungan ini.")}{" "}
                <code className="rounded bg-ink/5 px-1">VITE_SUPABASE_URL</code> dan{" "}
                <code className="rounded bg-ink/5 px-1">VITE_SUPABASE_ANON_KEY</code>{" "}
                {t("perlu diisi di")} <code className="rounded bg-ink/5 px-1">frontend/.env</code>.
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={masukGoogle}
              disabled={memuat}
              className="sentuh mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-md disabled:opacity-60"
            >
              <IkonGoogle />
              {memuat ? t("Memeriksa sesi...") : t("Lanjutkan dengan Google")}
            </button>
          )}

          <div className="mt-6 border-t border-ink/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              {t("Peran yang tersedia")}
            </p>
            <ul className="mt-2.5 space-y-2.5">
              <li className="flex items-start gap-2.5">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                <span className="text-xs leading-relaxed text-ink-soft">
                  <strong className="text-ink">UMKM</strong> —{" "}
                  {t(
                    "kelola produk dan harga, lihat performa usaha. Perlu mengklaim usaha yang terdaftar.",
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                <span className="text-xs leading-relaxed text-ink-soft">
                  <strong className="text-ink">{t("Pemerintah")}</strong> —{" "}
                  {t(
                    "statistik kawasan, analisis kesenjangan, simulasi kebijakan. Masuk memakai surel dinas resmi (mis. berakhiran .go.id) — aktif seketika, tanpa persetujuan admin.",
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
