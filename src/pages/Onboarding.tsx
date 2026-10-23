import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AuthPanel from "@/components/auth/AuthPanel";
import {
  ComoFuncionaScreen,
  MudancaScreen,
  NomeScreen,
  TermosScreen,
} from "@/components/onboarding-v2/screens-intro";
import {
  GastosScreen,
  HoraTrabalhoScreen,
  MesScreen,
  ObjetivoScreen,
  RendaScreen,
  TipoRendaScreen,
} from "@/components/onboarding-v2/screens-money";
import {
  MetaGraficoScreen,
  MetaPrazoScreen,
  MetaValorScreen,
} from "@/components/onboarding-v2/screens-goal";
import { CategoriasScreen, ComprovanteScreen } from "@/components/onboarding-v2/screens-spending";
import {
  CompromissoScreen,
  LembretesScreen,
  LendoScreen,
  LevaScreen,
  PlanoScreen,
} from "@/components/onboarding-v2/screens-plan";
import { AntesDepoisScreen, ComunidadeScreen } from "@/components/onboarding-v2/screens-prova";
import { temDepoimentos } from "@/lib/depoimentos";
import PaywallV2 from "@/components/onboarding-v2/PaywallV2";
import { trackOnboarding } from "@/services/onboardingEvents";
import { finalizeOnboarding } from "@/services/finalizeOnboarding";
import {
  clearOnboardingState,
  derivePlan,
  INITIAL_ANSWERS,
  mostraHoraTrabalho,
  pedeValorEPrazo,
  readOnboardingState,
  saveOnboardingState,
  type OnboardingAnswers,
} from "@/lib/onboardingState";

/**
 * The onboarding, screen by screen.
 *
 * Twenty-two of them, and the welcome before them is the Welcome page, which is why the
 * first back arrow here leaves rather than going back. Three of the screens are not
 * always shown — the month needs a spending figure to subtract, the hourly rate means
 * nothing to someone whose income is not hours, and only two of the four objectives
 * have an amount to ask for — so stepping is done through `move`, never by ±1.
 *
 * Everything the person answers is kept in localStorage as they go, and dropped the
 * moment it has been written to their account.
 */

const STEPS = [
  "nome",
  "termos",
  "mudanca",
  "como",
  "objetivo",
  "tipoRenda",
  "renda",
  "gastos",
  "mes",
  "hora",
  "metaValor",
  "metaPrazo",
  "metaGrafico",
  "categorias",
  "comprovante",
  "compromisso",
  "lembretes",
  "lendo",
  "plano",
  "antesDepois",
  "leva",
  "comunidade",
  "cadastro",
  "paywall",
] as const;

type Step = (typeof STEPS)[number];

/**
 * The light behind each stretch of the flow, so a new section feels like a new room.
 *
 * Strong enough to be noticed without being looked at: it washes the top third, which
 * is where the section label and the heading live, and leaves the answers on black.
 * The hues are Willo's own — water green, coral, a cool blue — rather than the magenta
 * of the reference this was drawn from.
 */
const SECAO: Record<Step, keyof typeof AURORA> = {
  nome: "sobre",
  termos: "sobre",
  mudanca: "sobre",
  como: "sobre",
  objetivo: "objetivo",
  tipoRenda: "renda",
  renda: "renda",
  gastos: "renda",
  mes: "renda",
  hora: "renda",
  metaValor: "objetivo",
  metaPrazo: "objetivo",
  metaGrafico: "objetivo",
  categorias: "gastos",
  comprovante: "gastos",
  compromisso: "plano",
  lembretes: "plano",
  lendo: "plano",
  plano: "plano",
  antesDepois: "plano",
  leva: "plano",
  comunidade: "conta",
  cadastro: "conta",
  paywall: "conta",
};

