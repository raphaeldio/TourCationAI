import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  IdCard,
  Landmark,
  LogOut,
  Mail,
  Pencil,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { kepalaAuth, useAuth, type JenisKelamin } from "../auth";
import { useT } from "../i18n";

interface UsahaTersedia {
  nama: string;
  alamat: string | null;
  kabupaten: string | null;
}

const KABUPATEN = [
  "Toba", "Simalungun", "Karo", "Samosir",
  "Pakpak Bharat", "Tapanuli Utara", "Dairi", "Humbang Hasundutan",
];

const KELAS_INPUT =
  "sentuh w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-sage";

const LABEL_GENDER: Record<JenisKelamin, string> = {
  LAKI_LAKI: "Laki-laki",
  PEREMPUAN: "Perempuan",
  TIDAK_DISEBUTKAN: "Tidak disebutkan",
};

export default function Akun() {
  const { profil, keluar, muatUlangProfil } = useAuth();
  const t = useT();
  const [pilihan, setPilihan] = useState<"UMKM" | "GOV">("UMKM");
  const [usahaTerpilih, setUsahaTerpilih] = useState<UsahaTersedia | null>(null);
  const [cari, setCari] = useState("");
  const [usaha, setUsaha] = useState<UsahaTersedia[]>([]);
  const [kabupaten, setKabupaten] = useState("Toba");
  const [alasan, setAlasan] = useState("");
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  const namaUsaha = usahaTerpilih?.nama ?? "";
  // Wilayah UMKM mengikuti alamat usaha yang diklaim; hanya jatuh ke pilihan
  // manual kalau alamat usaha tidak bisa dipetakan ke kabupaten mana pun.
  const kabupatenTerkunci = pilihan === "UMKM" && !!usahaTerpilih?.kabupaten;
  const kabupatenDipakai = kabupatenTerkunci
    ? (usahaTerpilih?.kabupaten as string)
    : kabupaten;
  // Domain surel yang otomatis berperan GOV; diambil dari server agar teks di
  // layar tidak menyimpang dari aturan yang sebenarnya dipakai.
  const domainGov = profil?.domain_gov ?? [];

  // Pencarian usaha di-debounce; tanpa itu tiap ketukan tombol memicu request.
  useEffect(() => {
    if (pilihan !== "UMKM") return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/auth/usaha-tersedia?cari=${encodeURIComponent(cari)}&batas=8`,
        );
        if (r.ok) setUsaha((await r.json()).usaha ?? []);
      } catch {
        /* pencarian gagal — biarkan daftar kosong */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cari, pilihan]);

  async function ajukan() {
    setKirim(true);
    setGalat(null);
    try {
      const r = await fetch("/api/auth/klaim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
        // Hanya UMKM yang lewat jalur permohonan; GOV ditentukan surel dinas.
        body: JSON.stringify({
          requested_role: "UMKM",
          umkm_place_name: namaUsaha,
          kabupaten: kabupatenDipakai,
          alasan,
        }),
      });
      if (!r.ok) {
        const isi = await r.json().catch(() => ({}));
        throw new Error(isi?.detail ?? r.statusText);
      }
      setSukses(true);
      await muatUlangProfil();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setKirim(false);
    }
  }

  const tertunda = profil?.permohonan_tertunda;

  return (
    <div className="min-h-screen bg-surface-paper px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Kembali ke beranda")}
        </Link>

        {/* Ringkasan akun */}
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-extrabold text-ink">{t("Akun Saya")}</h1>
              <p className="mt-0.5 truncate text-sm text-ink-soft">{profil?.email}</p>
            </div>
            <button
              type="button"
              onClick={keluar}
              className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink-soft"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t("Keluar")}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg bg-brand-sage/15 px-3 py-1.5 text-xs font-extrabold text-brand-sage-ink">
              {t("Peran")}: {profil?.peran ?? "USER"}
            </span>
            {profil?.kabupaten && (
              <span className="rounded-lg bg-brand-sand/15 px-3 py-1.5 text-xs font-extrabold text-brand-sand-ink">
                {t("Wilayah")}: {profil.kabupaten}
              </span>
            )}
          </div>

          {(profil?.boleh.gov || profil?.boleh.umkm) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profil.boleh.gov && (
                <Link
                  to="/gov"
                  className="sentuh flex items-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-bold text-on-sage-ink no-underline"
                >
                  <Landmark className="h-4 w-4" aria-hidden />
                  {t("Dashboard Pemerintah")}
                </Link>
              )}
              {profil.boleh.umkm && (
                <Link
                  to="/umkm"
                  className="sentuh flex items-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-bold text-on-sage-ink no-underline"
                >
                  <Store className="h-4 w-4" aria-hidden />
                  {t("Dashboard UMKM")}
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Biodata. Onboarding memang hanya sekali, tetapi jalur menyuntingnya
            harus tetap ada: biodata yang tidak bisa dikoreksi berarti satu
            salah ketik nomor telepon bersifat permanen. */}
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <IdCard className="h-5 w-5 text-brand-sage-ink" aria-hidden />
              {t("Biodata")}
            </h2>
            <Link
              to="/biodata?ubah=1"
              className="sentuh flex shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink no-underline transition-colors hover:bg-ink/5"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t("Ubah")}
            </Link>
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
            {[
              { k: t("Nama lengkap"), v: profil?.biodata?.full_name },
              { k: t("Nomor telepon"), v: profil?.biodata?.telepon },
              { k: t("Kota asal"), v: profil?.biodata?.kota_asal },
              { k: t("Negara"), v: profil?.biodata?.negara },
              { k: t("Bahasa utama"), v: profil?.biodata?.bahasa_utama },
              { k: t("Tanggal lahir"), v: profil?.biodata?.tanggal_lahir },
              {
                k: t("Jenis kelamin"),
                v: profil?.biodata?.jenis_kelamin
                  ? t(LABEL_GENDER[profil.biodata.jenis_kelamin])
                  : null,
              },
            ].map(({ k, v }) => (
              <div key={k}>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  {k}
                </dt>
                <dd className={v ? "text-sm text-ink" : "text-sm text-ink-faint"}>
                  {v || t("belum diisi")}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Permohonan peran */}
        {tertunda || sukses ? (
          <section className="mt-4 rounded-2xl border border-brand-amber/30 bg-brand-amber/10 p-5 sm:p-6">
            <p className="flex items-center gap-2 font-display font-extrabold text-ink">
              <Clock className="h-5 w-5 text-brand-amber-ink" aria-hidden />
              {t("Permohonan sedang ditinjau")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {t("Permohonan peran")}{" "}
              <strong>{tertunda?.requested_role ?? pilihan}</strong>{" "}
              {t(
                "sudah tercatat dan menunggu persetujuan admin. Peran akan berubah otomatis begitu disetujui — tidak perlu mendaftar ulang.",
              )}
            </p>
          </section>
        ) : profil?.peran === "USER" ? (
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Ajukan Peran")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              {pilihan === "UMKM"
                ? t("Permohonan ditinjau admin. Peran tidak berubah sampai disetujui.")
                : t("Peran Pemerintah ditentukan oleh alamat surel dinas Anda.")}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {([
                { k: "UMKM" as const, ikon: Store, label: "Pemilik UMKM" },
                { k: "GOV" as const, ikon: Landmark, label: "Pemerintah" },
              ]).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setPilihan(o.k)}
                  className={`sentuh flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-colors ${
                    pilihan === o.k
                      ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                      : "border-ink/10 text-ink-soft hover:border-ink/25"
                  }`}
                >
                  <o.ikon className="h-5 w-5" aria-hidden />
                  {t(o.label)}
                </button>
              ))}
            </div>

            {pilihan === "GOV" ? (
              /* Peran GOV tidak lewat antrean: kepemilikan surel dinas yang
                 membuktikannya, dan admin tidak punya cara verifikasi yang
                 lebih baik daripada domain surel itu sendiri. */
              <div className="mt-4 rounded-xl border border-ink/10 bg-surface-2 p-4">
                <p className="flex items-center gap-2 font-display text-sm font-extrabold text-ink">
                  <Mail className="h-4 w-4 text-brand-sage-ink" aria-hidden />
                  {t("Peran Pemerintah lewat surel dinas")}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  {t(
                    "Peran ini tidak diajukan lewat formulir. Masuk memakai alamat surel dinas Anda — peran Pemerintah aktif seketika, tanpa menunggu persetujuan.",
                  )}
                </p>

                {domainGov.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      {t("Domain yang diterima")}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {domainGov.map((d) => (
                        <code
                          key={d}
                          className="rounded-lg bg-brand-sage/15 px-2 py-1 text-xs font-bold text-brand-sage-ink"
                        >
                          @{d}
                        </code>
                      ))}
                    </p>
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                  {t("Anda sedang masuk sebagai")}{" "}
                  <strong className="text-ink">{profil?.email}</strong>{" "}
                  {t("— alamat ini belum terdaftar sebagai surel dinas.")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                  {t(
                    "Instansi yang memakai surel di luar domain tersebut bisa didaftarkan satu per satu oleh admin lewat GOV_EMAILS di server.",
                  )}
                </p>

                <button
                  type="button"
                  onClick={keluar}
                  className="sentuh mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-bold text-ink"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {t("Keluar & masuk dengan surel dinas")}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">
                    {t("Cari usaha Anda di daftar terdaftar")}
                  </span>
                  <input
                    className={KELAS_INPUT}
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder={t("mis. Lapo, RM, nama warung...")}
                  />
                </label>

                {usaha.length > 0 && (
                  <ul className="max-h-52 gulir-x space-y-1.5 overflow-y-auto">
                    {usaha.map((u) => (
                      <li key={u.nama}>
                        <button
                          type="button"
                          onClick={() => setUsahaTerpilih(u)}
                          className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                            namaUsaha === u.nama
                              ? "border-brand-sage-ink bg-brand-sage/10"
                              : "border-ink/10 hover:border-ink/25"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-ink">
                            {u.nama}
                          </span>
                          <span className="block truncate text-[11px] text-ink-faint">
                            {u.kabupaten ?? "-"} &middot;{" "}
                            {u.alamat ?? t("alamat tidak tercatat")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {usahaTerpilih && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-sage-ink">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {t("Dipilih")}: {usahaTerpilih.nama}
                  </p>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">
                    {t("Kabupaten")}
                  </span>
                  {kabupatenTerkunci ? (
                    <>
                      <input
                        className={`${KELAS_INPUT} bg-ink/5 text-ink-soft`}
                        value={kabupatenDipakai}
                        readOnly
                      />
                      <span className="mt-1 block text-[11px] text-ink-faint">
                        {t("Mengikuti alamat usaha yang dipilih.")}
                      </span>
                    </>
                  ) : (
                    <>
                      <select
                        className={KELAS_INPUT}
                        value={kabupaten}
                        onChange={(e) => setKabupaten(e.target.value)}
                      >
                        {KABUPATEN.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-[11px] text-ink-faint">
                        {usahaTerpilih
                          ? t("Alamat usaha tidak mencantumkan kabupaten — pilih manual.")
                          : t("Akan terisi otomatis setelah usaha dipilih.")}
                      </span>
                    </>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">
                    {t("Keterangan tambahan (opsional)")}
                  </span>
                  <textarea
                    className={`${KELAS_INPUT} min-h-[72px]`}
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  onClick={ajukan}
                  disabled={kirim || !namaUsaha}
                  className="sentuh flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-sage-ink to-brand-forest px-4 py-3 text-sm font-extrabold text-on-sage-ink disabled:opacity-50"
                >
                  {kirim ? t("Mengirim...") : t("Ajukan Permohonan")}
                </button>

                {galat && (
                  <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
                )}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
