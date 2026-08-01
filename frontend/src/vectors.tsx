import { useState } from "react";
import { BRAND_LOGO_URL, KANDIDAT_LOGO } from "./config";
import { PALET } from "./palette";
import { cn } from "./lib/utils";

interface Props {
  className?: string;
}

/**
 * Logo brand di navbar.
 *
 * Mencoba berkas di frontend/public/ berurutan (logo.jpg, logo.jpeg, logo.png,
 * logo.webp, logo.svg) sampai ada yang berhasil dimuat. Kalau tidak ada satu
 * pun — atau semuanya gagal — komponen jatuh balik ke logo vektor bawaan,
 * jadi navbar tidak pernah kosong.
 */
export function BrandLogo({ className }: Props) {
  // Daftar berkas yang akan dicoba berurutan. Bila VITE_BRAND_LOGO_URL diisi,
  // itu satu-satunya yang dicoba — pilihan eksplisit tidak boleh ditebak-tebak.
  const kandidat = BRAND_LOGO_URL ? [BRAND_LOGO_URL] : KANDIDAT_LOGO;
  const [indeks, setIndeks] = useState(0);

  if (indeks < kandidat.length) {
    return (
      <img
        src={kandidat[indeks]}
        alt="Logo TourCation AI"
        width={36}
        height={36}
        // Gagal muat -> coba ekstensi berikutnya; habis semua -> logo vektor.
        onError={() => setIndeks((i) => i + 1)}
        className={cn(
          "h-9 w-9 rounded-xl object-cover shadow-md shadow-brand-forest/25 ring-1 ring-white/50",
          className,
        )}
      />
    );
  }

  return (
    <svg className={cn("h-9 w-9", className)} viewBox="0 0 32 32" role="img" aria-label="TourCation AI">
      <defs>
        <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PALET.sage} />
          <stop offset="100%" stopColor={PALET.forest} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#brand-grad)" />
      <path d="M6 24 L14 12 L18 18 L22 10 L26 24 Z" fill="#061a14" opacity="0.85" />
      <path d="M4 26 Q16 22 28 26 L28 30 L4 30 Z" fill="#061a14" opacity="0.5" />
      <circle cx="24" cy="8" r="3" fill={PALET.amber} />
    </svg>
  );
}

