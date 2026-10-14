import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Camera, Loader2, Mic, Square, Table2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import Notinha, { type NotinhaLine } from "./Notinha";

/**
 * Registro rápido: say what you spent, in one sentence, and have it filed.
 *
 * It replaces the scanner as the first thing the add button does, because the camera
 * only ever answered one question — "I have a receipt in my hand" — and most spending
 * never produces one. The camera is still here, one tap down, along with the full form.
 *
 * The screen is a conversation with a receipt attached. The thread scrolls and is
 * disposable; the receipt stays and is the record. Anything the app cannot work out it
 * asks about — but only what it genuinely cannot know, which is why the questions come
 * from resolve.ts and not from the model.
 */

type Msg = { id: string; role: "bot" | "user"; text: string };

interface Line {
  draft: QuickDraft;
  saved: boolean;
  saving: boolean;
  error: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const CHIPS = [
  "uber 18, farmácia 40",
  "pix 50 e luz 120",
  "recebi 200 de freela",
  "mercado 230 no crédito",
];

export default function RegistroRapidoSheet({ open, onClose, onPhoto, onManual }: {
  open: boolean;
  onClose: () => void;
  /** Hands over to the receipt camera. */
  onPhoto: () => void;
  /** Hands over to the full form. */
  onManual: () => void;
}) {
  const { user } = useAuth();
  useScrollLock(open);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [setup, setSetup] = useState<QuickSetup>({ accounts: [], cards: [] });
  const [categories, setCategories] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [question, setQuestion] = useState<QuickQuestion | null>(null);

  const askedRef = useRef("");
  const savingRef = useRef<Set<string>>(new Set());
  const threadRef = useRef<HTMLDivElement>(null);
  const recorder = useAudioRecorder();

  const pushBot = useCallback((t: string) => setMessages((m) => [...m, { id: uid(), role: "bot", text: t }]), []);
  const pushUser = useCallback((t: string) => setMessages((m) => [...m, { id: uid(), role: "user", text: t }]), []);

  /* ---- opening and closing ------------------------------------------------ */

  useEffect(() => {
    if (!open) return;
    setMessages([
      { id: uid(), role: "bot", text: "Me conta o que entrou ou saiu." },
      { id: uid(), role: "bot", text: "Pode ser tudo de uma vez, escrevendo ou falando." },
    ]);
    setLines([]);
    setText("");
    setQuestion(null);
    askedRef.current = "";
    savingRef.current = new Set();

    getAccounts()
      .then((accounts) => {
        const usable = (accounts as { id: string; name: string; type?: string; is_default?: boolean }[])
          .filter((a) => a.type !== "investment");
        setSetup((s) => ({ ...s, accounts: usable }));
      })
      .catch(() => { /* an account list that failed to load just means more questions */ });

    getCreditCards()
      .then((cards) => setSetup((s) => ({ ...s, cards: (cards as unknown as { id: string; name: string }[]) ?? [] })))
      .catch(() => { /* same */ });

    allowedCategories().then(setCategories).catch(() => setCategories([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, lines, open]);

  const handleClose = useCallback(() => {
    recorder.cancel();
    onClose();
  }, [onClose, recorder]);

  /* ---- writing ------------------------------------------------------------ */

  const save = useCallback(async (toSave: Line[]) => {
    if (!user) return;
    for (const line of toSave) savingRef.current.add(line.draft.id);
    setLines((ls) => ls.map((l) => (savingRef.current.has(l.draft.id) && !l.saved ? { ...l, saving: true } : l)));

    for (const line of toSave) {
      const d = line.draft;
      try {
        await createTransaction(
          {
            name: d.name,
            type: d.type,
            amount: d.amount,
            category: d.category ?? "Outros",
            date: d.date,
            status: d.type === "receita" ? "recebido" : "pago",
            payment_method: d.paymentMethod ?? "conta",
            account_id: d.accountId,
            credit_card_id: d.creditCardId,
          } as never,
          user.id,
        );
        setLines((ls) => ls.map((l) => (l.draft.id === d.id ? { ...l, saved: true, saving: false } : l)));
      } catch {
        setLines((ls) => ls.map((l) => (l.draft.id === d.id ? { ...l, error: true, saving: false } : l)));
        toast.error(`Não consegui salvar "${d.name}"`);
      }
    }

    window.dispatchEvent(new CustomEvent("transaction-created"));
  }, [user]);

  /* ---- the question loop --------------------------------------------------
     Everything the app still needs comes from one place, so there is no chance of
     the thread and the receipt disagreeing about what is outstanding. */

  useEffect(() => {
    if (!open) return;
    const unsaved = lines.filter((l) => !l.saved && !l.error);
    if (unsaved.length === 0) {
      setQuestion(null);
      if (lines.length > 0 && lines.every((l) => l.saved) && askedRef.current !== "done") {
        askedRef.current = "done";
        pushBot("Anotado.");
      }
      return;
    }

    const q = nextQuestion(unsaved.map((l) => l.draft), setup);
    if (q) {
      setQuestion(q);
      const key = `${q.draftId}:${q.kind}`;
      if (askedRef.current !== key) {
        askedRef.current = key;
        pushBot(q.prompt);
      }
      return;
    }

    setQuestion(null);
    const toSave = unsaved.filter((l) => !savingRef.current.has(l.draft.id));
    if (toSave.length > 0) save(toSave);
  }, [lines, setup, open, pushBot, save]);

  /* ---- reading what was said ---------------------------------------------- */

  const ingest = useCallback(async (input: { text?: string; audio?: { data: string; mimeType: string } }) => {
    setThinking(true);
    try {
      const { entries, transcript } = await readEntry({ ...input, categories });
      if (transcript) pushUser(transcript);

      if (entries.length === 0) {
        pushBot("Não achei nenhum valor aí. Tenta algo como “mercado 30” ou “recebi 200 de freela”.");
        return;
      }

      const fresh: Line[] = entries.map((e) => ({
        draft: applyDefaults(
          {
            id: uid(),
            name: e.name,
            type: e.type,
            amount: e.amount,
            category: e.category,
            date: e.date || todayISO(),
            paymentMethod: e.paymentMethod,
            accountId: null,
            creditCardId: null,
          },
          setup,
        ),
        saved: false,
        saving: false,
        error: false,
      }));
      askedRef.current = "";
      setLines((ls) => [...ls, ...fresh]);
    } catch (err) {
      pushBot(err instanceof Error ? err.message : "Não consegui ler agora. Tenta de novo?");
    } finally {
      setThinking(false);
    }
  }, [categories, setup, pushBot, pushUser]);

  /* ---- answering ---------------------------------------------------------- */

  const applyAnswer = useCallback((q: QuickQuestion, value: string) => {
    setLines((ls) => ls.map((l) =>
      l.draft.id === q.draftId
        ? { ...l, draft: applyDefaults(answerDraft(l.draft, q, value), setup) }
        : l,
    ));
    askedRef.current = "";
  }, [setup]);

  const answerWithOption = useCallback((q: QuickQuestion, option: { id: string; label: string }) => {
    pushUser(option.label);
    applyAnswer(q, option.id);
  }, [applyAnswer, pushUser]);

  /** A typed answer to "em que você gastou?" goes back through the reader, because
      people answer "no mercado" or "foi um lanche", not with a category name. */
  const answerCategory = useCallback(async (q: QuickQuestion, said: string) => {
    const line = lines.find((l) => l.draft.id === q.draftId);
    if (!line) return;
    pushUser(said);
    setThinking(true);
    try {
      const cat = await categoriseAnswer(said, line.draft.amount, line.draft.type, categories);
      if (!cat) {
        pushBot("Ainda não consegui encaixar numa categoria. Escolhe uma abaixo?");
        return;
      }
      applyAnswer(q, cat);
    } catch {
      pushBot("Não consegui agora. Escolhe uma categoria abaixo?");
    } finally {
      setThinking(false);
    }
  }, [lines, categories, applyAnswer, pushBot, pushUser]);

  /* ---- sending ------------------------------------------------------------ */

  const submitText = useCallback(() => {
    const said = text.trim();
    if (!said || thinking) return;
    setText("");
    if (question?.kind === "category") {
      answerCategory(question, said);
      return;
    }
    pushUser(said);
    ingest({ text: said });
  }, [text, thinking, question, answerCategory, ingest, pushUser]);

  const toggleRecording = useCallback(async () => {
    if (recorder.recording) {
      const audio = await recorder.stop();
      if (!audio || audio.seconds < 1) {
        pushBot("Não peguei nada. Segura um pouquinho mais?");
        return;
      }
      ingest({ audio: { data: audio.data, mimeType: audio.mimeType } });
      return;
    }
    try {
      await recorder.start();
    } catch {
      toast.error("Preciso de acesso ao microfone para ouvir.");
    }
  }, [recorder, ingest, pushBot]);

  /* ---- what the receipt shows --------------------------------------------- */

  const notinhaLines: NotinhaLine[] = useMemo(() => lines.map((l) => ({
    id: l.draft.id,
    name: l.draft.name,
    sub: l.draft.category ?? "",
    amount: l.draft.amount,
    type: l.draft.type,
    status: l.error ? "error" : l.saved ? "saved" : l.saving ? "saving"
      : question?.draftId === l.draft.id ? "asking" : "reading",
  })), [lines, question]);

  /** Categories worth offering by hand, for the type being asked about. */
  const categoryChips = useMemo(() => {
    if (question?.kind !== "category") return [];
    const line = lines.find((l) => l.draft.id === question.draftId);
    const typed = text.trim().toLowerCase();
    const pool = categories.filter((c) =>
      line?.draft.type === "receita"
        ? ["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"].includes(c)
        : !["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"].includes(c),
    );
    return (typed ? pool.filter((c) => c.toLowerCase().includes(typed)) : pool).slice(0, 12);
  }, [question, lines, categories, text]);

  const hasEntries = lines.length > 0;
  const optionChips = question && question.kind !== "category" ? question.options : [];

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[120] flex flex-col bg-[#0D0E10]"
        role="dialog"
        aria-label="Registro rápido"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <button
            onClick={handleClose}
            className="rounded-full bg-white/[0.08] px-4 py-2 text-[15px] font-medium text-[#8AB4F8] active:opacity-70"
          >
            {hasEntries ? "Concluir" : "Fechar"}
          </button>
          <h2 className="text-[17px] font-bold tracking-tight text-white">Registro rápido</h2>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <p className={m.role === "user"
                ? "max-w-[82%] rounded-[18px] bg-[#0A84FF] px-3.5 py-2.5 text-[15px] leading-snug text-white"
                : "max-w-[82%] rounded-[18px] border border-white/[0.10] bg-white/[0.06] px-3.5 py-2.5 text-[15px] leading-snug text-white/92"}
              >
                {m.text}
              </p>
            </motion.div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <p className="flex items-center gap-2 rounded-[18px] border border-white/[0.10] bg-white/[0.06] px-3.5 py-2.5 text-[15px] text-white/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Anotando…
              </p>
            </div>
          )}

          {hasEntries && <div className="pt-1"><Notinha lines={notinhaLines} /></div>}
        </div>

        {/* Composer */}
        <div
          className="shrink-0 border-t border-white/[0.07] px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          {/* Chips: the options being asked for, the categories to choose from, or —
              when nothing is pending — examples of what a sentence can look like. */}
          <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {optionChips.map((o) => (
              <button
                key={o.id}
                onClick={() => question && answerWithOption(question, o)}
                className="shrink-0 rounded-full border border-[#8AB4F8]/40 bg-[#8AB4F8]/10 px-3.5 py-2 text-[13.5px] font-medium text-[#8AB4F8] active:opacity-70"
              >
                {o.label}
              </button>
            ))}
            {categoryChips.map((c) => (
              <button
                key={c}
                onClick={() => {
                  if (!question) return;
                  setText("");
                  pushUser(c);
                  applyAnswer(question, c);
                }}
                className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 py-2 text-[13.5px] text-white/80 active:opacity-70"
              >
                {c}
              </button>
            ))}
            {!question && !text && CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setText(c)}
                className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 py-2 text-[13.5px] text-white/70 active:opacity-70"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitText(); }}
              placeholder={recorder.recording ? `Ouvindo… ${recorder.seconds}s` : "uber 18, farmácia 40…"}
              disabled={recorder.recording}
              enterKeyHint="send"
              className="h-[46px] min-w-0 flex-1 rounded-full border border-[#8AB4F8]/45 bg-transparent px-4 text-[15px] text-white placeholder:text-white/35 focus:border-[#8AB4F8] focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={text.trim() ? submitText : toggleRecording}
              disabled={thinking || (!text.trim() && !recorder.supported)}
              aria-label={text.trim() ? "Enviar" : recorder.recording ? "Parar gravação" : "Gravar"}
              className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                recorder.recording ? "bg-[#F87171]" : "bg-[#0A84FF]"
              }`}
            >
              {thinking ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                : text.trim() ? <ArrowUp className="h-5 w-5 text-white" strokeWidth={2.6} />
                : recorder.recording ? <Square className="h-4 w-4 fill-white text-white" />
                : <Mic className="h-5 w-5 text-white" strokeWidth={2.2} />}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-5">
            <button onClick={onPhoto} className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#8AB4F8] active:opacity-70">
              <Camera className="h-4 w-4" strokeWidth={2.2} />
              Foto do comprovante
            </button>
            <button onClick={onManual} className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#8AB4F8] active:opacity-70">
              <Table2 className="h-4 w-4" strokeWidth={2.2} />
              Campo a campo
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
