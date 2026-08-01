/** Konten yang dapat diubah tanpa menyentuh komponen: video, logo, galeri. */

/** Video hero. Berkas .mp4/.webm, YouTube, atau Vimeo; "" menyembunyikan section. */
export const VIDEO_URL: string =
  import.meta.env?.VITE_VIDEO_URL ?? "https://youtu.be/_IzOqfrLc0o";

/** Logo navbar. Kosong -> coba KANDIDAT_LOGO, lalu logo vektor bawaan. */
export const BRAND_LOGO_URL: string =
  import.meta.env?.VITE_BRAND_LOGO_URL ?? "";

/** Dicoba berurutan agar beda ekstensi (.jpg vs .jpeg) tidak menggagalkan logo. */
export const KANDIDAT_LOGO = [
  "/logo.jpg",
  "/logo.jpeg",
  "/logo.png",
  "/logo.webp",
  "/logo.svg",
];

/** Kicker kecil di atas judul section. */
export const VIDEO_KICKER = "Sekilas Danau Toba";

/** Judul section. Kata terakhir otomatis diberi gradien warna brand. */
export const VIDEO_JUDUL = "Lihat Sendiri Keindahannya";

/** Paragraf pendek di bawah judul. Kosongkan ("") bila tidak perlu. */
export const VIDEO_DESKRIPSI =
  "Kaldera vulkanik terbesar di dunia, danau sepanjang 100 kilometer, dan budaya Batak yang hidup di tepiannya.";

/** true = putar otomatis tanpa suara saat section terlihat. */
export const VIDEO_AUTOPLAY = false;

/* ── Pengenal link video ─────────────────────────────────────────────── */

export type JenisVideo = "file" | "gambar" | "youtube" | "vimeo" | "kosong";

export interface SumberVideo {
  jenis: JenisVideo;
  /** URL siap pakai: src untuk <video>, atau src iframe untuk penanaman. */
  src: string;
}

/** URL video -> bentuk siap tanam. Jenis "kosong" bila tidak dikenali. */
export function bacaSumberVideo(url: string, autoplay = false): SumberVideo {
  const u = (url || "").trim();
  if (!u) return { jenis: "kosong", src: "" };

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { jenis: "file", src: u };

  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (yt) {
    const id = yt[1];
    const p = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      ...(autoplay ? { autoplay: "1", mute: "1" } : {}),
    });
    return {
      jenis: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}?${p}`,
    };
  }

  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) {
    const p = new URLSearchParams(autoplay ? { autoplay: "1", muted: "1" } : {});
    return {
      jenis: "vimeo",
      src: `https://player.vimeo.com/video/${vm[1]}${p.toString() ? `?${p}` : ""}`,
    };
  }

  return { jenis: "kosong", src: "" };
}

/* ── Galeri ──────────────────────────────────────────────────────────── */

/** Satu kartu di galeri. */
export interface ItemGaleri {
  jenis: "gambar" | "video";
  /** Path di public/ atau URL penuh. */
  sumber: string;
  /** Sampul video; untuk YouTube diambil otomatis bila kosong. */
  sampul?: string;
  judul: string;
  keterangan?: string;
  /** Bagian akhir /galeri/<slug>; dibentuk dari judul bila kosong. */
  slug?: string;
}