/** Ikon UMKM / toko lokal */
export function UmkmVector({ className }: Props) {
  return (
    <svg className={cn("h-10 w-10", className)} viewBox="0 0 40 40" role="img" aria-label="UMKM">
      <defs>
        <linearGradient id="umkm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PALET.sage} />
          <stop offset="100%" stopColor={PALET.amber} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#umkm-grad)" opacity="0.2" />
      <path d="M8 28 V18 L20 10 L32 18 V28 H8 Z" fill="none" stroke={PALET.sage} strokeWidth="1.5" />
      <rect x="14" y="22" width="12" height="6" rx="1" fill={PALET.amber} opacity="0.6" />
      <path d="M16 18 H24" stroke={PALET.amber} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface ThumbProps {
  kind: string;
}

/** Tile ikon vektor 84×64 dengan gradien per kategori. */
export function VectorThumb({ kind }: ThumbProps) {
  const art = pickArt(kind);
  return (
    <svg className="vthumb shrink-0" viewBox="0 0 84 64" role="img" aria-label={kind}>
      <defs>
        <linearGradient id={`vg-${art.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.from} />
          <stop offset="100%" stopColor={art.to} />
        </linearGradient>
        <clipPath id={`clip-${art.id}`}>
          <rect width="84" height="64" rx="12" />
        </clipPath>
      </defs>
      <rect width="84" height="64" rx="12" fill={`url(#vg-${art.id})`} />
      {/* Motif dipotong sudut membulatnya supaya tidak menonjol keluar tile */}
      <g clipPath={`url(#clip-${art.id})`}>{art.svg}</g>
      {/* Kilau tipis di bagian atas + garis dalam: bikin tile terasa timbul */}
      <path d="M0 12 Q0 0 12 0 L72 0 Q84 0 84 12 L84 26 Q42 40 0 26 Z" fill="#ffffff" opacity="0.16" />
      <rect
        x="0.75"
        y="0.75"
        width="82.5"
        height="62.5"
        rx="11.25"
        fill="none"
        stroke={PALET.forest}
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function pickArt(kind: string) {
  switch (kind) {
    case "Alam":
      return {
        id: "alam",
        from: "#a8ceac",
        to: PALET.sage,
        svg: (
          <g>
            <circle cx="65" cy="15" r="8" fill={PALET.amber} />
            <circle cx="65" cy="15" r="12" fill={PALET.amber} opacity="0.28" />
            <path d="M0 52 L22 24 L36 42 L48 27 L70 52 Z" fill={PALET.forest} />
            <path d="M22 24 L29 33 L22 34 L16 31 Z" fill="#ffffff" opacity="0.92" />
            <path d="M48 27 L53 34 L48 35 L44 33 Z" fill="#ffffff" opacity="0.8" />
            <path d="M0 50 Q42 42 84 50 L84 64 L0 64 Z" fill="#124a3a" />
            <path d="M0 55 Q42 48 84 55 L84 64 L0 64 Z" fill={PALET.forest} opacity="0.7" />
          </g>
        ),
      };
    case "Budaya":
      return {
        id: "budaya",
        from: "#f0d9b6",
        to: PALET.sand,
        svg: (
          <g>
            <circle cx="66" cy="14" r="9" fill={PALET.amber} opacity="0.55" />
            {/* Atap rumah bolon: melengkung tinggi di kedua ujungnya */}
            <path d="M10 32 Q42 2 74 32 L64 32 Q42 14 20 32 Z" fill={PALET.forest} />
            <path d="M18 32 Q42 16 66 32 Z" fill={PALET.sage} opacity="0.55" />
            <rect x="24" y="32" width="36" height="18" rx="1.5" fill="#7a5730" />
            <rect x="24" y="32" width="36" height="4" fill={PALET.amber} opacity="0.85" />
            <rect x="38" y="39" width="9" height="11" rx="1" fill="#3b2312" />
            <path d="M20 50 L64 50 L60 57 L24 57 Z" fill={PALET.forest} />
          </g>
        ),
      };
    case "Rohani":
      return {
        id: "rohani",
        from: "#cfe4d6",
        to: PALET.sage,
        svg: (
          <g>
            <circle cx="42" cy="26" r="17" fill="#ffffff" opacity="0.4" />
            <rect x="39" y="10" width="6" height="30" rx="3" fill="#ffffff" />
            <rect x="29" y="19" width="26" height="6" rx="3" fill="#ffffff" />
            <circle cx="66" cy="14" r="6" fill={PALET.amber} />
            <path d="M0 48 Q42 38 84 48 L84 64 L0 64 Z" fill={PALET.forest} />
          </g>
        ),
      };
    case "Rekreasi":
      return {
        id: "rekreasi",
        from: "#ffd978",
        to: PALET.amber,
        svg: (
          <g>
            <circle cx="42" cy="30" r="21" fill="#ffffff" opacity="0.35" />
            <g stroke={PALET.forest} strokeWidth="2.4" fill="none" strokeLinecap="round">
              <circle cx="42" cy="30" r="15" />
              <path d="M42 15 V45 M27 30 H57 M31.5 19.5 L52.5 40.5 M52.5 19.5 L31.5 40.5" />
            </g>
            <circle cx="42" cy="30" r="4.5" fill={PALET.forest} />
            <circle cx="42" cy="30" r="1.8" fill={PALET.amber} />
          </g>
        ),
      };
    case "makan":
      return {
        id: "makan",
        from: "#f7dfbe",
        to: "#c96a3b",
        svg: (
          <g>
            {/* Uap mengepul */}
            <path
              d="M34 16 Q37 21 34 26 M42 12 Q45 19 42 26 M50 16 Q53 21 50 26"
              stroke="#ffffff"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path d="M18 32 Q42 28 66 32 Q63 51 42 54 Q21 51 18 32 Z" fill="#ffffff" />
            <path d="M25 36 Q42 33 59 36 Q56 47 42 49 Q28 47 25 36 Z" fill="#c96a3b" />
            <ellipse cx="42" cy="38" rx="7" ry="3" fill={PALET.amber} />
            <rect x="12" y="30" width="60" height="3.5" rx="1.75" fill={PALET.forest} opacity="0.85" />
          </g>
        ),
      };
    case "hotel":
      return {
        id: "hotel",
        from: "#bcd8c4",
        to: PALET.sage,
        svg: (
          <g>
            <circle cx="68" cy="14" r="7" fill={PALET.amber} opacity="0.9" />
            {/* Menara samping bikin siluetnya tidak sekadar kotak */}
            <rect x="14" y="26" width="16" height="30" rx="2" fill="#124a3a" />
            <rect x="30" y="10" width="34" height="46" rx="3" fill={PALET.forest} />
            <path d="M30 10 L47 3 L64 10 Z" fill={PALET.sand} />
            {[16, 24, 32, 40].map((y) =>
              [35, 44, 53].map((x) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx="1" fill={PALET.amber} />
              )),
            )}
            {[31, 39, 47].map((y) => (
              <rect key={y} x={19} y={y} width="6" height="4" rx="1" fill={PALET.amber} opacity="0.65" />
            ))}
            <rect x="42" y="48" width="10" height="8" rx="1" fill={PALET.sand} />
          </g>
        ),
      };
    case "travel":
    default:
      return {
        id: "travel",
        from: "#c7e0d0",
        to: PALET.sage,
        svg: (
          <g>
            <circle cx="66" cy="13" r="7" fill={PALET.amber} />
            {/* Perahu di danau — lebih khas Toba dari sekadar ikon transport */}
            <path d="M42 10 L42 32" stroke={PALET.forest} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M44 12 L58 27 L44 30 Z" fill="#ffffff" opacity="0.95" />
            <path d="M40 14 L28 28 L40 30 Z" fill="#ffffff" opacity="0.7" />
            <path d="M20 34 L64 34 L56 45 L28 45 Z" fill={PALET.forest} />
            <g stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.75">
              <path d="M8 51 Q17 46 26 51 T44 51 T62 51 T80 51" />
              <path d="M14 59 Q23 55 32 59 T50 59 T68 59" />
            </g>
          </g>
        ),
      };
  }
}

/** Ilustrasi kosong: kompas AI */
export function EmptyArt() {
  return (
    <svg viewBox="0 0 160 160" width="130" height="130" role="img" aria-label="Mulai merencanakan">
      <defs>
        <linearGradient id="ea-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PALET.sage} />
          <stop offset="100%" stopColor={PALET.amber} />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="62" fill="none" stroke="url(#ea-ring)" strokeWidth="3" opacity="0.9" />
      <circle cx="80" cy="80" r="50" fill="none" stroke="#234034" strokeWidth="1.5" />
      <path d="M80 34 L86 74 L126 80 L86 86 L80 126 L74 86 L34 80 L74 74 Z" fill={PALET.sage} opacity="0.25" />
      <path d="M96 64 L84 84 L64 96 L76 76 Z" fill="url(#ea-ring)" />
      <circle cx="80" cy="80" r="5" fill="#061a14" stroke={PALET.amber} strokeWidth="2" />
    </svg>
  );
}

/**
 * Latar hero vektor Danau Toba — pengganti foto, agar seluruh UI tetap vektor.
 * Berlapis: langit, punggung bukit jauh/dekat, danau, pantulan, dan kabut.
 */
export function HeroVector({ className }: Props) {
  return (
    <svg
      className={cn("pointer-events-none h-full w-full", className)}
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d2a20" />
          <stop offset="55%" stopColor="#08211a" />
          <stop offset="100%" stopColor="#061a14" />
        </linearGradient>
        <linearGradient id="hero-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#124a3a" />
          <stop offset="100%" stopColor="#061a14" />
        </linearGradient>
        <linearGradient id="hero-ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4a3a" />
          <stop offset="100%" stopColor="#0e2b21" />
        </linearGradient>
        <linearGradient id="hero-ridge-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#155040" />
          <stop offset="100%" stopColor="#08211a" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="50%" cy="8%" r="62%">
          <stop offset="0%" stopColor={PALET.sage} stopOpacity="0.45" />
          <stop offset="100%" stopColor={PALET.sage} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="600" fill="url(#hero-sky)" />
      <rect width="1200" height="600" fill="url(#hero-glow)" />

      {/* Bintang tipis di langit */}
      <g fill="#e8f0e9" opacity="0.5">
        {[
          [120, 70], [260, 44], [410, 96], [560, 58], [700, 88],
          [880, 50], [1010, 92], [1130, 62], [330, 130], [960, 140],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.7 : 1.1} />
        ))}
      </g>

      {/* Punggung bukit jauh */}
      <path
        d="M0 300 L150 218 L270 268 L400 196 L540 262 L680 212 L820 274 L960 220 L1090 268 L1200 226 L1200 340 L0 340 Z"
        fill="url(#hero-ridge-far)"
        opacity="0.85"
      />
      {/* Punggung bukit dekat */}
      <path
        d="M0 344 L170 282 L320 330 L470 274 L620 328 L760 288 L920 336 L1060 296 L1200 338 L1200 400 L0 400 Z"
        fill="url(#hero-ridge-near)"
      />

      {/* Danau */}
      <path d="M0 384 Q300 366 600 380 T1200 372 L1200 600 L0 600 Z" fill="url(#hero-lake)" />

      {/* Pantulan cahaya di permukaan air */}
      <g stroke={PALET.amber} strokeLinecap="round" opacity="0.2">
        <path d="M240 430 H420" strokeWidth="2" />
        <path d="M300 466 H520" strokeWidth="1.6" />
        <path d="M180 502 H360" strokeWidth="1.4" />
        <path d="M700 442 H900" strokeWidth="2" />
        <path d="M760 484 H980" strokeWidth="1.5" />
        <path d="M840 524 H1030" strokeWidth="1.3" />
      </g>

      {/* Pulau Samosir sebagai siluet */}
      <path d="M470 392 Q560 372 660 390 Q600 404 470 392 Z" fill="#0b2a22" opacity="0.9" />

      {/* Kabut tipis di kaki bukit */}
      <path d="M0 378 Q300 358 600 376 T1200 366 L1200 392 L0 392 Z" fill={PALET.sand} opacity="0.09" />
    </svg>
  );
}

/** Ikon minat wisata sebagai vektor (ganti emoji dari backend) */
export function MinatIcon({ kind }: { kind: string }) {
  const icons: Record<string, JSX.Element> = {
    Alam: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M2 14 L6 6 L8 10 L10 5 L14 14 Z" />
      </svg>
    ),
    Budaya: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M3 12 L8 3 L13 12 H3 Z" />
      </svg>
    ),
    Rohani: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
        <rect x="7" y="2" width="2" height="12" />
        <rect x="3" y="6" width="10" height="2" />
      </svg>
    ),
    Rekreasi: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="5" />
        <path d="M8 3 V13 M3 8 H13" />
      </svg>
    ),
  };
  return icons[kind] ?? icons.Alam;
}
