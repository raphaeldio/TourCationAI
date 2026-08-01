import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Check,
  Copy,
  Languages,
  Mic,
  Send,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { Bahasa } from "../types";
import { fetchLanguages, translateText } from "../api";
import { cn } from "../lib/utils";
import { useT } from "../i18n";

type Role = "user" | "bot";

interface ChatMessage {
  id: number;
  role: Role;
  content: string;
  lang?: string;
  time: string;
  err?: boolean;
}

/* ── Web Speech API: belum ada di lib DOM standar ───────────────────────── */
interface SpeechRecognitionErrorEvent {
  error: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): ISpeechRecognition };
    webkitSpeechRecognition?: { new (): ISpeechRecognition };
  }
}

/** Cadangan bila /api/languages belum termuat. */
const FALLBACK: Bahasa[] = [
  { code: "id", label: "Indonesia", stt: "id-ID" },
  { code: "en", label: "English", stt: "en-US" },
];

const SARAN = [
  "Halo, apa kabar?",
  "Berapa harganya?",
  "Di mana dermaga feri?",
  "Saya tidak mengerti.",
];

const jam = () =>
  new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function useTTS() {
  return useCallback((text: string, bcp47?: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (bcp47) u.lang = bcp47;
    u.rate = 0.95;
    const suara = window.speechSynthesis
      .getVoices()
      .find((v) => bcp47 && v.lang.startsWith(bcp47.slice(0, 2)));
    if (suara) u.voice = suara;
    window.speechSynthesis.speak(u);
  }, []);
}

/** Chip kode bahasa — pengganti bendera emoji agar UI tetap bebas emoji. */
function KodeBahasa({ code, aktif }: { code: string; aktif?: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
        aktif ? "bg-white/20 text-white" : "bg-ink/[0.06] text-ink-soft",
      )}
    >
      {code}
    </span>
  );
}

function Waveform({ aktif }: { aktif: boolean }) {
  const [h, setH] = useState<number[]>(Array(7).fill(3));
  useEffect(() => {
    if (!aktif) {
      setH(Array(7).fill(3));
      return;
    }
    const id = setInterval(() => {
      setH(
        Array(7)
          .fill(0)
          .map((_, i) => Math.round(3 + (1 - Math.abs(i - 3) / 3) * 5 + Math.random() * 10)),
      );
    }, 90);
    return () => clearInterval(id);
  }, [aktif]);
  return (
    <div className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {h.map((v, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full transition-[height] duration-100", aktif ? "bg-rose-400" : "bg-ink/20")}
          style={{ height: `${v}px` }}
        />
      ))}
    </div>
  );
}

