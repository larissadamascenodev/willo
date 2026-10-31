import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { DatePick, todayIso, type EntryValues } from "~/components/registro/EntryForm";
import { CategoryButton, Choice, EntryCard, GLASS, PartsBar, Primary, REPEAT_LABEL, RepeatList, SavedView, dayLabel, nums, type Account, type Card, type Repeat } from "~/components/registro/entryParts";
import { Check, ChevronLeft, Clock, CreditCard, Landmark } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { suggestCategory } from "~/lib/categorize";
import { money } from "~/lib/money";
import { preloadCash } from "~/lib/sounds";
import { sparkle } from "~/lib/sparkles";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Adicionar manualmente, guided — the Registro rápido's way, with nothing taken from a
 * sentence: everything is asked, one question at a time, with the usual answer chosen.
 *
 * First the amount, and whether it went out or came in. Then the card of what it is fills
 * in while the questions change under it: what it was (the category follows from the
 * words, or Willo suggests one), how it was paid, from which account or on which card,
 * whether it repeats, the day, and whether it is settled — a day ahead is scheduled.
 * Started inside a card it is a purchase on that card, and neither the way it was paid
 * nor the card is asked. Voltar always goes one question back, with what was chosen
 * still chosen; Continuar goes on from there. Then the check, every part changeable, and
 * the receipt.
 */

export type ManualStep = "value" | "ask" | "confirm" | "done";
type Question = "name" | "category" | "method" | "where" | "repeat" | "parts" | "when" | "status";
const ORDER: Question[] = ["name", "category", "method", "where", "repeat", "parts", "when", "status"];

/* The bar at the top moves part by part: the amount, what it was, how it was paid, whether it repeats, when, the check. */
type Stage = "value" | "what" | "pay" | "repeat" | "when" | "confirm";
const STAGE_OF: Record<Question, Stage> = { name: "what", category: "what", method: "pay", where: "pay", repeat: "repeat", parts: "repeat", when: "when", status: "when" };

