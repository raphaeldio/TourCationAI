import { ArrowLeft, IdCard, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { simpanBiodata } from "../apiProfil";
import { useAuth, type JenisKelamin } from "../auth";
import { useT } from "../i18n";

const KELAS_INPUT =
  "sentuh w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-sage";

const KELAS_LABEL = "block text-xs font-bold text-ink";

const GENDER: { kode: JenisKelamin; label: string }[] = [
  { kode: "LAKI_LAKI", label: "Laki-laki" },
  { kode: "PEREMPUAN", label: "Perempuan" },
  { kode: "TIDAK_DISEBUTKAN", label: "Tidak disebutkan" },
];

/**
 * Onboarding biodata, dan sekaligus formulir penyuntingannya.
 *
 * Satu komponen untuk dua keadaan, dibedakan `?ubah=1`. Formulirnya identik,
 * dan dua komponen yang menulis kolom yang sama pasti menyimpang cepat atau
 * lambat — yang berbeda hanya judul, teks pengantar, dan ke mana tombol
 * kembali mengarah.
 *
 * **Kenapa penyuntingan ada padahal onboarding wajib.** Biodata yang hanya
 * bisa diisi sekali berarti satu salah ketik nomor telepon bersifat permanen.
 * Itu cacat, bukan sifat — jadi jalurnya tetap dibuka lewat /akun.
 *
 * **Hanya nama yang wajib.** Formulir yang menahan pengguna sampai delapan
 * kolom terisi akan diisi asal-asalan, dan data karangan lebih buruk daripada
 * kolom kosong — terutama bagi kolom yang tujuannya agregat demografi.
 */
export default function Biodata() {
  const t = useT();
  const navigate = useNavigate();
  const [param] = useSearchParams();
  const { sesi, profil, muatUlangProfil } = useAuth();

  const modeUbah = param.get("ubah") === "1";
  const bio = profil?.biodata;

  /**
   * Nilai awal dari Google, dipakai HANYA bila biodatanya belum pernah diisi.
   *
   * Google mengirimkan nama dan foto di metadata OAuth; memintanya lagi ke
   * pengguna adalah pekerjaan yang tidak perlu. Tetapi begitu ia sudah pernah
   * menyimpan, nilai tersimpannya yang menang — kalau tidak, nama yang sengaja
   * ia perbaiki akan tertimpa nama Google setiap kali formulir dibuka.
   */
  const dariGoogle = useMemo(() => {
    const m = (sesi?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const teks = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
    return {
      nama: teks("full_name") || teks("name") || "",
      foto: teks("avatar_url") || teks("picture") || "",
    };
  }, [sesi]);

  const [nama, setNama] = useState("");
  const [foto, setFoto] = useState("");
  const [telepon, setTelepon] = useState("");
  const [kota, setKota] = useState("");
  const [negara, setNegara] = useState("");
  const [bahasa, setBahasa] = useState("");
  const [lahir, setLahir] = useState("");
  const [gender, setGender] = useState<JenisKelamin | "">("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Diisi sekali begitu profil terbaca. Tanpa penanda, setiap render ulang
  // profil akan menimpa apa yang sedang diketik pengguna.
  const [terisi, setTerisi] = useState(false);
  useEffect(() => {
    if (terisi || !profil) return;
    setNama(bio?.full_name || dariGoogle.nama);
    setFoto(bio?.avatar_url || dariGoogle.foto);
    setTelepon(bio?.telepon ?? "");
    setKota(bio?.kota_asal ?? "");
    setNegara(bio?.negara ?? "Indonesia");
    setBahasa(bio?.bahasa_utama ?? "");
    setLahir(bio?.tanggal_lahir ?? "");
    setGender(bio?.jenis_kelamin ?? "");
    setTerisi(true);
  }, [profil, bio, dariGoogle, terisi]);

  async function kirim() {
    if (!nama.trim()) {
      setGalat(t("Nama lengkap wajib diisi."));
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      await simpanBiodata({
        nama_lengkap: nama.trim(),
        avatar_url: foto || null,
        telepon: telepon || null,
        kota_asal: kota || null,
        negara: negara || null,
        bahasa_utama: bahasa || null,
        tanggal_lahir: lahir || null,
        jenis_kelamin: gender || null,
      });
      // Profil dimuat ulang supaya `biodata_lengkap` menjadi true dan penjaga
      // route tidak memantulkan pengguna kembali ke halaman ini.
      await muatUlangProfil();
      navigate(modeUbah ? "/akun" : tujuanSetelahOnboarding(), { replace: true });
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  /** Setelah onboarding, arahkan ke tempat yang paling berguna bagi perannya. */
  function tujuanSetelahOnboarding(): string {
    if (profil?.boleh.gov) return "/gov";
    if (profil?.boleh.umkm) return "/umkm";
    return "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-paper px-4 py-10">
      <div className="w-full max-w-lg">
        {modeUbah && (
          <Link
            to="/akun"
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("Akun Saya")}
          </Link>
        )}

        <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sage-ink">
            <IdCard className="h-6 w-6 text-on-sage-ink" aria-hidden />
          </span>

          <h1 className="mt-4 font-display text-xl font-extrabold text-ink sm:text-2xl">
            {modeUbah ? t("Ubah Biodata") : t("Lengkapi Biodata Anda")}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {modeUbah
              ? t("Perubahan langsung berlaku. Hanya nama yang wajib diisi.")
              : t(
                  "Sekali saja, lalu Anda tidak akan ditanya lagi. Hanya nama yang wajib — sisanya boleh dilewati dan bisa diisi kapan pun dari halaman Akun.",
                )}
          </p>

          {foto && (
            <img
              src={foto}
              alt=""
              className="mt-4 h-16 w-16 rounded-2xl border border-ink/10 object-cover"
            />
          )}

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className={KELAS_LABEL}>
                {t("Nama lengkap")} <span className="text-rose-600">*</span>
              </span>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                maxLength={120}
                placeholder={t("Nama sesuai yang ingin Anda tampilkan")}
                className={`mt-1 ${KELAS_INPUT}`}
              />
            </label>

            <label className="block">
              <span className={KELAS_LABEL}>{t("Nomor telepon")}</span>
              <input
                value={telepon}
                onChange={(e) => setTelepon(e.target.value)}
                maxLength={40}
                inputMode="tel"
                placeholder="08xxxxxxxxxx"
                className={`mt-1 ${KELAS_INPUT}`}
              />
              <span className="mt-1 block text-[11px] text-ink-faint">
                {t("Dipakai bila pemilik usaha perlu menghubungi Anda soal reservasi.")}
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={KELAS_LABEL}>{t("Kota asal")}</span>
                <input
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  maxLength={100}
                  placeholder={t("mis. Medan")}
                  className={`mt-1 ${KELAS_INPUT}`}
                />
              </label>
              <label className="block">
                <span className={KELAS_LABEL}>{t("Negara")}</span>
                <input
                  value={negara}
                  onChange={(e) => setNegara(e.target.value)}
                  maxLength={100}
                  className={`mt-1 ${KELAS_INPUT}`}
                />
              </label>
            </div>

            <label className="block">
              <span className={KELAS_LABEL}>{t("Bahasa utama")}</span>
              <input
                value={bahasa}
                onChange={(e) => setBahasa(e.target.value)}
                maxLength={60}
                placeholder={t("mis. Indonesia")}
                className={`mt-1 ${KELAS_INPUT}`}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={KELAS_LABEL}>{t("Tanggal lahir")}</span>
                <input
                  type="date"
                  value={lahir}
                  onChange={(e) => setLahir(e.target.value)}
                  // Batas atas hari ini: tanggal lahir di masa depan ditolak
                  // database, dan menahannya di sini menghemat satu perjalanan.
                  max={new Date().toISOString().slice(0, 10)}
                  min="1900-01-02"
                  className={`mt-1 ${KELAS_INPUT}`}
                />
              </label>
              <label className="block">
                <span className={KELAS_LABEL}>{t("Jenis kelamin")}</span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as JenisKelamin | "")}
                  className={`mt-1 ${KELAS_INPUT}`}
                >
                  <option value="">{t("Tidak diisi")}</option>
                  {GENDER.map((g) => (
                    <option key={g.kode} value={g.kode}>
                      {t(g.label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Dinyatakan terus-terangan untuk apa dua field terakhir dipakai.
              Meminta tanggal lahir tanpa menyebut alasannya adalah cara
              tercepat membuat orang mengisinya sembarangan. */}
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink/[0.03] p-3 text-[11px] leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t(
                "Kota asal, tanggal lahir, dan jenis kelamin hanya dipakai sebagai angka gabungan di dashboard pemerintah — tidak pernah ditampilkan per orang, dan tidak pernah ikut ke data itinerary yang dibaca dinas.",
              )}
            </span>
          </p>

          {galat && (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sibuk}
              onClick={() => void kirim()}
              className="sentuh flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-3 text-sm font-bold text-on-sage-ink disabled:opacity-60"
            >
              {sibuk && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {sibuk ? t("Menyimpan…") : modeUbah ? t("Simpan Perubahan") : t("Simpan & Lanjutkan")}
            </button>
            {modeUbah && (
              <button
                type="button"
                onClick={() => navigate("/akun")}
                className="sentuh rounded-xl border border-ink/15 px-4 py-3 text-sm font-bold text-ink"
              >
                {t("Batal")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
