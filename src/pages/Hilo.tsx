import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHiloSnapshot } from "@/hooks/useHiloSnapshot";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

/** Openers that show what Hilo is for: deciding, not just looking things up. */
const OPENERS = [
  "Como está meu mês?",
  "Posso gastar R$ 300 essa semana?",
  "Onde foi meu dinheiro em setembro?",
  "Quando é melhor comprar um celular de R$ 2.000?",
];

function Bubble({ turn }: { turn: Turn }) {
  const mine = turn.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap text-[14.5px] leading-relaxed",
          mine
            ? "rounded-[20px] rounded-br-[8px] bg-white px-4 py-2.5 font-medium text-[#0B0B0B]"
            : "rounded-[20px] rounded-bl-[8px] border border-white/[0.07] willo-glass px-4 py-3 text-white/90",
        )}
      >
        {turn.content}
      </div>
    </motion.div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-[8px] border border-white/[0.07] willo-glass px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-white/50"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Hilo() {
  const { build, loading: snapshotLoading } = useHiloSnapshot();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: turns.length > 1 ? "smooth" : "auto" });
  }, [turns, sending]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;

      // The whole history goes up every time: the API keeps no state of its own.
      const next: Turn[] = [...turns, { role: "user", content: question }];
      setTurns(next);
      setDraft("");
      setFailed(null);
      setSending(true);

      try {
        const { data, error } = await supabase.functions.invoke("hilo-chat", {
          body: { messages: next, snapshot: build() },
        });

        // On a non-2xx the client throws a generic "non-2xx status code" and keeps the
        // real body on the error, so the function's own message is read out of there.
        if (error) {
          let said: string | null = null;
          try {
            said = (await (error as any)?.context?.json?.())?.error ?? null;
          } catch {
            said = null;
          }
          throw new Error(said || "Não consegui falar com o Hilo agora.");
        }
        if (data?.error) throw new Error(data.error);

        setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (err: any) {
        // Say it failed rather than leaving a turn that looks answered.
        setFailed(err?.message || "Não consegui falar com o Hilo agora.");
      } finally {
        setSending(false);
      }
    },
    [turns, sending, build],
  );

  const empty = turns.length === 0;

  return (
    <div className="mx-auto flex h-[100dvh] max-w-lg flex-col">
      <div className="shrink-0 px-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05]">
            <Sparkles className="h-[15px] w-[15px] text-white/80" strokeWidth={2.1} />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold leading-none text-white">Hilo</p>
            <p className="mt-1 text-[11.5px] text-white/45">Olha os seus números de verdade</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 scrollbar-none">
        {empty ? (
          <div className="flex h-full flex-col justify-end pb-2">
            <p className="text-[22px] font-bold leading-tight tracking-tight text-white">
              O que você quer entender
              <br />
              do seu dinheiro?
            </p>
            <p className="mt-2 text-[13.5px] leading-snug text-white/50">
              Eu leio o que já está lançado no Willo. Posso analisar, comparar meses e simular
              uma compra antes de você fazer.
            </p>
            <div className="mt-5 space-y-2">
              {OPENERS.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  disabled={snapshotLoading}
                  className="flex w-full items-center rounded-[18px] border border-white/[0.07] willo-glass px-4 py-3 text-left text-[14px] text-white/80 active:opacity-70 disabled:opacity-40"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {turns.map((t, i) => (
              <Bubble key={i} turn={t} />
            ))}
            <AnimatePresence>{sending && <Thinking />}</AnimatePresence>
            {failed && (
              <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-[13px] leading-snug text-white/80">
                {failed}
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div
        className="shrink-0 px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
      >
        <div className="flex items-end gap-2 rounded-[26px] border border-white/[0.08] willo-glass p-2 pl-4">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Pergunte sobre o seu dinheiro"
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] text-white placeholder:text-white/35 focus:outline-none scrollbar-none"
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim() || sending}
            aria-label="Enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B0B0B] transition-opacity active:opacity-80 disabled:opacity-25"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
        <p className="mt-2 px-1 text-center text-[11px] leading-snug text-white/30">
          O Hilo analisa e recomenda. Ainda não registra lançamentos.
        </p>
      </div>
    </div>
  );
}
