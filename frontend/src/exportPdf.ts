import { jsPDF } from "jspdf";
import type { Itinerary, DampakLokal } from "./types";
import { rp } from "./api";
import { hitungBiaya } from "./dampak";

// Palet senada UI. jsPDF hanya bisa warna solid, jadi gradient hero ditiru
// dengan beberapa pita tipis dari biru ke violet.
const BRAND_BLUE: [number, number, number] = [45, 105, 245];
const BRAND_VIOLET: [number, number, number] = [124, 58, 237];
const INK: [number, number, number] = [23, 32, 48];
const MUTED: [number, number, number] = [110, 122, 140];

const M = 20; // margin kiri/kanan
const PAGE_W = 210;
const PAGE_H = 297;
const BODY_W = PAGE_W - M * 2;

function line(doc: jsPDF, text: string, x: number, y: number, maxW = BODY_W) {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * 5.5;
}

/** Pita gradient palsu: 60 irisan tipis yang dilerp biru → violet. */
function gradientBand(doc: jsPDF, y: number, h: number) {
  const steps = 60;
  const w = PAGE_W / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(BRAND_BLUE[0] + (BRAND_VIOLET[0] - BRAND_BLUE[0]) * t),
      Math.round(BRAND_BLUE[1] + (BRAND_VIOLET[1] - BRAND_BLUE[1]) * t),
      Math.round(BRAND_BLUE[2] + (BRAND_VIOLET[2] - BRAND_BLUE[2]) * t),
    );
    // +0.4 agar irisan sedikit tumpang tindih, tidak meninggalkan garis putih
    doc.rect(i * w, y, w + 0.4, h, "F");
  }
}