/** Daftar kosong menyembunyikan section galeri. */
export const GALERI: ItemGaleri[] = [
  {
    jenis: "video",
    sumber: VIDEO_URL,
    judul: "Sekilas Danau Toba",
    keterangan: "Kaldera vulkanik terbesar di dunia dari udara",
    slug: "sekilas-danau-toba",
  },
  {
    jenis: "gambar",
    sumber: "https://cdn0-production-images-kly.akamaized.net/BSHUpTNvvNJ4qJpEGBODj_z1XKA=/1200x675/smart/filters:quality(75):strip_icc():format(jpeg)/kly-media-production/medias/1020657/original/077643200_1444871277-3.jpg",
    judul: "Pulau Samosir",
    keterangan: "Pulau seluas Singapura di tengah danau",
    slug: "pulau-samosir",
  },
  {
    jenis: "gambar",
    sumber: "https://asset.kompas.com/crops/ivzThQyONXaKZcMWTK0XDKuaqbY=/0x0:1075x538/1200x800/data/photo/2021/02/01/60178d1b24d79.jpg",
    judul: "Bukit Holbung",
    keterangan: "Punggung bukit hijau menghadap perairan",
    slug: "bukit-holbung",
  },
  {
    jenis: "gambar",
    sumber: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWkCaZg_5tBULUekUj3qk3vAWzM5-UDm8KnsiSkFtoi1exm53Re1FcAutWiRca6tEjsB7ESNy3_maVA2_qiNLpYllYvTJVYqh8xGASGsKWVvaS_OjADWsZHF367XMATJhfk4t0PX=s1360-w1360-h1020-rw",
    judul: "Air Terjun Sipiso-piso",
    keterangan: "Terjunan 120 meter di ujung utara kaldera",
    slug: "air-terjun-sipiso-piso",
  },
  {
    jenis: "gambar",
    sumber: "https://zjglidcehtsqqqhbdxyp.supabase.co/storage/v1/object/public/atourin/images/destination/samosir/desa-tomok-profile1637064124.png?x-image-process=image/resize,p_100,limit_1/imageslim",
    judul: "Desa Tomok",
    keterangan: "Rumah bolon dan makam batu raja Batak",
    slug: "desa-tomok",
  },
];

/** Slug URL kartu galeri; dibentuk dari judul bila `slug` kosong. */
export function slugGaleri(item: ItemGaleri): string {
  if (item.slug) return item.slug;
  return item.judul
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // buang tanda diakritik hasil NFD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cari item galeri berdasarkan slug URL-nya. null bila tidak ketemu. */
export function cariGaleriSlug(slug: string): ItemGaleri | null {
  return GALERI.find((it) => slugGaleri(it) === slug) ?? null;
}

/** Foto latar hero; default memakai foto Pulau Samosir dari galeri. */
export const HERO_FOTO: string =
  import.meta.env?.VITE_HERO_FOTO_URL ?? GALERI[1].sumber;

/** Kicker, judul, dan deskripsi section galeri. */
export const GALERI_KICKER = VIDEO_KICKER;
export const GALERI_JUDUL = VIDEO_JUDUL;
export const GALERI_DESKRIPSI = VIDEO_DESKRIPSI;

/** Sampul kartu galeri; "" bila tidak ada, kartu lalu memakai gradien polos. */
export function sampulItem(item: ItemGaleri): string {
  if (item.sampul) return item.sampul;
  if (item.jenis === "gambar") return item.sumber;

  const yt = item.sumber.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/maxresdefault.jpg` : "";
}

/* ── Media latar hero ────────────────────────────────────────────────── */

/** Foto atau video latar hero: path di public/, URL penuh, YouTube, atau Vimeo. */
export const HERO_MEDIA_URL: string =
  import.meta.env?.VITE_HERO_MEDIA_URL ??
  import.meta.env?.VITE_HERO_VIDEO_URL ??
  VIDEO_URL;

/** Alias lama. */
export const HERO_VIDEO_URL = HERO_MEDIA_URL;

/** Media latar hero: video diputar tanpa suara, berulang, tanpa kontrol. */
export function bacaVideoLatar(url: string): SumberVideo {
  const u = (url || "").trim();
  if (!u) return { jenis: "kosong", src: "" };

  if (/\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(u)) return { jenis: "gambar", src: u };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { jenis: "file", src: u };

  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (yt) {
    const id = yt[1];
    const p = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: id,   // wajib agar loop bekerja pada satu video
      controls: "0",
      showinfo: "0",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      disablekb: "1",
      iv_load_policy: "3",
    });
    return {
      jenis: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}?${p}`,
    };
  }

  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) {
    const p = new URLSearchParams({
      autoplay: "1",
      muted: "1",
      loop: "1",
      background: "1",
    });
    return { jenis: "vimeo", src: `https://player.vimeo.com/video/${vm[1]}?${p}` };
  }

  return { jenis: "kosong", src: "" };
}
