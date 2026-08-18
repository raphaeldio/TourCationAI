import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Urutan dalam satu kelompok; menghasilkan jeda bertingkat 60 ms. */
  index?: number;
  className?: string;
}

/**
 * Munculnya elemen saat masuk viewport — sekali, halus, dan tidak berulang.
 *
 * Menggantikan komponen AnimatedContent/FadeContent dari ReactBits yang
 * menarik gsap + ScrollTrigger (~70 KB gz) hanya untuk efek fade sederhana.
 * framer-motion sudah ada di proyek ini, jadi efek yang sama gratis.
 *
 * Gerak dibatasi 14 px dan durasi 380 ms; saat pengguna meminta pengurangan
 * gerak, elemen langsung tampil tanpa animasi sama sekali.
 */
export default function Reveal({ children, index = 0, className }: Props) {
  const kurangiGerak = useReducedMotion();

  if (kurangiGerak) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.38,
        delay: Math.min(index, 7) * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
