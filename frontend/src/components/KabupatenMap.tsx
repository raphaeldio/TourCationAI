import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef } from "react";

import { PALET } from "../palette";
import type { GapKabupaten } from "../typesIntel";
import { useT } from "../i18n";

interface Props {
  data: GapKabupaten[];
  dipilih: string | null;
  onPilih: (kabupaten: string) => void;
}

/** Warna titik mengikuti mendesaknya prioritas. */
function warnaPrioritas(peringkat: number, total: number): string {
  const rasio = peringkat / total;
  if (rasio <= 0.25) return "#be123c"; // rose-700 — paling mendesak
  if (rasio <= 0.5) return PALET.amber;
  if (rasio <= 0.75) return PALET.sand;
  return PALET.sage;
}

/**
 * Peta prioritas per kabupaten.
 *
 * Sengaja TIDAK memakai ulang MapCard: komponen itu terikat erat pada tipe
 * Itinerary (tab harian, rute OSRM, penggantian titik berangkat). Yang dipakai
 * ulang adalah idiom lifecycle-nya — callback ref, layerGroup, invalidateSize.
 *
 * Tidak ada panggilan OSRM di sini. OSRM adalah server demo publik tanpa SLA
 * dan sudah menjadi dependensi hidup MapCard; menambah pemakaian kedua berarti
 * menggandakan titik kegagalan tanpa manfaat — peta ini hanya butuh titik.
 */
export default function KabupatenMap({ data, dipilih, onPilih }: Props) {
  const t = useT();
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Handler terbaru disimpan di ref supaya marker tidak perlu dipasang ulang
  // hanya karena identitas fungsi berubah antar-render.
  const pilihRef = useRef(onPilih);
  useEffect(() => {
    pilihRef.current = onPilih;
  }, [onPilih]);

  const pasangPeta = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      return;
    }
    if (mapRef.current) return;

    const m = L.map(node, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    m.setView([2.62, 98.75], 8); // kawasan Danau Toba
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;

    // Container sering diukur sebelum layout selesai -> tile abu-abu.
    requestAnimationFrame(() => m.invalidateSize());
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !data.length) return;
    layer.clearLayers();

    const total = data.length;
    for (const k of data) {
      const warna = warnaPrioritas(k.peringkat_prioritas, total);
      // Jari-jari 10-26 px mengikuti skor prioritas, bukan luas wilayah.
      const r = 10 + k.skor_prioritas * 22;
      const aktif = k.kabupaten === dipilih;

      const titik = L.circleMarker([k.peta.lat, k.peta.lon], {
        radius: r,
        color: aktif ? PALET.forest : warna,
        weight: aktif ? 3 : 1.5,
        fillColor: warna,
        fillOpacity: k.peta.tanpa_data ? 0.25 : 0.55,
        // Garis putus-putus menandai posisi perkiraan, bukan centroid data.
        dashArray: k.peta.tanpa_data ? "4 4" : undefined,
      });

      titik.bindPopup(
        `<div style="min-width:170px">
           <strong style="font-size:13px">${k.kabupaten}</strong><br/>
           <span style="font-size:11px;color:#555">${t("Prioritas")} #${k.peringkat_prioritas} ${t("dari")} ${total}</span>
           <hr style="margin:6px 0;border:0;border-top:1px solid #eee"/>
           <span style="font-size:11px">
             ${k.bukti.n_destinasi} ${t("destinasi terdata")}<br/>
             ${k.bukti.n_umkm} ${t("UMKM terdata")}<br/>
             ${
               k.bukti.wisatawan_2024
                 ? `${k.bukti.wisatawan_2024.toLocaleString("id-ID")} ${t("wisatawan 2024")}${
                     k.bukti.wisatawan_diimputasi ? ` (${t("imputasi")})` : ""
                   }`
                 : t("Data wisatawan tidak tersedia")
             }
           </span>
           ${
             k.peta.tanpa_data
               ? `<br/><span style="font-size:10px;color:#b45309">${t("Posisi perkiraan — tidak ada destinasi terdata")}</span>`
               : ""
           }
         </div>`,
      );
      titik.on("click", () => pilihRef.current(k.kabupaten));
      titik.addTo(layer);
    }
  }, [data, dipilih, t]);

  return (
    <div>
      <div
        ref={pasangPeta}
        className="leafmap h-64 w-full overflow-hidden rounded-xl sm:h-72 lg:h-80"
        role="application"
        aria-label={t("Peta prioritas pengembangan per kabupaten")}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#be123c" }} />
          {t("Paling mendesak")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALET.amber }} />
          {t("Mendesak")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALET.sand }} />
          {t("Sedang")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALET.sage }} />
          {t("Terkelola")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-ink/40" />
          {t("Posisi perkiraan")}
        </span>
      </div>
    </div>
  );
}
