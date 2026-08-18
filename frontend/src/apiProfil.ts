/** Klien untuk biodata pengguna. */

import { kepalaAuth, type Biodata, type JenisKelamin } from "./auth";

export interface BiodataBaru {
  nama_lengkap: string;
  avatar_url?: string | null;
  telepon?: string | null;
  kota_asal?: string | null;
  negara?: string | null;
  bahasa_utama?: string | null;
  /** "YYYY-MM-DD" */
  tanggal_lahir?: string | null;
  jenis_kelamin?: JenisKelamin | null;
}

/**
 * PATCH, bukan PUT: yang dikirim adalah biodata utuh dari formulir, tetapi
 * `profiles` juga memuat kolom lain (peran, kabupaten) yang endpoint ini tidak
 * pernah menyentuh. PUT akan menyiratkan penggantian seluruh baris.
 */
export async function simpanBiodata(
  isi: BiodataBaru,
): Promise<{ biodata: Biodata; biodata_lengkap: boolean }> {
  const r = await fetch("/api/auth/biodata", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
    body: JSON.stringify(isi),
  });
  if (!r.ok) {
    let pesan = r.statusText;
    try {
      const body = await r.json();
      if (typeof body?.detail === "string") pesan = body.detail;
      else if (body?.detail?.pesan) pesan = body.detail.pesan;
    } catch {
      /* body bukan JSON */
    }
    if (r.status === 401) pesan = "Sesi Anda berakhir. Silakan masuk kembali.";
    throw new Error(pesan);
  }
  return r.json();
}
