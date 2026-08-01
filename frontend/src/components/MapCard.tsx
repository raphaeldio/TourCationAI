import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map, Search, LocateFixed, X, Plus, Check, Navigation, ExternalLink } from "lucide-react";
import type { AgendaWisata, Itinerary, NearbyPlace } from "../types";
import { rp } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import { PALET } from "../palette";

// Ongkos BBM per km, asumsi ~1 L/10 km x Rp10.000/L.
const BBM_PER_KM_CADANGAN = 850;
const OSRM = "https://router.project-osrm.org";

interface Props {
  itinerary: Itinerary | null;
}

interface Dep {
  lat: number;
  lon: number;
  name: string;
}

function pinIcon(label: string, cls = ""): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="lpin ${cls}">${label}</div>`,
  });
}

/** Tautan Google Maps untuk satu titik (dipakai di popup marker). */
function gmapsPoint(lat: number, lon: number, name?: string): string {
  const q = name ? `${name} @${lat},${lon}` : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function MapCard({ itinerary }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fetchSeq = useRef(0);
  // Penanda peta sudah terpasang, agar penggambar rute jalan ulang.
  const [mapReady, setMapReady] = useState(false);

  const [dayIdx, setDayIdx] = useState(0);
  const [dep, setDep] = useState<Dep | null>(null); // null = berangkat dari hotel
  const [extra, setExtra] = useState<NearbyPlace[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [routeKm, setRouteKm] = useState<number | null>(null);

  const day =
    itinerary && itinerary.days.length
      ? itinerary.days[Math.min(dayIdx, itinerary.days.length - 1)]
      : null;

  /** Titik-titik rute hari ini: berangkat -> wisata terurut -> singgahan. */
  const routePoints = useMemo<Array<[number, number]>>(() => {
    if (!itinerary || !day) return [];
    // Pangkal rute = titik acuan engine, kecuali ditimpa pengguna di peta.
    const acuan = itinerary.titik_acuan;
    const start: [number, number] = dep
      ? [dep.lat, dep.lon]
      : [
          acuan?.latitude ?? itinerary.hotel?.lat ?? 2.65,
          acuan?.longitude ?? itinerary.hotel?.lon ?? 98.85,
        ];
    const stops = day.agenda
      .filter((a) => a.kind === "wisata" && a.place.lat != null && a.place.lon != null)
      .map((a) => [(a as AgendaWisata).place.lat, (a as AgendaWisata).place.lon] as [number, number]);
    return [start, ...stops, ...extra.map((e) => [e.lat, e.lon] as [number, number])];
  }, [itinerary, day, dep, extra]);

  /** Deep link Google Maps (tanpa API key), dihitung terpisah dari peta. */
  const driveUrl = useMemo(() => {
    if (routePoints.length < 2) return null;
    const [oLat, oLon] = routePoints[0];
    const [dLat, dLon] = routePoints[routePoints.length - 1];
    // Google Maps membatasi 9 waypoint di antara asal & tujuan.
    const way = routePoints
      .slice(1, -1)
      .slice(0, 9)
      .map((p) => `${p[0]},${p[1]}`)
      .join("|");
    const u = new URL("https://www.google.com/maps/dir/");
    u.searchParams.set("api", "1");
    u.searchParams.set("travelmode", "driving");
    u.searchParams.set("origin", `${oLat},${oLon}`);
    u.searchParams.set("destination", `${dLat},${dLon}`);
    if (way) u.searchParams.set("waypoints", way);
    return u.toString();
  }, [routePoints]);

  // Itinerary baru -> kembali ke Hari 1, titik berangkat hotel, tanpa singgahan.
  useEffect(() => {
    setDayIdx(0);
    setDep(null);
    setExtra([]);
    setMsg(null);
  }, [itinerary]);
  useEffect(() => setExtra([]), [dayIdx]);

  /**
   * Callback ref, bukan useEffect([]): container baru dirender setelah itinerary
   * ada, sehingga efek dengan deps kosong akan melewatkannya.
   */
  const attachMap = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setMapReady(false);
      return;
    }
    if (mapRef.current) return;

    const m = L.map(node, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    m.setView([2.65, 98.85], 9); // Danau Toba
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;

    // Container baru sering diukur sebelum layout selesai -> tile abu-abu.
    requestAnimationFrame(() => m.invalidateSize());
    setMapReady(true);
  }, []);

  // Gambar ulang marker + rute setiap hari/berangkat/singgahan berubah.
  useEffect(() => {
    const m = mapRef.current;
    const layer = layerRef.current;
    if (!m || !layer) return;
    layer.clearLayers();
    if (!itinerary || !day) return;

    const acuan = itinerary.titik_acuan;
    const start: Dep = dep ?? {
      lat: acuan?.latitude ?? itinerary.hotel?.lat ?? 2.65,
      lon: acuan?.longitude ?? itinerary.hotel?.lon ?? 98.85,
      name: acuan?.["place-name"] ?? itinerary.hotel?.name ?? "Titik acuan",
    };
    const stops = day.agenda
      .filter((a) => a.kind === "wisata" && a.place.lat != null && a.place.lon != null)
      .map((a) => (a.kind === "wisata" ? a.place : null)!)

    const pts = routePoints;

    // Setiap popup punya tautan langsung ke Google Maps untuk titik itu.
    const popup = (name: string, lat: number, lon: number, sub?: string) =>
      `<b>${name}</b>${sub ? `<br>${sub}` : ""}` +
      `<br><a href="${gmapsPoint(lat, lon, name)}" target="_blank" rel="noopener noreferrer">` +
      `Buka di Google Maps</a>`;

    L.marker([start.lat, start.lon], { icon: pinIcon("S", "dep") })
      .bindPopup(popup(start.name, start.lat, start.lon, "Titik berangkat"))
      .addTo(layer);
    stops.forEach((s, i) =>
      L.marker([s.lat as number, s.lon as number], { icon: pinIcon(String(i + 1)) })
        .bindPopup(
          popup(s.name, s.lat as number, s.lon as number, `Perhentian ${i + 1}`),
        )
        .addTo(layer),
    );
    extra.forEach((e) =>
      L.marker([e.lat, e.lon], { icon: pinIcon("+", "extra") })
        .bindPopup(popup(e.name, e.lat, e.lon, "Singgahan tambahan"))
        .addTo(layer),
    );

    const draw = (latlngs: Array<[number, number]>, km: number) => {
      L.polyline(latlngs, {
        color: PALET.sage,
        weight: 4,
        opacity: 0.9,
        className: "route-anim",
      }).addTo(layer);
      setRouteKm(Math.round(km * 10) / 10);
      m.fitBounds(L.latLngBounds(pts).pad(0.2));
    };

    const straight = () => {
      let km = 0;
      for (let i = 1; i < pts.length; i++) {
        km += haversine(pts[i - 1], pts[i]);
      }
      draw(pts, km);
    };

    if (pts.length < 2) return;
    // Rute jalan asli via OSRM publik; kalau gagal jatuh ke garis lurus.
    const seq = ++fetchSeq.current;
    const coords = pts.map((p) => `${p[1]},${p[0]}`).join(";");
    fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((j) => {
        if (seq !== fetchSeq.current) return; // hasil basi, hari sudah berganti
        const rt = j.routes?.[0];
        if (!rt) return straight();
        draw(
          rt.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
          rt.distance / 1000,
        );
      })
      .catch(() => {
        if (seq === fetchSeq.current) straight();
      });
    // mapReady jadi dependency agar efek jalan ulang setelah peta terpasang.
  }, [itinerary, day, dep, extra, routePoints, mapReady]);

  if (!itinerary || !day) {
    return (
      <Card id="peta" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Map className="h-4 w-4 text-brand-sand-ink" />
            Peta Rute
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mutetext">Peta rute muncul setelah rencana disusun.</p>
        </CardContent>
      </Card>
    );
  }

  const wisataCost = day.agenda.reduce(
    (acc, a) => acc + (a.kind === "wisata" ? a.place.price_group : 0),
    0,
  );
  const km = routeKm ?? day.distance_km ?? 0;
  const tarifKm = itinerary.transport?.tarif_per_km ?? BBM_PER_KM_CADANGAN;
  const bbm = Math.round(km * tarifKm);

  const geocode = async () => {
    if (!q.trim()) {
      setMsg({ t: "Ketik nama lokasi dulu.", err: true });
      return;
    }
    setMsg({ t: "Mencari lokasi…" });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(q)}`,
      );
      const arr = await res.json();
      if (!arr.length) {
        setMsg({ t: "Lokasi tidak ditemukan di Indonesia.", err: true });
        return;
      }
      const nama = String(arr[0].display_name).split(",")[0];
      setDep({ lat: Number(arr[0].lat), lon: Number(arr[0].lon), name: nama });
      setMsg({ t: `Titik berangkat: ${nama}` });
    } catch {
      setMsg({ t: "Gagal mencari lokasi (butuh internet).", err: true });
    }
  };

  const myLocation = () => {
    if (!navigator.geolocation) {
      setMsg({ t: "Browser tidak mendukung geolokasi.", err: true });
      return;
    }
    setMsg({ t: "Meminta izin lokasi…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDep({ lat: p.coords.latitude, lon: p.coords.longitude, name: "Lokasi Saya" });
        setMsg({ t: "Titik berangkat: Lokasi Saya" });
      },
      (e) => {
        const t =
          e.code === 1
            ? "Izin lokasi ditolak — aktifkan izin lokasi di browser."
            : e.code === 3
              ? "Permintaan lokasi kehabisan waktu."
              : "Lokasi tidak tersedia saat ini.";
        setMsg({ t, err: true });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <Card id="peta" className="mapwrap scroll-mt-24 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="h-4 w-4 text-brand-sand-ink" />
          Peta Rute
          <span className="phsub">
            ~{km} km · BBM ~{rp(bbm)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {itinerary.days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              i === dayIdx
                ? "border-transparent bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink"
                : "border-ink/10 bg-ink/[0.04] text-ink-soft hover:text-ink",
            )}
            onClick={() => setDayIdx(i)}
          >
            Hari {d.day}
          </button>
        ))}
      </div>

      <div ref={attachMap} className="leafmap" />

      <div className="depbar">
        <Input
          placeholder="Lokasi berangkat… (default: hotel)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && geocode()}
          className="flex-1"
        />
        <button type="button" className="sqbtn grid place-items-center" onClick={geocode} title="Cari lokasi">
          <Search className="h-4 w-4" />
        </button>
        <button type="button" className="sqbtn grid place-items-center" onClick={myLocation} title="Gunakan lokasiku">
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>
      {msg && <div className={"geo-msg" + (msg.err ? " err" : "")}>{msg.t}</div>}
      {dep && (
        <button type="button" className="qchip mt-1.5 inline-flex items-center gap-1" onClick={() => setDep(null)}>
          <X className="h-3 w-3" /> Kembali berangkat dari hotel
        </button>
      )}

      {day.penyeberangan.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3">
          <div className="text-[0.74rem] font-extrabold tracking-wide text-amber-700">
            Perlu menyeberang
          </div>
          {day.penyeberangan.map((p, i) => (
            <p key={i} className="mt-1 text-[0.72rem] leading-relaxed text-ink-soft">
              {p.dari} → {p.ke}
              {p.keterangan ? <span className="block text-ink-faint">{p.keterangan}</span> : null}
            </p>
          ))}
        </div>
      )}

      {day.nearby.length > 0 && (
        <div className="nearwrap">
          <div className="neartitle">Destinasi Terdekat</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {day.nearby.map((n) => {
              const added = extra.some((e) => e.name === n.name);
              return (
                <button
                  key={n.name}
                  type="button"
                  className={"qchip inline-flex items-center gap-1" + (added ? " onq" : "")}
                  onClick={() =>
                    setExtra((x) =>
                      added ? x.filter((e) => e.name !== n.name) : [...x, n],
                    )
                  }
                >
                  {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {n.name} ({n.km} km)
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="daybudget">
        <div className="row">
          <span>Total Biaya Wisata</span>
          <b>{rp(wisataCost)}</b>
        </div>
        <div className="row">
          <span>Total Biaya BBM (~{km} km)</span>
          <b>{rp(bbm)}</b>
        </div>
        <div className="row total">
          <span>Total Hari {day.day}</span>
          <b>{rp(wisataCost + bbm)}</b>
        </div>
      </div>

      {driveUrl ? (
        <a
          className="btn-plan mt-3 no-underline"
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Navigation className="h-4 w-4" />
          Buka rute Hari {day.day} di Google Maps
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      ) : (
        <p className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2.5 text-center text-xs text-ink-faint">
          Rute Google Maps butuh minimal dua titik berkoordinat.
        </p>
      )}
      </CardContent>
    </Card>
  );
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
