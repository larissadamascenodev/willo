import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, FadeInRight, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import { AskDemo, ForecastDemo, NotifyDemo } from "~/components/welcome/Demos";
import QuickTap from "./QuickTap";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Car,
  CircleCheck,
  Check,
  Clock as Clock2,
  Coffee,
  CreditCard,
  EyeOff,
  Gauge,
  House,
  Layers,
  LayoutGrid,
  MessageIcon,
  PiggyBank,
  Plane,
  Repeat,
  Scale,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone as Smartphone2,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Unlink,
  Utensils,
  Wallet,
  Zap,
} from "./icons";
import { Ask, Aura, C, Card, Choice, Chip, Cta, Evolution, Eyebrow, Header, IconTile, Journey, Label, MoneyInput, Pop, Ring, Segments, Tile, Title, type IconC } from "./kit";
import Paywall from "./Paywall";
import { brl, type PlanId } from "~/lib/plans";
import {
  EMPTY_ANSWERS,
  GOALS_WITH_DREAM,
  debtOrder,
  debtPlan,
  dreamPlan,
  hourValue,
  profileOf,
  workTime,
  type GoalId,
  type OnboardingAnswers,
} from "~/lib/onboardingProfile";

/**
 * The way in, before there is an account: Willo asks, a few things at a time, and
 * between the questions shows what he will do with the answers — the Copilot noting a
 * purchase, the goal drawn as a line to its date, an hour of work in reais, two taps
 * on the back of the phone, the things he will keep an eye on, a question answered.
 * At the end a ring fills while he puts it together, the financial profile he made of
 * the answers, and the plans. Every answer comes back to `onDone`; the account is made
 * after it, on the screen that already makes accounts.
 */

type StepId =
  | "name"
  | "source"
  | "copilot"
  | "goal"
  | "detail"
  | "goalDemo"
  | "income"
  | "hour"
  | "monthEnd"
  | "quick"
  | "card"
  | "emergency"
  | "habits"
  | "watch"
  | "ask"
  | "building"
  | "result"
  | "paywall";

const SECTION: Partial<Record<StepId, string>> = {
  name: "SOBRE VOCÊ",
  source: "SOBRE VOCÊ",
  copilot: "WILLO COPILOT",
  goal: "SEU OBJETIVO",
  detail: "SEU OBJETIVO",
  goalDemo: "SEU OBJETIVO",
  income: "SEU DINHEIRO HOJE",
  hour: "SUA HORA DE TRABALHO",
  monthEnd: "SEU DINHEIRO HOJE",
  quick: "REGISTRO RÁPIDO",
  card: "SEU DINHEIRO HOJE",
  emergency: "SEU DINHEIRO HOJE",
  habits: "SEUS HÁBITOS",
  watch: "SEUS HÁBITOS",
  ask: "CONVERSE COM O WILLO",
};

export const GOALS: { id: GoalId; label: string; Icon: IconC; hex: string }[] = [
  { id: "dividas", label: "Sair das dívidas", Icon: Unlink, hex: C.red },
  { id: "viagem", label: "Viajar", Icon: Plane, hex: C.orange },
  { id: "casa", label: "Casa própria", Icon: House, hex: C.blue },
  { id: "carro", label: "Comprar um carro", Icon: Car, hex: C.lilac },
  { id: "guardar", label: "Guardar dinheiro", Icon: PiggyBank, hex: C.green },
  { id: "controlar", label: "Controlar gastos", Icon: Gauge, hex: C.orange },
  { id: "investir", label: "Começar a investir", Icon: TrendingUp, hex: C.teal },
  { id: "organizar", label: "Organizar tudo", Icon: LayoutGrid, hex: C.blue },
  { id: "outro", label: "Outro sonho", Icon: Star, hex: "#fff" },
];

const DEBTS: { id: string; label: string }[] = [
  { id: "cartao", label: "Cartão de crédito" },
  { id: "cheque", label: "Cheque especial" },
  { id: "emprestimo", label: "Empréstimo" },
  { id: "financiamento", label: "Financiamento" },
  { id: "carne", label: "Carnê de loja" },
  { id: "pessoa", label: "Alguém próximo" },
];
const debtLabel = (id: string) => DEBTS.find((d) => d.id === id)?.label ?? id;

type Viz = "limit" | "dates" | "segments" | "trend";
export const HABITS: { id: string; label: string; Icon: IconC; hex: string; watch: string; viz: Viz }[] = [
  { id: "delivery", label: "Delivery", Icon: Utensils, hex: C.orange, watch: "Sugiro um limite e te aviso antes de passar dele.", viz: "limit" },
  { id: "fatura", label: "Fatura do cartão", Icon: CreditCard, hex: C.violet, watch: "Te lembro antes de fechar e antes de vencer.", viz: "dates" },
  { id: "parcelas", label: "Parcelas", Icon: Layers, hex: C.blue, watch: "Conto quantas faltam e te mostro quando a renda fica livre.", viz: "segments" },
  { id: "online", label: "Compras online", Icon: ShoppingBag, hex: C.lilac, watch: "Te mostro o total do mês e aviso quando ele sobe.", viz: "limit" },
  { id: "transporte", label: "Uber e transporte", Icon: Car, hex: C.blue, watch: "Acompanho as corridas e o total da semana.", viz: "limit" },
  { id: "mercado", label: "Mercado", Icon: ShoppingCart, hex: C.green, watch: "Comparo com os seus meses anteriores.", viz: "trend" },
  { id: "assinaturas", label: "Assinaturas", Icon: Repeat, hex: C.teal, watch: "Aviso quando uma reajusta ou fica sem uso.", viz: "trend" },
  { id: "saidas", label: "Saídas e lazer", Icon: Coffee, hex: C.orange, watch: "Te mostro quanto foi o fim de semana.", viz: "limit" },
  { id: "casa", label: "Contas da casa", Icon: House, hex: C.blue, watch: "Aviso antes de cada vencimento.", viz: "dates" },
  { id: "beleza", label: "Beleza e roupas", Icon: Sparkles, hex: C.lilac, watch: "Sugiro um limite para o mês.", viz: "limit" },
];

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function marksFor(months: number, now = new Date()) {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => MONTH_ABBR[new Date(now.getFullYear(), now.getMonth() + Math.round(months * f), 1).getMonth()]);
}

