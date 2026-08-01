/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* <alpha-value> agar modifier opacity (mis. bg-brand-sage/25) bekerja */
        brand: {
          sage: {
            /* Sama seperti amber: DEFAULT untuk isian, .ink untuk teks —
               #6D9773 di kertas putih hanya ~2.6:1. */
            DEFAULT: "hsl(var(--brand-sage) / <alpha-value>)",
            ink: "hsl(var(--brand-sage-ink) / <alpha-value>)",
          },
          amber: {
            /* DEFAULT untuk isian; .ink untuk teks — #FFBA00 di kertas terang
               hanya ~1.9:1, jadi tidak layak dipakai sebagai warna teks. */
            DEFAULT: "hsl(var(--brand-amber) / <alpha-value>)",
            ink: "hsl(var(--brand-amber-ink) / <alpha-value>)",
          },
          sand: {
            DEFAULT: "hsl(var(--brand-sand) / <alpha-value>)",
            ink: "hsl(var(--brand-sand-ink) / <alpha-value>)",
          },
          forest: "hsl(var(--brand-forest) / <alpha-value>)",
        },
        /* Pasangan teks untuk tiap isian brand — pakai text-on-amber di atas
           bg-brand-amber, dst. Menebak sendiri warna teksnya adalah cara
           paling gampang menjatuhkan kontras di bawah 4.5:1. */
        on: {
          sage: "hsl(var(--on-sage) / <alpha-value>)",
          "sage-ink": "hsl(var(--on-sage-ink) / <alpha-value>)",
          amber: "hsl(var(--on-amber) / <alpha-value>)",
          sand: "hsl(var(--on-sand) / <alpha-value>)",
          "sand-ink": "hsl(var(--on-sand-ink) / <alpha-value>)",
          forest: "hsl(var(--on-forest) / <alpha-value>)",
        },
        surface: {
          paper: "hsl(var(--surface-paper) / <alpha-value>)",
          1: "hsl(var(--surface-1) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
        },
        /* Tinta teks berjenjang: ink (judul) → soft (isi) → faint (label) */
        ink: {
          DEFAULT: "hsl(var(--ink) / <alpha-value>)",
          soft: "hsl(var(--ink-soft) / <alpha-value>)",
          faint: "hsl(var(--ink-faint) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          to: { backgroundPosition: "-200% 0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(109, 151, 115, 0.35)" },
          "50%": { boxShadow: "0 0 22px rgba(109, 151, 115, 0.7)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        aurora: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(26px)" },
          to: { opacity: "1", transform: "none" },
        },
        "scroll-hint": {
          "0%": { transform: "scaleY(0)", transformOrigin: "top", opacity: "0" },
          "45%": { transform: "scaleY(1)", transformOrigin: "top", opacity: "1" },
          "55%": { transform: "scaleY(1)", transformOrigin: "bottom", opacity: "1" },
          "100%": { transform: "scaleY(0)", transformOrigin: "bottom", opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "70%, 100%": { transform: "scale(1.45)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
        glow: "glow 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        aurora: "aurora 14s ease-in-out infinite",
        rise: "rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scroll-hint": "scroll-hint 2.2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