export default function ManualEntryFlow({
  cardId,
  onClose,
  onSeeTransactions,
  onSeeCard,
  onStep,
}: {
  /** Started inside this card. */
  cardId?: string | null;
  onClose: () => void;
  onSeeTransactions: () => void;
  onSeeCard: (cardId: string) => void;
  onStep?: (step: ManualStep) => void;
}) {
  const { user } = useAuth();
  const locked = !!cardId;
  const [step, setStep] = useState<ManualStep>("value");
  const [v, setV] = useState<EntryValues>({
    type: "despesa",
    cents: 0,
    name: "",
    category: null,
    method: locked ? "cartao" : null,
    whereId: cardId ?? null,
    repeat: "unica",
    parts: null,
    date: todayIso(),
    status: "pago",
    note: "",
  });
  const set = (patch: Partial<EntryValues>) => setV((p) => ({ ...p, ...patch }));

  /* The question on screen, and the ones answered before it — Voltar walks them back. */
  const [q, setQ] = useState<Question>("name");
  const [trail, setTrail] = useState<Question[]>([]);
  /* Every question answered at least once: its answer shows as chosen when it comes round again. */
  const [seen, setSeen] = useState<Question[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [partsDraft, setPartsDraft] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    preloadCash();
    getAccounts()
      .then((list) => setAccounts((list as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
    allowedCategories().then(setCategories).catch(() => undefined);
    getRecentTransactions(120)
      .then((rows) => {
        for (const r of rows as { name: string; category: string }[]) if (r.name && r.category && r.category !== "Outros") history.current[r.name] ??= r.category;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    onStep?.(step);
  }, [step, onStep]);

  const income = v.type === "receita";
  const how = income ? "conta" : v.method;
  const list: (Account | Card)[] = how === "cartao" ? cards : accounts;
  const whereId = v.whereId && list.some((o) => o.id === v.whereId) ? v.whereId : how && list.length === 1 ? list[0].id : null;
  const credit = !income && how === "cartao";
  const picked = list.find((o) => o.id === whereId) ?? null;

  /* Which questions this entry has, given what is known: some answer themselves. */
  const asks = (x: EntryValues, question: Question) => {
    const xIncome = x.type === "receita";
    const xHow = xIncome ? "conta" : x.method;
    const xList = xHow === "cartao" ? cards : accounts;
    switch (question) {
      case "category":
        return !x.category;
      case "method":
        return !locked && !xIncome;
      case "where":
        return !locked && xList.length !== 1;
      case "parts":
        return x.repeat === "parcelado";
      case "status":
        return !(!xIncome && xHow === "cartao");
      default:
        return true;
    }
  };

  /* On to the next question — or, with none left, to the check. */
  const advance = (patch: Partial<EntryValues> = {}) => {
    Keyboard.dismiss();
    const x = { ...v, ...patch };
    setV(x);
    setTrail((t) => [...t, q]);
    setSeen((s) => (s.includes(q) ? s : [...s, q]));
    const next = ORDER.slice(ORDER.indexOf(q) + 1).find((question) => asks(x, question));
    if (next) {
      if (next === "parts") setPartsDraft(x.parts);
      setQ(next);
      return;
    }
    const xHow = x.type === "receita" ? "conta" : x.method;
    const xList = xHow === "cartao" ? cards : accounts;
    set({ method: xHow, whereId: x.whereId ?? (xList.length === 1 ? xList[0].id : null) });
    setStep("confirm");
  };

  /* One step back, always — with what was chosen there still chosen. */
  const back = () => {
    setError(null);
    if (step === "confirm" || step === "ask") {
      const last = trail[trail.length - 1];
      if (step === "ask" && !last) return setStep("value");
      if (last) {
        setTrail((t) => t.slice(0, -1));
        if (last === "parts") setPartsDraft(v.parts);
        if (last === "name") setNameDraft(v.name);
        setQ(last);
      }
      setStep("ask");
    }
  };

  /* What it was: the category from the words on the phone, else Willo's suggestion. */
  const submitName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    const local = parseLocal(`${name} ${Math.max(1, Math.round(v.cents / 100))}`, { today: todayIso(), categories, history: history.current })?.[0]?.category ?? null;
    if (!local && !v.category) {
      setThinking(true);
      void suggestCategory({ name, amount: v.cents / 100, type: v.type })
        .then((c) => setSuggested(c && categories.includes(c) ? c : null))
        .finally(() => setThinking(false));
    }
    advance({ name: name.replace(/^./, (c) => c.toUpperCase()), category: local ?? v.category });
  };

  const register = async () => {
    if (!user || !how || !whereId || v.cents <= 0 || !v.name.trim()) return;
    const parts = v.repeat === "parcelado" && v.parts && v.parts > 1 ? v.parts : null;
    if (credit) {
      const card = cards.find((c) => c.id === whereId);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && v.cents / 100 > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await createTransaction(
        {
          name: v.name.trim(),
          type: v.type,
          /* In instalments the purchase carries one instalment's value; the instalments repeat it. */
          amount: parts ? Math.round(v.cents / parts) / 100 : v.cents / 100,
          category: v.category ?? "Outros",
          date: v.date,
          status: credit ? "pendente" : v.status,
          payment_method: how,
          account_id: how === "conta" ? whereId : null,
          credit_card_id: credit ? whereId : null,
          recurrence_type: parts ? "parcelado" : v.repeat === "fixa" ? "fixa" : "unica",
          installments: parts,
          installment_current: parts ? 1 : null,
          observation: v.note.trim() || null,
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setSavedAt(new Date());
      setStep("done");
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const scheduled = !credit && v.status === "pendente";
  const split = v.repeat === "parcelado" && v.parts ? v.parts : null;
  const payLabel = income ? (picked?.name ?? null) : how ? `${credit ? "Crédito" : "Débito"}${picked ? ` · ${picked.name}` : ""}` : null;
  const passed = (question: Question) => seen.includes(question);
  const repeatLabel = split ? `${split}x de ${money(v.cents / 100 / split)}` : passed("repeat") ? REPEAT_LABEL[v.repeat] : null;

  /* The seal ticks: the notice and the sparkles come with the chime. */
  const landed = () => {
    const what = income ? "Receita" : "Despesa";
    showToast(`${what} ${scheduled ? "agendada" : "adicionada"} · ${v.name.trim()}, ${money(v.cents / 100)}${split ? ` em ${split}x` : ""}`);
    sparkle();
  };

  const stages: Stage[] = locked ? ["value", "what", "repeat", "when", "confirm"] : ["value", "what", "pay", "repeat", "when", "confirm"];
  const stageNo = stages.indexOf(step === "value" ? "value" : step === "ask" ? STAGE_OF[q] : "confirm") + 1;

  const title: Record<Question, string> = {
    name: income ? "De onde veio esse dinheiro?" : "Com o que foi esse gasto?",
    category: "Em qual categoria ele entra?",
    method: "Como você pagou?",
    where: credit ? "Em qual cartão?" : income ? "Em qual conta entrou?" : "De qual conta saiu?",
    repeat: income ? "Essa entrada se repete?" : "Esse gasto se repete?",
    parts: "Em quantas parcelas?",
    when: credit ? "Quando foi a compra?" : v.repeat === "fixa" ? "A partir de quando?" : income ? "Quando entrou?" : "Quando foi?",
    status: income ? "Já recebeu?" : "Já está pago?",
  };

  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8 }}>
        {/* ── Where in it, and the way back ── */}
        {step !== "done" && (
          <>
            <View style={{ minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.72)" }}>
                {locked ? "NO CARTÃO" : "ADICIONAR"} · ETAPA {stageNo} DE {stages.length}
              </Text>
              {step !== "value" && (
                <Pressable
                  onPress={back}
                  hitSlop={10}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, height: 30, paddingLeft: 6, paddingRight: 11, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}
                >
                  <ChevronLeft size={15} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Voltar</Text>
                </Pressable>
              )}
            </View>
            <View style={{ marginTop: 8, flexDirection: "row", gap: 4 }}>
              {stages.map((_, i) => i + 1).map((n) => (
                <View key={n} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: n <= stageNo ? "#fff" : "rgba(255,255,255,0.12)" }} />
              ))}
            </View>
          </>
        )}

        {/* ── 1 · How much, out or in ── */}
        {step === "value" && (
          <Animated.View entering={FadeIn.duration(240)} style={{ marginTop: 18 }}>
            {!locked && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["despesa", "receita"] as const).map((t) => {
                  const on = v.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => set(t === "receita" ? { type: t, method: "conta", repeat: v.repeat === "parcelado" ? "unica" : v.repeat, parts: null } : { type: t, method: null })}
                      style={({ pressed }) => ({ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)", opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: on ? (t === "receita" ? GREEN : "#fff") : INK.soft }}>{t === "despesa" ? "Despesa" : "Receita"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text style={{ marginTop: locked ? 0 : 18, fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>
              {income ? "Quanto você recebeu?" : locked ? "Qual o valor da compra?" : "Quanto você gastou?"}
            </Text>
            {locked && picked ? <Text style={{ marginTop: 4, fontSize: 14, color: INK.soft }}>No cartão {picked.name}</Text> : null}
            <TextInput
              autoFocus
              value={money(v.cents / 100)}
              onChangeText={(t) => set({ cents: Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999) })}
              onSubmitEditing={() => v.cents > 0 && setStep("ask")}
              keyboardType="number-pad"
              returnKeyType="next"
              style={[nums, { marginTop: 14, height: 64, borderRadius: 20, paddingHorizontal: 18, fontSize: 34, fontWeight: "800", letterSpacing: -1, color: income ? GREEN : "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: v.cents > 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)" }]}
            />
            <Primary
              label="Continuar"
              disabled={v.cents <= 0}
              onPress={() => {
                Keyboard.dismiss();
                setStep("ask");
              }}
            />
          </Animated.View>
        )}

        {/* ── 2 · The card, and one question at a time under it ── */}
        {step === "ask" && (
          <Animated.View entering={FadeIn.duration(240)} style={{ marginTop: 18 }}>
            <Animated.View entering={FadeInDown.duration(260)} style={[GLASS, { padding: 14 }]}>
              <EntryCard
                name={q === "name" ? nameDraft : v.name}
                cents={v.cents}
                type={v.type}
                category={v.category}
                when={passed("when") || q === "when" || q === "status" ? dayLabel(v.date) : null}
                pay={passed("method") || passed("where") || locked ? payLabel : null}
                parts={repeatLabel}
              />
            </Animated.View>

            <Animated.View key={q} entering={FadeIn.duration(220)} style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>{title[q]}</Text>

              {q === "name" && (
                <>
                  <TextInput
                    autoFocus
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onSubmitEditing={submitName}
                    returnKeyType="next"
                    maxLength={40}
                    placeholder={income ? "Ex.: salário, freela, venda" : "Ex.: academia, mercado, Uber"}
                    placeholderTextColor={INK.faint}
                    style={{ marginTop: 12, height: 56, borderRadius: 20, paddingHorizontal: 18, fontSize: 19, fontWeight: "600", color: "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: nameDraft.trim() ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)" }}
                  />
                  <Primary label="Continuar" disabled={!nameDraft.trim()} onPress={submitName} tight />
                </>
              )}

              {q === "category" && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {suggested ? (
                    <Choice
                      icon={(() => {
                        const I = categoryIcon(suggested);
                        return <I size={18} color="#fff" strokeWidth={2.1} />;
                      })()}
                      label={`Sugestão: ${suggested}`}
                      on={v.category === suggested}
                      onPress={() => advance({ category: suggested })}
                    />
                  ) : thinking ? (
                    <Text style={{ fontSize: 13.5, color: INK.soft }}>Willo está pensando…</Text>
                  ) : null}
                  <CategoryButton onPress={() => setPicking(true)} />
                </View>
              )}

              {q === "method" && (
                <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                  <Choice icon={<Landmark size={19} color="#fff" strokeWidth={2.1} />} label="Débito" on={v.method === "conta"} onPress={() => advance({ method: "conta", whereId: v.method === "conta" ? v.whereId : null })} />
                  <Choice icon={<CreditCard size={19} color="#fff" strokeWidth={2.1} />} label="Crédito" on={v.method === "cartao"} onPress={() => advance({ method: "cartao", whereId: v.method === "cartao" ? v.whereId : null })} />
                </View>
              )}

              {q === "where" && (
                <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {list.map((o) => (
                    <Choice key={o.id} wide={list.length > 3} on={v.whereId === o.id} icon={<BankMark name={o.name} hex={colorFor(o.name, o.color)} size={30} />} label={o.name} onPress={() => advance({ whereId: o.id })} />
                  ))}
                </View>
              )}

              {q === "repeat" && (
                <View style={{ marginTop: 12 }}>
                  <RepeatList
                    value={passed("repeat") ? v.repeat : null}
                    income={income}
                    onPick={(r: Repeat) => {
                      advance({ repeat: r, parts: r === "parcelado" ? v.parts : null });
                    }}
                  />
                </View>
              )}

              {q === "parts" && (
                <View style={{ marginTop: 12 }}>
                  <PartsBar cents={v.cents} value={partsDraft} onChange={setPartsDraft} />
                  {partsDraft ? <Primary label="Continuar" onPress={() => advance({ parts: partsDraft })} tight /> : null}
                </View>
              )}

              {q === "when" && (
                <View style={{ marginTop: 12 }}>
                  <DatePick values={{ ...v, method: how, whereId }} onChange={set} cards={cards} />
                  <Primary label="Continuar" onPress={() => advance()} tight />
                </View>
              )}

              {q === "status" && (
                <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                  <Choice icon={<Check size={19} color="#fff" strokeWidth={2.4} />} label={income ? "Já recebi" : "Já paguei"} on={passed("status") && v.status === "pago"} onPress={() => advance({ status: "pago" })} />
                  <Choice icon={<Clock size={19} color="#fff" strokeWidth={2.1} />} label="Ainda não" on={passed("status") && v.status === "pendente"} onPress={() => advance({ status: "pendente" })} />
                </View>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {/* ── 3 · Check before saving: every part changeable here ── */}
        {step === "confirm" && (
          <Animated.View key="confirm" entering={FadeInDown.duration(320)} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>Confira antes de salvar</Text>
            <EntryForm values={v} onChange={set} accounts={accounts} cards={cards} lockedCard={locked} onPickCategory={() => setPicking(true)} />
            {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}
            <Primary
              label={saving ? "Registrando…" : scheduled ? "Agendar" : "Registrar"}
              busy={saving}
              disabled={saving || v.cents <= 0 || !v.name.trim() || !v.whereId || (v.repeat === "parcelado" && !v.parts)}
              onPress={() => void register()}
            />
          </Animated.View>
        )}

        {/* ── Saved: the receipt, and what to do with it ── */}
        {step === "done" && savedAt && (
          <SavedView
            line={{ id: "1", name: v.name.trim(), category: v.category ?? "Outros", amount: v.cents / 100, type: v.type, method: payLabel, installments: split }}
            savedAt={savedAt}
            title={scheduled ? (income ? "Receita agendada" : "Gasto agendado") : undefined}
            onLanded={landed}
            onClose={onClose}
            onSee={() => (credit && whereId ? onSeeCard(whereId) : onSeeTransactions())}
            seeLabel={credit ? "Ver na fatura do cartão" : "Ver transações"}
          />
        )}
      </View>

      <CategoryPicker
        open={picking}
        type={v.type}
        value={v.category ?? ""}
        suggested={suggested}
        onPick={(c: string) => {
          setPicking(false);
          if (step === "ask" && q === "category") advance({ category: c });
          else set({ category: c });
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}