export default function Funnel({ onDone, onExit }: { onDone: (a: OnboardingAnswers, plan: PlanId | null) => void; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - 40 - 20) / 3);
  const [a, setA] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [i, setI] = useState(0);
  /* The income only counts as answered once something is typed — zero included. */
  const [incomeTyped, setIncomeTyped] = useState(false);
  const set = (patch: Partial<OnboardingAnswers>) => setA((v) => ({ ...v, ...patch }));

  const steps = useMemo<StepId[]>(() => {
    const out: StepId[] = ["name", "source", "copilot", "goal"];
    if (a.goal && (GOALS_WITH_DREAM.includes(a.goal) || a.goal === "dividas")) out.push("detail");
    out.push("goalDemo", "income");
    if (a.income > 0) out.push("hour");
    out.push("monthEnd", "quick", "card", "emergency", "habits", "watch", "ask", "building", "result", "paywall");
    return out;
  }, [a.goal, a.income]);

  const step = steps[Math.min(i, steps.length - 1)];
  const questions = steps.indexOf("building");
  const progress = Math.min(1, (i + 1) / questions);
  const first = a.name.trim().split(" ")[0];

  const next = () => setI((v) => Math.min(steps.length - 1, v + 1));
  const back = () => (i === 0 ? onExit() : setI((v) => v - 1));

  /* What each step needs before it lets you on. */
  const ready = (() => {
    switch (step) {
      case "name":
        return first.length >= 2;
      case "source":
        return !!a.source;
      case "income":
        return incomeTyped && (a.income === 0 || !!a.incomeKind);
      case "habits":
        return a.habits.length === 3;
      case "goal":
        return !!a.goal;
      case "monthEnd":
        return !!a.monthEnd;
      case "card":
        return !!a.card;
      case "emergency":
        return !!a.emergency;
      case "detail":
        return a.goal === "dividas" ? (a.debt?.total ?? 0) > 0 && (a.debt?.kinds.length ?? 0) > 0 && a.debt?.late != null : (a.dream?.amount ?? 0) > 0 && (a.goal !== "viagem" && a.goal !== "outro" ? true : (a.dream?.label.trim().length ?? 0) > 1);
      default:
        return true;
    }
  })();

  if (step === "building") return <Building a={a} onDone={next} />;
  if (step === "result") return <Result a={a} onNext={next} />;
  if (step === "paywall") return <Paywall name={first} goal={a.goal} onClose={() => onDone(a, null)} onStart={(plan) => onDone(a, plan)} />;

  const body = (() => {
    switch (step) {
      case "name":
        return (
          <Ask lead="Oi! Eu sou o Willo, e vou cuidar do seu dinheiro com você." title="Como posso" strong="te chamar?">
            <Label>Seu nome ou apelido</Label>
            <TextInput
              value={a.name}
              onChangeText={(t) => set({ name: t })}
              placeholder="Seu nome"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
              onSubmitEditing={() => ready && next()}
              selectionColor="#fff"
              style={{ height: 58, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: C.fill, paddingHorizontal: 18, fontSize: 19, fontWeight: "600", color: "#fff" }}
            />
            {first.length >= 2 && (
              <Animated.Text entering={FadeIn.duration(300)} style={{ marginTop: 12, fontSize: 14.5, color: "rgba(255,255,255,0.8)" }}>
                Prazer, {first}! Bora montar o seu perfil.
              </Animated.Text>
            )}
          </Ask>
        );

      case "source":
        return (
          <Ask lead={`Antes de começar, ${first}…`} title="Como você" strong="conheceu o Willo?">
            <View style={{ gap: 9 }}>
              {["App Store", "Instagram", "TikTok", "YouTube", "Google", "Amigo ou família", "Outro"].map((s) => (
                <Choice key={s} label={s} on={a.source === s} onPress={() => set({ source: s })} />
              ))}
            </View>
          </Ask>
        );

      case "copilot":
        return (
          <DemoStep title="Você compra." strong="O Willo anota." line="Ele pega o aviso de compra do banco e separa o gasto para você. Você só confere e confirma.">
            <NotifyDemo active />
          </DemoStep>
        );

      case "goal":
        return (
          <Ask lead={`${first}, me conta:`} title="O que você quer" strong="conquistar agora?">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {GOALS.map((g) => (
                <Tile
                  key={g.id}
                  label={g.label}
                  Icon={g.Icon}
                  hex={g.hex}
                  width={tileW}
                  on={a.goal === g.id}
                  onPress={() => set({ goal: g.id, dream: GOALS_WITH_DREAM.includes(g.id) ? { label: a.dream?.label ?? "", amount: a.dream?.amount ?? 0, months: a.dream?.months ?? 12 } : null, debt: g.id === "dividas" ? (a.debt ?? { total: 0, kinds: [], late: null }) : null })}
                />
              ))}
            </View>
            <Text style={{ marginTop: 14, fontSize: 13, lineHeight: 19, color: C.softer }}>Escolha o principal. Depois você cria quantos objetivos quiser.</Text>
          </Ask>
        );

      case "detail":
        return a.goal === "dividas" ? <DebtDetail a={a} set={set} /> : <DreamDetail a={a} set={set} />;

      case "goalDemo":
        return <GoalDemo a={a} />;

      case "income":
        return (
          <Ask lead="Agora, o tamanho do seu mês." title="Quanto você" strong="ganha por mês?">
            <Label>Por mês, já com os descontos</Label>
            <MoneyInput
              value={a.income}
              onChange={(v) => {
                setIncomeTyped(true);
                set({ income: v });
              }}
              big
            />
            <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 17, color: C.softer }}>Pode arredondar. Se hoje não entra nada, digite zero.</Text>
            <View style={{ marginTop: 20, gap: 9 }}>
              <Label>Esse valor é…</Label>
              <Choice label="Fixo" sub="Salário, aposentadoria: cai igual todo mês" on={a.incomeKind === "fixa"} onPress={() => set({ incomeKind: "fixa" })} tile={{ Icon: CalendarDays, hex: C.green }} />
              <Choice label="Varia" sub="Autônomo, comissão, freela" on={a.incomeKind === "varia"} onPress={() => set({ incomeKind: "varia" })} tile={{ Icon: TrendingUp, hex: C.orange }} />
              <Choice label="Uma parte fixa, outra varia" sub="Salário e um extra" on={a.incomeKind === "mista"} onPress={() => set({ incomeKind: "mista" })} tile={{ Icon: Layers, hex: C.blue }} />
            </View>
          </Ask>
        );

      case "hour":
        return <HourDemo income={a.income} />;

      case "monthEnd":
        return (
          <Ask lead="Sem julgamento, tá? É só para eu saber por onde começar." title="Quando o mês acaba," strong="como fica sua conta?">
            <View style={{ gap: 9 }}>
              {(
                [
                  ["sobra", "Sobra dinheiro", "E consigo guardar um pouco", C.green, TrendingUp],
                  ["zero", "Fecha no zero a zero", "Entra e sai quase igual", C.blue, Scale],
                  ["falta", "Às vezes falta", "Uns meses apertam", C.orange, AlertTriangle],
                  ["vermelho", "Quase sempre no vermelho", "Cheque especial ou cartão para fechar", C.red, TrendingDown],
                ] as const
              ).map(([id, label, sub, hex, Icon]) => (
                <Choice key={id} label={label} sub={sub} on={a.monthEnd === id} onPress={() => set({ monthEnd: id })} tile={{ Icon: Icon, hex: hex }} />
              ))}
            </View>
          </Ask>
        );

      case "quick":
        return (
          <DemoStep title="Dois toques." strong="Pronto, anotado." line="Duas batidinhas atrás do celular e o registro rápido abre, de qualquer tela.">
            <QuickTap />
          </DemoStep>
        );

      case "card":
        return (
          <Ask lead="Agora o cartão, que é onde muita gente se perde." title="E a fatura do cartão," strong="como é com ela?">
            <View style={{ gap: 9 }}>
              {(
                [
                  ["acompanho", "Pago tudo e acompanho", "Sei quanto vem antes de chegar", C.green, CircleCheck],
                  ["nao-acompanho", "Pago tudo, mas não acompanho", "Só descubro o valor quando chega", C.blue, EyeOff],
                  ["parcelo", "Às vezes parcelo a fatura", "Ou pago só uma parte", C.orange, Layers],
                  ["sem-cartao", "Não uso cartão de crédito", "Débito, Pix ou dinheiro", C.lilac, Wallet],
                ] as const
              ).map(([id, label, sub, hex, Icon]) => (
                <Choice key={id} label={label} sub={sub} on={a.card === id} onPress={() => set({ card: id })} tile={{ Icon: Icon, hex: hex }} />
              ))}
            </View>
          </Ask>
        );

      case "emergency":
        return (
          <Ask lead="Uma situação rápida, só para eu entender." title="Um gasto de R$ 1.000" strong="amanhã. E agora?">
            <View style={{ gap: 9 }}>
              {(
                [
                  ["reserva", "Usaria minha reserva", "Tenho um dinheiro guardado para isso", C.green, Shield],
                  ["mes", "Tiraria do dinheiro do mês", "E apertaria o resto", C.blue, Wallet],
                  ["parcelaria", "Parcelaria no cartão", "E pagaria aos poucos", C.orange, CreditCard],
                  ["nao-conseguiria", "Não conseguiria pagar", "Hoje não teria de onde tirar", C.red, AlertTriangle],
                ] as const
              ).map(([id, label, sub, hex, Icon]) => (
                <Choice key={id} label={label} sub={sub} on={a.emergency === id} onPress={() => set({ emergency: id })} tile={{ Icon: Icon, hex: hex }} />
              ))}
            </View>
          </Ask>
        );

      case "habits":
        return (
          <Ask lead="Agora o que mais importa no dia a dia." title="O que pesa" strong="todo mês?">
            <Label>{a.habits.length < 3 ? `Escolha 3. Faltam ${3 - a.habits.length}.` : "Pronto, são esses 3 que eu vou vigiar."}</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {HABITS.map((h) => {
                const on = a.habits.includes(h.id);
                return (
                  <Choice
                    key={h.id}
                    label={h.label}
                    on={on}
                    style={{ width: "48.6%", minHeight: 52, paddingHorizontal: 12 }}
                    icon={<h.Icon size={17} color={on ? "#0B0B0B" : h.hex} strokeWidth={2.2} />}
                    onPress={() => set({ habits: on ? a.habits.filter((x) => x !== h.id) : a.habits.length >= 3 ? a.habits : [...a.habits, h.id] })}
                  />
                );
              })}
            </View>
          </Ask>
        );

      case "watch":
        return <WatchDemo habits={a.habits} />;

      case "ask":
        return (
          <DemoStep title="Pergunte qualquer coisa." strong="Eu respondo com os seus números." line="Sem resposta pronta: eu penso no seu mês e te mostro.">
            <AskDemo active />
          </DemoStep>
        );

    }
    return null;
  })();

  const isDemo = step === "copilot" || step === "quick" || step === "ask";
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex={step === "goalDemo" || step === "detail" ? (GOALS.find((g) => g.id === a.goal)?.hex ?? C.violet) : step === "hour" ? C.green : C.violet} />
      <KeyboardAvoidingView style={{ flex: 1, paddingTop: insets.top + 6 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Header section={SECTION[step] ?? ""} progress={progress} onBack={back} />
        {isDemo ? (
          <Animated.View key={step} entering={FadeInRight.duration(420).easing(Easing.out(Easing.cubic))} style={{ flex: 1 }}>
            {body}
          </Animated.View>
        ) : (
          <Animated.View key={step} entering={FadeInRight.duration(420).easing(Easing.out(Easing.cubic))} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {body}
            </ScrollView>
          </Animated.View>
        )}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
          <Cta label="Continuar" disabled={!ready} onPress={next} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────────── */

/** A screen that shows the app at work: a title, then the real demonstration under it. */
function DemoStep({ title, strong, line, children }: { title: string; strong: string; line: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [h, setH] = useState(0);
  const scale = h > 0 && h < 440 ? h / 440 : 1;
  return (
    <View style={{ flex: 1 }}>
      <Title title={title} strong={strong} line={line} />
      <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {h > 0 && (
          <Animated.View entering={FadeIn.delay(250).duration(500)} style={{ width: width - 48, alignItems: "center", transform: [{ scale }] }}>
            {children}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function GoalTile({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon: ReactNode }) {
  return (
    <Choice
      label=""
      on={false}
      onPress={onPress}
      style={{ width: "31.4%", height: 102, minHeight: 0, padding: 0, paddingHorizontal: 0, paddingVertical: 0, flexDirection: "column", justifyContent: "center", gap: 8, backgroundColor: on ? "#fff" : C.fill, borderColor: on ? "#fff" : C.line }}
      icon={
        <View style={{ alignItems: "center", gap: 9, width: "100%" }}>
          {icon}
          <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 15, fontWeight: on ? "800" : "600", color: on ? "#0B0B0B" : "#fff", textAlign: "center", paddingHorizontal: 6 }}>
            {label}
          </Text>
        </View>
      }
    />
  );
}

const DREAM_COPY: Partial<Record<GoalId, { lead: string; title: string; strong: string; what?: string; amount: string }>> = {
  viagem: { lead: "Uma viagem, adorei!", title: "Me conta", strong: "como ela vai ser", what: "Para onde?", amount: "Quanto deve custar, mais ou menos?" },
  casa: { lead: "A casa própria, que plano!", title: "Quanto você precisa", strong: "juntar para a entrada?", amount: "Valor da entrada" },
  carro: { lead: "Um carro novo, bora!", title: "Quanto você quer", strong: "juntar para ele?", amount: "Valor do carro ou da entrada" },
  guardar: { lead: "Guardar é o melhor começo.", title: "Quanto você", strong: "quer juntar?", amount: "Quanto quer ter guardado" },
  outro: { lead: "Todo sonho cabe num plano.", title: "Me conta", strong: "qual é o seu sonho", what: "Qual é o sonho?", amount: "Quanto custa, mais ou menos?" },
};

function DreamDetail({ a, set }: { a: OnboardingAnswers; set: (p: Partial<OnboardingAnswers>) => void }) {
  const copy = DREAM_COPY[a.goal ?? "outro"] ?? DREAM_COPY.outro!;
  const dream = a.dream ?? { label: "", amount: 0, months: 12 };
  const put = (p: Partial<typeof dream>) => set({ dream: { ...dream, ...p } });
  return (
    <Ask lead={copy.lead} title={copy.title} strong={copy.strong}>
      {copy.what ? (
        <View style={{ marginBottom: 20 }}>
          <Label>{copy.what}</Label>
          <TextInput
            value={dream.label}
            onChangeText={(t) => put({ label: t })}
            placeholder={a.goal === "viagem" ? "Ex.: Nordeste com a família" : "Ex.: meu curso de fotografia"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            selectionColor="#fff"
            style={{ height: 54, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: C.fill, paddingHorizontal: 16, fontSize: 16, fontWeight: "600", color: "#fff" }}
          />
        </View>
      ) : null}
      <Label>{copy.amount}</Label>
      <MoneyInput value={dream.amount} onChange={(v) => put({ amount: v })} />
      {dream.amount > 0 && (
        <Animated.Text entering={FadeIn.duration(260)} style={{ marginTop: 9, fontSize: 13, color: C.soft }}>
          São {brl(dream.amount / Math.max(1, dream.months))} por mês até {dream.months === 12 ? "daqui a 1 ano" : dream.months === 24 ? "daqui a 2 anos" : `daqui a ${dream.months} meses`}.
        </Animated.Text>
      )}
      <View style={{ marginTop: 22 }}>
        <Label>Para quando?</Label>
        <Segments
          value={dream.months}
          onChange={(m) => put({ months: m })}
          options={[
            { id: 3, label: "3 meses" },
            { id: 6, label: "6 meses" },
            { id: 12, label: "1 ano" },
            { id: 24, label: "2 anos" },
          ]}
        />
      </View>
    </Ask>
  );
}

function DebtDetail({ a, set }: { a: OnboardingAnswers; set: (p: Partial<OnboardingAnswers>) => void }) {
  const debt = a.debt ?? { total: 0, kinds: [], late: null };
  const put = (p: Partial<typeof debt>) => set({ debt: { ...debt, ...p } });
  return (
    <Ask lead="Bora resolver isso juntos, sem julgamento." title="Como estão" strong="suas dívidas hoje?">
      <Label>Quanto você deve, somando tudo?</Label>
      <MoneyInput value={debt.total} onChange={(v) => put({ total: v })} />
      <Text style={{ marginTop: 8, fontSize: 12.5, color: C.softer }}>Um valor aproximado já ajuda.</Text>
      <View style={{ marginTop: 20 }}>
        <Label>De onde vêm? Marque quantas quiser</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DEBTS.map((d) => {
            const on = debt.kinds.includes(d.id);
            return <Chip key={d.id} label={d.label} on={on} onPress={() => put({ kinds: on ? debt.kinds.filter((k) => k !== d.id) : [...debt.kinds, d.id] })} />;
          })}
        </View>
      </View>
      <View style={{ marginTop: 20 }}>
        <Label>Alguma está atrasada?</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Choice label="Sim" on={debt.late === true} onPress={() => put({ late: true })} />
          </View>
          <View style={{ flex: 1 }}>
            <Choice label="Não, em dia" on={debt.late === false} onPress={() => put({ late: false })} />
          </View>
        </View>
      </View>
    </Ask>
  );
}

const GOAL_TITLE: Partial<Record<GoalId, [string, string]>> = {
  viagem: ["Sua viagem", "já tem caminho."],
  casa: ["Sua casa", "já tem caminho."],
  carro: ["Seu carro", "já tem caminho."],
  guardar: ["Seu dinheiro", "guardado, com data."],
  outro: ["Seu sonho", "já tem caminho."],
};

function GoalDemo({ a }: { a: OnboardingAnswers }) {
  if (a.goal === "dividas" && a.debt) {
    const order = debtOrder(a.debt.kinds);
    return (
      <View>
        <Title title="Dá para sair." strong="Uma de cada vez." line={order.length ? `Eu começo pela de juros mais caros: ${debtLabel(order[0]).toLowerCase()}. E te mostro a dívida diminuindo, mês a mês.` : "Eu começo pela de juros mais caros e te mostro a dívida diminuindo, mês a mês."} />
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
          <Evolution dir="down" from={brl(a.debt.total)} to="R$ 0" toLabel="LIVRE" marks={["hoje", "", "", "", "livre"]} accent={C.green} />
          {order.length > 0 && (
            <Card style={{ gap: 12 }}>
              <Eyebrow>A ORDEM QUE EU SUGIRO</Eyebrow>
              {order.map((k, n) => (
                <Animated.View key={k} entering={FadeInDown.delay(1600 + n * 140).duration(380)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: n === 0 ? "#fff" : "rgba(255,255,255,0.1)" }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: n === 0 ? "#0B0B0B" : "#fff" }}>{n + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, color: "#fff" }}>{debtLabel(k)}</Text>
                  {n === 0 && <Text style={{ fontSize: 12, color: C.softer }}>juros mais caros</Text>}
                </Animated.View>
              ))}
            </Card>
          )}
        </View>
      </View>
    );
  }

  if (a.goal && a.dream && GOALS_WITH_DREAM.includes(a.goal)) {
    const g = GOALS.find((x) => x.id === a.goal)!;
    const plan = dreamPlan(a.dream);
    const [t, s] = GOAL_TITLE[a.goal] ?? ["Seu sonho", "já tem caminho."];
    return (
      <View>
        <Title title={t} strong={s} line={`Guardando ${brl(plan.monthly)} por mês, fica pronto em ${plan.ready}. Eu crio a caixinha e te mostro ela enchendo.`} />
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
          <Evolution dir="up" from="R$ 0" to={brl(a.dream.amount)} marks={marksFor(plan.months)} accent={g.hex === "#fff" ? C.green : g.hex} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Stat label="POR MÊS" value={brl(plan.monthly)} delay={1500} />
            <Stat label="PRONTO EM" value={plan.ready} accent={C.green} delay={1650} />
          </View>
        </View>
      </View>
    );
  }

  if (a.goal === "investir") {
    return (
      <View>
        <Title title="Primeiro a base," strong="depois o crescimento." line="Antes de investir, eu te ajudo a montar uma reserva. Depois ela cresce com constância, todo mês." />
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Evolution dir="up" from="Hoje" to="Reserva pronta" marks={marksFor(12)} accent={C.teal} />
        </View>
      </View>
    );
  }

  return (
    <DemoStep title="Seu mês," strong="antes do fim." line="Eu te mostro quanto sobra no dia 30 e simulo um gasto antes de você fazer.">
      <ForecastDemo active />
    </DemoStep>
  );
}

function Stat({ label, value, accent = "#fff", delay = 0 }: { label: string; value: string; accent?: string; delay?: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Pop delay={delay}>
        <Card style={{ padding: 14, gap: 4 }}>
          <Eyebrow>{label}</Eyebrow>
          <Text style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: accent }}>{value}</Text>
        </Card>
      </Pop>
    </View>
  );
}