export default function TranslatorBot() {
  const tr = useT();
  const [langs, setLangs] = useState<Bahasa[]>(FALLBACK);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [src, setSrc] = useState("id");
  const [tgt, setTgt] = useState("en");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<ISpeechRecognition | null>(null);
  const speak = useTTS();

  const bcp47 = (code: string) => langs.find((l) => l.code === code)?.stt ?? code;
  const nama = (code?: string) => langs.find((l) => l.code === code)?.label ?? code ?? "";

  useEffect(() => {
    fetchLanguages()
      .then(setLangs)
      .catch(() => setLangs(FALLBACK));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setUnread(0);
    }
  }, [open]);

  // Daftar suara TTS dimuat asinkron di sebagian browser.
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  const tambah = (role: Role, content: string, lang?: string, err = false) => {
    setMsgs((m) => [...m, { id: Date.now() + Math.random(), role, content, lang, time: jam(), err }]);
    if (role === "bot" && !open) setUnread((u) => u + 1);
  };

  const kirim = useCallback(
    async (teks: string) => {
      const t = teks.trim();
      if (!t || loading) return;
      setInput("");
      tambah("user", t, src);
      setLoading(true);
      try {
        tambah("bot", await translateText(t, src, tgt), tgt);
      } catch (e) {
        tambah("bot", (e as Error).message || "Gagal menerjemahkan.", tgt, true);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, tgt, loading, open],
  );

  const mulaiDengar = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      tambah("bot", "Browser ini tidak mendukung pengenalan suara. Coba Chrome atau Edge.", tgt, true);
      return;
    }
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        // Lepaskan track segera; kalau tidak, mic terkunci dan STT tidak dapat audio.
        stream.getTracks().forEach((t) => t.stop());

        const rec = new SR();
        rec.lang = bcp47(src);
        rec.interimResults = true;
        rec.continuous = false;
        recogRef.current = rec;

        rec.onstart = () => setListening(true);
        rec.onresult = (e) => {
          let interim = "";
          let final = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const teks = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += teks;
            else interim += teks;
          }
          if (interim) setInput(interim);
          if (final) {
            setInput(final);
            setListening(false);
            void kirim(final);
          }
        };
        rec.onerror = (e) => {
          setListening(false);
          setInput("");
          const pesan =
            e.error === "no-speech"
              ? "Tidak ada suara yang terdengar. Coba lagi."
              : e.error === "not-allowed"
                ? "Akses mikrofon ditolak. Izinkan mikrofon di pengaturan situs, lalu muat ulang."
                : `Pengenalan suara gagal (${e.error}).`;
          tambah("bot", pesan, tgt, true);
        };
        rec.onend = () => setListening(false);
        rec.start();
      })
      .catch(() =>
        tambah(
          "bot",
          "Izin mikrofon ditolak. Buka pengaturan situs di browser, izinkan Microphone, lalu muat ulang halaman.",
          tgt,
          true,
        ),
      );
  };

  const stopDengar = () => {
    try {
      recogRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const salin = async (teks: string, id: number) => {
    try {
      await navigator.clipboard.writeText(teks);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard diblokir */
    }
  };

  const tukar = () => {
    setSrc(tgt);
    setTgt(src);
  };

  const selectCls =
    "flex-1 min-w-0 rounded-lg border border-ink/10 bg-black/30 px-2 py-1.5 text-xs font-medium text-ink outline-none transition focus:border-brand-sage/50";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Penerjemah AI"
            className="glass-strong fixed bottom-24 right-6 z-50 flex h-[min(580px,calc(100vh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden bg-white/95"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-ink/10 bg-gradient-to-r from-brand-sage/18 via-brand-sand/12 to-transparent px-4 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.06]">
                <Languages className="h-4 w-4 text-brand-sand-ink" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-display text-sm font-bold text-ink">{tr("Penerjemah AI")}</p>
                <p className="flex items-center gap-1.5 text-[0.68rem] text-ink-soft">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      loading ? "bg-amber-400" : "bg-emerald-400",
                    )}
                  />
                  {tr(loading ? "Menerjemahkan…" : "Siap menerjemahkan")}
                </p>
              </div>
              {msgs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMsgs([]);
                    setUnread(0);
                  }}
                  className="rounded-lg p-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
                  aria-label={tr("Hapus percakapan")}
                  title={tr("Hapus percakapan")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
                aria-label="Tutup penerjemah"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Pemilih bahasa */}
            <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 bg-ink/[0.04] px-3 py-2.5">
              <select
                className={selectCls}
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                aria-label="Bahasa sumber"
              >
                {langs.map((l) => (
                  <option key={l.code} value={l.code} className="bg-white text-ink">
                    {l.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={tukar}
                aria-label={tr("Tukar bahasa")}
                title={tr("Tukar bahasa")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-ink/[0.05] text-ink-soft transition hover:border-brand-sage/45 hover:text-brand-amber-ink"
              >
                <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
              </button>

              <select
                className={selectCls}
                value={tgt}
                onChange={(e) => setTgt(e.target.value)}
                aria-label="Bahasa tujuan"
              >
                {langs.map((l) => (
                  <option key={l.code} value={l.code} className="bg-white text-ink">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Percakapan */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" role="log" aria-live="polite">
              {msgs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ink/10 bg-brand-sage/10">
                    <Languages className="h-6 w-6 text-brand-amber-ink" strokeWidth={1.6} />
                  </div>
                  <p className="mt-1 font-display text-base font-bold text-ink">{tr("Penerjemah AI")}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                    <KodeBahasa code={src} /> {nama(src)}
                    <span className="text-ink-faint">→</span>
                    <KodeBahasa code={tgt} /> {nama(tgt)}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {SARAN.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void kirim(s)}
                        className="rounded-full border border-ink/10 bg-ink/[0.04] px-3 py-1.5 text-[0.7rem] text-ink-soft transition hover:border-brand-sage/40 hover:text-brand-amber-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                msgs.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "group flex max-w-[88%] flex-col gap-1",
                      m.role === "user" ? "items-end self-end" : "items-start self-start",
                    )}
                  >
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.84rem] leading-relaxed",
                        m.role === "user"
                          ? "rounded-tr-sm bg-gradient-to-br from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-md shadow-brand-sage/25"
                          : "rounded-tl-sm border border-ink/10 bg-ink/[0.05] text-ink",
                        m.err && "border-red-400/30 bg-red-500/10 text-red-700",
                      )}
                    >
                      {m.content}
                    </div>
                    <div className="flex items-center gap-1.5 px-1 text-[0.62rem] text-ink-faint">
                      <span>{m.time}</span>
                      {m.lang && <KodeBahasa code={m.lang} />}
                      {!m.err && (
                        <button
                          type="button"
                          onClick={() => salin(m.content, m.id)}
                          className="opacity-0 transition hover:text-ink-soft focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label="Salin"
                        >
                          {copied === m.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      {m.role === "bot" && !m.err && (
                        <button
                          type="button"
                          onClick={() => speak(m.content, bcp47(m.lang ?? tgt))}
                          className="opacity-0 transition hover:text-ink-soft focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label="Dengarkan"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex items-center gap-2 self-start rounded-2xl rounded-tl-sm border border-ink/10 bg-ink/[0.05] px-3.5 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-amber"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-ink/10 p-3">
              {listening && (
                <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2">
                  <Waveform aktif={listening} />
                  <span className="text-xs font-medium text-rose-600">{tr("Mendengarkan…")}</span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => (listening ? stopDengar() : mulaiDengar())}
                  aria-label={listening ? "Berhenti merekam" : "Rekam suara"}
                  title={listening ? "Berhenti merekam" : "Rekam suara"}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
                    listening
                      ? "animate-pulse border-rose-400/50 bg-rose-500/15 text-rose-600"
                      : "border-ink/10 bg-ink/[0.05] text-ink-soft hover:border-brand-sage/45 hover:text-brand-amber-ink",
                  )}
                >
                  <Mic className="h-4 w-4" />
                </button>

                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void kirim(input);
                    }
                  }}
                  placeholder={tr("Ketik teks untuk diterjemahkan…")}
                  aria-label="Teks untuk diterjemahkan"
                  className="max-h-24 min-h-[36px] flex-1 resize-none rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-sage/50"
                />

                <button
                  type="button"
                  onClick={() => void kirim(input)}
                  disabled={!input.trim() || loading}
                  aria-label={tr("Terjemahkan")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-lg shadow-brand-sage/30 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.64rem] text-ink-faint">
                {tr("Enter kirim · Shift+Enter baris baru")}
                <KodeBahasa code={src} />
                <span>→</span>
                <KodeBahasa code={tgt} />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tombol mengambang */}
      <motion.button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (listening) stopDengar();
        }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? "Tutup penerjemah" : "Buka penerjemah AI"}
        title={open ? "Tutup penerjemah" : "Penerjemah AI"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-sage to-brand-sand shadow-lg shadow-brand-sage/40 transition hover:scale-105"
      >
        {!open && (
          <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-brand-amber/50" />
        )}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-brand-amber px-1 text-[0.62rem] font-bold text-on-amber">
            {unread}
          </span>
        )}
        {open ? (
          <X className="h-6 w-6 text-ink" strokeWidth={2.5} />
        ) : (
          <Languages className="h-6 w-6 text-ink" strokeWidth={2.2} />
        )}
      </motion.button>
    </>
  );
}