/** Kop halaman pertama: pita brand + wordmark, semua digambar sebagai vektor. */
function header(doc: jsPDF): number {
  gradientBand(doc, 0, 34);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("TourCation AI", M, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Rencana Perjalanan Danau Toba", M, 24);

  doc.setFontSize(8.5);
  doc.text(`Diekspor ${new Date().toLocaleString("id-ID")}`, PAGE_W - M, 24, { align: "right" });

  doc.setTextColor(...INK);
  return 46;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(M, y - 3.6, 2.2, 5, "F"); // penanda vertikal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(text, M + 5, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 7;
}

/** Nomor halaman di setiap lembar, dipanggil sekali di akhir. */
function footers(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(224, 228, 236);
    doc.line(M, PAGE_H - 16, PAGE_W - M, PAGE_H - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("TourCation AI - Danau Toba AI Tourism", M, PAGE_H - 11);
    doc.text(`Halaman ${p} dari ${total}`, PAGE_W - M, PAGE_H - 11, { align: "right" });
  }
}

/**
 * @param dampak Dampak UMKM hasil pilihan turis. Bila tidak diberikan, dipakai
 *   angka bawaan dari server — yang hanya benar selama turis belum menukar
 *   satu pun tempat makan.
 */
/**
 * @param pick Pilihan rumah makan turis. WAJIB diteruskan bila ada, karena
 *   biaya di PDF harus sama dengan yang tampil di layar. Tanpa ini, PDF
 *   mencetak `summary.total_estimasi` mentah dari server dan setiap penukaran
 *   rumah makan membuat kedua angka berbeda tanpa penjelasan.
 */
export function exportItineraryPdf(
  itinerary: Itinerary,
  dampak?: DampakLokal,
  pick: Record<string, number> = {},
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = itinerary.summary;
  const b = hitungBiaya(itinerary, pick);
  let y = header(doc);

  // Halaman baru bila sisa ruang tidak cukup untuk blok berikutnya.
  const ensure = (need: number) => {
    if (y + need > PAGE_H - 22) {
      doc.addPage();
      y = 22;
    }
  };

  y = sectionTitle(doc, "Ringkasan", y);
  doc.setTextColor(...INK);
  y = line(doc, `${s.n_days} hari / ${s.n_nights} malam - ${s.n_orang} orang - Profil ${s.profil}`, M, y);
  y = line(doc, `Budget: ${rp(s.budget_total)} | Estimasi: ${rp(b.total)} (${b.persen}%)`, M, y);
  // Penyebut setiap angka disebut eksplisit. "Per hari" dan "per orang" memakai
  // penyebut yang BERBEDA (hari vs orang), jadi tanpa keterangan keduanya mudah
  // dibaca sebagai satu besaran yang sama — dan pada rombongan lebih dari satu
  // orang, angka per-orang selalu tampak bertentangan dengan angka per-hari.
  y = line(doc, `Sisa: ${rp(b.sisa)}`, M, y);
  y = line(
    doc,
    `Per hari (semua orang): ${rp(b.per_hari)} | Per orang (seluruh perjalanan): ` +
      `${rp(b.per_orang)} | Per orang per hari: ${rp(b.per_orang_per_hari)}`,
    M,
    y,
  );
  if (b.delta !== 0) {
    // Tanpa baris ini, PDF dan layar bisa menampilkan total berbeda tanpa
    // penjelasan apa pun bagi pembaca yang menerima berkasnya.
    y = line(
      doc,
      `Termasuk penukaran rumah makan: ${b.delta > 0 ? "+" : "-"}${rp(Math.abs(b.delta))} ` +
        `dari rekomendasi awal.`,
      M,
      y,
    );
  }
  y += 5;

  // Tanpa penginapan, yang dicetak adalah titik keberangkatan.
  ensure(26);
  if (itinerary.hotel) {
    y = sectionTitle(doc, "Penginapan", y);
    y = line(
      doc,
      `${itinerary.hotel.name} - Rating ${itinerary.hotel.rating ?? "-"} - ${rp(itinerary.hotel.price)}/malam`,
      M,
      y,
    );
    if (itinerary.hotel.address) y = line(doc, itinerary.hotel.address, M, y);
  } else {
    const a = itinerary.titik_acuan;
    y = sectionTitle(doc, "Titik Keberangkatan", y);
    y = line(
      doc,
      a
        ? `${a["place-name"]} (${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)})`
        : "Titik acuan tidak tersedia",
      M,
      y,
    );
    y = line(doc, "Tanpa penginapan - rute berangkat & kembali ke titik ini.", M, y);
  }
  y += 5;

  const dl = dampak ?? itinerary.dampak_lokal;
  if (dl?.status === "ok") {
    ensure(42);
    y = sectionTitle(doc, "Dampak UMKM Lokal", y);

    // Kartu berlatar lembut agar blok ini menonjol seperti di layar.
    const top = y - 5;
    doc.setFillColor(240, 246, 255);
    doc.setDrawColor(206, 222, 250);
    doc.roundedRect(M, top, BODY_W, 30, 2.5, 2.5, "FD");

    doc.setTextColor(...INK);
    let ty = top + 7;
    ty = line(
      doc,
      `Usaha lokal otentik: ${dl.umkm_lokal_otentik}/${dl.total_kunjungan_makan} (${dl.proporsi_umkm}%)`,
      M + 5,
      ty,
      BODY_W - 10,
    );
    ty = line(
      doc,
      `Ragam kuliner khas: ${dl.ragam_kuliner_khas} jenis - Usaha unik: ${dl.usaha_unik_dikunjungi}`,
      M + 5,
      ty,
      BODY_W - 10,
    );
    ty = line(
      doc,
      `Estimasi dana ke usaha lokal: ${rp(dl.estimasi_kasar_ke_usaha_lokal)}`,
      M + 5,
      ty,
      BODY_W - 10,
    );

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    line(
      doc,
      "Estimasi kasar dari harga x kunjungan, bukan dampak ekonomi terverifikasi.",
      M + 5,
      ty + 1,
      BODY_W - 10,
    );
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    y = top + 36;
  }

  for (const d of itinerary.days) {
    ensure(20);
    y = sectionTitle(doc, `Hari ${d.day}  (~${d.distance_km ?? 0} km)`, y);

    for (const a of d.agenda) {
      ensure(10);
      if (a.kind === "wisata") {
        y = line(
          doc,
          `${a.time}  WISATA  ${a.place.name} (${a.place.kategori}) - ${rp(a.place.price_group)}/grup`,
          M + 5,
          y,
          BODY_W - 5,
        );
      } else {
        const names = a.options.map((o) => o.name).join(", ");
        y = line(doc, `${a.time}  ${a.slot.toUpperCase()}  ${names}`, M + 5, y, BODY_W - 5);
      }
    }
    y += 4;
  }

  footers(doc);
  doc.save("tourcation-itinerary.pdf");
}
