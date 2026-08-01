import { useState } from "react";
import {
  Settings,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  BedDouble,
  Navigation,
  LocateFixed,
  Route,
} from "lucide-react";
import { Bus, Footprints, Bike, Car } from "lucide-react";
import type {
  GayaJelajahOption,
  Itinerary,
  MinatOption,
  Moda,
  PlanForm,
  ProfilOption,
} from "../types";
import MapCard from "./MapCard";
import { MinatIcon } from "../vectors";
import { hitungMalam } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { useT } from "../i18n";

interface Props {
  minat: MinatOption[];
  profil: ProfilOption[];
  /** Pilihan gaya jelajah dari /api/meta (Dekat-dekat, Seimbang, Jelajah jauh). */
  gayaJelajah: GayaJelajahOption[];
  form: PlanForm;
  setForm: (f: PlanForm) => void;
  onPlan: () => void;
  planning: boolean;
  error: string | null;
  itinerary: Itinerary | null;
}

export default function SidePanel({
  minat,
  profil,
  gayaJelajah,
  form,
  setForm,
  onPlan,
  planning,
  error,
  itinerary,
}: Props) {
  const toggleMinat = (key: string) => {
    const has = form.minat_wisata.includes(key);
    setForm({
      ...form,
      minat_wisata: has ? form.minat_wisata.filter((m) => m !== key) : [...form.minat_wisata, key],
    });
  };

  const tr = useT();
  const [geo, setGeo] = useState<{ t: string; err?: boolean } | null>(null);
  const [mencariGeo, setMencariGeo] = useState(false);

  const malam = hitungMalam(form);
  const bisaMenginap = form.n_days >= 2;

  /**
   * Ambil koordinat turis untuk dipakai sebagai titik acuan rute saat
   * penginapan tidak diikutkan.
   */
  const ambilLokasi = () => {
    if (!navigator.geolocation) {
      setGeo({ t: "Browser ini tidak mendukung geolokasi.", err: true });
      return;
    }
    setMencariGeo(true);
    setGeo({ t: "Meminta izin lokasi…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm({
          ...form,
          origin: {
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            label: "Lokasi Anda",
          },
        });
        setGeo({ t: "Titik acuan: lokasi Anda saat ini." });
        setMencariGeo(false);
      },
      (e) => {
        setGeo({
          t:
            e.code === 1
              ? "Izin lokasi ditolak. Rute akan berpangkal di hotel acuan."
              : e.code === 3
                ? "Permintaan lokasi kehabisan waktu."
                : "Lokasi tidak tersedia saat ini.",
          err: true,
        });
        setMencariGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <aside className="col-side order-1 flex flex-col gap-4 lg:order-2">
      <Card variant="glow" className="anim-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-brand-sand-ink" />
            {tr("Atur Perjalanan")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
              {tr("Budget Total (Rp)")}
            </label>
            {/* type="text", bukan "number": input number menolak menampilkan
                pemisah ribuan. Nilai di state tetap number murni — pemisah
                hanya lapisan tampilan, dan dilucuti lagi saat mengetik. */}
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.budget_total ? form.budget_total.toLocaleString("id-ID") : ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  budget_total: Number(e.target.value.replace(/\D/g, "")) || 0,
                })
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
              {tr("Tanggal Mulai")}
            </label>
            <Input
              type="date"
              value={form.tanggal_mulai ?? ""}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value || null })}
            />
            <p className="mt-1 text-[0.62rem] leading-relaxed text-ink-faint">
              {tr("Dipakai untuk menghindari destinasi yang libur pada hari itu.")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
                {tr("Durasi (Hari)")}
              </label>
              <Input
                type="number"
                min={1}
                max={7}
                value={form.n_days}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  // Sekali hari turun ke 1, penginapan tidak lagi relevan.
                  setForm({
                    ...form,
                    n_days: n,
                    include_penginapan: n >= 2 ? form.include_penginapan : false,
                  });
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
                {tr("Jumlah Orang")}
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.n_orang}
                onChange={(e) => {
                  // Field angka boleh dikosongkan atau diisi 0 lewat keyboard —
                  // atribut min saja tidak menahannya. Nilai selalu dijepit ke >= 1
                  // supaya pembagian "per orang" tidak pernah kehilangan makna.
                  const n = Number(e.target.value);
                  setForm({
                    ...form,
                    n_orang: Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 20) : 1,
                  });
                }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
              {tr("Wisata Per Hari")}
            </label>
            <Input
              type="number"
              min={1}
              max={5}
              value={form.max_attractions_per_day}
              onChange={(e) =>
                setForm({ ...form, max_attractions_per_day: Number(e.target.value) })
              }
            />
          </div>

          {/* Moda transportasi. Biayanya ikut masuk ke batas budget, bukan
              sekadar ditampilkan — lihat MODUL 6 di engine.py. */}
          <div className="rounded-xl border border-ink/10 bg-ink/[0.04] p-3">
            <label className="mb-2 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
              {tr("Transportasi")}
            </label>

            <button
              type="button"
              onClick={() =>
                setForm({ ...form, moda: form.moda === "umum" ? "mobil" : "umum" })
              }
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold transition",
                form.moda === "umum"
                  ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink"
                  : "border-ink/10 text-ink-soft hover:text-ink",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bus className="h-3.5 w-3.5" />
                {tr("Angkutan umum")}
              </span>
              <span className="text-[0.6rem] font-bold opacity-80">
                {form.moda === "umum" ? tr("Dipakai") : tr("Tidak")}
              </span>
            </button>

            {/* Kendaraan sendiri hanya relevan kalau bukan angkutan umum. */}
            {form.moda !== "umum" && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: "jalan_kaki", icon: Footprints, label: "Jalan kaki" },
                    { key: "motor", icon: Bike, label: "Motor" },
                    { key: "mobil", icon: Car, label: "Mobil" },
                  ] as { key: Moda; icon: typeof Car; label: string }[]
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, moda: key })}
                    className={cn(
                      "inline-flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[0.68rem] font-semibold transition",
                      form.moda === key
                        ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink"
                        : "border-ink/10 text-ink-soft hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tr(label)}
                  </button>
                ))}
              </div>
            )}

            <p className="mt-2 text-[0.66rem] leading-relaxed text-ink-faint">
              {form.moda === "umum"
                ? tr("Tarif per orang per hari dari data operator antarkota.")
                : form.moda === "jalan_kaki"
                  ? tr("Tanpa biaya BBM. Feri dihitung tarif pejalan kaki.")
                  : tr("Biaya BBM dihitung dari jarak rute dan ikut membatasi budget.")}
            </p>
          </div>

          {/* Gaya jelajah: seberapa jauh turis rela pergi demi sebuah destinasi.
              Ini SELERA, bukan benar-salah — makanya diserahkan ke turis, bukan
              disimpulkan sistem dari budget. Efeknya besar: pada uji 3 hari,
              "Dekat-dekat" menghasilkan 23 km sementara "Jelajah jauh" 123 km. */}
          {gayaJelajah.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
                <Route className="h-3 w-3" />
                {tr("Gaya Jelajah")}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {gayaJelajah.map((g) => {
                  const aktif = form.gaya_jelajah === g.key;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setForm({ ...form, gaya_jelajah: g.key })}
                      title={tr(g.deskripsi)}
                      aria-pressed={aktif}
                      className={cn(
                        "rounded-lg border px-1.5 py-2 text-[0.68rem] font-semibold leading-tight transition",
                        aktif
                          ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-md shadow-brand-sage/25"
                          : "border-ink/10 text-ink-soft hover:border-brand-sage/40 hover:text-ink",
                      )}
                    >
                      {tr(g.key)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-ink-faint">
                {tr(
                  gayaJelajah.find((g) => g.key === form.gaya_jelajah)?.deskripsi ??
                    "Seberapa jauh kamu rela pergi demi sebuah destinasi.",
                )}
              </p>
            </div>
          )}

          {/* Penginapan hanya relevan kalau perjalanan >= 2 hari. Jumlah malam
              selalu hari - 1, tidak pernah diisi manual. */}
          {bisaMenginap && (
            <div className="rounded-xl border border-ink/10 bg-ink/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
                  {tr("Penginapan")}
                </span>
                <span className="text-[0.68rem] font-semibold text-brand-amber-ink">
                  {malam > 0 ? `${malam} ${tr("malam")}` : tr("tanpa menginap")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { on: true, icon: BedDouble, label: tr("Termasuk") },
                  { on: false, icon: Navigation, label: tr("Tidak") },
                ].map(({ on, icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setForm({ ...form, include_penginapan: on })}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition",
                      form.include_penginapan === on
                        ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink"
                        : "border-ink/10 text-ink-soft hover:text-ink",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {form.include_penginapan ? (
                <p className="mt-2 text-[0.66rem] leading-relaxed text-ink-faint">
                  Hotel dihitung untuk {malam} malam (hari − 1) dan jadi pangkal rute harian.
                </p>
              ) : (
                // Tanpa penginapan, rute berpangkal di lokasi turis sendiri.
                <div className="mt-2.5">
                  <p className="text-[0.66rem] leading-relaxed text-ink-faint">
                    {tr("Hotel tidak dibiayai. Rute berangkat dari titik acuan pilihanmu.")}
                  </p>
                  <button
                    type="button"
                    onClick={ambilLokasi}
                    disabled={mencariGeo}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-ink/[0.05] px-2 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand-sage/45 hover:text-ink disabled:opacity-50"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    {tr(form.origin ? "Perbarui lokasi saya" : "Gunakan lokasi saya")}
                  </button>
                  {form.origin && (
                    <p className="mt-1.5 text-[0.66rem] font-semibold text-emerald-600">
                      {tr(form.origin.label)} · {form.origin.lat.toFixed(4)},{" "}
                      {form.origin.lon.toFixed(4)}
                    </p>
                  )}
                  {geo && (
                    <p
                      className={cn(
                        "mt-1.5 text-[0.66rem] leading-relaxed",
                        geo.err ? "text-amber-600" : "text-ink-faint",
                      )}
                    >
                      {tr(geo.t)}
                    </p>
                  )}
                  {!form.origin && !geo && (
                    <p className="mt-1.5 text-[0.66rem] leading-relaxed text-ink-faint">
                      {tr("Tanpa lokasi, rute tetap berpangkal di hotel acuan terdekat.")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[0.64rem] font-bold uppercase tracking-wider text-ink-faint">
              {tr("Minat Wisata")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {minat.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    form.minat_wisata.includes(m.key)
                      ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-md shadow-brand-sage/30"
                      : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:border-ink/20 hover:text-ink",
                  )}
                  onClick={() => toggleMinat(m.key)}
                  title={m.deskripsi}
                >
                  <MinatIcon kind={m.key} />
                  {m.key}
                </button>
              ))}
            </div>

            {/* Sub-pilihan dari minat: gaya pengalaman. Keempatnya setara —
                yang berbeda adalah bobot keberpihakan ke UMKM di solver. */}
            <div className="mt-3 border-l-2 border-ink/10 pl-3">
              <label className="mb-1.5 block text-[0.62rem] font-bold uppercase tracking-wider text-ink-faint">
                {tr("Gaya Pengalaman")}
              </label>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, profil_pilihan: null })}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left text-xs transition",
                    form.profil_pilihan === null
                      ? "border-brand-sage/45 bg-brand-sage/12 text-ink"
                      : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:border-ink/20",
                  )}
                >
                  <span className="font-semibold">{tr("Saran AI")}</span>
                  <span className="mt-0.5 block text-[0.66rem] leading-snug text-ink-faint">
                    {tr("Dipilihkan dari budget per hari")}
                  </span>
                </button>

                {profil.map((p) => {
                  const aktif = form.profil_pilihan === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setForm({ ...form, profil_pilihan: p.key })}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-left text-xs transition",
                        aktif
                          ? "border-brand-sage/45 bg-brand-sage/12 text-ink"
                          : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:border-ink/20",
                      )}
                      title={p.deskripsi}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{p.key}</span>
                        <span className="shrink-0 text-[0.6rem] font-bold text-emerald-600">
                          UMKM {Math.round(p.umkm_weight * 100)}%
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[0.66rem] leading-snug text-ink-faint">
                        {p.deskripsi}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={onPlan} disabled={planning}>
            {planning ? (
              <>
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
                {tr("AI menyusun rencana…")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {tr("Susun Rencana")}
              </>
            )}
          </Button>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-50/20 px-3 py-2.5 text-xs leading-relaxed text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5 text-xs text-ink-soft">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-amber-ink" />
              {tr("Dijamin tidak melebihi budget")}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {tr("Mendukung UMKM & wisata lokal")}
            </div>
          </div>
        </CardContent>
      </Card>

      <MapCard itinerary={itinerary} />

      <Card className="anim-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            {tr("Tips Lokal")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 pl-4 text-xs leading-relaxed text-ink-soft">
            <li>Sewa skuter untuk menjangkau desa-desa di dataran tinggi Samosir.</li>
            <li>Coba &quot;Naniura&quot; — sashimi khas Batak, mirip ceviche.</li>
            <li>Naik feri pagi dari Parapat ke Tomok agar tidak berdesakan.</li>
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}
