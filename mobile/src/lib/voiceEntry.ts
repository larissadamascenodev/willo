import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { createTransaction, deleteTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { allowedCategories, readEntry, todayISO } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { applyDefaults, answer as answerDraft, nextQuestion, statusFor } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import { useAuth } from "~/lib/auth";
import { MicrophoneDenied, useVoice } from "~/lib/voice";

/**
 * Say it, and have it noted — with one look before it is.
 *
 * Tap, speak, tap. The clip goes to the same reader the typed sentences go to, and
 * the reader answers with the entries and, alongside, what it heard; so there is
 * one round trip, not a transcription followed by a reading. What comes back is not
 * written. It is held for a look, because a misheard word becomes a wrong entry and
 * an entry is harder to notice than a sentence is — and while it is held, a word or
 * an amount can be corrected, and whatever the app genuinely cannot know is asked,
 * from the same rules the typed flow asks from.
 *
 * Writing needs a yes, with one exception: answering the last question is itself the
 * yes. Someone who has just said "débito" has seen what is about to be written and
 * has said what it was, and asking them to confirm it a second time is the one step
 * that makes speaking slower than typing.
 *
 * It ends itself. The recorder reports how loud it is; once something has been said
 * and then there has been a short silence, the clip is read without a second tap —
 * a tap still works, for a noisy room where silence never comes. Nothing counts
 * seconds at the person: it is not a voice memo.
 *
 * What was said might not be an entry at all. "Como estão minhas faturas?" has no
 * amount in it; where the caller asks to hear about that (`onQuestion`) it gets the
 * words, and the sphere on the home answers them.
 *
 * It is a hook rather than a screen so the two places that start it — the sphere on
 * the home and the sphere in Registro rápido — answer in the same way and show the
 * same sheet.
 */

export type VoiceState = "idle" | "listening" | "reading" | "confirm" | "saving" | "saved";

export interface VoiceLine {
  draft: QuickDraft;
  /** The row it became, so it can be taken back. */
  txId?: string;
  failed?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"];

/** How long it has to be quiet, after something was said, for the person to be done. */
const QUIET_MS = 1250;
/** How long it waits for a first word before deciding nobody is going to say one. */
const NOTHING_MS = 9000;
/** Never listen longer than this. */
const LONGEST_MS = 40_000;
/** A voice is this far above the quietest the room has been. */
const ABOVE_FLOOR = 13;

export function useVoiceEntry(options: { onQuestion?: (said: string) => void; history?: () => Record<string, string> } = {}) {
  const onQuestion = useRef(options.onQuestion);
  onQuestion.current = options.onQuestion;
  const history = useRef(options.history);
  history.current = options.history;
  /* Whether what is on the sheet was said or typed, for the sheet's own words. */
  const [source, setSource] = useState<"voice" | "text">("voice");
  const { user } = useAuth();
  const voice = useVoice();

  const [state, setState] = useState<VoiceState>("idle");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [setup, setSetup] = useState<QuickSetup>({ accounts: [], cards: [] });
  const [categories, setCategories] = useState<string[]>([]);

  /* What this person has, which decides what is worth asking. Fetched the first time
     it is needed, not when the screen opens. */
  const loading = useRef<Promise<{ setup: QuickSetup; categories: string[] }> | null>(null);
  const ensureSetup = useCallback(() => {
    loading.current ??= (async () => {
      const [accounts, cards, cats] = await Promise.all([
        getAccounts().catch(() => []),
        getCreditCards().catch(() => []),
        allowedCategories().catch(() => [] as string[]),
      ]);
      const usable = (accounts as { id: string; name: string; type?: string; is_default?: boolean }[]).filter((a) => a.type !== "investment");
      const next: QuickSetup = { accounts: usable, cards: (cards as unknown as { id: string; name: string }[]) ?? [] };
      setSetup(next);
      setCategories(cats);
      return { setup: next, categories: cats };
    })();
    return loading.current;
  }, []);

  const reset = useCallback(() => {
    answered.current = false;
    setState("idle");
    setLines([]);
    setTranscript(null);
    setMessage(null);
  }, []);

  /* ---- speaking ---- */

  const reading = useRef(false);
  const read = useCallback(async () => {
    /* Whatever ends the listening — a silence, a tap — ends it once. */
    if (reading.current) return;
    reading.current = true;
    setState("reading");
    setSource("voice");
    try {
      const clip = await voice.stop();
      if (!clip || clip.seconds < 1) {
        setMessage("Não peguei nada. Toque e fale um pouquinho mais.");
        setState("idle");
        return;
      }
      const ctx = await ensureSetup();
      const { entries, transcript: heard } = await readEntry({
        audio: { data: clip.data, mimeType: clip.mimeType },
        categories: ctx.categories,
      });
      setTranscript(heard?.trim() || null);

      /* Words with no money in them are a question for whoever is listening. */
      if (entries.length === 0 && heard?.trim() && heard.trim().length > 2 && onQuestion.current) {
        onQuestion.current(heard.trim());
        setState("idle");
        return;
      }

      if (entries.length === 0) {
        setMessage(
          heard?.trim()
            ? `Não achei um valor em “${heard.trim()}”. Tente algo como “mercado 30”.`
            : "Não consegui ouvir. Fale mais perto, num lugar mais quieto?",
        );
        setState("idle");
        return;
      }

      setLines(
        entries.map((e) => ({
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
            ctx.setup,
          ),
        })),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setState("confirm");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não consegui ouvir agora. Tente de novo.");
      setState("idle");
    } finally {
      reading.current = false;
    }
  }, [voice, ensureSetup]);

  /**
   * A typed sentence, through the same look before it is written. A plain one is read
   * on the phone; only what it cannot read goes to the AI reader. Words with no money in
   * them go to `otherwise` — a question.
   */
  const readText = useCallback(
    async (said: string, otherwise: () => void) => {
      if (state !== "idle" && state !== "saved") return;
      setMessage(null);
      setSource("text");
      setTranscript(said);
      setState("reading");
      try {
        const ctx = await ensureSetup();
        const local = parseLocal(said, { today: todayISO(), categories: ctx.categories, history: history.current?.() });
        const entries = local ?? (await readEntry({ text: said, categories: ctx.categories })).entries;
        if (entries.length === 0) {
          setState("idle");
          otherwise();
          return;
        }
        setLines(
          entries.map((e) => ({
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
              ctx.setup,
            ),
          })),
        );
        setState("confirm");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Não consegui ler agora. Tente de novo.");
        setState("idle");
      }
    },
    [state, ensureSetup],
  );

  /** Tap to start, tap to stop. */
  const toggle = useCallback(async () => {
    if (state === "listening") {
      await read();
      return;
    }
    if (state !== "idle") return;
    setMessage(null);
    void ensureSetup();
    try {
      await voice.start();
      setState("listening");
    } catch (err) {
      setMessage(
        err instanceof MicrophoneDenied
          ? "O microfone está bloqueado. Libere o Willo em Ajustes › Willo › Microfone."
          : "Não consegui acessar o microfone agora.",
      );
    }
  }, [state, read, voice, ensureSetup]);

  /* ---- knowing when they have stopped ---- */

  const calm = useRef({ floor: 0, seen: false, spoke: false, quietSince: 0, began: 0 });
  useEffect(() => {
    if (state === "listening") calm.current = { floor: 0, seen: false, spoke: false, quietSince: 0, began: Date.now() };
  }, [state]);

  useEffect(() => {
    if (state !== "listening") return;
    const c = calm.current;
    const now = Date.now();
    if (now - c.began > LONGEST_MS) {
      void read();
      return;
    }
    const level = voice.level;
    if (typeof level !== "number") return;

    /* The quietest the room has been is what a voice is measured against. */
    c.floor = c.seen ? Math.min(c.floor + 0.05, level) : level;
    c.seen = true;
    const loud = level > Math.max(-42, c.floor + ABOVE_FLOOR);

    if (loud) {
      c.spoke = true;
      c.quietSince = 0;
    } else if (c.spoke) {
      if (c.quietSince === 0) c.quietSince = now;
      else if (now - c.quietSince > QUIET_MS) void read();
    } else if (now - c.began > NOTHING_MS) {
      void voice.cancel();
      reset();
      setMessage("Não ouvi nada. Toque no orbe e fale de novo.");
    }
  }, [state, voice.level, voice, read, reset]);

  const cancel = useCallback(async () => {
    await voice.cancel();
    reset();
  }, [voice, reset]);

  /* ---- what is still missing ---- */

  const question: QuickQuestion | null = useMemo(
    () => (state === "confirm" ? nextQuestion(lines.map((l) => l.draft), setup) : null),
    [state, lines, setup],
  );

  /* Set when an answer is given, so that if it was the last one the entry goes in. */
  const answered = useRef(false);

  const answer = useCallback(
    (q: QuickQuestion, value: string) => {
      answered.current = true;
      setLines((ls) => ls.map((l) => (l.draft.id === q.draftId ? { ...l, draft: applyDefaults(answerDraft(l.draft, q, value), setup) } : l)));
    },
    [setup],
  );

  /** A word or an amount put right. */
  const edit = useCallback((draftId: string, patch: { name?: string; amount?: number }) => {
    setLines((ls) => ls.map((l) => (l.draft.id === draftId ? { ...l, draft: { ...l.draft, ...patch } } : l)));
  }, []);

  /** Categories worth offering by hand, for the type being asked about. */
  const categoryChips = useMemo(() => {
    if (question?.kind !== "category") return [];
    const line = lines.find((l) => l.draft.id === question.draftId);
    const income = line?.draft.type === "receita";
    return categories.filter((c) => INCOME_CATEGORIES.includes(c) === income).slice(0, 16);
  }, [question, lines, categories]);

  /* ---- writing ---- */

  const confirm = useCallback(async () => {
    if (!user || state !== "confirm" || question) return;
    setState("saving");
    setMessage(null);

    const done = await Promise.all(
      lines.map(async (line): Promise<VoiceLine> => {
        const d = line.draft;
        try {
          const created = (await createTransaction(
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
          )) as { id?: string } | null;
          return { draft: d, txId: created?.id };
        } catch {
          return { draft: d, failed: true };
        }
      }),
    );

    window.dispatchEvent(new CustomEvent("transaction-created"));
    const failed = done.filter((l) => l.failed);
    if (failed.length > 0) {
      /* What did land stays; what did not is left to try again. */
      setLines(failed.map((l) => ({ draft: l.draft })));
      setMessage(`Não consegui salvar ${failed.length === 1 ? `"${failed[0].draft.name}"` : `${failed.length} lançamentos`}. Tente de novo.`);
      setState("confirm");
      return;
    }
    setLines(done);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setState("saved");
  }, [user, state, question, lines]);

  /* The last question answered is the confirmation. */
  useEffect(() => {
    if (!answered.current || state !== "confirm" || question) return;
    answered.current = false;
    void confirm();
  }, [state, question, lines, confirm]);

  /** Takes what was just noted back out of the books. */
  const undo = useCallback(async () => {
    const ids = lines.map((l) => l.txId).filter((id): id is string => !!id);
    try {
      await Promise.all(ids.map((id) => deleteTransaction(id)));
      window.dispatchEvent(new CustomEvent("transaction-created"));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      reset();
      setMessage("Desfeito.");
    } catch {
      setMessage("Não consegui desfazer agora. Tente pela tela de Transações.");
    }
  }, [lines, reset]);

  /* The way out of a message, so it does not sit there. */
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  return {
    state,
    source,
    readText,
    seconds: voice.seconds,
    lines,
    transcript,
    message,
    setup,
    question,
    categoryChips,
    toggle,
    cancel,
    answer,
    edit,
    confirm,
    undo,
    reset,
  };
}

export type VoiceEntry = ReturnType<typeof useVoiceEntry>;
