import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, LinearTransition, withTiming } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { categoryHex } from "@/lib/categoryData";
import { createTransaction, deleteTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion, statusFor } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import Room from "~/components/Room";
import SwipeHome from "~/components/SwipeHome";
import Glass from "~/components/Glass";
import Notinha, { type NotinhaLine } from "~/components/registro/Notinha";
import Confirmado from "~/components/registro/Confirmado";
import ParticleOrb, { type OrbMode } from "~/components/registro/ParticleOrb";
import { ArrowUp, Camera, ChevronLeft, Clock, Mic, PenLine, SlidersHorizontal, Sparkles, X } from "~/components/icons";
import ReceiptCard, { type ReceiptLine } from "~/components/registro/ReceiptCard";
import { commentAfter } from "~/lib/afterEntry";
import WilloSettings from "~/components/willo/WilloSettings";
import ChatHistory from "~/components/willo/ChatHistory";
import RadarPanel from "~/components/willo/RadarPanel";
import ListeningDock from "~/components/willo/ListeningDock";
import GreetingLine from "~/components/willo/GreetingLine";
import { firstName } from "~/lib/greeting";
import SegmentedTabs from "~/components/SegmentedTabs";
import { useRaioX, type RaioXData } from "@/hooks/useRaioX";
import { boardAnswer, buildBoard, radarForAssistant, type BoardLine } from "~/lib/radarBoard";
import { saveChat, type ChatItem, type SavedChat } from "~/lib/willoChats";
import { voiced } from "~/lib/voiceTone";
import { face } from "~/lib/chatFont";
import { parseCommand, runCommand } from "~/lib/chatCommands";
import { followUps, frequentAsks, mergeAsks, noteAsked } from "~/lib/shortcuts";
import { continuePlan, startPlan, type GoalPlan, type PlanTurn } from "~/lib/goalPlanner";
import { createGoal } from "@/services/goalService";
import { splitReply, typingMs } from "~/lib/chatText";
import ChatBubble from "~/components/willo/ChatBubble";
import AgentMark from "~/components/willo/AgentMark";
import { AGENTS } from "~/lib/agents";
import { useWilloPrefs } from "~/lib/willoPrefs";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { useVoiceEntry } from "~/lib/voiceEntry";
import { useTapOrDouble } from "~/lib/doubleTap";
import { useAssistantSnapshot } from "@/hooks/useAssistantSnapshot";
import { askWilloFull, converseAsking, tidyReply, type Turn } from "~/lib/assistantAsk";
import { useProfile } from "@/hooks/useProfile";
import { localAnswer } from "~/lib/localAnswers";
import AnswerCardView, { type AnswerCard, type Simulation } from "~/components/willo/AnswerCards";
import { cardsFor, workingOn } from "~/lib/answerCards";
import { useFinanceData } from "@/hooks/useFinanceData";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { loadActiveInstallments } from "@/services/activeInstallments";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import VoiceEntrySheet from "~/components/registro/VoiceEntrySheet";
import { GREEN, INK } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";
/**
 * Willo: talk to him, or tell him what you spent, in the same place.
 *
 * One screen where there used to be two that looked alike. What is said either has
 * money in it — "uber 18", "recebi 200 de freela" — and is filed, as it always was; or
 * it does not, and is a question for the assistant, which answers in the thread from
 * the same snapshot of the person's money the web's assistant page uses. Nobody has to
 * say which they mean.
 *
 * Registro rápido: say what you spent, in one sentence, and have it filed.
 *
 * Read through the same reader and asked through the same rules as the web. It
 * opens on Willo himself — a sphere of particles that idles, listens and spins as
 * he works — and the three ways in, with the person's own frequent entries as
 * one-tap shortcuts: "Uber 18" again is a tap, not a sentence. Once something has
 * been said the screen becomes the conversation, each batch landing on its own
 * receipt, saved once nothing is missing and undoable from the receipt itself.
 *
 * The sphere is the microphone. Drag it and it turns; tap it and it swells and
 * listens; tap it again and what was said is read, and a sheet comes up to confirm
 * before anything is written — see lib/voiceEntry. Writing and the camera stay in
 * the bar below, and the person's own frequent entries sit under the sphere as
 * shortcuts: "Uber 18" again is a tap.
 */

type Item =
  | { kind: "msg"; id: string; role: "bot" | "user"; text: string; agents?: string[]; instant?: boolean }
  | { kind: "batch"; id: string }
  | { kind: "done"; id: string; text: string; total?: number; income?: boolean }
  | { kind: "card"; id: string; card: AnswerCard }
  | { kind: "receipt"; id: string; line: ReceiptLine; when: Date };

interface Line {
  batchId: string;
  draft: QuickDraft;
  saved: boolean;
  saving: boolean;
  error: boolean;
  /** The row it became, so it can be taken back. */
  txId?: string;
  undone?: boolean;
}

interface Shortcut {
  key: string;
  name: string;
  amount: number;
  category: string;
  type: "despesa" | "receita";
  text: string;
}

/** The sphere's size once a conversation is under it. */
const COMPACT_ORB = 118;

/** The sphere arrives from where it was: larger and lower, settling small and high. */
const shrinkIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0.5, transform: [{ translateY: 140 }, { scale: 2.2 }] },
    animations: {
      opacity: withTiming(1, { duration: 420 }),
      transform: [{ translateY: withTiming(0, { duration: 620 }) }, { scale: withTiming(1, { duration: 620 }) }],
    },
  };
};

/** The room under the sphere for what it is saying. */
const CAPTION_H = 100;

