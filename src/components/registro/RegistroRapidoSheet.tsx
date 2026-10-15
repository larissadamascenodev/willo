import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Camera, History, Mic, PenLine, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { chimeAsk, chimeSaved } from "@/lib/chime";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion, statusFor } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import type { ReceiptItem } from "@/lib/receiptImage";
import Notinha, { type NotinhaLine } from "./Notinha";
import ReceiptViewer from "./ReceiptViewer";
import HistoricoPanel from "./HistoricoPanel";
import BotMark from "./BotMark";
import Confirmado from "./Confirmado";

/**
 * Registro rápido: say what you spent, in one sentence, and have it filed.
 *
 * It replaces the scanner as the first thing the add button does, because the camera
 * only ever answered one question — "I have a receipt in my hand" — and most spending
 * never produces one. The camera is still here, and so is the full form.
 *
 * The screen is a conversation with receipts in it. Each thing said produces its own
 * receipt, in place, so a lone Uber is a receipt for an Uber and five things dictated
 * together are one receipt for the five: what gets totalled is what was said together,
 * which is the only grouping the person actually made.
 *
 * Anything the app cannot work out it asks about — but only what it genuinely cannot
 * know, which is why the questions come from resolve.ts and not from the model.
 */

type Item =
  | { kind: "msg"; id: string; role: "bot" | "user"; text: string }
  | { kind: "batch"; id: string }
  | { kind: "done"; id: string; text: string };

