import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { categoryHex } from "@/lib/categoryData";
import { createTransaction, deleteTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion, statusFor } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import Notinha, { type NotinhaLine } from "~/components/registro/Notinha";
import Confirmado from "~/components/registro/Confirmado";
import ParticleOrb, { type OrbMode } from "~/components/registro/ParticleOrb";
import { ArrowUp, Camera, Mic, PenLine, Sparkles, X, Zap } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { useVoiceEntry } from "~/lib/voiceEntry";
import VoiceEntrySheet from "~/components/registro/VoiceEntrySheet";
import { GREEN, INK } from "~/theme/tokens";

/**
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
  | { kind: "msg"; id: string; role: "bot" | "user"; text: string }
  | { kind: "batch"; id: string }
  | { kind: "done"; id: string; text: string };

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

/** The room under the sphere for what it is saying. */
const CAPTION_H = 84;

const uid = () => Math.random().toString(36).slice(2, 10);

/** Examples that between them show the range: one thing, several, income, card, a past day. */
const EXAMPLES: { text: string; category: string }[] = [
  { text: "café 12", category: "Cafeteria" },
  { text: "uber 18 e farmácia 40", category: "Transporte" },
  { text: "mercado 90 no crédito", category: "Supermercado" },
  { text: "almoço 35 ontem", category: "Alimentação" },
  { text: "recebi 200 de freela", category: "Freelance" },
  { text: "luz 180, água 60", category: "Conta de Luz" },
];

const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"];

const spoken = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

const tapSaved = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
const tapAsked = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

