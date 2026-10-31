import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, readEntry, todayISO, type ParsedEntry } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import CategoryPicker from "~/components/CategoryPicker";
import ParticleOrb from "~/components/registro/ParticleOrb";
import EntryForm, { type EntryValues } from "~/components/registro/EntryForm";
import { CategoryButton, Choice, EntryCard, GLASS, StepHeader, PartsBar, Primary, SavedView, dayLabel, hhmm, type Account, type Card, type Kind, type Method } from "~/components/registro/entryParts";
import { Banknote, CalendarClock, ChevronLeft, CreditCard, Landmark } from "~/components/icons";
import { money } from "~/lib/money";
import { paymentMention } from "~/lib/paymentMention";
import { preloadCash } from "~/lib/sounds";
import { sparkle } from "~/lib/sparkles";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Registro rápido — the same steps wherever an entry starts: a double tap on the sphere
 * (from "O que aconteceu?"), or something said or written to Willo (already read, so it
 * starts at the card).
 *
 * "O que aconteceu?" — the person writes it their own way, "padaria 48", and the card of
 * what it became fills in as they type: what, the category, the amount, the day and the
 * hour. When the typing pauses the keyboard steps aside, and what is still missing is
 * asked under the card, one question at a time — debit or credit, then which account or
 * card; on a card, at once or in instalments, and how many; then the category — each
 * answer landing on the card. In instalments it is a purchase on the card: the total is
 * written once and the card's invoices take it month by month, as the form does. Whatever the sentence
 * already said ("no débito, na conta Nubank") is not asked again; with nothing missing it
 * goes straight to the check. The check: out or in, the amount, the words, the category
 * and how it was paid — and Registrar. It lands on the receipt: at the moment its seal
 * ticks, the chime, the notice at the top and a burst of sparkles, all at once; and the
 * ways on — share it, keep it in the gallery, see the transactions. The sparkles belong
 * to that moment and go with the sheet.
 *
 * It closes with a tap outside it; there is no X to take room at the top.
 */

export type Step = "ask" | "confirm" | "done";

/** An entry already read — from speech or from the conversation. */
export interface StartingEntry {
  name: string;
  amount: number;
  type: "despesa" | "receita";
  category: string | null;
  method: "conta" | "cartao" | null;
  accountId?: string | null;
  cardId?: string | null;
  /** yyyy-mm-dd, when it was not today. */
  date?: string;
}

/* How long the typing pauses before the keyboard steps aside. */
const PAUSE_MS = 1400;

type Plan = "avista" | "parcelado";
type Question = "method" | "where" | "plan" | "parts" | "category";


const EXAMPLES = ["mercado 130", "uber 22 crédito", "recebi 300"];