interface Line {
  batchId: string;
  draft: QuickDraft;
  saved: boolean;
  saving: boolean;
  error: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Examples that between them show the range: one thing, several, income, card, a past day. */
const CHIPS = [
  "café 12",
  "uber 18",
  "mercado 90 no crédito",
  "almoço 35 ontem",
  "uber 18 e farmácia 40",
  "recebi 200 de freela",
  "luz 180, água 60",
];

const INCOME_CATEGORIES = [
  "Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada",
];

/** How the money moved, in the words the receipt should carry. */
function methodLabel(draft: QuickDraft, setup: QuickSetup): string | undefined {
  if (draft.paymentMethod === "cartao") {
    const card = setup.cards.find((c) => c.id === draft.creditCardId);
    return card ? `Crédito · ${card.name}` : "Crédito";
  }
  if (draft.paymentMethod === "conta") {
    const account = setup.accounts.find((a) => a.id === draft.accountId);
    return account ? `Débito · ${account.name}` : "Débito";
  }
  return undefined;
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

  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [setup, setSetup] = useState<QuickSetup>({ accounts: [], cards: [] });
  const [categories, setCategories] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuickQuestion | null>(null);
  const [receiptBatch, setReceiptBatch] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const askedRef = useRef<Set<string>>(new Set());
  const savingRef = useRef<Set<string>>(new Set());
  const savedCountRef = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  const pushBot = useCallback((t: string) => setItems((m) => [...m, { kind: "msg", id: uid(), role: "bot", text: t }]), []);
  const pushUser = useCallback((t: string) => setItems((m) => [...m, { kind: "msg", id: uid(), role: "user", text: t }]), []);

  /* ---- opening and closing ------------------------------------------------ */

  useEffect(() => {
    if (!open) return;
    setItems([
      { kind: "msg", id: uid(), role: "bot", text: "Me conta o que entrou ou saiu." },
      { kind: "msg", id: uid(), role: "bot", text: "Pode ser tudo de uma vez — escrevendo, falando ou fotografando." },
    ]);
    setLines([]);
    setText("");
    setQuestion(null);
    setReceiptBatch(null);
    setShowHistory(false);
    askedRef.current = new Set();
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
  }, [items, lines, thinking, open]);

  const handleClose = useCallback(() => {
    recorder.cancel();
    onClose();
  }, [onClose, recorder]);

  /* ---- writing ------------------------------------------------------------ */

  const save = useCallback(async (toSave: Line[]) => {
    if (!user) return;
    for (const line of toSave) savingRef.current.add(line.draft.id);
    setLines((ls) => ls.map((l) => (savingRef.current.has(l.draft.id) && !l.saved ? { ...l, saving: true } : l)));

    // In parallel: three things dictated together should land together, not one after
    // another while the person watches a row at a time flip over.
    await Promise.all(toSave.map(async (line) => {
      const d = line.draft;
      try {
        await createTransaction(
          {
            name: d.name,
            type: d.type,
            amount: d.amount,
            category: d.category ?? "Outros",
            date: d.date,
            status: d.status,
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
    }));

    window.dispatchEvent(new CustomEvent("transaction-created"));
  }, [user]);

  /** One sound per thing filed, fired off the state that actually changed. */
  useEffect(() => {
    const saved = lines.filter((l) => l.saved).length;
    if (saved > savedCountRef.current) chimeSaved();
    savedCountRef.current = saved;
  }, [lines]);

  /* ---- the question loop --------------------------------------------------
     Everything still outstanding comes from one place, so the thread and the receipts
     cannot disagree about what is missing. */

  useEffect(() => {
    if (!open) return;
    const unsaved = lines.filter((l) => !l.saved && !l.error);

    if (unsaved.length === 0) {
      setQuestion(null);
      // One "done" per batch, not one for the session.
      const batches = [...new Set(lines.map((l) => l.batchId))];
      for (const b of batches) {
        const own = lines.filter((l) => l.batchId === b);
        const key = `done:${b}`;
        if (own.length > 0 && own.every((l) => l.saved) && !askedRef.current.has(key)) {
          askedRef.current.add(key);
          setItems((m) => [...m, {
            kind: "done",
            id: uid(),
            text: own.length > 1 ? `${own.length} lançamentos anotados` : "Anotado",
          }]);
        }
      }
      return;
    }

    const q = nextQuestion(unsaved.map((l) => l.draft), setup);
    if (q) {
      setQuestion(q);
      const key = `${q.draftId}:${q.kind}`;
      if (!askedRef.current.has(key)) {
        askedRef.current.add(key);
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

  /** Reads a sentence. Speech reaches here too, but only after it has been read back
      to the person and sent by them, so there is one way in from here down. */
  const ingest = useCallback(async (said: string) => {
    setThinking("Anotando");
    try {
      const { entries } = await readEntry({ text: said, categories });

      if (entries.length === 0) {
        pushBot("Não achei nenhum valor aí. Tenta algo como “mercado 30” ou “recebi 200 de freela”.");
        return;
      }

      const batchId = uid();
      const fresh: Line[] = entries.map((e) => ({
        batchId,
        draft: applyDefaults(
          {
            id: uid(),
            name: e.name,
            type: e.type,
            amount: e.amount,
            category: e.category,
            date: e.date || todayISO(),
            status: statusFor(e.settled, e.date || todayISO(), todayISO()),
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
      setItems((m) => [...m, { kind: "batch", id: batchId }]);
      setLines((ls) => [...ls, ...fresh]);
    } catch (err) {
      pushBot(err instanceof Error ? err.message : "Não consegui ler agora. Tenta de novo?");
    } finally {
      setThinking(null);
    }
  }, [categories, setup, pushBot]);

  /* ---- answering ---------------------------------------------------------- */

  const applyAnswer = useCallback((q: QuickQuestion, value: string) => {
    setLines((ls) => ls.map((l) =>
      l.draft.id === q.draftId
        ? { ...l, draft: applyDefaults(answerDraft(l.draft, q, value), setup) }
        : l,
    ));
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
    ingest(said);
  }, [text, thinking, question, answerCategory, ingest, pushUser]);

  /**
   * What was heard goes into the box, not into the books.
   *
   * A misheard word becomes a wrong entry, and an entry is harder to notice and undo
   * than a sentence is to correct before sending. So speaking fills the field and
   * stops there: read it, fix the word, send it.
   */
  const toggleRecording = useCallback(async () => {
    if (recorder.recording) {
      const audio = await recorder.stop();
      if (!audio || audio.seconds < 1) {
        pushBot("Não peguei nada. Segura um pouquinho mais?");
        return;
      }
      setThinking("Ouvindo");
      try {
        const { transcript } = await readEntry({
          audio: { data: audio.data, mimeType: audio.mimeType },
          categories,
        });
        if (!transcript?.trim()) {
          pushBot("Não consegui ouvir. Fala mais perto, num lugar mais quieto?");
          return;
        }
        setText(transcript.trim());
        inputRef.current?.focus();
      } catch {
        pushBot("Não consegui ouvir agora. Tenta de novo?");
      } finally {
        setThinking(null);
      }
      return;
    }
    try {
      await recorder.start();
    } catch (err) {
      const denied = err instanceof DOMException
        && (err.name === "NotAllowedError" || err.name === "SecurityError");
      toast.error(denied
        ? "O microfone está bloqueado. Libere o Willo nas configurações do aparelho."
        : "Não consegui acessar o microfone agora.");
    }
  }, [recorder, categories, pushBot]);

  /* ---- what each receipt shows -------------------------------------------- */

  const linesOf = useCallback((batchId: string): NotinhaLine[] =>
    lines.filter((l) => l.batchId === batchId).map((l) => ({
      id: l.draft.id,
      name: l.draft.name,
      sub: l.draft.category ?? "",
      amount: l.draft.amount,
      type: l.draft.type,
      status: l.error ? "error" : l.saved ? "saved" : l.saving ? "saving"
        : question?.draftId === l.draft.id ? "asking" : "reading",
    })), [lines, question]);

  const receiptItems: ReceiptItem[] = useMemo(() => {
    if (!receiptBatch) return [];
    return lines
      .filter((l) => l.batchId === receiptBatch && l.saved)
      .map((l) => ({
        name: l.draft.name,
        category: l.draft.category ?? "Outros",
        amount: l.draft.amount,
        type: l.draft.type,
        method: methodLabel(l.draft, setup),
      }));
  }, [receiptBatch, lines, setup]);

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

  const chipBase = "shrink-0 rounded-full px-3.5 py-[7px] text-[13px] transition-transform active:scale-95";

  return createPortal(
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.975 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.985 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
          className="willo-aurora fixed inset-0 z-[120] flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Registro rápido"
        >
          {/* Header — the title leads, the controls sit off to the side. */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2.5"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <BotMark working={busy} size={34} />
              <div className="min-w-0">
                <h2 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-white">Registro rápido</h2>
                <p className="text-[12px] leading-tight text-white/40">
                  {busy ? "Trabalhando…" : allSaved ? "Tudo anotado" : hasEntries ? "Quase lá" : "Uma frase basta"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowHistory(true)}
                aria-label="Histórico"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/75 ring-1 ring-white/10 active:scale-95"
              >
                <History className="h-[17px] w-[17px]" strokeWidth={2.2} />
              </button>
              <button
                onClick={handleClose}
                aria-label={hasEntries ? "Concluir" : "Fechar"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/85 ring-1 ring-white/10 active:scale-95"
              >
                <X className="h-[17px] w-[17px]" strokeWidth={2.4} />
              </button>
            </div>
          </motion.div>

          {/* Thread */}
          <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto px-5 pb-4 pt-1">
            {items.map((item) => item.kind === "done" ? (
              <div key={item.id} className="py-1"><Confirmado text={item.text} /></div>
            ) : item.kind === "msg" ? (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={item.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <p className={item.role === "user"
                  ? "willo-bubble-me max-w-[84%] rounded-[19px] rounded-br-[7px] px-3.5 py-2.5 text-[15px] font-medium leading-snug tracking-[-0.01em]"
                  : "max-w-[84%] rounded-[19px] rounded-bl-[7px] border border-white/[0.09] bg-white/[0.06] px-3.5 py-2.5 text-[15px] leading-snug text-white/92"}
                >
                  {item.text}
                </p>
              </motion.div>
            ) : (
              <div key={item.id} className="py-1.5">
                <Notinha
                  lines={linesOf(item.id)}
                  onOpen={() => setReceiptBatch(item.id)}
                />
              </div>
            ))}

            <AnimatePresence>
              {busy && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2"
                >
                  <BotMark working size={26} />
                  <span className="flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.06] px-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="block h-[5px] w-[5px] rounded-full bg-willo-green"
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }}
                        transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Composer */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 border-t border-white/[0.07] bg-black/30 px-4 pt-2.5 backdrop-blur-xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
          >
            {/* Chips: what is being asked for, the categories to choose from, or —
                with nothing pending — examples of what one sentence can carry. */}
            <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {optionChips.map((o) => (
                <button
                  key={o.id}
                  onClick={() => question && answerWithOption(question, o)}
                  className={`${chipBase} bg-willo-green font-bold text-[#0B0B0B]`}
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
                  className={`${chipBase} border border-white/[0.10] bg-white/[0.06] font-medium text-white/85`}
                >
                  {c}
                </button>
              ))}
              {!question && !text && CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setText(c); inputRef.current?.focus(); }}
                  className={`${chipBase} border border-white/[0.08] bg-white/[0.035] text-white/55`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Writing in the middle, the camera and the microphone on either side, and
                the full form tucked into the same row rather than claiming one of
                its own. */}
            <div className="flex items-center gap-2">
              <button
                onClick={onPhoto}
                aria-label="Foto do comprovante"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06] text-white/75 active:scale-95"
              >
                <Camera className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </button>

              <div className={`flex h-11 min-w-0 flex-1 items-center rounded-full border bg-white/[0.05] transition-colors ${
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
                  className="h-full w-full rounded-full bg-transparent px-3.5 text-[15px] text-white placeholder:text-white/32 focus:outline-none disabled:opacity-70"
                />
              </div>

              <button
                onClick={text.trim() ? submitText : toggleRecording}
                disabled={busy || (!text.trim() && !recorder.supported)}
                aria-label={text.trim() ? "Enviar" : recorder.recording ? "Parar gravação" : "Gravar"}
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 ${
                  recorder.recording ? "bg-[#F87171]"
                    : text.trim() ? "bg-willo-green"
                    : "border border-white/[0.10] bg-white/[0.06]"
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
                  {text.trim() ? <ArrowUp className="h-[19px] w-[19px] text-[#0B0B0B]" strokeWidth={2.8} />
                    : recorder.recording ? <Square className="h-[14px] w-[14px] fill-white text-white" />
                    : <Mic className="h-[18px] w-[18px] text-white/75" strokeWidth={2.1} />}
                </span>
              </button>
            </div>

            <button
              onClick={onManual}
              className="mx-auto mt-1.5 flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium text-white/45 active:text-white/80"
            >
              <PenLine className="h-[13px] w-[13px]" strokeWidth={2.2} />
              Adicionar manualmente
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <ReceiptViewer
        open={receiptBatch !== null && receiptItems.length > 0}
        items={receiptItems}
        onClose={() => setReceiptBatch(null)}
      />

      <HistoricoPanel open={showHistory} onClose={() => setShowHistory(false)} />
    </>,
    document.body,
  );
}