function HourDemo({ income }: { income: number }) {
  const v = hourValue(income);
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setK((x) => (x >= 40 ? (clearInterval(t), x) : x + 1)), 22);
    return () => clearInterval(t);
  }, []);
  const shown = v * (1 - Math.pow(1 - k / 40, 3));
  const examples: [IconC, string, string, number][] = [
    [Utensils, C.orange, "Um delivery de R$ 45", 45],
    [ShoppingBag, C.lilac, "Um tênis de R$ 300", 300],
    [Repeat, C.teal, "Uma assinatura de R$ 40", 40],
  ];
  return (
    <View>
      <Title title="Cada gasto custa" strong="horas da sua vida." line={`Com ${brl(income)} por mês, eu calculo quanto trabalho cada compra vale. Decidir fica muito mais fácil.`} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
        <Card style={{ overflow: "hidden" }}>
          <LinearGradient colors={["rgba(103,205,103,0.18)", "rgba(103,205,103,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
          <Eyebrow>SUA HORA VALE</Eyebrow>
          <Text style={{ marginTop: 4, fontSize: 50, lineHeight: 58, fontWeight: "800", letterSpacing: -1.8, color: "#fff", fontVariant: ["tabular-nums"] }}>{brl(shown)}</Text>
          <Text style={{ fontSize: 12.5, color: C.softer }}>Contando 220 horas de trabalho por mês</Text>
        </Card>
        {examples.map(([Icon, hex, label, price], n) => (
          <Animated.View key={label} entering={FadeInDown.delay(900 + n * 220).duration(420)}>
            <View style={{ borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <IconTile Icon={Icon} hex={hex} size={38} />
              <Text style={{ flex: 1, fontSize: 14, color: "#fff" }}>{label}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "800", color: "#fff" }}>{workTime(price, income)}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/** A thin bar that fills when it appears. */
function Fill({ to, hex, delay = 0, height = 6 }: { to: number; hex: string; delay?: number; height?: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withDelay(delay, withTiming(to, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [w, to, delay]);
  const style = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: hex }, style]} />
    </View>
  );
}

function HabitViz({ viz, hex, delay }: { viz: Viz; hex: string; delay: number }) {
  if (viz === "dates")
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {["Antes de fechar", "Antes de vencer"].map((t) => (
          <View key={t} style={{ height: 26, borderRadius: 13, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${hex}1F` }}>
            <Bell size={11} color={hex} strokeWidth={2.4} />
            <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff" }}>{t}</Text>
          </View>
        ))}
      </View>
    );
  if (viz === "segments")
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: 12 }, (_, n) => (
          <Animated.View key={n} entering={FadeIn.delay(delay + n * 45).duration(200)} style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: n < 8 ? hex : "rgba(255,255,255,0.12)" }} />
        ))}
      </View>
    );
  if (viz === "trend")
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height: 26 }}>
        {[0.55, 0.7, 0.62, 0.85, 0.66, 0.5].map((v, n) => (
          <Animated.View key={n} entering={FadeInDown.delay(delay + n * 60).duration(300)} style={{ flex: 1, height: 26 * v, borderRadius: 4, backgroundColor: n === 5 ? hex : `${hex}55` }} />
        ))}
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      <Fill to={0.8} hex={hex} delay={delay} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 11, color: C.softer }}>Seu limite</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>aviso aos 80%</Text>
      </View>
    </View>
  );
}

function WatchDemo({ habits }: { habits: string[] }) {
  const list = habits.map((id) => HABITS.find((h) => h.id === id)!).filter(Boolean);
  return (
    <View>
      <Title title="Você vive." strong="Eu fico de olho." line={`Para ${list.length === 1 ? "o que você marcou" : `os ${list.length} que você marcou`}, eu já sei o que fazer.`} />
      <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 12 }}>
        {list.map((h, n) => (
          <Animated.View key={h.id} entering={FadeInDown.delay(250 + n * 260).springify().damping(16).stiffness(140)}>
            <Card style={{ gap: 14, overflow: "hidden" }}>
              <LinearGradient colors={[`${h.hex}22`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                <IconTile Icon={h.Icon} hex={h.hex} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{h.label}</Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: C.soft }}>{h.watch}</Text>
                </View>
              </View>
              <HabitViz viz={h.viz} hex={h.hex} delay={600 + n * 260} />
            </Card>
          </Animated.View>
        ))}
        <Animated.View entering={FadeIn.delay(400 + list.length * 260).duration(500)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, paddingTop: 4 }}>
          <Zap size={16} color={C.teal} strokeWidth={2.4} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: C.soft }}>E o Copilot anota sozinho cada compra que o banco avisar.</Text>
        </Animated.View>
      </View>
    </View>
  );
}

/* ── Putting it together ───────────────────────────────────────────────────── */

/* The financial profile's five stages, lowest first: where the journey card climbs. */
const STAGES = ["Recomeço", "Apagando incêndios", "Equilíbrio", "Construção", "Crescimento"];

const BUILD_MS = 4600;

function Building({ a, onDone }: { a: OnboardingAnswers; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);
  const [pct, setPct] = useState(0);
  const goal = GOALS.find((g) => g.id === a.goal);
  const lines = [
    a.income > 0 ? "Calculando sua hora de trabalho" : "Entendendo o seu mês",
    a.goal === "dividas" ? "Traçando o caminho para sair das dívidas" : goal ? `Planejando: ${goal.label.toLowerCase()}` : "Pensando no seu objetivo",
    "Escolhendo o que acompanhar de perto",
    "Montando o seu perfil financeiro",
  ];
  useEffect(() => {
    p.set(withTiming(1, { duration: BUILD_MS, easing: Easing.inOut(Easing.quad) }));
    const start = Date.now();
    const t = setInterval(() => {
      const f = Math.min(1, (Date.now() - start) / BUILD_MS);
      const eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      setPct(Math.round(eased * 100));
      if (f >= 1) {
        clearInterval(t);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setTimeout(onDone, 900);
      }
    }, 33);
    return () => clearInterval(t);
    // Runs once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* A step shows once the one before it is done and its line has drawn down to it. */
  const shown = lines.filter((_, n) => n === 0 || pct >= n * 25 + 5).length;
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center" }}>
      <Aura hex="#8FA4C8" top={-60} height={720} />
      <Ring p={p} label={`${pct}%`} />
      <Text style={{ marginTop: 30, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>{pct >= 100 ? "Tudo pronto!" : "Montando o seu perfil"}</Text>
      <View style={{ marginTop: 26, width: 290, minHeight: 4 * 48 }}>
        {lines.slice(0, shown).map((l, n) => (
          <TimelineStep key={l} label={l} done={pct >= (n + 1) * 25} last={n === lines.length - 1} />
        ))}
      </View>
    </Animated.View>
  );
}

/** One step of the loading timeline: a dot that fills when done, and the line down to the next. */
function TimelineStep({ label, done, last }: { label: string; done: boolean; last: boolean }) {
  const line = useSharedValue(0);
  useEffect(() => {
    if (done && !last) line.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [done, last, line]);
  const grow = useAnimatedStyle(() => ({ height: 26 * line.get() }));
  return (
    <Animated.View entering={FadeIn.duration(380)} style={{ flexDirection: "row", gap: 14 }}>
      <View style={{ width: 22, alignItems: "center" }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: done ? "#fff" : "transparent", borderWidth: done ? 0 : 1.5, borderColor: "rgba(255,255,255,0.75)" }}>
          {done && (
            <Animated.View entering={ZoomIn.duration(260)}>
              <Check size={13} color="#0B0B0B" strokeWidth={3.2} />
            </Animated.View>
          )}
        </View>
        {!last && (
          <View style={{ width: 2, height: 26, marginVertical: 1, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <Animated.View style={[{ width: 2, backgroundColor: "#fff" }, grow]} />
          </View>
        )}
      </View>
      <Text style={{ flex: 1, marginTop: 1, fontSize: 14.5, lineHeight: 20, fontWeight: done ? "500" : "700", color: done ? "rgba(255,255,255,0.7)" : "#fff" }}>{label}</Text>
    </Animated.View>
  );
}

/** A thin line across, between the result's sections. */
function Rule() {
  return <View style={{ height: 1, marginVertical: 26, backgroundColor: "rgba(255,255,255,0.08)" }} />;
}

function Result({ a, onNext }: { a: OnboardingAnswers; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const prof = profileOf(a);
  const first = a.name.trim().split(" ")[0];
  const goal = GOALS.find((g) => g.id === a.goal);
  const habits = a.habits.map((id) => HABITS.find((h) => h.id === id)!).filter(Boolean);
  const debt = a.goal === "dividas" && a.debt ? debtPlan(a.debt.total, a.income) : null;
  const dream = a.dream && a.dream.amount > 0 ? dreamPlan(a.dream) : null;
  const ranked = [...prof.traits].sort((x, y) => y.value - x.value);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const stage = Math.max(0, STAGES.indexOf(prof.type));

  /* The charts play when they are scrolled to, not before. */
  const tops = useRef<Record<string, number>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const look = (y: number) => {
    const fresh: Record<string, boolean> = {};
    for (const [k, top] of Object.entries(tops.current)) if (!seen[k] && y + height * 0.82 > top) fresh[k] = true;
    if (Object.keys(fresh).length) setSeen((v) => ({ ...v, ...fresh }));
  };
  const mark = (k: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    tops.current[k] = e.nativeEvent.layout.y;
    look(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex="#8FA4C8" top={-180} />
      <ScrollView onScroll={(e) => look(e.nativeEvent.contentOffset.y)} scrollEventThrottle={64} contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", gap: 16 }}>
          <View style={{ width: 64, height: 64 }}>
            <WilloBot size={64} />
          </View>
          <Text style={{ fontSize: 27, lineHeight: 33, fontWeight: "300", letterSpacing: -0.5, color: "#fff", textAlign: "center" }}>
            {first}, seu perfil{"\n"}
            <Text style={{ fontWeight: "800" }}>financeiro está pronto.</Text>
          </Text>
        </Animated.View>

        {/* The profile, on the ground itself. */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ marginTop: 30 }}>
          <Eyebrow>SEU PERFIL · ESTIMADO</Eyebrow>
          <Text style={{ marginTop: 8, fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: "#fff" }}>{prof.type}</Text>
          <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: C.soft }}>{prof.line}</Text>
          <View style={{ marginTop: 20, gap: 14 }}>
            {prof.traits.map((t, n) => (
              <View key={t.label} style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13.5, color: "rgba(255,255,255,0.78)" }}>{t.label}</Text>
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{t.word}</Text>
                </View>
                <Fill to={t.value} hex="#fff" delay={500 + n * 140} height={4} />
              </View>
            ))}
          </View>
        </Animated.View>

        <Rule />

        {/* Where they are, and where they are going. */}
        <View onLayout={mark("journey")}>
          <Eyebrow>SUA JORNADA</Eyebrow>
          <View style={{ marginTop: 6, marginHorizontal: -8 }}>
            <Journey stages={STAGES} at={stage} play={!!seen.journey} />
          </View>
          <Text style={{ marginTop: 4, fontSize: 14.5, lineHeight: 21, color: C.soft }}>
            {stage < STAGES.length - 1 ? (
              <>
                Você está em <Text style={{ fontWeight: "800", color: "#fff" }}>{prof.type}</Text>. A próxima etapa é <Text style={{ fontWeight: "800", color: "#fff" }}>{STAGES[stage + 1]}</Text>, e eu te levo até lá.
              </>
            ) : (
              <>
                Você já está em <Text style={{ fontWeight: "800", color: "#fff" }}>{prof.type}</Text>. Agora é manter o ritmo, comigo de olho.
              </>
            )}
          </Text>
        </View>

        <Rule />

        <View style={{ flexDirection: "row" }}>
          {[best, worst].map((t, n) => (
            <View key={t.label} style={{ flex: 1, gap: 8, paddingRight: n === 0 ? 16 : 0, paddingLeft: n === 1 ? 16 : 0, borderLeftWidth: n === 1 ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.08)" }}>
              {n === 0 ? <TrendingUp size={18} color="rgba(255,255,255,0.85)" strokeWidth={2} /> : <AlertTriangle size={18} color="rgba(255,255,255,0.85)" strokeWidth={2} />}
              <Eyebrow>{n === 0 ? "PONTO FORTE" : "PEDE ATENÇÃO"}</Eyebrow>
              <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "700", color: "#fff" }}>{t.label}</Text>
            </View>
          ))}
        </View>

        {a.income > 0 && (
          <>
            <Rule />
            <View style={{ gap: 4 }}>
              <Eyebrow>SUA HORA DE TRABALHO</Eyebrow>
              <Text style={{ marginTop: 4, fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: "#fff" }}>
                {brl(hourValue(a.income))}
                <Text style={{ fontSize: 15, fontWeight: "600", letterSpacing: 0, color: C.soft }}> por hora</Text>
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: C.soft }}>Um delivery de R$ 45 custa {workTime(45, a.income)}.</Text>
            </View>
          </>
        )}

        {goal && (dream || (a.goal === "dividas" && a.debt)) && (
          <>
            <Rule />
            <View onLayout={mark("goal")} style={{ gap: 12 }}>
              <Eyebrow>{a.goal === "dividas" ? "SAIR DAS DÍVIDAS" : (a.dream?.label || goal.label).toUpperCase().slice(0, 30)}</Eyebrow>
              {a.goal === "dividas" && a.debt ? (
                <Evolution play={!!seen.goal} dir="down" from={brl(a.debt.total)} to="R$ 0" fromLabel="HOJE" toLabel="LIVRE" marks={debt ? marksFor(debt.months) : ["hoje", "", "", "", "livre"]} accent="#fff" />
              ) : dream && a.dream ? (
                <Evolution play={!!seen.goal} dir="up" from="R$ 0" to={brl(a.dream.amount)} fromLabel="HOJE" marks={marksFor(dream.months)} accent="#fff" />
              ) : null}
              <Text style={{ fontSize: 14, lineHeight: 20, color: C.soft }}>
                {a.goal === "dividas"
                  ? debt
                    ? `Separando ${brl(debt.monthly)} por mês, você fica livre por volta de ${debt.free}. Uma prévia: eu ajusto com os seus números quando você entrar.`
                    : "Eu monto o caminho com os seus números quando você entrar."
                  : dream
                    ? `${brl(dream.monthly)} por mês e fica pronto em ${dream.ready}. A caixinha já nasce criada.`
                    : ""}
              </Text>
            </View>
          </>
        )}

        <Rule />

        <View style={{ gap: 4 }}>
          <Eyebrow>VOU ACOMPANHAR DE PERTO</Eyebrow>
          {habits.map((h, n) => (
            <View key={h.id} style={{ flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 14, borderTopWidth: n ? 1 : 0, borderTopColor: "rgba(255,255,255,0.07)" }}>
              <h.Icon size={20} color="rgba(255,255,255,0.88)" strokeWidth={1.9} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{h.label}</Text>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.soft }}>{h.watch}</Text>
              </View>
            </View>
          ))}
        </View>

        <Rule />

        <View>
          <Eyebrow>SEUS PRIMEIROS 30 DIAS</Eyebrow>
          {(
            [
              ["HOJE", "Ativar o Willo Copilot", "Seus gastos começam a se anotar sozinhos."],
              ["SEMANA 1", "Eu aprendo o seu mês", "Entradas, contas fixas e o que pesa."],
              ["SEMANA 2", `Limites para ${habits[0]?.label.toLowerCase() ?? "o que pesa"}`, "Eu sugiro, você confirma."],
              ["DIA 30", "Seu primeiro relatório", "E o perfil deixa de ser estimado."],
            ] as const
          ).map(([when, what, line], n, all) => (
            <View key={when} style={{ flexDirection: "row", gap: 14, marginTop: n === 0 ? 16 : 0 }}>
              <View style={{ alignItems: "center", width: 14 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 3, backgroundColor: n === 0 ? "#fff" : C.bg, borderWidth: 2, borderColor: n === 0 ? "#fff" : "rgba(255,255,255,0.35)" }} />
                {n < all.length - 1 && <View style={{ flex: 1, width: 2, marginVertical: 3, backgroundColor: "rgba(255,255,255,0.12)" }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: n < all.length - 1 ? 18 : 0, gap: 2 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, color: n === 0 ? "#fff" : C.softer }}>{when}</Text>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{what}</Text>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.soft }}>{line}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <LinearGradient colors={["rgba(13,14,16,0)", C.bg]} locations={[0, 0.4]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 30, paddingBottom: insets.bottom + 12 }}>
        <Cta label="Vamos começar!" onPress={onNext} />
      </LinearGradient>
    </View>
  );
}
