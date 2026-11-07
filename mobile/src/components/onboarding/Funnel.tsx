import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      case "goal":
        return !!a.goal;
      case "monthEnd":
        return !!a.monthEnd;
      case "card":
        return !!a.card;
      case "emergency":
        return !!a.emergency;
      case "detail":
        return a.goal === "dividas" ? (a.debt?.total ?? 0) > 0 : (a.dream?.amount ?? 0) > 0 && (a.goal !== "viagem" && a.goal !== "outro" ? true : (a.dream?.label.trim().length ?? 0) > 1);
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
            <MoneyInput value={a.income} onChange={(v) => set({ income: v })} big />
            <Text style={{ marginTop: 8, fontSize: 12.5, color: C.softer }}>Pode arredondar. É só para eu entender o tamanho do seu mês.</Text>
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
            <Label>Marque até 3. Só preciso saber o que vigiar.</Label>
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
                    onPress={() => set({ habits: on ? a.habits.filter((x) => x !== h.id) : a.habits.length >= 3 ? [...a.habits.slice(1), h.id] : [...a.habits, h.id] })}
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
  const list = (habits.length ? habits : ["delivery", "fatura", "parcelas"]).map((id) => HABITS.find((h) => h.id === id)!).filter(Boolean);
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
  const [ready, setReady] = useState(false);
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
        setReady(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setTimeout(onDone, 1100);
      }
    }, 33);
    return () => clearInterval(t);
    // Runs once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shown = Math.min(lines.length, Math.floor(pct / 25) + 1);
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, alignItems: "center", justifyContent: "center" }}>
      <Aura hex="#8FA4C8" top={-60} height={720} />
      <View style={{ width: 196, height: 196, alignItems: "center", justifyContent: "center" }}>
        <Ring p={p} label={ready ? "" : `${pct}%`} />
        {ready && (
          <Animated.View entering={ZoomIn.springify().damping(11).stiffness(200)} style={{ position: "absolute", width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Check size={40} color="#0B0B0B" strokeWidth={3} />
          </Animated.View>
        )}
      </View>
      <Animated.Text key={ready ? "pronto" : "montando"} entering={FadeIn.duration(400)} style={{ marginTop: 30, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>
        {ready ? "Tudo pronto!" : "Montando o seu perfil"}
      </Animated.Text>
      <View style={{ marginTop: 22, gap: 14, width: 290, minHeight: 4 * 36 }}>
        {lines.slice(0, shown).map((l, n) => {
          const done = pct >= (n + 1) * 25;
          return (
            <Animated.View key={l} entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                {done ? (
                  <Animated.View entering={ZoomIn.springify().damping(12).stiffness(260)} style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                    <Check size={13} color="#0B0B0B" strokeWidth={3.2} />
                  </Animated.View>
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)" }} />
                )}
              </View>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: done ? "500" : "700", color: done ? "rgba(255,255,255,0.7)" : "#fff" }}>{l}</Text>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function Result({ a, onNext }: { a: OnboardingAnswers; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const prof = profileOf(a);
  const first = a.name.trim().split(" ")[0];
  const goal = GOALS.find((g) => g.id === a.goal);
  const habits = (a.habits.length ? a.habits : ["delivery", "fatura", "parcelas"]).map((id) => HABITS.find((h) => h.id === id)!).filter(Boolean);
  const debt = a.goal === "dividas" && a.debt ? debtPlan(a.debt.total, a.income) : null;
  const dream = a.dream && a.dream.amount > 0 ? dreamPlan(a.dream) : null;
  const traitHex = [C.blue, C.violet, C.orange, C.teal];
  const ranked = [...prof.traits].sort((x, y) => y.value - x.value);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex={C.green} top={-160} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 26, paddingHorizontal: 20, paddingBottom: 120, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", gap: 14, paddingHorizontal: 10, paddingBottom: 8 }}>
          <Pop>
            <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: C.green, alignItems: "center", justifyContent: "center" }}>
              <Check size={28} color={C.green} strokeWidth={2.8} />
            </View>
          </Pop>
          <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: "300", letterSpacing: -0.5, color: "#fff", textAlign: "center" }}>
            {first}, seu perfil{"\n"}
            <Text style={{ fontWeight: "800" }}>financeiro está pronto.</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Card style={{ gap: 16, overflow: "hidden" }}>
            <LinearGradient colors={["rgba(124,196,255,0.14)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.9 }} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow>SEU PERFIL FINANCEIRO</Eyebrow>
              <View style={{ height: 24, borderRadius: 12, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.75)" }}>Estimado</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <IconTile Icon={Target} hex={C.blue} size={54} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 23, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{prof.type}</Text>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.soft }}>{prof.line}</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {prof.traits.map((t, n) => (
                <View key={t.label} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.78)" }}>{t.label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{t.word}</Text>
                  </View>
                  <Fill to={t.value} hex={traitHex[n % traitHex.length]} delay={500 + n * 150} />
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 12, lineHeight: 17, color: C.softer }}>Ele fica mais preciso conforme você usa o app, e muda junto com você.</Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(500)}>
          <Card style={{ gap: 14 }}>
            <Eyebrow>SUA JORNADA</Eyebrow>
            <Journey stages={STAGES} at={Math.max(0, STAGES.indexOf(prof.type))} />
            <Text style={{ fontSize: 13.5, lineHeight: 19, color: C.soft }}>
              {STAGES.indexOf(prof.type) < STAGES.length - 1 ? (
                <>
                  Você está em <Text style={{ fontWeight: "800", color: "#fff" }}>{prof.type}</Text>. A próxima etapa é <Text style={{ fontWeight: "800", color: C.green }}>{STAGES[STAGES.indexOf(prof.type) + 1]}</Text>, e eu te levo até lá.
                </>
              ) : (
                <>
                  Você já está em <Text style={{ fontWeight: "800", color: "#fff" }}>{prof.type}</Text>. Agora é manter o ritmo, e eu fico de olho com você.
                </>
              )}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={{ flexDirection: "row", gap: 12 }}>
          {[best, worst].map((t, n) => (
            <Card key={t.label} style={{ flex: 1, padding: 14, gap: 8 }}>
              <IconTile Icon={n === 0 ? TrendingUp : AlertTriangle} hex={n === 0 ? C.green : C.orange} size={34} />
              <Eyebrow color={n === 0 ? C.green : C.orange}>{n === 0 ? "PONTO FORTE" : "PEDE ATENÇÃO"}</Eyebrow>
              <Text style={{ fontSize: 14.5, lineHeight: 19, fontWeight: "700", color: "#fff" }}>{t.label}</Text>
            </Card>
          ))}
        </Animated.View>

        {a.income > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <IconTile Icon={Clock2} hex={C.green} />
              <View style={{ flex: 1, gap: 2 }}>
                <Eyebrow>SUA HORA VALE</Eyebrow>
                <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{brl(hourValue(a.income))}</Text>
                <Text style={{ fontSize: 12.5, color: C.softer }}>Um delivery de R$ 45 = {workTime(45, a.income)}</Text>
              </View>
            </Card>
          </Animated.View>
        )}

        {goal && (dream || a.goal === "dividas") && (
          <Animated.View entering={FadeInDown.delay(500).duration(500)}>
            {a.goal === "dividas" && a.debt ? (
              <Evolution dir="down" from={brl(a.debt.total)} to="R$ 0" toLabel="LIVRE" fromLabel="SUAS DÍVIDAS" marks={debt ? marksFor(debt.months).map((m, n) => (n === 4 ? m : n === 0 ? "hoje" : m)) : ["hoje", "", "", "", "livre"]} accent={C.green} />
            ) : dream && a.dream ? (
              <Evolution dir="up" from="R$ 0" to={brl(a.dream.amount)} fromLabel={(a.dream.label || goal.label).toUpperCase().slice(0, 26)} marks={marksFor(dream.months)} accent={goal.hex === "#fff" ? C.green : goal.hex} />
            ) : null}
            <Text style={{ marginTop: 10, paddingHorizontal: 6, fontSize: 13, lineHeight: 19, color: C.soft }}>
              {a.goal === "dividas"
                ? debt
                  ? `Separando ${brl(debt.monthly)} por mês, você fica livre por volta de ${debt.free}. Uma prévia: eu ajusto com os seus números quando você entrar.`
                  : "Eu monto o caminho com os seus números quando você entrar."
                : dream
                  ? `${brl(dream.monthly)} por mês e fica pronto em ${dream.ready}. A caixinha já nasce criada.`
                  : ""}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(650).duration(500)}>
          <Card style={{ gap: 14 }}>
            <Eyebrow>VOU ACOMPANHAR DE PERTO</Eyebrow>
            {habits.map((h) => (
              <View key={h.id} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <IconTile Icon={h.Icon} hex={h.hex} size={38} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{h.label}</Text>
                  <Text style={{ fontSize: 12.5, lineHeight: 17, color: C.soft }}>{h.watch}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(720).duration(500)}>
          <Card style={{ gap: 0 }}>
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
                  <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 3, backgroundColor: n === 0 ? C.green : C.bg, borderWidth: 2, borderColor: n === 0 ? C.green : "rgba(255,255,255,0.35)" }} />
                  {n < all.length - 1 && <View style={{ flex: 1, width: 2, marginVertical: 3, backgroundColor: "rgba(255,255,255,0.12)" }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: n < all.length - 1 ? 16 : 0, gap: 2 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, color: n === 0 ? C.green : C.softer }}>{when}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{what}</Text>
                  <Text style={{ fontSize: 12.5, lineHeight: 17, color: C.soft }}>{line}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).duration(500)}>
          <Card style={{ gap: 14 }}>
            <Eyebrow>O QUE O WILLO FAZ POR VOCÊ</Eyebrow>
            {(
              [
                [Zap, C.teal, "Willo Copilot", "Seus gastos se anotam sozinhos. Você só confirma."],
                [Smartphone2, C.violet, "Dois toques", "Atrás do celular, e o registro rápido abre."],
                [Bell, C.orange, "Avisos na hora certa", "Contas, fatura, limites e o salário caindo."],
                [MessageIcon, C.lilac, "Pergunte qualquer coisa", "Respostas com os seus números, de verdade."],
              ] as [IconC, string, string, string][]
            ).map(([Icon, hex, t, l]) => (
              <View key={t} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <IconTile Icon={Icon} hex={hex} size={38} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{t}</Text>
                  <Text style={{ fontSize: 12.5, lineHeight: 17, color: C.soft }}>{l}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      </ScrollView>
      <LinearGradient colors={["rgba(13,14,16,0)", C.bg]} locations={[0, 0.4]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 30, paddingBottom: insets.bottom + 12 }}>
        <Cta label="Vamos começar!" onPress={onNext} />
      </LinearGradient>
    </View>
  );
}

