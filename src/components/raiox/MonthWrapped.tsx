import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { toast } from "sonner";
import { getCategoryIcon } from "@/lib/categoryUtils";
import type { MonthWrap } from "@/services/raioXAnalytics";
import { brl, brlCents } from "./primitives";

const SLIDE_MS = 5500;

interface Slide {
  bg: string;
  content: React.ReactNode;
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[48px] font-extrabold leading-[1.02] tracking-tight text-white">{children}</p>
);
const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/74">{children}</p>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 text-[17px] leading-snug text-white/85">{children}</p>
);

function buildSlides(w: MonthWrap): Slide[] {
  const slides: Slide[] = [
    {
      bg: "radial-gradient(120% 80% at 20% 10%, #3F6212 0%, #0B0B0B 70%)",
      content: (
        <>
          <p className="text-[64px]">✨</p>
          <Kicker>Retrospectiva</Kicker>
          <Big>Seu {w.monthLabel} em números</Big>
          <Sub>{w.count} lançamentos contando a história do seu dinheiro. Bora ver?</Sub>
        </>
      ),
    },
    {
      bg: "radial-gradient(120% 80% at 80% 0%, #1E3A8A 0%, #0B0B0B 70%)",
      content: (
        <>
          <Kicker>O mês em resumo</Kicker>
          <div className="mt-4 space-y-4">
            <div><p className="text-[15px] text-white/74">Entrou</p><p className="text-[40px] font-extrabold leading-none text-[#C8F36D] tabular-nums">{brl(w.income)}</p></div>
            <div><p className="text-[15px] text-white/74">Saiu</p><p className="text-[40px] font-extrabold leading-none text-white tabular-nums">{brl(w.expense)}</p></div>
            <div>
              <p className="text-[15px] text-white/74">{w.saved >= 0 ? "Sobrou" : "Faltou"}</p>
              <p className={`text-[40px] font-extrabold leading-none tabular-nums ${w.saved >= 0 ? "text-[#C8F36D]" : "text-[#F87171]"}`}>{brl(Math.abs(w.saved))}</p>
            </div>
          </div>
          {w.savedPct !== null && w.savedPct > 0 && <Sub>Você guardou {Math.round(w.savedPct * 100)}% do que ganhou 💰</Sub>}
        </>
      ),
    },
  ];

  if (w.villain) {
    const Icon = getCategoryIcon(w.villain.name);
    slides.push({
      bg: "radial-gradient(120% 80% at 50% 0%, #7F1D1D 0%, #0B0B0B 70%)",
      content: (
        <>
          <p className="text-[56px]">😈</p>
          <Kicker>Categoria vilã</Kicker>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10"><Icon className="h-7 w-7 text-[#F87171]" /></span>
            <Big>{w.villain.name}</Big>
          </div>
          <Sub>Levou {brl(w.villain.amount)}, {Math.round(w.villain.share * 100)}% de tudo que você gastou.</Sub>
        </>
      ),
    });
  }

  if (w.priciestDay) {
    const d = new Date(`${w.priciestDay.date}T12:00:00`);
    slides.push({
      bg: "radial-gradient(120% 80% at 20% 100%, #86198F 0%, #0B0B0B 70%)",
      content: (
        <>
          <p className="text-[56px]">📅</p>
          <Kicker>Dia mais caro</Kicker>
          <Big>{d.getDate()} de {w.monthLabel}</Big>
          <Sub>Uma {w.priciestDay.weekday} de {brl(w.priciestDay.amount)} em gastos. Que dia, hein?</Sub>
        </>
      ),
    });
  }

  if (w.biggest) {
    slides.push({
      bg: "radial-gradient(120% 80% at 80% 100%, #9A3412 0%, #0B0B0B 70%)",
      content: (
        <>
          <p className="text-[56px]">🛍️</p>
          <Kicker>Maior compra</Kicker>
          <Big>{brlCents(w.biggest.amount)}</Big>
          <Sub>{w.biggest.name}. Valeu a pena? Só você sabe 😉</Sub>
        </>
      ),
    });
  }

  slides.push({
    bg: "radial-gradient(120% 80% at 50% 20%, #3F6212 0%, #0B0B0B 70%)",
    content: (
      <>
        <p className="text-[64px]">🏆</p>
        <Kicker>Maior conquista</Kicker>
        <p className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight text-white">{w.win}</p>
        {w.score !== null && (
          <div className="mt-6 inline-flex items-center gap-3 rounded-[20px] bg-white/10 px-4 py-3">
            <span className="text-[34px] font-extrabold text-white tabular-nums">{w.score}</span>
            <span className="text-[14px] leading-tight text-white/82">
              pontos de saúde financeira
              {w.scoreDelta !== null && w.scoreDelta !== 0 && (
                <span className={`block font-bold ${w.scoreDelta > 0 ? "text-[#C8F36D]" : "text-[#F87171]"}`}>
                  {w.scoreDelta > 0 ? "+" : ""}{w.scoreDelta} vs mês anterior
                </span>
              )}
            </span>
          </div>
        )}
      </>
    ),
  });

  return slides;
}

/** Stories-style recap of last month, meant to be shared. */
export default function MonthWrapped({ wrap, open, onClose }: { wrap: MonthWrap; open: boolean; onClose: () => void }) {
  const slides = buildSlides(wrap);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || last) return;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, slides.length - 1)), SLIDE_MS);
    return () => clearTimeout(id);
  }, [open, index, last, slides.length]);

  const share = async () => {
    const text = [
      `Minha retrospectiva de ${wrap.monthLabel} no Willo ✨`,
      wrap.saved >= 0 ? `💰 Sobraram ${brl(wrap.saved)}` : null,
      wrap.villain ? `😈 Categoria vilã: ${wrap.villain.name}` : null,
      `🏆 ${wrap.win}`,
      wrap.score !== null ? `📊 Score: ${wrap.score} pontos` : null,
    ].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Retrospectiva Willo", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Resumo copiado para compartilhar");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="fixed inset-0 z-[90] overflow-hidden bg-black"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
              style={{ background: slides[index].bg }}
            />
          </AnimatePresence>

          {/* Progress */}
          <div className="absolute inset-x-3 z-20 flex gap-1" style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            {slides.map((_, i) => (
              <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                {i < index && <div className="h-full w-full bg-white" />}
                {i === index && (
                  <motion.div
                    key={`bar-${index}`}
                    className="h-full bg-white"
                    initial={{ width: last ? "100%" : "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: last ? 0 : SLIDE_MS / 1000, ease: "linear" }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="absolute inset-x-4 z-20 flex items-center justify-between" style={{ top: "calc(env(safe-area-inset-top, 0px) + 22px)" }}>
            <span className="text-[13px] font-semibold text-white/80">willo.</span>
            <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-full text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tap zones */}
          <button type="button" aria-label="Anterior" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => setIndex((i) => Math.max(i - 1, 0))} />
          <button type="button" aria-label="Próximo" className="absolute inset-y-0 right-0 z-10 w-2/3" onClick={() => (last ? undefined : setIndex((i) => i + 1))} />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-6 top-1/2 z-10 -translate-y-1/2"
            >
              {slides[index].content}
            </motion.div>
          </AnimatePresence>

          {last && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-5 z-20 flex gap-2.5"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
            >
              <button type="button" onClick={share} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B]">
                <Share2 className="h-5 w-5" /> Compartilhar
              </button>
              <button type="button" onClick={onClose} className="h-14 rounded-full bg-white/15 px-6 text-[16px] font-semibold text-white">
                Fechar
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