export default function Registro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const entry = useVoiceEntry();
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
  const [question, setQuestion] = useState<QuickQuestion | null>(null);

  const askedRef = useRef<Set<string>>(new Set());
  const savingRef = useRef<Set<string>>(new Set());
  const savedCountRef = useRef(0);
  const threadRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const pushBot = useCallback((t: string) => setItems((m) => [...m, { kind: "msg", id: uid(), role: "bot", text: t }]), []);
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

    /* The person's own frequent entries: the same thing, again, in one tap. */
    getRecentTransactions(80)
      .then((rows) => {
        const by = new Map<string, Shortcut & { count: number }>();
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
          setItems((m) => [...m, { kind: "done", id: uid(), text: own.length > 1 ? `${own.length} lançamentos anotados` : "Anotado" }]);
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

  const ingest = useCallback(
    async (said: string) => {
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
    },
    [categories, setup, pushBot],
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
      if (!said || thinking) return;
      if (question?.kind === "category") {
        void answerCategory(question, said);
        return;
      }
      pushUser(said);
      void ingest(said);
    },
    [thinking, question, answerCategory, ingest, pushUser],
  );

  const submitText = useCallback(() => {
    const said = text.trim();
    if (!said || thinking) return;
    setText("");
    send(said);
  }, [text, thinking, send]);

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

  const started = items.length > 0;
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
  const orb = stageH > 0 ? Math.max(190, Math.min(width * 0.8, 320, stageH - CAPTION_H - 18 - 56)) : 250;
  const stage = listening || reading || !started;

  return (
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Willo, and the way out ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            {started && !listening && !reading ? (
              <Animated.View entering={FadeIn.duration(320)}>
                <ParticleOrb size={44} mode={mode} onPress={() => void entry.toggle()} />
              </Animated.View>
            ) : (
              <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                <Zap size={18} color={GREEN} />
              </View>
            )}
            <View style={{ minWidth: 0 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>Registro rápido</Text>
              <Text style={{ fontSize: 12, color: INK.softer }}>
                {listening
                  ? "Ouvindo…"
                  : reading
                    ? "Anotando…"
                  : busy
                    ? `${thinking}…`
                    : allSaved
                      ? "Tudo anotado"
                      : hasEntries
                        ? "Quase lá"
                        : "Toque no orbe e fale"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={close}
            accessibilityLabel={hasEntries ? "Concluir" : "Fechar"}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Glass radius={18} interactive style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <X size={17} color="rgba(255,255,255,0.88)" strokeWidth={2.4} />
            </Glass>
          </Pressable>
        </View>

        {/* ── The stage: the sphere, or — once something has been said — the conversation ── */}
        {stage ? (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }} onLayout={(e) => setStageH(e.nativeEvent.layout.height)}>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                <ParticleOrb size={orb} mode={mode} expanded={listening} onPress={() => void entry.toggle()} />

                {/* What the sphere is saying, in the same place whichever it is. */}
                <View style={{ marginTop: 18, height: CAPTION_H, alignSelf: "stretch", alignItems: "center" }}>
                  {listening ? (
                    <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Estou ouvindo…</Text>
                      <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft, textAlign: "center" }}>Pode falar. Eu paro quando você parar.</Text>
                      <Pressable onPress={() => void entry.cancel()} hitSlop={10} style={({ pressed }) => ({ marginTop: 6, paddingVertical: 5, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
                      </Pressable>
                    </Animated.View>
                  ) : reading ? (
                    <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Anotando…</Text>
                      <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft }}>Só um instante.</Text>
                    </Animated.View>
                  ) : (
                    <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <Mic size={16} color={GREEN} strokeWidth={2.3} />
                        <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Toque para falar</Text>
                      </View>
                      <Text numberOfLines={2} style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, color: entry.message ? "#F9CE4E" : INK.soft, textAlign: "center" }}>
                        {entry.message ?? "Diga o que gastou ou recebeu."}
                      </Text>
                    </Animated.View>
                  )}
                </View>
              </View>
            </View>

            {/* ── The person's own shortcuts — or, before there are any, what a sentence can carry ── */}
            {!listening && !reading && (
              <Animated.View entering={FadeInDown.delay(160).duration(380)} style={{ paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 22 }}>
                  {shortcuts.length > 0 ? <Zap size={12} color={GREEN} /> : <Sparkles size={12} color={GREEN} />}
                  <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", color: INK.soft }}>
                    {shortcuts.length > 0 ? "Seus atalhos" : "Experimente"}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}
                >
                  {shortcuts.length > 0
                    ? shortcuts.slice(0, 8).map((sc) => (
                        <ShortcutChip key={sc.key} label={sc.name} note={money(sc.amount)} category={sc.category} income={sc.type === "receita"} onPress={() => send(sc.text)} />
                      ))
                    : EXAMPLES.map((e) => (
                        <ShortcutChip
                          key={e.text}
                          label={e.text}
                          category={e.category}
                          onPress={() => {
                            setText(e.text);
                            inputRef.current?.focus();
                          }}
                        />
                      ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        ) : (
          <ScrollView
            ref={threadRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) =>
              item.kind === "done" ? (
                <View key={item.id} style={{ paddingVertical: 4 }}>
                  <Confirmado text={item.text} />
                </View>
              ) : item.kind === "msg" ? (
                <Bubble key={item.id} role={item.role} text={item.text} />
              ) : (
                <View key={item.id} style={{ paddingVertical: 6 }}>
                  <Notinha lines={linesOf(item.id)} onUndo={() => void undo(item.id)} />
                </View>
              ),
            )}

            {busy && (
              <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ParticleOrb size={30} mode="thinking" />
                <Text style={{ fontSize: 13.5, color: INK.soft }}>{thinking}…</Text>
              </Animated.View>
            )}
          </ScrollView>
        )}

        {/* ── The composer ── */}
        <View style={{ paddingTop: 8, paddingBottom: insets.bottom + 8 }}>
          {started && !listening && (
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
              {!question &&
                !text &&
                (shortcuts.length > 0
                  ? shortcuts.map((s) => (
                      <Chip key={s.key} label={`${s.name} · ${money(s.amount)}`} tone="shortcut" category={s.category} onPress={() => send(s.text)} />
                    ))
                  : EXAMPLES.map((e) => (
                      <Chip
                        key={e.text}
                        label={e.text}
                        tone="shortcut"
                        category={e.category}
                        onPress={() => {
                          setText(e.text);
                          inputRef.current?.focus();
                        }}
                      />
                    )))}
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
                borderColor: typed ? "rgba(200,243,109,0.45)" : "rgba(255,255,255,0.10)",
              }}
            >
              <Pressable
                onPress={() => router.replace("/scanner" as never)}
                accessibilityLabel="Foto do comprovante"
                hitSlop={4}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "transparent",
                })}
              >
                <Camera size={20} color="rgba(255,255,255,0.78)" strokeWidth={2} />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={submitText}
                placeholder={question ? "sua resposta…" : "o que rolou?"}
                placeholderTextColor={INK.faint}
                editable={!listening}
                returnKeyType="send"
                submitBehavior="submit"
                style={{ flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 4, fontSize: 16, color: "#fff" }}
              />
              {/* Only once there is something to send: the microphone is the sphere. */}
              {typed && <SendButton disabled={busy || reading} onPress={submitText} />}
            </Glass>
          </View>

          {!listening && !reading && (
            <Pressable
              onPress={() => router.replace("/novo" as never)}
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
              <PenLine size={13} color={INK.softer} strokeWidth={2.2} />
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: INK.softer }}>Adicionar manualmente</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* What was heard, for a look before it is written. */}
      <VoiceEntrySheet entry={entry} />
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
        borderColor: "rgba(255,255,255,0.09)",
        backgroundColor: "rgba(255,255,255,0.05)",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={14} color={chipInk(hex)} strokeWidth={2} />
      </View>
      <Text numberOfLines={1} style={{ maxWidth: 130, fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
        {label}
      </Text>
      {note ? (
        <Text style={{ fontSize: 12.5, color: income ? GREEN : INK.soft }}>
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
  tone: "answer" | "category" | "shortcut";
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
        borderColor: "rgba(255,255,255,0.09)",
        backgroundColor: tone === "answer" ? GREEN : "rgba(255,255,255,0.05)",
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {Icon && hex && <Icon size={13} color={chipInk(hex)} strokeWidth={2} />}
      <Text style={{ fontSize: 13, fontWeight: tone === "answer" ? "700" : "500", color: tone === "answer" ? "#0B0B0B" : "rgba(255,255,255,0.86)" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Bubble({ role, text }: { role: "bot" | "user"; text: string }) {
  const mine = role === "user";
  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      layout={LinearTransition.duration(200)}
      style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" }}
    >
      <View
        style={{
          maxWidth: "84%",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderCurve: "continuous",
          ...(mine
            ? { borderBottomRightRadius: 7, backgroundColor: GREEN }
            : {
                borderBottomLeftRadius: 7,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
                backgroundColor: "rgba(255,255,255,0.06)",
              }),
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: mine ? "500" : "400", color: mine ? "#0B0B0B" : "rgba(255,255,255,0.92)" }}>
          {text}
        </Text>
      </View>
    </Animated.View>
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
          backgroundColor: GREEN,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <ArrowUp size={20} color="#0B0B0B" strokeWidth={2.8} />
      </Pressable>
    </Animated.View>
  );
}
