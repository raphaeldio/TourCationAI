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
