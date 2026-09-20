export type EndOfMonthAnswer = "sobra" | "zero-a-zero" | "as-vezes-falta" | "vermelho";
export type CreditCardAnswer = "pago-acompanho" | "pago-nao-acompanho" | "parcelo-as-vezes" | "dificuldade";
export type EmergencyAnswer = "reserva" | "dinheiro-do-mes" | "parcelaria" | "nao-conseguiria";
export type ChallengeAnswer = "gastar-menos" | "guardar-dinheiro" | "entender-gastos" | "sair-dividas";

export interface OnboardingScoreFactor {
  label: string;
  value: number;
  weight: number;
  weighted: number;
  status: "saudavel" | "atencao" | "critico";
  description: string;
}

export interface OnboardingScoreResult {
  score: number;
  label: "Organizado" | "Em alerta" | "Atenção necessária";
  level: "verde" | "amarelo" | "vermelho";
  factors: OnboardingScoreFactor[];
}

export interface OnboardingQuizAnswers {
  endOfMonth: EndOfMonthAnswer;
  creditCard: CreditCardAnswer;
  emergency: EmergencyAnswer;
  challenge: ChallengeAnswer;
}

const statusFor = (value: number): "saudavel" | "atencao" | "critico" =>
  value >= 70 ? "saudavel" : value >= 40 ? "atencao" : "critico";

const END_OF_MONTH_SCORE: Record<EndOfMonthAnswer, { value: number; description: string }> = {
  sobra: { value: 100, description: "Sobra dinheiro no fim do mês — ótimo sinal" },
  "zero-a-zero": { value: 70, description: "Fecha no zero a zero — dá pra criar folga" },
  "as-vezes-falta": { value: 40, description: "Às vezes falta dinheiro no fim do mês" },
  vermelho: { value: 10, description: "Quase sempre termina no vermelho" },
};

const CREDIT_CARD_SCORE: Record<CreditCardAnswer, { value: number; description: string }> = {
  "pago-acompanho": { value: 100, description: "Paga a fatura inteira e acompanha — controle total" },
  "pago-nao-acompanho": { value: 70, description: "Paga inteira, mas nem sempre acompanha os gastos" },
  "parcelo-as-vezes": { value: 30, description: "Às vezes precisa parcelar a fatura" },
  dificuldade: { value: 10, description: "Frequentemente tem dificuldade para pagar a fatura" },
};

const EMERGENCY_SCORE: Record<EmergencyAnswer, { value: number; description: string }> = {
  reserva: { value: 100, description: "Tem uma reserva para imprevistos" },
  "dinheiro-do-mes": { value: 70, description: "Consegue pagar usando o dinheiro do mês" },
  parcelaria: { value: 40, description: "Provavelmente precisaria parcelar um imprevisto" },
  "nao-conseguiria": { value: 60, description: "Não conseguiria pagar um imprevisto agora" },
};

const CHALLENGE_SCORE: Record<ChallengeAnswer, { value: number; description: string }> = {
  "guardar-dinheiro": { value: 80, description: "Foco em guardar dinheiro — nenhum alerta crítico" },
  "entender-gastos": { value: 70, description: "Quer entender pra onde o dinheiro vai" },
  "gastar-menos": { value: 50, description: "Quer gastar menos — sinal de atenção" },
  "sair-dividas": { value: 20, description: "Quer sair das dívidas — sinal de alerta" },
};

/**
 * Simplified onboarding-quiz version of healthScoreService.calculateHealthScore.
 * Reuses the exact same 4 categories, weights and score bands as the real
 * score, but derives each factor's value from quiz answers instead of real
 * transaction data — since there's no financial history yet at this point.
 */
export function calculateOnboardingScore(answers: OnboardingQuizAnswers): OnboardingScoreResult {
  const commit = END_OF_MONTH_SCORE[answers.endOfMonth];
  const parc = CREDIT_CARD_SCORE[answers.creditCard];
  const stab = EMERGENCY_SCORE[answers.emergency];
  const alert = CHALLENGE_SCORE[answers.challenge];

  const factors: OnboardingScoreFactor[] = [
    {
      label: "Comprometimento da renda",
      value: commit.value,
      weight: 0.4,
      weighted: commit.value * 0.4,
      status: statusFor(commit.value),
      description: commit.description,
    },
    {
      label: "Parcelamentos",
      value: parc.value,
      weight: 0.25,
      weighted: parc.value * 0.25,
      status: statusFor(parc.value),
      description: parc.description,
    },
    {
      label: "Estabilidade de gastos",
      value: stab.value,
      weight: 0.2,
      weighted: stab.value * 0.2,
      status: statusFor(stab.value),
      description: stab.description,
    },
    {
      label: "Alertas do Radar",
      value: alert.value,
      weight: 0.15,
      weighted: alert.value * 0.15,
      status: statusFor(alert.value),
      description: alert.description,
    },
  ];

  const score = Math.round(factors.reduce((s, f) => s + f.weighted, 0));

  let label: OnboardingScoreResult["label"];
  let level: OnboardingScoreResult["level"];
  if (score >= 80) { label = "Organizado"; level = "verde"; }
  else if (score >= 50) { label = "Em alerta"; level = "amarelo"; }
  else { label = "Atenção necessária"; level = "vermelho"; }

  return { score, label, level, factors };
}