const AURORA = {
  sobre: { esquerda: "rgba(150,190,255,0.20)", direita: "rgba(255,255,255,0.10)" },
  objetivo: { esquerda: "rgba(124,224,195,0.22)", direita: "rgba(120,180,255,0.12)" },
  renda: { esquerda: "rgba(120,180,255,0.20)", direita: "rgba(124,224,195,0.12)" },
  gastos: { esquerda: "rgba(255,170,110,0.18)", direita: "rgba(255,138,122,0.12)" },
  plano: { esquerda: "rgba(124,224,195,0.24)", direita: "rgba(150,190,255,0.12)" },
  conta: { esquerda: "rgba(255,255,255,0.12)", direita: "rgba(124,224,195,0.14)" },
} as const;

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [retomado] = useState(readOnboardingState);
  const [chegouLogada] = useState(() => Boolean(user));
  const [index, setIndex] = useState(() => {
    const salvo = retomado ? STEPS.indexOf(retomado.screen as Step) : -1;
    return salvo > 0 ? salvo : 0;
  });
  const [dir, setDir] = useState<1 | -1>(1);
  const [a, setA] = useState<OnboardingAnswers>(() => retomado?.answers ?? INITIAL_ANSWERS);

  const step: Step = STEPS[index];
  const plan = useMemo(() => derivePlan(a), [a]);

  /* The answers as of now, for the handlers that fire from a timer. */
  const atual = useRef(a);
  atual.current = a;

  const set = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }));

  /* ── Onde parou ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    /* Nothing is worth remembering until there is at least a name. */
    if (a.nome.trim()) saveOnboardingState(a, step);
  }, [a, step]);

  useEffect(() => {
    trackOnboarding(step, "view");
  }, [step]);

  /* ── Andando ────────────────────────────────────────────────────────────── */

  const pular = useCallback((st: Step, respostas: OnboardingAnswers): boolean => {
    if (st === "mes") return respostas.gastosCentavos === null;
    if (st === "hora") return !mostraHoraTrabalho(respostas.tipoRenda);
    if (st === "metaValor" || st === "metaPrazo") return !pedeValorEPrazo(respostas.objetivo);
    /* Nobody real has said anything yet, so there is nothing to show. */
    if (st === "comunidade") return !temDepoimentos();
    /* Someone who is already signed in has nothing to create. */
    if (st === "cadastro") return Boolean(user);
    return false;
  }, [user]);

  const move = useCallback((from: number, delta: 1 | -1) => {
    let i = from + delta;
    while (i > 0 && i < STEPS.length - 1 && pular(STEPS[i], atual.current)) i += delta;
    return Math.min(Math.max(i, 0), STEPS.length - 1);
  }, [pular]);

  const next = useCallback(() => {
    trackOnboarding(STEPS[index], "answer");
    setDir(1);
    setIndex((i) => move(i, 1));
  }, [index, move]);

  const back = useCallback(() => {
    if (index === 0) {
      navigate("/welcome");
      return;
    }
    setDir(-1);
    setIndex((i) => move(i, -1));
  }, [index, move, navigate]);

  const skip = useCallback((what: () => void) => {
    trackOnboarding(STEPS[index], "skip");
    what();
    setDir(1);
    setIndex((i) => move(i, 1));
  }, [index, move]);

  const goTo = useCallback((st: Step) => {
    const i = STEPS.indexOf(st);
    setDir(i >= index ? 1 : -1);
    setIndex(i);
  }, [index]);

  /* ── Salvando na conta ──────────────────────────────────────────────────── */

  const gravando = useRef(false);

  const gravar = useCallback(async (userId: string) => {
    if (gravando.current || atual.current.finalized) return;
    gravando.current = true;
    try {
      const result = await finalizeOnboarding(userId, atual.current);
      if (result.ran) {
        setA((prev) => ({ ...prev, finalized: true }));
        clearOnboardingState();
      }
    } catch {
      /* The plan is already on screen; a failed write must not trap anyone here. */
    } finally {
      gravando.current = false;
    }
  }, []);

  /* Signing in is what ends the questions: write the answers, then show the paywall. */
  useEffect(() => {
    if (!user) return;
    if (index < STEPS.indexOf("leva")) return;
    void gravar(user.id);
    if (step === "cadastro") goTo("paywall");
  }, [user, index, step, gravar, goTo]);

  const entrarNoApp = useCallback(() => {
    trackOnboarding("paywall", "finish");
    clearOnboardingState();
    navigate("/", { replace: true });
  }, [navigate]);

  /* Someone with an account who lands here fresh has already been through this. */
  if (!loading && chegouLogada && !retomado) return <Navigate to="/" replace />;

  /* ── As telas ───────────────────────────────────────────────────────────── */

  const nav = { onBack: back, onNext: next };

  const screen = (() => {
    switch (step) {
      case "nome":
        return <NomeScreen value={a.nome} onChange={(v) => set("nome", v)} {...nav} />;
      case "termos":
        return (
          <TermosScreen
            onBack={back}
            onAccept={() => {
              setA((prev) => ({ ...prev, termosAceitos: true, iaAceita: true }));
              next();
            }}
          />
        );
      case "mudanca":
        return <MudancaScreen nome={a.nome} {...nav} />;
      case "como":
        return <ComoFuncionaScreen {...nav} />;
      case "objetivo":
        return <ObjetivoScreen value={a.objetivo} onChange={(v) => set("objetivo", v)} {...nav} />;
      case "tipoRenda":
        return <TipoRendaScreen value={a.tipoRenda} onChange={(v) => set("tipoRenda", v)} {...nav} />;
      case "renda":
        return <RendaScreen value={a.rendaCentavos} onChange={(v) => set("rendaCentavos", v)} tipo={a.tipoRenda} {...nav} />;
      case "gastos":
        return (
          <GastosScreen
            value={a.gastosCentavos}
            onChange={(v) => set("gastosCentavos", v)}
            onSkip={() => skip(() => set("gastosCentavos", null))}
            {...nav}
          />
        );
      case "mes":
        return <MesScreen renda={a.rendaCentavos ?? 0} gastos={a.gastosCentavos ?? 0} {...nav} />;
      case "hora":
        return <HoraTrabalhoScreen renda={a.rendaCentavos ?? 0} tipo={a.tipoRenda} {...nav} />;
      case "metaValor":
        return (
          <MetaValorScreen
            objetivo={a.objetivo ?? "juntar"}
            valor={a.metaValorCentavos}
            onValor={(v) => set("metaValorCentavos", v)}
            nome={a.metaNome}
            onNome={(v) => set("metaNome", v)}
            {...nav}
          />
        );
      case "metaPrazo":
        return (
          <MetaPrazoScreen
            objetivo={a.objetivo ?? "juntar"}
            prazo={a.prazoMeses}
            onPrazo={(v) => set("prazoMeses", v)}
            {...nav}
          />
        );
      case "metaGrafico":
        return <MetaGraficoScreen answers={a} plan={plan} {...nav} />;
      case "categorias":
        return (
          <CategoriasScreen
            value={a.categorias}
            onChange={(v) => set("categorias", v)}
            onSkip={() => skip(() => set("categorias", []))}
            {...nav}
          />
        );
      case "comprovante":
        return <ComprovanteScreen categorias={a.categorias} {...nav} />;
      case "compromisso":
        return (
          <CompromissoScreen
            onBack={back}
            onConfirm={() => {
              set("compromisso", true);
              next();
            }}
          />
        );
      case "lembretes":
        return (
          <LembretesScreen
            onBack={back}
            onDecide={(ativar) => {
              set("notifyDueDates", ativar);
              next();
            }}
          />
        );
      case "lendo":
        return <LendoScreen onDone={next} />;
      case "plano":
        return <PlanoScreen answers={a} plan={plan} {...nav} />;
      case "antesDepois":
        return <AntesDepoisScreen answers={a} plan={plan} {...nav} />;
      case "leva":
        return <LevaScreen {...nav} />;
      case "comunidade":
        return <ComunidadeScreen {...nav} />;
      case "cadastro":
        return (
          <AuthPanel
            mode="signup"
            onBack={back}
            headingLight="Salve"
            headingBold="seu plano."
            pendingProfile={{ displayName: a.nome.trim() || undefined }}
          />
        );
      case "paywall":
        return (
          <PaywallV2
            nome={a.nome}
            onPaywallView={() => trackOnboarding("paywall", "paywall_view")}
            onCta={() => {
              trackOnboarding("paywall", "paywall_cta");
              entrarNoApp();
            }}
            onDismiss={() => {
              trackOnboarding("paywall", "paywall_close");
              setA((prev) => ({ ...prev, paywallDismissed: true }));
              if (user) void gravar(user.id);
              entrarNoApp();
            }}
          />
        );
    }
  })();

  return (
    <div
      className="relative h-[100dvh] overflow-hidden bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Two lights spilling from the top corners, re-tinted as the flow moves from one
          section to the next. They cross over the heading and fade before the answers. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-44 h-[380px] w-[380px] rounded-full blur-[100px]"
        animate={{ backgroundColor: AURORA[SECAO[step]].esquerda }}
        transition={{ duration: 0.7 }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-[320px] w-[320px] rounded-full blur-[100px]"
        animate={{ backgroundColor: AURORA[SECAO[step]].direita }}
        transition={{ duration: 0.7, delay: 0.05 }}
      />

      <div className="relative h-full overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            className="absolute inset-0"
            variants={{
              enter: (d: number) => ({ x: d > 0 ? "26%" : "-26%", opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d > 0 ? "-26%" : "26%", opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {screen}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
