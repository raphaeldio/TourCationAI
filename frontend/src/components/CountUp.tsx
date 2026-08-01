import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { cn } from "../lib/utils";

interface Props {
  /** Nilai akhir yang dihitung naik dari 0. */
  value: number;
  /** Pembungkus hasil, mis. `rp` untuk format rupiah. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Angka yang menghitung naik saat pertama kali masuk viewport.
 * Menghormati prefers-reduced-motion dengan langsung menampilkan nilai akhir.
 */
export default function CountUp({ value, format, durationMs = 900, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);
  // Titik awal animasi: 0 saat pertama muncul, lalu nilai lama saat berubah
  // (mis. biaya yang bergeser karena pengguna mengganti pilihan makan).
  const fromRef = useRef(0);

  useEffect(() => {
    if (!inView) return;

    const from = fromRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === value) {
      setN(value);
      fromRef.current = value;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // easeOutCubic — cepat di awal, melandai di akhir
      const e = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (value - from) * e));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [inView, value, durationMs]);

  return (
    // `num` = angka berlebar tetap (tabular-nums). Nilai di sini berubah tiap
    // frame; dengan angka proporsional lebar tiap digit berbeda, sehingga
    // barisnya bergoyang sepanjang animasi. Dipasang di sini, bukan di tiap
    // pemanggil, supaya semua penghitung ikut terkunci.
    <span ref={ref} className={cn("num", className)}>
      {format ? format(n) : n.toLocaleString("id-ID")}
    </span>
  );
}
