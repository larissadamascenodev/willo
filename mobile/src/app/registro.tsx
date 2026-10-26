import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { allowedCategories, categoriseAnswer, readEntry, todayISO } from "@/services/quickEntry";
import { applyDefaults, answer as answerDraft, nextQuestion, statusFor } from "@/lib/quickEntry/resolve";
import type { QuickDraft, QuickQuestion, QuickSetup } from "@/lib/quickEntry/types";
import Room from "~/components/Room";
import BotMark from "~/components/BotMark";
import Notinha, { type NotinhaLine } from "~/components/registro/Notinha";
import Confirmado from "~/components/registro/Confirmado";
import { ArrowUp, Camera, Mic, PenLine, Square, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { MicrophoneDenied, useVoice } from "~/lib/voice";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Registro rápido: say what you spent, in one sentence, and have it filed.
 *
 * The phone's copy of the web's sheet, reading through the same reader and asking
 * through the same rules. The screen is a conversation with receipts in it: each
 * thing said produces its own receipt, in place, so a lone Uber is a receipt for an
 * Uber and five things dictated together are one receipt for the five.
 *
 * Anything the app cannot work out it asks about — but only what it genuinely
 * cannot know, which is why the questions come from resolve.ts and not from the
 * model. Speaking fills the box rather than the books: read it, fix the word, send.
 * The camera hands over to the receipt reader, and the full form is a tap below.
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

const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Aluguéis", "Bônus", "Comissão", "Mesada"];

const saved = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
const asked = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

export default function Registro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const voice = useVoice();

  const [items, setItems] = useState<Item[]>(() => [
    { kind: "msg", id: uid(), role: "bot", text: "Me conta o que entrou ou saiu." },
    { kind: "msg", id: uid(), role: "bot", text: "Pode ser tudo de uma vez — escrevendo, falando ou fotografando." },
  ]);
  const [lines, setLines] = useState<Line[]>([]);
  const [setup, setSetup] = useState<QuickSetup>({ accounts: [], cards: [] });
  const [categories, setCategories] = useState<string[]>([]);
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

  /* ---- what this person has, which decides what is worth asking ---- */

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
  }, []);

  const close = useCallback(() => {
    void voice.cancel();
    router.back();
  }, [router, voice]);

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
            pushBot(`Não consegui salvar "${d.name}".`);
          }
        }),
      );

      window.dispatchEvent(new CustomEvent("transaction-created"));
    },
    [user, pushBot],
  );

  /* One tap of the hand per thing filed. */
  useEffect(() => {
    const count = lines.filter((l) => l.saved).length;
    if (count > savedCountRef.current) saved();
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
        asked();
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

  const submitText = useCallback(() => {
    const said = text.trim();
    if (!said || thinking) return;
    setText("");
    if (question?.kind === "category") {
      void answerCategory(question, said);
      return;
    }
    pushUser(said);
    void ingest(said);
  }, [text, thinking, question, answerCategory, ingest, pushUser]);

  /** What was heard goes into the box, not into the books. */
  const toggleRecording = useCallback(async () => {
    if (voice.recording) {
      try {
        const clip = await voice.stop();
        if (!clip || clip.seconds < 1) {
          pushBot("Não peguei nada. Segura um pouquinho mais?");
          return;
        }
        setThinking("Ouvindo");
        const { transcript } = await readEntry({ audio: { data: clip.data, mimeType: clip.mimeType }, categories });
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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      await voice.start();
    } catch (err) {
      pushBot(
        err instanceof MicrophoneDenied
          ? "O microfone está bloqueado. Libere o Willo em Ajustes › Willo › Microfone."
          : "Não consegui acessar o microfone agora.",
      );
    }
  }, [voice, categories, pushBot]);

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
          status: l.error
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

  const hasEntries = lines.length > 0;
  const allSaved = hasEntries && lines.every((l) => l.saved);
  const optionChips = question && question.kind !== "category" ? question.options : [];
  const busy = thinking !== null;
  const typed = text.trim().length > 0;

  return (
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Title, and the way out ── */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(300)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: insets.top + 10,
            paddingHorizontal: 20,
            paddingBottom: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <BotMark size={34} />
            <View style={{ minWidth: 0 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>Registro rápido</Text>
              <Text style={{ fontSize: 12, color: INK.softer }}>
                {busy ? "Trabalhando…" : allSaved ? "Tudo anotado" : hasEntries ? "Quase lá" : "Uma frase basta"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={close}
            accessibilityLabel={hasEntries ? "Concluir" : "Fechar"}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.08)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={17} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
          </Pressable>
        </Animated.View>

        {/* ── The conversation ── */}
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
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(280)}
                style={{ flexDirection: "row", justifyContent: item.role === "user" ? "flex-end" : "flex-start" }}
              >
                <Text
                  style={[
                    {
                      maxWidth: "84%",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 19,
                      overflow: "hidden",
                      fontSize: 15,
                      lineHeight: 20,
                    },
                    item.role === "user"
                      ? { borderBottomRightRadius: 7, backgroundColor: GREEN, color: "#0B0B0B", fontWeight: "500" }
                      : {
                          borderBottomLeftRadius: 7,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.09)",
                          backgroundColor: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.92)",
                        },
                  ]}
                >
                  {item.text}
                </Text>
              </Animated.View>
            ) : (
              <View key={item.id} style={{ paddingVertical: 6 }}>
                <Notinha lines={linesOf(item.id)} />
              </View>
            ),
          )}

          {busy && <Thinking />}
        </ScrollView>

        {/* ── The composer ── */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.07)",
            backgroundColor: "rgba(0,0,0,0.30)",
            paddingTop: 10,
            paddingBottom: insets.bottom + 8,
          }}
        >
          {/* What is being asked for, the categories to choose from, or — with
              nothing pending — examples of what one sentence can carry. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 8 }}
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
              CHIPS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  tone="example"
                  onPress={() => {
                    setText(c);
                    inputRef.current?.focus();
                  }}
                />
              ))}
          </ScrollView>

          {/* Writing in the middle, the camera and the microphone either side. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 }}>
            <RoundButton label="Foto do comprovante" onPress={() => router.replace("/scanner" as never)}>
              <Camera size={18} color="rgba(255,255,255,0.75)" strokeWidth={2.1} />
            </RoundButton>

            <View
              style={{
                flex: 1,
                minWidth: 0,
                height: 44,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: voice.recording ? "rgba(248,113,113,0.6)" : typed ? "rgba(200,243,109,0.55)" : "rgba(255,255,255,0.11)",
                backgroundColor: "rgba(255,255,255,0.05)",
                justifyContent: "center",
              }}
            >
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={submitText}
                placeholder={voice.recording ? `Ouvindo…  ${voice.seconds}s` : "o que rolou?"}
                placeholderTextColor={INK.faint}
                editable={!voice.recording}
                returnKeyType="send"
                submitBehavior="submit"
                autoCorrect
                style={{ height: "100%", paddingHorizontal: 14, fontSize: 15, color: "#fff" }}
              />
            </View>

            <SendOrSpeak
              typed={typed}
              recording={voice.recording}
              disabled={busy}
              onPress={() => (typed ? submitText() : void toggleRecording())}
            />
          </View>

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
        </View>
      </KeyboardAvoidingView>
    </Room>
  );
}

function Chip({ label, tone, onPress }: { label: string; tone: "answer" | "category" | "example"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: tone === "answer" ? 0 : 1,
        borderColor: tone === "category" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
        backgroundColor: tone === "answer" ? GREEN : tone === "category" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.035)",
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: tone === "answer" ? "700" : "500",
          color: tone === "answer" ? "#0B0B0B" : tone === "category" ? "rgba(255,255,255,0.85)" : INK.soft,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

/** Send when there is something written; otherwise the microphone, red while it listens. */
function SendOrSpeak({
  typed,
  recording,
  disabled,
  onPress,
}: {
  typed: boolean;
  recording: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(
      recording
        ? withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1, false, undefined, ReduceMotion.System)
        : 0,
    );
  }, [recording, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: recording ? 0.45 * (1 - pulse.get()) : 0,
    transform: [{ scale: 1 + pulse.get() * 0.35 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={typed ? "Enviar" : recording ? "Parar gravação" : "Gravar"}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: typed || recording ? 0 : 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: recording ? RED : typed ? GREEN : "rgba(255,255,255,0.06)",
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: RED }, ring]}
      />
      {typed ? (
        <ArrowUp size={19} color="#0B0B0B" strokeWidth={2.8} />
      ) : recording ? (
        <Square size={14} color="#fff" fill="#fff" />
      ) : (
        <Mic size={18} color="rgba(255,255,255,0.75)" strokeWidth={2.1} />
      )}
    </Pressable>
  );
}

/** Willo at work: three dots rising in turn. */
function Thinking() {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <BotMark size={26} />
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.09)",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 150} />
        ))}
      </View>
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(1, { duration: 520 }), withTiming(0, { duration: 520 })),
          -1,
          false,
          undefined,
          ReduceMotion.System,
        ),
      ),
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.get() * 0.75, transform: [{ translateY: -2.5 * t.get() }] }));
  return <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN }, style]} />;
}
