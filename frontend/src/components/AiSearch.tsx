import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Search, Sparkles, X } from "lucide-react";
import type { Itinerary } from "../types";
import { askAI } from "../api";
import { cn } from "../lib/utils";
import { useT } from "../i18n";

interface Props {
  itinerary: Itinerary | null;
  /** Pertanyaan yang dikirim dari luar (mis. kartu analisis). */
  seed: string | null;
  onSeedConsumed: () => void;
  /** Tempat makan pilihan turis per slot — dipakai AI menghitung biaya makan. */
  pick: Record<string, number>;
}

const SUGGEST_UMUM = [
  "Kapan musim terbaik ke Danau Toba?",
  "Bagaimana cara ke Pulau Samosir?",
  "Apa itu Naniura?",
];
const SUGGEST_RENCANA = [
  "Wisata paling murah di rencana ini?",
  "Total biaya makan hari 1?",
  "Tempat mana yang buka paling pagi?",
];

/**
 * Kotak pencarian AI di hero — menggantikan bubble chat mengambang.
 * Jawaban muncul langsung di bawah kotak, bukan di panel terpisah.
 */
export default function AiSearch({ itinerary, seed, onSeedConsumed, pick }: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = itinerary?.status === "Optimal";
  const suggests = ready ? SUGGEST_RENCANA : SUGGEST_UMUM;

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || asking) return;
    setAsking(true);
    setErr(false);
    setAsked(question);
    setAnswer(null);
    try {
      // Itinerary boleh null — AI tetap melayani pertanyaan umum Danau Toba.
      setAnswer(await askAI(question, itinerary, pick));
    } catch (e) {
      setErr(true);
      setAnswer((e as Error).message || "Gagal memanggil AI.");
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    if (!seed) return;
    setQ(seed);
    void ask(seed);
    onSeedConsumed();
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const copy = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard diblokir — abaikan */
    }
  };

  const reset = () => {
    setAnswer(null);
    setAsked(null);
    setErr(false);
    setQ("");
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className={cn(
          "group flex items-center gap-2 rounded-full border border-ink/10 bg-white/95 py-2 pl-5 pr-2 shadow-xl shadow-brand-forest/10 backdrop-blur-2xl transition-all",
          "focus-within:border-brand-sage/50 focus-within:shadow-[0_0_0_4px_hsl(var(--brand-sage)/0.14)]",
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-brand-amber-ink" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(q)}
          placeholder={t("Tanya AI soal Danau Toba…")}
          aria-label={t("Tanya AI soal Danau Toba…")}
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {q && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full p-1.5 text-ink-faint transition hover:text-ink"
            aria-label="Bersihkan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => ask(q)}
          disabled={asking || !q.trim()}
          aria-label="Tanya AI"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-lg shadow-brand-sage/30 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          {asking ? (
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 animate-bounce rounded-full bg-white"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {suggests.map((s) => (
          <button
            key={s}
            type="button"
            disabled={asking}
            onClick={() => {
              setQ(s);
              void ask(s);
            }}
            className="rounded-full border border-ink/10 bg-ink/[0.04] px-3 py-1.5 text-[0.7rem] font-medium text-ink-soft backdrop-blur-md transition hover:border-brand-sage/40 hover:text-brand-amber-ink disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {(asking || answer) && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "glass-strong mt-4 rounded-2xl p-4 text-left",
                err && "border-red-400/30",
              )}
            >
              {asked && (
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
                  {asked}
                </p>
              )}
              {asking ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="skel h-3 rounded-full"
                      style={{ width: `${100 - i * 18}%`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-[0.86rem] leading-relaxed",
                      err ? "text-red-700" : "text-ink",
                    )}
                  >
                    {answer}
                  </p>
                  {!err && (
                    <div className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-2.5">
                      <button
                        type="button"
                        onClick={copy}
                        className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-2.5 py-1 text-[0.68rem] font-semibold text-ink-soft transition hover:text-ink"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> {t("Tersalin")}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> {t("Salin")}
                          </>
                        )}
                      </button>
                      {!ready && (
                        <span className="text-[0.66rem] text-ink-faint">
                          {t("Susun rencana agar jawabannya lebih spesifik.")}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
