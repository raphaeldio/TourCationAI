/**
 * Palet brand dalam hex, untuk tempat yang tidak bisa memakai kelas Tailwind
 * atau `hsl(var(--…))`: atribut SVG sebaris dan opsi pustaka seperti Leaflet.
 *
 * Sumber kebenaran tetap variabel CSS di index.css — ubah keduanya bersamaan.
 */
export const PALET = {
  sage: "#6d9773",      // perbukitan & pinus; isian utama
  sageInk: "#375d3c",   // aman memuat teks putih (kontras 7.52:1)
  amber: "#ffba00",     // sorotan saja, bukan warna dasar
  sand: "#bb8a52",      // tanah vulkanik & ulos
  forest: "#0c3b2e",    // air danau dalam; tinta & permukaan pekat
  paper: "#edefe9",     // kertas halaman
} as const;

/**
 * Urutan warna untuk seri kategorikal pada grafik (Recharts).
 *
 * Disusun agar dua warna bertetangga selalu berbeda terang-gelapnya, bukan
 * hanya berbeda rona — sehingga tetap terbedakan pada layar kecil, cetakan
 * hitam-putih, dan bagi pembaca dengan buta warna merah-hijau.
 *
 * Amber sengaja ditaruh di urutan ke-4, bukan lebih awal: ia warna SOROTAN.
 * Memakainya untuk seri pertama membuat semua grafik berteriak sekaligus.
 */
export const SERI_CHART = [
  "#375d3c", // sage-ink   — paling gelap, seri utama
  "#6d9773", // sage
  "#bb8a52", // sand
  "#ffba00", // amber
  "#0c3b2e", // forest
  "#9db8a1", // sage muda
  "#d8b98c", // sand muda
  "#5b7f61", // sage sedang
] as const;

/** Warna netral untuk kisi & sumbu grafik; sepadan dengan border-ink/10. */
export const KISI_CHART = "rgba(12, 59, 46, 0.10)";
export const TINTA_SUMBU = "rgba(12, 59, 46, 0.55)";