const uid = () => Math.random().toString(36).slice(2, 10);
const isHisMessage = (item?: Item) => item?.kind === "msg" && item.role === "bot";

/** Examples that between them show the range: one thing, several, income, card, a past day. */
const EXAMPLES: { text: string; category: string }[] = [
  { text: "café 12", category: "Cafeteria" },
  { text: "uber 18 e farmácia 40", category: "Transporte" },
  { text: "mercado 90 no crédito", category: "Supermercado" },
  { text: "almoço 35 ontem", category: "Alimentação" },
  { text: "recebi 200 de freela", category: "Freelance" },
  { text: "luz 180, água 60", category: "Conta de Luz" },
];

/** Things worth asking, one or two for each part of the app. */
const QUESTIONS = [
  "Quanto posso gastar até o fim do mês?",
  "Quanto está minha fatura?",
  "Quando terminam meus parcelamentos?",
  "Onde estou gastando mais este mês?",
  "Posso comprar algo de R$ 500?",
  "Por que minha fatura aumentou?",
  "Tenho algum gasto fora do padrão?",
  "Quais assinaturas eu pago?",
  "Qual o melhor plano para minha renda?",
  "Quanto tenho de limite no cartão?",
];

const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"];

const spoken = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

const tapSaved = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
const tapAsked = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