export default function QuickEntryFlow({
  initial,
  heard,
  spoken,
  onClose,
  onSeeTransactions,
  onSeeCard,
  onStep,
  onSaved,
}: {
  initial?: StartingEntry | null;
  /** What was said or written, shown over the card. */
  heard?: string | null;
  spoken?: boolean;
  onClose: () => void;
  onSeeTransactions: () => void;
  /** A purchase on a card is seen on its invoice. */
  onSeeCard?: (cardId: string) => void;
  onStep?: (step: Step) => void;
  onSaved?: (summary: string) => void;
}) {
  const { user } = useAuth();
  const [opened] = useState(() => new Date());

  const [step, setStep] = useState<Step>("ask");
  const [said, setSaid] = useState(heard ?? "");
  const [loaded, setLoaded] = useState(false);
  const [reading, setReading] = useState(false);
  const [aiRead, setAiRead] = useState<ParsedEntry | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [cents, setCents] = useState(() => {
    if (!initial) return 0;
    const heardOf = paymentMention(heard ?? "", [], []);
    return Math.round(initial.amount * 100) * (heardOf.perPart && heardOf.installments ? heardOf.installments : 1);
  });
  const [type, setType] = useState<Kind>(initial?.type ?? "despesa");
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [date, setDate] = useState(() => paymentMention(heard ?? "", [], []).date ?? initial?.date ?? todayISO());
  /* What goes on the check, set when it opens; changed there before Registrar. */
  const [form, setForm] = useState<EntryValues | null>(null);
  /* What the person chose on the card; what the words said comes after it. */
  const [pickedMethod, setPickedMethod] = useState<Method | null>(null);
  const [pickedWhere, setPickedWhere] = useState<string | null>(null);
  const [pickedPlan, setPickedPlan] = useState<Plan | null>(null);
  const [pickedParts, setPickedParts] = useState<number | null>(null);
  /* Chosen in the bar but not yet confirmed: the value of one instalment shows meanwhile. */
  const [partsDraft, setPartsDraft] = useState<number | null>(null);
  /* The questions answered, in order — Voltar walks them back, the answer still chosen. */
  const [trail, setTrail] = useState<Question[]>([]);
  const [reopen, setReopen] = useState<Question | null>(null);
  /* Asked again from the check: the words no longer decide it. */
  const [askAgain, setAskAgain] = useState(false);
  const [planAgain, setPlanAgain] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [typing, setTyping] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    preloadCash();
    Promise.all([
      getAccounts().then((list) => setAccounts((list as unknown as Account[]).filter((a) => a.type !== "investment"))),
      getCreditCards().then((c) => setCards(c as unknown as Card[])),
    ])
      .catch(() => undefined)
      .finally(() => setLoaded(true));
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

  /* While the keyboard is up the sheet holds only what is being typed and its card. */
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const up = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setTyping(true));
    const down = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setTyping(false));
    return () => {
      up.remove();
      down.remove();
    };
  }, []);

  /* How it was paid, if the words say — and the words without it, to read the rest. */
  const mention = useMemo(() => paymentMention(said, accounts, cards), [said, accounts, cards]);

  /* What is written becomes the card as it is typed — on the phone, no waiting. */
  const typed = useMemo(() => {
    if (initial || !said.trim()) return null;
    const options = { today: todayISO(), categories, history: history.current };
    return (mention.rest ? parseLocal(mention.rest, options)?.[0] : null) ?? parseLocal(said, options)?.[0] ?? null;
  }, [initial, said, mention.rest, categories]);
  const draft = typed ?? aiRead;
  useEffect(() => {
    if (!draft) return;
    setName(draft.name);
    setCents(Math.round(draft.amount * 100) * (mention.perPart && mention.installments ? mention.installments : 1));
    setType(draft.type);
    setCategory(draft.category);
    setDate(mention.date ?? (draft.date || todayISO()));
  }, [draft, mention.perPart, mention.installments, mention.date]);

  /* The way it was paid and where: chosen on the card, else said, else read. */
  const baseMethod = initial ? initial.method : (draft?.paymentMethod ?? null);
  const resolve = (pm: Method | null, pw: string | null) => {
    const how: Method | null = type === "receita" ? "conta" : (pm ?? (askAgain ? null : (mention.method ?? baseMethod)));
    const list: (Account | Card)[] = how === "cartao" ? cards : accounts;
    const inList = (id?: string | null) => (id && list.some((o) => o.id === id) ? id : null);
    const said_ = askAgain ? null : (inList(how === "cartao" ? mention.cardId : mention.accountId) ?? inList(how === "cartao" ? initial?.cardId : initial?.accountId));
    const whereId = inList(pw) ?? said_ ?? (how && list.length === 1 ? list[0].id : null);
    return { how, list, whereId };
  };
  /* On a card, at once or in instalments, and how many: chosen, else said. */
  const saidPlan: Plan | null = askAgain || planAgain ? null : mention.installments || mention.split ? "parcelado" : mention.inCash ? "avista" : null;
  const saidParts = askAgain || planAgain ? null : mention.installments;

  /* Every month, when the words say so: nothing about instalments is asked. */
  const recurring = mention.recurring;

  /* What would still be asked, for a given set of answers. On a card, at once or in
     instalments; on the account, in instalments only when the words said so. */
  const pending = (pm: Method | null, pw: string | null, pp: Plan | null, pn: number | null, cat: string | null) => {
    const r = resolve(pm, pw);
    const credit = type === "despesa" && r.how === "cartao";
    const plan = recurring || type === "receita" ? null : credit ? (pp ?? saidPlan) : saidPlan === "parcelado" ? (pp ?? "parcelado") : null;
    const parts = plan === "parcelado" ? (pn ?? saidParts) : null;
    const question: Question | null = !r.how ? "method" : !r.whereId ? "where" : credit && !recurring && !plan ? "plan" : plan === "parcelado" && !parts ? "parts" : !cat ? "category" : null;
    return { ...r, credit, plan, parts, question };
  };
  const now = pending(pickedMethod, pickedWhere, pickedPlan, pickedParts, category);
  const { how, list, whereId, plan, parts, question: missing } = now;
  const picked = list.find((o) => o.id === whereId) ?? null;
  const payLabel = type === "receita" ? (picked?.name ?? null) : how ? `${how === "cartao" ? "Crédito" : "Débito"}${picked ? ` · ${picked.name}` : ""}` : null;
  const shownParts = plan === "parcelado" ? (parts ?? partsDraft) : null;
  const partsLabel = recurring ? "Recorrente" : shownParts ? `${shownParts}x de ${money(cents / 100 / shownParts)}` : plan === "avista" ? "À vista" : null;

  /* The check opens with everything as it stands: settled, unless on a card or on a day ahead. */
  const toConfirm = (p: ReturnType<typeof pending>, cat: string | null) => {
    setForm({
      type,
      cents,
      name: name.trim(),
      category: cat,
      method: p.how,
      whereId: p.whereId,
      repeat: recurring ? "fixa" : p.plan === "parcelado" && p.parts ? "parcelado" : "unica",
      parts: p.plan === "parcelado" ? p.parts : null,
      date,
      status: p.credit || date > todayISO() ? "pendente" : "pago",
      note: "",
    });
    setStep("confirm");
  };

  /* What is still missing, asked one at a time under the card. */
  const hasEntry = initial ? loaded : !!draft;
  const question = !hasEntry || !loaded ? null : (reopen ?? missing);

  /* Once it reads as an entry and the typing pauses, the keyboard steps aside — and with nothing missing, the check. */
  const pausedOn = useRef<string | null>(null);
  useEffect(() => {
    if (initial || step !== "ask" || !typed || !loaded || pausedOn.current === said) return;
    const t = setTimeout(() => {
      pausedOn.current = said;
      Keyboard.dismiss();
      if (!question) toConfirm(now, category);
    }, PAUSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, step, said, typed, loaded, question]);

  /* Said or written to Willo with everything in it: straight to the check. */
  const jumped = useRef(false);
  useEffect(() => {
    if (!initial || !loaded || jumped.current) return;
    jumped.current = true;
    if (!question) toConfirm(now, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, loaded, question]);

  /* What is written, typed or picked from the examples: the words decide again. */
  const write = (t: string) => {
    setSaid(t);
    setAiRead(null);
    setError(null);
    setPickedMethod(null);
    setPickedWhere(null);
    setPickedPlan(null);
    setPickedParts(null);
    setPartsDraft(null);
    setAskAgain(false);
    setPlanAgain(false);
    setTrail([]);
    setReopen(null);
  };

  /* An answer lands on the card; the last one goes to the check. */
  const answered = (next: { method?: Method; where?: string; plan?: Plan; parts?: number; category?: string }) => {
    Keyboard.dismiss();
    if (question) setTrail((t) => [...t, question]);
    setReopen(null);
    const pm = next.method ?? pickedMethod;
    const pw = next.method ? null : (next.where ?? pickedWhere);
    const pp = next.method ? null : (next.plan ?? pickedPlan);
    const pn = next.method || next.plan ? (next.parts ?? null) : (next.parts ?? pickedParts);
    const cat = next.category ?? category;
    setPickedMethod(pm);
    setPickedWhere(pw);
    setPickedPlan(pp);
    setPickedParts(pn);
    if (next.plan || next.method) {
      setPartsDraft(null);
    }
    if (next.category) setCategory(next.category);
    const after = pending(pm, pw, pp, pn, cat);
    if (!after.question) toConfirm(after, cat);
  };

  /* Nothing on the phone could read it: the AI reader tries. */
  const readHard = async () => {
    const text = said.trim();
    if (!text || reading) return;
    setError(null);
    setReading(true);
    try {
      const e = (await readEntry({ text, categories })).entries[0];
      if (!e) setError("Não achei um valor aí. Tente algo como “padaria 48”.");
      else {
        void Haptics.selectionAsync().catch(() => undefined);
        setAiRead(e);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ler agora. Tente de novo.");
    } finally {
      setReading(false);
    }
  };

  /* As it stands on the check. */
  const f = form;
  const fCredit = !!f && f.type === "despesa" && f.method === "cartao";
  const fParts = f && f.repeat === "parcelado" && f.parts && f.parts > 1 ? f.parts : null;
  const fList: (Account | Card)[] = fCredit ? cards : accounts;
  const fPicked = f ? (fList.find((o) => o.id === f.whereId) ?? null) : null;
  const fPay = f ? (f.type === "receita" ? (fPicked?.name ?? null) : `${fCredit ? "Crédito" : "Débito"}${fPicked ? ` · ${fPicked.name}` : ""}`) : null;
  const scheduled = !!f && !fCredit && f.status === "pendente";

  const register = async () => {
    if (!user || !f || !f.method || !f.whereId || f.cents <= 0 || !f.name.trim()) return;
    if (fCredit) {
      const card = cards.find((c) => c.id === f.whereId);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && f.cents / 100 > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await createTransaction(
        {
          name: f.name.trim().replace(/^./, (c) => c.toUpperCase()),
          type: f.type,
          /* In instalments the purchase carries one instalment's value; the instalments repeat it. */
          amount: fParts ? Math.round(f.cents / fParts) / 100 : f.cents / 100,
          category: f.category ?? "Outros",
          date: f.date,
          status: fCredit ? "pendente" : f.status,
          payment_method: f.type === "receita" ? "conta" : f.method,
          account_id: fCredit ? null : f.whereId,
          credit_card_id: fCredit ? f.whereId : null,
          recurrence_type: fParts ? "parcelado" : f.repeat === "fixa" ? "fixa" : "unica",
          installments: fParts,
          installment_current: fParts ? 1 : null,
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setSavedAt(new Date());
      setStep("done");
      onSaved?.(`${f.name.trim()}, ${money(f.cents / 100)}${fParts ? ` em ${fParts}x` : f.repeat === "fixa" ? ", todo mês" : ""}`);
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  /* The seal ticks: the notice and the sparkles come with the chime. */
  const landed = () => {
    if (!f) return;
    showToast(`${f.type === "receita" ? "Receita" : "Despesa"} ${scheduled ? "agendada" : "adicionada"} · ${f.name.trim()}, ${money(f.cents / 100)}${fParts ? ` em ${fParts}x` : ""}`);
    sparkle();
  };

  /* One step back, always: the last question answered, its answer still chosen. */
  const back = () => {
    setError(null);
    const last = trail[trail.length - 1];
    if (last) {
      setTrail((t) => t.slice(0, -1));
      if (last === "parts") setPartsDraft(parts);
      setReopen(last);
    }
    setStep("ask");
  };

  const stageNo = step === "ask" ? 1 : 2;
  const when = date === todayISO() ? `${dayLabel(date)}, ${hhmm(opened)}` : dayLabel(date);

  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8 }}>
        {/* ── Where in it, and the way back ── */}
        {step !== "done" && (
          <>
            <StepHeader label={`REGISTRO RÁPIDO · ETAPA ${stageNo} DE 2`} stage={stageNo} total={2} onBack={step === "confirm" || (step === "ask" && trail.length > 0) ? back : undefined} />
          </>
        )}

        {/* ── What happened, the card it became, and what is still missing ── */}
        {step === "ask" && (
          <Animated.View entering={FadeIn.duration(240)} style={{ marginTop: 18 }}>
            {initial ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ParticleOrb size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>{spoken ? "Confirme o que ouvi" : "Confirme o que você escreveu"}</Text>
                  {said.trim() ? (
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13, fontStyle: "italic", color: INK.softer }}>
                      “{said.trim()}”
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>O que aconteceu?</Text>
                <TextInput
                  autoFocus
                  value={said}
                  onChangeText={write}
                  onSubmitEditing={() => {
                    if (!draft) return void readHard();
                    pausedOn.current = said;
                    Keyboard.dismiss();
                    if (!question) toConfirm(now, category);
                  }}
                  returnKeyType={draft ? "done" : "next"}
                  placeholder="Ex.: padaria 48"
                  placeholderTextColor={INK.faint}
                  style={{ marginTop: 16, height: 56, borderRadius: 20, paddingHorizontal: 18, fontSize: 19, fontWeight: "600", color: "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: said.trim() ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)" }}
                />
                {!said.trim() && (
                  <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                    {EXAMPLES.map((e) => (
                      <Pressable
                        key={e}
                        onPress={() => {
                          write(e);
                          Keyboard.dismiss();
                        }}
                        style={({ pressed }) => ({ flex: 1, height: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", opacity: pressed ? 0.6 : 1 })}>
                        <Text numberOfLines={1} style={{ fontSize: 13, color: INK.soft }}>
                          {e}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* The card fills in as it is typed, and stays while the questions change under it */}
            {hasEntry && (
              <Animated.View entering={FadeInDown.duration(260)} style={[GLASS, { marginTop: 14, padding: 14 }]}>
                <EntryCard name={name} cents={cents} type={type} category={category} when={when} pay={payLabel} parts={partsLabel} payMissing={type === "receita" ? "Falta a conta" : "Falta a forma de pagamento"} />
              </Animated.View>
            )}

            <View>
              {question && !typing ? (
                <Animated.View key={question} entering={FadeIn.duration(220)} style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>
                    {question === "method"
                      ? "Foi no débito ou no crédito?"
                      : question === "where"
                        ? how === "cartao"
                          ? "Em qual cartão?"
                          : type === "receita"
                            ? "Entrou em qual conta?"
                            : "Que conta você usou?"
                        : question === "plan"
                          ? "À vista ou parcelado?"
                          : question === "parts"
                            ? "Em quantas vezes?"
                            : "De que categoria é?"}
                  </Text>

                  {question === "method" && (
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                      <Choice icon={<Landmark size={19} color="#fff" strokeWidth={2.1} />} label="Débito" on={reopen === "method" && how === "conta"} onPress={() => answered({ method: "conta" })} />
                      <Choice icon={<CreditCard size={19} color="#fff" strokeWidth={2.1} />} label="Crédito" on={reopen === "method" && how === "cartao"} onPress={() => answered({ method: "cartao" })} />
                    </View>
                  )}

                  {question === "where" && (
                    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {list.map((o) => (
                        <Choice key={o.id} wide={list.length > 3} on={reopen === "where" && whereId === o.id} icon={<BankMark name={o.name} hex={colorFor(o.name, o.color)} size={30} />} label={o.name} onPress={() => answered({ where: o.id })} />
                      ))}
                    </View>
                  )}

                  {question === "plan" && (
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                      <Choice icon={<Banknote size={19} color="#fff" strokeWidth={2.1} />} label="À vista" on={reopen === "plan" && plan === "avista"} onPress={() => answered({ plan: "avista" })} />
                      <Choice icon={<CalendarClock size={19} color="#fff" strokeWidth={2.1} />} label="Parcelado" on={reopen === "plan" && plan === "parcelado"} onPress={() => answered({ plan: "parcelado" })} />
                    </View>
                  )}

                  {/* How many: the bar, then Continuar */}
                  {question === "parts" && (
                    <View style={{ marginTop: 12 }}>
                      <PartsBar cents={cents} value={partsDraft} onChange={setPartsDraft} />
                      {partsDraft ? <Primary label="Continuar" onPress={() => answered({ parts: partsDraft })} tight /> : null}
                    </View>
                  )}

                  {question === "category" && (
                    <View style={{ marginTop: 12 }}>
                      <CategoryButton
                        onPress={() => {
                          Keyboard.dismiss();
                          setPicking(true);
                        }}
                      />
                    </View>
                  )}
                </Animated.View>
              ) : (
                <>
                  {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}
                  {!question && (hasEntry || said.trim()) && (
                    <Primary
                      label={reading ? "Lendo…" : "Continuar"}
                      busy={reading}
                      disabled={reading}
                      onPress={() => {
                        Keyboard.dismiss();
                        if (hasEntry) toConfirm(now, category);
                        else void readHard();
                      }}
                    />
                  )}
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Check before saving: the same page as the guided entry's ── */}
        {step === "confirm" && f && (
          <Animated.View key="confirm" entering={FadeInDown.duration(320)} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>Confira antes de salvar</Text>
            {said.trim() ? (
              <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12.5, color: INK.softer }}>
                {spoken ? "Você disse" : "Você escreveu"} <Text style={{ fontStyle: "italic", color: INK.soft }}>“{said.trim()}”</Text>
              </Text>
            ) : null}
            <EntryForm values={f} onChange={(patch) => setForm((cur) => (cur ? { ...cur, ...patch } : cur))} accounts={accounts} cards={cards} onPickCategory={() => setPicking(true)} />
            {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}
            <Primary
              label={saving ? "Registrando…" : scheduled ? "Agendar" : "Registrar"}
              busy={saving}
              disabled={saving || f.cents <= 0 || !f.name.trim() || !f.whereId || (f.repeat === "parcelado" && !f.parts)}
              onPress={() => void register()}
            />
          </Animated.View>
        )}

        {/* ── Saved: the receipt, and what to do with it ── */}
        {step === "done" && savedAt && f && (
          <SavedView
            line={{ id: "1", name: f.name.trim(), category: f.category ?? "Outros", amount: f.cents / 100, type: f.type, method: fPay, installments: fParts }}
            savedAt={savedAt}
            title={scheduled ? (f.type === "receita" ? "Receita agendada" : "Gasto agendado") : undefined}
            onLanded={landed}
            onClose={onClose}
            onSee={() => (fCredit && f.whereId && onSeeCard ? onSeeCard(f.whereId) : onSeeTransactions())}
            seeLabel={fCredit && onSeeCard ? "Ver na fatura do cartão" : "Ver transações"}
          />
        )}
      </View>

      <CategoryPicker
        open={picking}
        type={type}
        value={category ?? ""}
        onPick={(c: string) => {
          setPicking(false);
          if (step === "ask") answered({ category: c });
          else setForm((cur) => (cur ? { ...cur, category: c } : cur));
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

