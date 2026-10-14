import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Camera, Loader2, Mic, PenLine, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { chimeAsk, chimeSaved } from "@/lib/chime";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import type { ReceiptItem } from "@/lib/receiptImage";
import Notinha, { type NotinhaLine } from "./Notinha";
import ReceiptViewer from "./ReceiptViewer";

/**
 * Registro rápido: say what you spent, in one sentence, and have it filed.
 *
 * It replaces the scanner as the first thing the add button does, because the camera
 * only ever answered one question — "I have a receipt in my hand" — and most spending
 * never produces one. The camera is still here, and so is the full form.
 *
 * The screen is a conversation with a receipt attached. The thread scrolls and is
 * disposable; the receipt stays and is the record. Anything the app cannot work out it
 * asks about — but only what it genuinely cannot know, which is why the questions come
 * from resolve.ts and not from the model.
 *
 * The composer puts writing in the middle with the camera and the microphone on either
 * side, because they are three ways to say the same thing, not one action with two
 * links underneath it.
 */

type Msg = { id: string; role: "bot" | "user"; text: string };

interface Line {
  draft: QuickDraft;
  saved: boolean;
  saving: boolean;
  error: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Examples that between them show the range: several at once, income, card, a past day. */
const CHIPS = [
  "mercado 120 no crédito",
  "uber 18 e farmácia 40",
  "recebi 200 de freela",
  "almoço 35 ontem",
  "luz 180, água 60",
];

const INCOME_CATEGORIES = [
  "Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada",
];

/** The bot working something out. Three dots, not a spinner — it reads as a pause. */
function Thinking({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-2.5 rounded-[20px] rounded-bl-[7px] border border-white/[0.09] bg-white/[0.06] px-4 py-3 backdrop-blur-xl">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-[5px] w-[5px] rounded-full bg-willo-green"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }}
              transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            />
          ))}
        </span>
        <span className="text-[14px] text-white/60">{label}</span>
      </div>
    </motion.div>
  );
}