export default function Registro() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  /* What is said with no money in it is a question, whether it was typed or spoken. */
  const askRef = useRef<(said: string) => void>(() => {});
  const historyRef = useRef<Record<string, string>>({});
  const planning = useRef(false);
  const entry = useVoiceEntry({ onQuestion: (said) => askRef.current(said), history: () => historyRef.current, onlyConversation: () => planning.current });
  const { build, loading: snapshotLoading } = useAssistantSnapshot();
  /* Always the latest: a question can be waiting for the numbers while they arrive, and the
     build it started with would still see them empty, and say so as a fact. */
  const buildRef = useRef(build);
  buildRef.current = build;
  const turns = useRef<Turn[]>([]);
  const snapshotReady = useRef(true);
  snapshotReady.current = !snapshotLoading;
  const { width } = useWindowDimensions();
  const [stageH, setStageH] = useState(0);
  const listening = entry.state === "listening";
  const reading = entry.state === "reading";

  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [setup, setSetup] = useState<QuickSetup>({ accounts: [], cards: [] });
  const [categories, setCategories] = useState<string[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState<string | null>(null);
  const { view: openOn } = useLocalSearchParams<{ view?: string }>();
  /* Only the conversation lives here now; an old link to the Radar tab goes to the Radar's page. */
  const [view, setView] = useState<"chat" | "radar">("chat");
  useEffect(() => {
    if (openOn === "radar") router.replace("/radar" as never);
  }, [openOn, router]);
  const [atSphere, setAtSphere] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* The Radar, read once the screen has settled: what the Radar tab shows and what Willo already knows. */
  const [radar, setRadar] = useState<RaioXData | null>(null);
  const [radarOn, setRadarOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRadarOn(true), 700);
    return () => clearTimeout(t);
  }, []);
  /* Each opening is a new conversation; the earlier ones stay in the history. */
  const chatId = useRef(uid());
  const { profile } = useProfile();
  /* Replies already typed out stay typed, whatever redraws the thread. */
  const typedRef = useRef<Set<string>>(new Set());
  const { data: monthData } = useFinanceData(new Date().getMonth(), new Date().getFullYear(), { includeHistorical: false });
  const [question, setQuestion] = useState<QuickQuestion | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const prefs = useWilloPrefs();

  const askedRef = useRef<Set<string>>(new Set());
  const savingRef = useRef<Set<string>>(new Set());
  const savedCountRef = useRef(0);
  const threadRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const written = useRef(new Map<string, () => void>());
  /* From a question arriving to the last of its answer being down. Shortcuts wait for it, and
     anything said meanwhile is answered next, so answers never overlap. */
  const [answering, setAnswering] = useState(false);
  const answeringRef = useRef(false);
  const waitingAsks = useRef<string[]>([]);
  const converseRef = useRef<(said: string) => void>(() => {});
  const [lastAsked, setLastAsked] = useState<string | null>(null);
  /* A goal being planned step by step: while it lasts, what is said answers it. */
  const [goalPlan, setGoalPlan] = useState<GoalPlan | null>(null);
  const planRef = useRef<GoalPlan | null>(null);
  const setPlan = useCallback((next: GoalPlan | null) => {
    planRef.current = next;
    planning.current = next !== null;
    setGoalPlan(next);
  }, []);
  /* His reply in short messages, each written out before the next begins; done when the last is. */
  const pushBot = useCallback(async (t: string, extra?: { agents?: string[]; instant?: boolean }) => {
    const chat = chatId.current;
    /* A negative figure stays whole when the line breaks. */
    for (const part of splitReply(t.replace(/-R\$[\s\u00A0]?/g, "\u2212R$\u00A0"))) {
      if (chatId.current !== chat) return;
      const id = uid();
      setItems((m) => [...m, { kind: "msg", id, role: "bot", text: part, ...extra }]);
      /* The next one starts only when this one has really finished, with a time limit in case
         it is off the screen and never does. */
      await new Promise<void>((r) => {
        written.current.set(id, r);
        setTimeout(r, typingMs(part) * 2 + 2000);
      });
      await new Promise((r) => setTimeout(r, 180));
    }
  }, []);
  const installmentsRef = useRef<ActiveInstallmentItem[] | null>(null);
  const pushUser = useCallback((t: string) => setItems((m) => [...m, { kind: "msg", id: uid(), role: "user", text: t }]), []);

  /* ---- what this person has, which decides what is worth asking — and offering ---- */

  useEffect(() => {
    getAccounts()
      .then((accounts) => {
        const usable = (accounts as { id: string; name: string; type?: string; is_default?: boolean }[]).filter(
          (a) => a.type !== "investment",
        );
        setSetup((s) => ({ ...s, accounts: usable }));
      })
      .catch(() => undefined);
    getCreditCards()
      .then((cards) => setSetup((s) => ({ ...s, cards: (cards as unknown as { id: string; name: string }[]) ?? [] })))
      .catch(() => undefined);
    allowedCategories().then(setCategories).catch(() => setCategories([]));
    if (user)
      loadActiveInstallments(user.id)
        .then((a) => (installmentsRef.current = a.items))
        .catch(() => undefined);

    /* The person's own frequent entries: the same thing, again, in one tap. */
    getRecentTransactions(80)
      .then((rows) => {
        const by = new Map<string, Shortcut & { count: number }>();
        for (const r of rows as { name: string; category: string }[]) {
          if (r.name && r.category && r.category !== "Outros") historyRef.current[r.name] ??= r.category;
        }
        for (const r of rows as {
          name: string;
          amount: number;
          category: string;
          type: string;
          recurrence_type?: string | null;
          installments?: number | null;
        }[]) {
          if (r.type !== "despesa" && r.type !== "receita") continue;
          if (r.recurrence_type === "fixa" || (r.installments ?? 0) > 1) continue;
          const key = r.name.trim().toLowerCase();
          if (!key) continue;
          const seen = by.get(key);
          if (seen) {
            seen.count += 1;
            continue;
          }
          const amount = Number(r.amount);
          const type = r.type as "despesa" | "receita";
          by.set(key, {
            key,
            name: r.name,
            amount,
            category: r.category,
            type,
            count: 1,
            text: type === "receita" ? `recebi ${spoken(amount)} de ${r.name}` : `${r.name} ${spoken(amount)}`,
          });
        }
        setShortcuts([...by.values()].sort((a, b) => b.count - a.count).slice(0, 8));
      })
      .catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    void entry.cancel();
    router.back();
  }, [router, entry]);
  const goHome = useCallback(() => {
    void entry.cancel();
    router.navigate("/" as never);
  }, [router, entry]);

  /* ---- writing ---- */

  const save = useCallback(
    async (toSave: Line[]) => {
      if (!user) {
        pushBot("Entre na sua conta para eu poder salvar.");
        return;
      }
      for (const line of toSave) savingRef.current.add(line.draft.id);
      setLines((ls) => ls.map((l) => (savingRef.current.has(l.draft.id) && !l.saved ? { ...l, saving: true } : l)));

      /* In parallel: things said together land together. */
      await Promise.all(
        toSave.map(async (line) => {
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
            setLines((ls) =>
              ls.map((l) => (l.draft.id === d.id ? { ...l, saved: true, saving: false, txId: created?.id } : l)),
            );
          } catch {
            setLines((ls) => ls.map((l) => (l.draft.id === d.id ? { ...l, error: true, saving: false } : l)));
            pushBot(`Não consegui salvar "${d.name}".`);
          }
        }),
      );

      window.dispatchEvent(new CustomEvent("transaction-created"));
    },
    [user, pushBot],
  );

  /** Takes a whole receipt back out of the books. */
  const undo = useCallback(
    async (batchId: string) => {
      const own = lines.filter((l) => l.batchId === batchId && l.saved && !l.undone && l.txId);
      if (own.length === 0) return;
      try {
        await Promise.all(own.map((l) => deleteTransaction(l.txId!)));
        setLines((ls) => ls.map((l) => (own.some((o) => o.draft.id === l.draft.id) ? { ...l, undone: true } : l)));
        window.dispatchEvent(new CustomEvent("transaction-created"));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        pushBot(own.length > 1 ? "Desfeito. Tirei os lançamentos dessa notinha." : "Desfeito. Tirei esse lançamento.");
      } catch {
        pushBot("Não consegui desfazer agora. Tenta pela tela de Transações?");
      }
    },
    [lines, pushBot],
  );

  /* One tap of the hand per thing filed. */
  useEffect(() => {
    const count = lines.filter((l) => l.saved).length;
    if (count > savedCountRef.current) tapSaved();
    savedCountRef.current = count;
  }, [lines]);

  /* ---- the question loop: everything still outstanding comes from one place ---- */

  useEffect(() => {
    const unsaved = lines.filter((l) => !l.saved && !l.error);

    if (unsaved.length === 0) {
      setQuestion(null);
      const batches = [...new Set(lines.map((l) => l.batchId))];
      for (const b of batches) {
        const own = lines.filter((l) => l.batchId === b);
        const key = `done:${b}`;
        if (own.length > 0 && own.every((l) => l.saved) && !askedRef.current.has(key)) {
          askedRef.current.add(key);
          const income = own.every((l) => l.draft.type === "receita");
          setItems((m) => [
            ...m,
            {
              kind: "done",
              id: uid(),
              text: income ? "Recebido" : "Anotado",
              total: own.reduce((s, l) => s + l.draft.amount, 0),
              income,
            },
          ]);
        }
      }
      return;
    }

    const q = nextQuestion(
      unsaved.map((l) => l.draft),
      setup,
    );
    if (q) {
      setQuestion(q);
      const key = `${q.draftId}:${q.kind}`;
      if (!askedRef.current.has(key)) {
        askedRef.current.add(key);
        pushBot(q.prompt);
        tapAsked();
      }
      return;
    }

    setQuestion(null);
    const toSave = unsaved.filter((l) => !savingRef.current.has(l.draft.id));
    if (toSave.length > 0) void save(toSave);
  }, [lines, setup, pushBot, save]);

  /* ---- reading what was said ---- */

  const board = useMemo(() => (radar && !snapshotLoading ? buildBoard(radar, build() as never) : []), [radar, snapshotLoading, build]);

  /** The picture that goes with an answer, for once the words have been written out. */
  const showCards = useCallback(
    async (said: string, simulation: Simulation | null = null) => {
      const cards = await cardsFor(said, { snapshot: buildRef.current() as never, categories: monthData.categories ?? [], installments: installmentsRef.current, simulation });
      if (cards.length) setItems((m) => [...m, ...cards.map((card) => ({ kind: "card" as const, id: uid(), card }))]);
    },
    [monthData],
  );

  /** A line of the Radar, said and answered from its own numbers. */
  const answerLine = useCallback(
    async (line: BoardLine) => {
      const reply = voiced(line.answer, line.mood);
      turns.current.push({ role: "assistant", content: reply });
      await pushBot(reply);
      await showCards(line.ask);
    },
    [pushBot, showCards],
  );

  /** Puts the thread so far to the assistant and writes what it answers. */
  const converse = useCallback(
    async (said: string) => {
      if (answeringRef.current) {
        waitingAsks.current.push(said);
        return;
      }
      answeringRef.current = true;
      setAnswering(true);
      setLastAsked(said);
      if (user) noteAsked(user.id, said);
      try {
      turns.current.push({ role: "user", content: said });
      /* A goal being planned, or the start of one: step by step, with no AI. */
      const room = radar?.report.projection.avgNet ?? null;
      const turn: PlanTurn | null = planRef.current ? continuePlan(planRef.current, said, room) : startPlan(said, room);
      if (turn) {
        const plan = planRef.current;
        setPlan(turn.plan);
        if (turn.create && plan && user) {
          setThinking("Criando a caixinha");
          try {
            const goal = await createGoal({ name: plan.name, target_amount: plan.amount, monthly_contribution: plan.perMonth, deadline: plan.deadline }, user.id);
            window.dispatchEvent(new CustomEvent("finance-data-changed"));
            setThinking(null);
            const reply = voiced(`Pronto! Criei a caixinha “${plan.name}”, com ${money(plan.perMonth)} por mês. Ela já está nas suas Caixinhas.`, "good");
            turns.current.push({ role: "assistant", content: reply });
            await pushBot(reply);
            setItems((m) => [...m, { kind: "card", id: uid(), card: { type: "metas", items: [goal] } }]);
          } catch {
            setThinking(null);
            await pushBot("Não consegui criar a caixinha agora. Tenta de novo?");
          }
          return;
        }
        turns.current.push({ role: "assistant", content: turn.reply });
        await pushBot(turn.reply);
        return;
      }
      /* Anything else ends a plan under way. */
      if (planRef.current) setPlan(null);
      /* An order is carried out, with no AI: "cria um limite de 300 para farmácia". */
      const command = parseCommand(said, categories);
      if (command && user) {
        setThinking("Fazendo");
        try {
          const reply = await runCommand(command, user.id);
          turns.current.push({ role: "assistant", content: reply });
          setThinking(null);
          await pushBot(reply);
        } catch {
          setThinking(null);
          await pushBot("Não consegui fazer isso agora. Tenta de novo?");
        }
        return;
      }
      /* What the numbers alone can answer is answered at once, with no AI. */
      const onBoard = boardAnswer(said, board);
      if (onBoard) {
        await answerLine(onBoard);
        return;
      }
      setThinking(workingOn(said));
      try {
        /* The numbers take a moment the first time. Better a short wait than zeros taken for
           the truth; past that, he goes without them and looks up what he needs. */
        for (let n = 0; n < 12 && !snapshotReady.current; n++) await new Promise((r) => setTimeout(r, 250));
        const ready = snapshotReady.current;
        const local = ready ? localAnswer(said, buildRef.current() as never, installmentsRef.current) : null;
        if (local) {
          const reply = voiced(local.text, local.mood);
          turns.current.push({ role: "assistant", content: reply });
          setThinking(null);
          await pushBot(reply);
          await showCards(said);
          return;
        }
        const sent = turns.current.slice(-8).map((t, i, all) => (i === all.length - 1 ? { ...t, content: converseAsking(t.content) } : t));
        const snapshot = ready ? { ...(buildRef.current() as object), ...(radar ? { radar: radarForAssistant(radar) } : {}) } : null;
        const { reply: raw, simulation } = await askWilloFull(sent, snapshot, profile?.display_name ?? null);
        const reply = tidyReply(raw);
        turns.current.push({ role: "assistant", content: reply });
        setThinking(null);
        await pushBot(reply);
        /* A picture only beside an answer about the person's money: "receita de bolo" is not about income. */
        if (simulation || /R\$/.test(reply)) await showCards(said, simulation);
      } catch (err) {
        pushBot(err instanceof Error ? err.message : "Não consegui falar com o Willo agora. Tenta de novo?");
      } finally {
        setThinking(null);
      }
      } finally {
        answeringRef.current = false;
        setAnswering(false);
        const next = waitingAsks.current.shift();
        if (next) converseRef.current(next);
      }
    },
    [pushBot, showCards, answerLine, board, radar, profile, categories, user, setPlan],
  );
  converseRef.current = (said) => void converse(said);

  /* What to offer: what carries on from the last question, what this person asks most, the rest. */
  const asks = useMemo(
    () => mergeAsks(lastAsked ? followUps(lastAsked) : [], user ? frequentAsks(user.id) : [], QUESTIONS).filter((a) => a !== lastAsked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastAsked, answering, user],
  );
  const carryOn = useMemo(() => (lastAsked ? followUps(lastAsked) : []), [lastAsked]);

  /* The conversation is kept as it goes, so leaving at any point loses nothing. */
  useEffect(() => {
    if (!user || !items.some((i) => (i.kind === "msg" && i.role === "user") || i.kind === "receipt")) return;
    const kept: ChatItem[] = [];
    for (const i of items) {
      if (i.kind === "msg") kept.push({ kind: "msg", id: i.id, role: i.role, text: i.text });
      else if (i.kind === "done" || i.kind === "card") kept.push(i);
      else if (i.kind === "receipt") kept.push({ ...i, when: i.when.toISOString() });
    }
    saveChat(user.id, { id: chatId.current, items: kept });
  }, [items, user]);

  const newChat = useCallback(() => {
    chatId.current = uid();
    turns.current = [];
    setPlan(null);
    setItems([]);
    setText("");
    setAtSphere(false);
    setView("chat");
    setHistoryOpen(false);
  }, [setPlan]);

  const openChat = useCallback((chat: SavedChat) => {
    chatId.current = chat.id;
    turns.current = chat.items.flatMap((i) => (i.kind === "msg" ? [{ role: i.role === "bot" ? ("assistant" as const) : ("user" as const), content: i.text }] : []));
    for (const i of chat.items) typedRef.current.add(i.id);
    setItems(chat.items.map((i) => (i.kind === "receipt" ? { ...i, when: new Date(i.when) } : i)));
    setAtSphere(false);
    setView("chat");
    setHistoryOpen(false);
  }, []);

  /* A spoken question lands in the thread like a typed one. */
  askRef.current = (said) => {
    pushUser(said);
    void converse(said);
  };

  const { ask, say } = useLocalSearchParams<{ ask?: string; say?: string }>();
  /* Something touched on the home that he takes up himself: he speaks first. */
  const saidFromHome = useRef(false);
  useEffect(() => {
    if (!say || saidFromHome.current) return;
    saidFromHome.current = true;
    void pushBot(say);
  }, [say, pushBot]);

  /* A question put to him from the home: the conversation opens with it already asked. */
  const askedFromHome = useRef(false);
  useEffect(() => {
    if (!ask || askedFromHome.current || (categories.length === 0 && snapshotLoading)) return;
    askedFromHome.current = true;
    pushUser(ask);
    void converse(ask);
  }, [ask, categories, snapshotLoading, pushUser, converse]);

  /* A question from the Radar: over to the conversation, with it asked. */
  const askFromRadar = useCallback(
    (asked: string) => {
      setView("chat");
      setAtSphere(false);
      pushUser(asked);
      void converseRef.current(asked);
    },
    [pushUser],
  );

  /* Tapped on the Radar: over to the conversation, already answered. */
  const askFromBoard = useCallback(
    (line: BoardLine) => {
      setView("chat");
      setAtSphere(false);
      pushUser(line.ask);
      if (answeringRef.current) {
        waitingAsks.current.push(line.ask);
        return;
      }
      void converseRef.current(line.ask);
    },
    [pushUser],
  );

  const ingest = useCallback(
    async (said: string) => {
      setThinking("Anotando");
      try {
        /* A plain sentence is read on the phone; only what it cannot read goes to the AI reader. */
        const local = parseLocal(said, { today: todayISO(), categories, history: historyRef.current });
        const { entries } = local ? { entries: local } : await readEntry({ text: said, categories });
        if (entries.length === 0) {
          setThinking(null);
          await converse(said);
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
    },
    [categories, setup, pushBot, converse],
  );

  /* ---- answering ---- */

  const applyAnswer = useCallback(
    (q: QuickQuestion, value: string) => {
      setLines((ls) =>
        ls.map((l) => (l.draft.id === q.draftId ? { ...l, draft: applyDefaults(answerDraft(l.draft, q, value), setup) } : l)),
      );
    },
    [setup],
  );

  /** A typed answer to "em que você gastou?" goes back through the reader, because
      people answer "no mercado" or "foi um lanche", not with a category name. */
  const answerCategory = useCallback(
    async (q: QuickQuestion, said: string) => {
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
    },
    [lines, categories, applyAnswer, pushBot, pushUser],
  );

  /* ---- sending ---- */

  const send = useCallback(
    (said: string) => {
      if (!said || thinking || answering) return;
      Keyboard.dismiss();
      pushUser(said);
      /* Mid-plan, "15 mil" answers the plan: it is not an expense. */
      if (planRef.current) {
        void converse(said);
        return;
      }
      /* An entry opens the same sheet a spoken one does; anything else is a question. */
      void entry.readText(said, () => void converse(said));
    },
    [thinking, answering, entry, converse, pushUser],
  );

  /* Written from the sheet: once it closes, the receipt lands in the conversation and he
     says what he makes of it. */
  const justSaved = useRef<{ line: ReceiptLine; when: Date } | null>(null);
  useEffect(() => {
    const saved = justSaved.current;
    if (entry.state !== "idle" || !saved) return;
    justSaved.current = null;
    setItems((m) => [...m, { kind: "receipt", id: uid(), line: saved.line, when: saved.when }]);
    const { name, category, amount, type, installments, day, repeat, scheduled } = saved.line;
    void commentAfter({ name, category, amount, type, installments, day: day ?? saved.when.toISOString().slice(0, 10), repeat: repeat ?? "unica", scheduled }, radar?.forecast.endBalance).then((said) => pushBot(said));
  }, [entry.state, pushBot, radar]);

  /* What was written lands in the thread as a line from him once it is in. */
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (entry.state !== "saved" || entry.lines.length === 0) return;
    const key = entry.lines.map((l) => l.txId ?? l.draft.id).join(",");
    if (lastSaved.current === key) return;
    lastSaved.current = key;
    const what = entry.lines.map((l) => `${l.draft.name}, ${money(l.draft.amount)}`).join("; ");
    pushBot(entry.lines.length > 1 ? `Anotei: ${what}.` : `Anotado: ${what}.`);
  }, [entry.state, entry.lines, pushBot]);

  const submitText = useCallback(() => {
    const said = text.trim();
    if (!said || thinking || answering) return;
    setText("");
    send(said);
  }, [text, thinking, answering, send]);

  /* ---- what each receipt shows ---- */

  const linesOf = useCallback(
    (batchId: string): NotinhaLine[] =>
      lines
        .filter((l) => l.batchId === batchId)
        .map((l) => ({
          id: l.draft.id,
          name: l.draft.name,
          sub: l.draft.category ?? "",
          amount: l.draft.amount,
          type: l.draft.type,
          status: l.undone
            ? "undone"
            : l.error
              ? "error"
              : l.saved
                ? "saved"
                : l.saving
                  ? "saving"
                  : question?.draftId === l.draft.id
                    ? "asking"
                    : "reading",
        })),
    [lines, question],
  );

  /** Categories worth offering by hand, for the type being asked about. */
  const categoryChips = useMemo(() => {
    if (question?.kind !== "category") return [];
    const line = lines.find((l) => l.draft.id === question.draftId);
    const typed = text.trim().toLowerCase();
    const isIncome = line?.draft.type === "receita";
    const pool = categories.filter((c) => INCOME_CATEGORIES.includes(c) === isIncome);
    return (typed ? pool.filter((c) => c.toLowerCase().includes(typed)) : pool).slice(0, 14);
  }, [question, lines, categories, text]);

  /* One tap listens; two open Registro rápido. */
  const tapOrDouble = useTapOrDouble(() => void entry.toggle(), () => router.push("/rapido" as never));
  const orbTap = () => (entry.state === "idle" ? tapOrDouble() : void entry.toggle());
  const started = items.length > 0;
  const lastBotId = [...items].reverse().find((i) => i.kind === "msg" && i.role === "bot")?.id ?? null;
  const hasEntries = lines.length > 0;
  const allSaved = hasEntries && lines.every((l) => l.saved);
  const optionChips = question && question.kind !== "category" ? question.options : [];
  const busy = thinking !== null;
  const typed = text.trim().length > 0;
  const mode: OrbMode = listening ? "listening" : busy || reading ? "thinking" : "idle";
  /* As large as the stage can spare: what is left once the words under the sphere
     have their room, and the swell has its own — across as well as down, since
     swollen it is a sixth wider than it is drawn. Measured, not guessed — the sphere
     was laid out against a height it did not have, and everything overlapped. */
  const orb = stageH > 0 ? Math.max(120, Math.min(width * 0.8, 320, stageH - CAPTION_H - 12 - 32)) : 250;
  /* The full stage is the welcome, and he stays on it while the first words are typed.
     Once there is a conversation the thread takes over. */
  useEffect(() => {
    setAtSphere(false);
  }, [items.length]);
  const stage = !started || (atSphere && !keyboardUp);

  return (
    <Room lit sky>
      {/* Pulled from the right edge, back to the start. */}
      <SwipeHome from="right" onLeave={goHome}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── The way out, which Willo you are looking at, and the conversations ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          {view === "chat" && !stage ? (
            <HeaderButton
              label="Voltar para a esfera"
              onPress={() => {
                Keyboard.dismiss();
                setAtSphere(true);
              }}
            >
              <ChevronLeft size={18} color={th("rgba(255,255,255,0.88)")} strokeWidth={2.4} />
            </HeaderButton>
          ) : (
            <HeaderButton label={hasEntries ? "Concluir" : "Fechar"} onPress={close}>
              <X size={17} color={th("rgba(255,255,255,0.88)")} strokeWidth={2.4} />
            </HeaderButton>
          )}
          <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            {/* The conversation stands alone: the Radar has a page of its own, reached from the home. */}
          </View>
          <HeaderButton label="Conversas anteriores" onPress={() => setHistoryOpen(true)}>
            <Clock size={16} color={th("rgba(255,255,255,0.88)")} strokeWidth={2.2} />
          </HeaderButton>
          <HeaderButton label="Personalizar o Willo" onPress={() => setSettingsOpen(true)}>
            <SlidersHorizontal size={16} color={th("rgba(255,255,255,0.88)")} strokeWidth={2.2} />
          </HeaderButton>
        </View>

        {/* ── The stage: the Radar, the sphere, or — once something has been said — the conversation ── */}
        {view === "radar" ? (
          <RadarPanel data={radar} snapshot={buildRef.current() as never} categories={categories} bottom={insets.bottom} onAsk={askFromRadar} />
        ) : stage ? (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }} onLayout={(e) => setStageH(e.nativeEvent.layout.height)}>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <ParticleOrb size={orb} mode={mode} expanded={listening} loudness={entry.loudness} onPress={orbTap} />

                {/* What the sphere is saying, in the same place whichever it is. */}
                <View style={{ marginTop: 12, height: CAPTION_H, alignSelf: "stretch", alignItems: "center" }}>
                  {listening ? (
                    /* Swollen, the sphere reaches further down: the words keep clear of it. */
                    <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: "center", marginTop: orb * 0.09 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Estou ouvindo…</Text>
                      <Pressable onPress={() => void entry.cancel()} hitSlop={10} style={({ pressed }) => ({ marginTop: 4, paddingVertical: 4, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: th("rgba(255,255,255,0.7)") }}>Cancelar</Text>
                      </Pressable>
                    </Animated.View>
                  ) : reading ? (
                    <Animated.View entering={FadeIn.duration(240)}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Entendendo…</Text>
                    </Animated.View>
                  ) : (
                    <>
                      <GreetingLine name={firstName(profile?.display_name)} readings={board.filter((l) => l.level === "alerta" || l.level === "atencao").slice(0, 1).map((l) => ({ title: "Vi uma coisa no Radar.", sub: l.title, ask: l.ask }))}
                        onPick={(line) => {
                          if (line.ask) {
                            pushUser(line.ask);
                            void converse(line.ask);
                          } else void pushBot(line.say ?? line.title);
                        }}
                      />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                        <Mic size={12} color={th(INK.softer)} strokeWidth={2.2} />
                        <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>Toque nele para falar</Text>
                      </View>
                      {entry.message ? (
                        <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12, color: th("#F9CE4E"), textAlign: "center" }}>
                          {entry.message}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>

              </View>
            </View>

            {/* Back to where the conversation was */}
            {started && !listening && !reading && (
              <Pressable onPress={() => setAtSphere(false)} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", marginBottom: 12, paddingVertical: 6, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: th("rgba(255,255,255,0.75)") }}>Voltar à conversa</Text>
              </Pressable>
            )}

            {/* ── What to ask him ── */}
            {!listening && !reading && (
              <Animated.View entering={FadeInDown.delay(100).duration(380)} style={{ paddingBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 22 }}>
                  <Sparkles size={12} color={th("#B9B0FF")} />
                  <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", color: th(INK.soft) }}>Pergunte</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}
                >
                  {asks.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => {
                        pushUser(q);
                        void converse(q);
                      }}
                      style={({ pressed }) => ({
                        height: 38,
                        justifyContent: "center",
                        paddingHorizontal: 14,
                        borderRadius: 19,
                        borderWidth: 1,
                        borderColor: th("rgba(185,176,255,0.28)", "line"),
                        backgroundColor: th("rgba(185,176,255,0.08)", "bg"),
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>{q}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

          </View>
        ) : (
          <View style={{ flex: 1 }}>
          <ScrollView
            ref={threadRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item, at) =>
              item.kind === "done" ? (
                <View key={item.id} style={{ paddingVertical: 4 }}>
                  <Confirmado text={item.text} total={item.total} income={item.income} />
                </View>
              ) : item.kind === "receipt" ? (
                <View key={item.id} style={{ paddingVertical: 8 }}>
                  <ReceiptCard sound={false} lines={[item.line]} when={item.when} />
                </View>
              ) : item.kind === "card" ? (
                <AnswerCardView key={item.id} card={item.card} />
              ) : item.kind === "msg" ? (
                <ChatBubble
                  key={item.id}
                  role={item.role}
                  text={item.text}
                  named={!isHisMessage(items[at - 1])}
                  avatar={item.id === lastBotId && !busy && !listening && !reading}
                  instant={typedRef.current.has(item.id)}
                  onDone={() => {
                    typedRef.current.add(item.id);
                    written.current.get(item.id)?.();
                    written.current.delete(item.id);
                  }}
                />
              ) : (
                <View key={item.id} style={{ paddingVertical: 6 }}>
                  <Notinha lines={linesOf(item.id)} onUndo={() => void undo(item.id)} />
                </View>
              ),
            )}

            {busy && (
              <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ParticleOrb size={30} mode="thinking" />
                <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>{thinking}…</Text>
              </Animated.View>
            )}
          </ScrollView>
          </View>
        )}

        {/* ── The composer ── */}
        {view === "chat" && (
        <View style={{ paddingTop: 8, paddingBottom: insets.bottom + 8 }}>
          {!stage && entry.message ? (
            <Text style={{ marginHorizontal: 24, marginBottom: 8, fontSize: 12.5, lineHeight: 17, color: th("#F9CE4E"), textAlign: "center" }}>{entry.message}</Text>
          ) : null}
          {!stage && !listening && !reading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 10 }}
            >
              {optionChips.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  tone="answer"
                  onPress={() => {
                    if (!question) return;
                    pushUser(o.label);
                    applyAnswer(question, o.id);
                  }}
                />
              ))}
              {categoryChips.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  tone="category"
                  category={c}
                  onPress={() => {
                    if (!question) return;
                    setText("");
                    pushUser(c);
                    applyAnswer(question, c);
                  }}
                />
              ))}
              {goalPlan?.stage === "confirm" &&
                !answering &&
                ["Sim, criar a caixinha", "Agora não"].map((o, n) => (
                  <Chip
                    key={o}
                    label={o}
                    tone={n === 0 ? "next" : "shortcut"}
                    onPress={() => {
                      pushUser(o);
                      void converse(n === 0 ? "sim" : "nao");
                    }}
                  />
                ))}
              {!question &&
                !text &&
                !answering &&
                !goalPlan &&
                asks.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    tone={carryOn.includes(q) ? "next" : "shortcut"}
                    onPress={() => {
                      pushUser(q);
                      void converse(q);
                    }}
                  />
                ))}
            </ScrollView>
          )}

          <View style={{ paddingHorizontal: 16 }}>
            <Glass
              radius={28}
              style={{
                height: 56,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 6,
                gap: 4,
                borderWidth: 1,
                borderColor: th(typed ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)", "line"),
              }}
            >
              <Pressable
                onPress={() => (listening ? void entry.cancel() : router.replace("/scanner" as never))}
                accessibilityLabel={listening ? "Cancelar" : "Foto do comprovante"}
                hitSlop={4}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: th(pressed ? "rgba(255,255,255,0.08)" : "transparent", "bg"),
                })}
              >
                {listening ? <X size={20} color={th("rgba(255,255,255,0.78)")} strokeWidth={2} /> : <Camera size={20} color={th("rgba(255,255,255,0.78)")} strokeWidth={2} />}
              </Pressable>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={submitText}
                placeholder={listening ? "Ouvindo…" : reading ? "Entendendo…" : question ? "sua resposta…" : "converse ou anote um gasto"}
                placeholderTextColor={th(INK.faint)}
                editable={!listening}
                returnKeyType="send"
                submitBehavior="submit"
                style={{ flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 4, fontSize: 16, color: th("#fff") }}
              />
              {/* Only once there is something to send: the microphone is the sphere. */}
              {typed ? (
                <SendButton disabled={busy || reading || answering} onPress={submitText} />
              ) : !stage ? (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    void entry.toggle();
                  }}
                  accessibilityLabel={listening ? "Parar" : "Falar"}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: th(listening ? "#fff" : "rgba(255,255,255,0.10)", "bg"),
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  })}
                >
                  <Mic size={19} color={th(listening ? "#0B0B0B" : "#fff")} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </Glass>
          </View>

          {!listening && !reading && (
            <Pressable
              onPress={() => router.push("/manual" as never)}
              style={({ pressed }) => ({
                alignSelf: "center",
                marginTop: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PenLine size={13} color={th(INK.softer)} strokeWidth={2.2} />
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: th(INK.softer) }}>Adicionar manualmente</Text>
            </Pressable>
          )}
        </View>
        )}
        {/* Over the field while he listens, as the phone's own assistant comes up. */}
        {view === "chat" && !stage && (listening || reading) && <ListeningDock reading={reading} bottom={insets.bottom} loudness={entry.loudness} onStop={() => void entry.toggle()} />}
      </KeyboardAvoidingView>
      </SwipeHome>

      {/* What was heard, for a look before it is written. */}
      <VoiceEntrySheet
        entry={entry}
        onSaved={(line, when) => {
          justSaved.current = { line, when };
        }}
      />
      <WilloSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ChatHistory open={historyOpen} userId={user?.id ?? null} currentId={chatId.current} onClose={() => setHistoryOpen(false)} onOpen={openChat} onNew={newChat} />
      {radarOn && <RadarFeed onData={setRadar} />}
    </Room>
  );
}