export default function RegistroRapidoSheet({ open, onClose, onPhoto, onManual }: {
  open: boolean;
  onClose: () => void;
  /** Hands over to the receipt camera, which carries its own gallery button. */
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
  const [thinking, setThinking] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuickQuestion | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const askedRef = useRef("");
  const savingRef = useRef<Set<string>>(new Set());
  const savedCountRef = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  const pushBot = useCallback((t: string) => setMessages((m) => [...m, { id: uid(), role: "bot", text: t }]), []);
  const pushUser = useCallback((t: string) => setMessages((m) => [...m, { id: uid(), role: "user", text: t }]), []);

  /* ---- opening and closing ------------------------------------------------ */

  useEffect(() => {
    if (!open) return;
    setMessages([
      { id: uid(), role: "bot", text: "Me conta o que entrou ou saiu." },
      { id: uid(), role: "bot", text: "Pode ser tudo de uma vez — escrevendo, falando ou fotografando." },
    ]);
    setLines([]);
    setText("");
    setQuestion(null);
    setShowReceipt(false);
    askedRef.current = "";
    savingRef.current = new Set();
    savedCountRef.current = 0;

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
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, lines, thinking, open]);

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

  /** One sound per thing filed, fired off the state that actually changed. */
  useEffect(() => {
    const saved = lines.filter((l) => l.saved).length;
    if (saved > savedCountRef.current) chimeSaved();
    savedCountRef.current = saved;
  }, [lines]);

  /* ---- the question loop --------------------------------------------------
     Everything still outstanding comes from one place, so the thread and the receipt
     cannot disagree about what is missing. */

  useEffect(() => {
    if (!open) return;
    const unsaved = lines.filter((l) => !l.saved && !l.error);
    if (unsaved.length === 0) {
      setQuestion(null);
      if (lines.length > 0 && lines.every((l) => l.saved) && askedRef.current !== "done") {
        askedRef.current = "done";
        pushBot(lines.length > 1 ? "Anotado. Tudo no lugar." : "Anotado.");
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
        chimeAsk();
      }
      return;
    }

    setQuestion(null);
    const toSave = unsaved.filter((l) => !savingRef.current.has(l.draft.id));
    if (toSave.length > 0) save(toSave);
  }, [lines, setup, open, pushBot, save]);

  /* ---- reading what was said ---------------------------------------------- */

  const ingest = useCallback(async (input: { text?: string; audio?: { data: string; mimeType: string } }) => {
    setThinking(input.audio ? "Ouvindo" : "Anotando");
    try {
      const { entries, transcript } = await readEntry({ ...input, categories });
      // Only for audio. Asked to transcribe, the model happily echoes typed text back
      // as a transcript too, which would post the sentence into the thread twice.
      if (input.audio && transcript) pushUser(transcript);

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
      setThinking(null);
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
    setThinking("Pensando");
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
      setThinking(null);
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

  const receiptItems: ReceiptItem[] = useMemo(() => lines
    .filter((l) => l.saved)
    .map((l) => ({
      name: l.draft.name,
      category: l.draft.category ?? "Outros",
      amount: l.draft.amount,
      type: l.draft.type,
    })), [lines]);

  /** Categories worth offering by hand, for the type being asked about. */
  const categoryChips = useMemo(() => {
    if (question?.kind !== "category") return [];
    const line = lines.find((l) => l.draft.id === question.draftId);
    const typed = text.trim().toLowerCase();
    const isIncome = line?.draft.type === "receita";
    const pool = categories.filter((c) => INCOME_CATEGORIES.includes(c) === isIncome);
    return (typed ? pool.filter((c) => c.toLowerCase().includes(typed)) : pool).slice(0, 14);
  }, [question, lines, categories, text]);

  const hasEntries = lines.length > 0;
  const allSaved = hasEntries && lines.every((l) => l.saved);
  const optionChips = question && question.kind !== "category" ? question.options : [];
  const busy = thinking !== null;

  if (!open) return null;

  return createPortal(
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="willo-aurora fixed inset-0 z-[120] flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Registro rápido"
        >
          {/* Header — the title leads, the way out sits off to the side. */}
          <div
            className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
          >
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-white">Registro rápido</h2>
              <p className="text-[12.5px] text-white/42">
                {allSaved ? "Tudo anotado" : hasEntries ? "Quase lá" : "Uma frase basta"}
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label={hasEntries ? "Concluir" : "Fechar"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/15 backdrop-blur-md transition-transform active:scale-95"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>

          {/* Thread */}
          <div ref={threadRef} className="relative z-10 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <p className={m.role === "user"
                  ? "max-w-[84%] rounded-[20px] rounded-br-[7px] bg-white px-4 py-2.5 text-[15px] font-medium leading-snug tracking-[-0.01em] text-[#0B0B0B]"
                  : "max-w-[84%] rounded-[20px] rounded-bl-[7px] border border-white/[0.09] bg-white/[0.06] px-4 py-2.5 text-[15px] leading-snug text-white/92 backdrop-blur-xl"}
                >
                  {m.text}
                </p>
              </motion.div>
            ))}

            <AnimatePresence>{busy && <Thinking key="t" label={thinking} />}</AnimatePresence>

            {hasEntries && (
              <div className="pt-1.5">
                <Notinha
                  lines={notinhaLines}
                  onOpen={receiptItems.length > 0 ? () => setShowReceipt(true) : undefined}
                />
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            className="relative z-10 shrink-0 border-t border-white/[0.07] bg-black/25 px-5 pt-3 backdrop-blur-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {/* Chips: what is being asked for, the categories to choose from, or —
                with nothing pending — examples of what one sentence can carry. */}
            <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {optionChips.map((o) => (
                <button
                  key={o.id}
                  onClick={() => question && answerWithOption(question, o)}
                  className="shrink-0 rounded-full bg-willo-green px-4 py-2 text-[13.5px] font-bold text-[#0B0B0B] transition-transform active:scale-95"
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
                  className="shrink-0 rounded-full border border-white/[0.10] bg-white/[0.06] px-4 py-2 text-[13.5px] font-medium text-white/85 backdrop-blur-md transition-transform active:scale-95"
                >
                  {c}
                </button>
              ))}
              {!question && !text && CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setText(c); inputRef.current?.focus(); }}
                  className="shrink-0 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-[13.5px] text-white/60 backdrop-blur-md transition-transform active:scale-95"
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Writing in the middle, the camera and the microphone on either side. */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={onPhoto}
                aria-label="Foto do comprovante"
                className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06] text-white/80 backdrop-blur-md transition-transform active:scale-95"
              >
                <Camera className="h-[19px] w-[19px]" strokeWidth={2.1} />
              </button>

              <div className={`flex h-[48px] min-w-0 flex-1 items-center rounded-full border bg-white/[0.05] backdrop-blur-md transition-colors ${
                recorder.recording ? "border-[#F87171]/60" : text ? "border-willo-green/55" : "border-white/[0.11]"
              }`}>
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitText(); }}
                  placeholder={recorder.recording ? `Ouvindo…  ${recorder.seconds}s` : "o que rolou?"}
                  disabled={recorder.recording}
                  enterKeyHint="send"
                  className="h-full w-full rounded-full bg-transparent px-4 text-[15px] text-white placeholder:text-white/32 focus:outline-none disabled:opacity-70"
                />
              </div>

              <button
                onClick={text.trim() ? submitText : toggleRecording}
                disabled={busy || (!text.trim() && !recorder.supported)}
                aria-label={text.trim() ? "Enviar" : recorder.recording ? "Parar gravação" : "Gravar"}
                className={`relative flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 ${
                  recorder.recording ? "bg-[#F87171]"
                    : text.trim() ? "bg-willo-green"
                    : "border border-white/[0.10] bg-white/[0.06] backdrop-blur-md"
                }`}
              >
                {recorder.recording && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[#F87171]"
                    animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span className="relative">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                    : text.trim() ? <ArrowUp className="h-5 w-5 text-[#0B0B0B]" strokeWidth={2.8} />
                    : recorder.recording ? <Square className="h-[15px] w-[15px] fill-white text-white" />
                    : <Mic className="h-[19px] w-[19px] text-white/80" strokeWidth={2.1} />}
                </span>
              </button>
            </div>

            <div className="mt-2.5 flex justify-center">
              <button
                onClick={onManual}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-medium text-white/50 transition-colors active:text-white/80"
              >
                <PenLine className="h-[14px] w-[14px]" strokeWidth={2.2} />
                Adicionar manualmente
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <ReceiptViewer
        open={showReceipt}
        items={receiptItems}
        onClose={() => setShowReceipt(false)}
      />
    </>,
    document.body,
  );
}