/** One shortcut: the category's mark, the thing, and — for one of the person's own — the amount. Small, in a row. */
function ShortcutChip({
  label,
  note,
  category,
  income,
  onPress,
}: {
  label: string;
  note?: string;
  category: string;
  income?: boolean;
  onPress: () => void;
}) {
  const Icon = categoryIcon(category);
  const hex = categoryHex(category);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 38,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 5,
        paddingRight: 13,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.09)", "line"),
        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(hex), "bg") }}>
        <Icon size={14} color={th(chipInk(hex))} strokeWidth={2} />
      </View>
      <Text numberOfLines={1} style={{ maxWidth: 130, fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>
        {label}
      </Text>
      {note ? (
        <Text style={{ fontSize: 12.5, color: th(income ? GREEN : INK.soft) }}>
          {income ? "+" : ""}
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Chip({
  label,
  tone,
  category,
  onPress,
}: {
  label: string;
  tone: "answer" | "category" | "shortcut" | "next";
  category?: string;
  onPress: () => void;
}) {
  const Icon = category ? categoryIcon(category) : null;
  const hex = category ? categoryHex(category) : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: Icon ? 10 : 14,
        paddingRight: 14,
        height: 34,
        borderRadius: 999,
        borderWidth: tone === "answer" ? 0 : 1,
        borderColor: th(tone === "next" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.09)", "line"),
        backgroundColor: th(tone === "answer" ? GREEN : tone === "next" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)", "bg"),
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {Icon && hex && <Icon size={13} color={th(chipInk(hex))} strokeWidth={2} />}
      <Text style={{ fontSize: 13, fontWeight: tone === "answer" ? "700" : tone === "next" ? "600" : "500", color: th(tone === "answer" ? "#0B0B0B" : tone === "next" ? "#fff" : "rgba(255,255,255,0.86)") }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Sends what is written. */
function SendButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(160)}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel="Enviar"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: th("#fff", "bg"),
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <ArrowUp size={20} color={th("#0B0B0B")} strokeWidth={2.8} />
      </Pressable>
    </Animated.View>
  );
}

/** One round button of the header. */
function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Glass radius={17} interactive style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
        {children}
      </Glass>
    </Pressable>
  );
}

/** Reads the Radar and hands it up, drawing nothing: mounted a moment after the screen opens. */
function RadarFeed({ onData }: { onData: (data: RaioXData) => void }) {
  const data = useRaioX();
  useEffect(() => {
    if (!data.loading) onData(data);
  }, [data, onData]);
  return null;
}
