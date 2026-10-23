import { supabase } from "@/integrations/supabase/client";
import { derivePlan, type OnboardingAnswers } from "@/lib/onboardingState";
import { RESERVE_NAME } from "@/services/goalService";

/**
 * Turning the answers into the account.
 *
 * Called once the person has signed in, which is the last screen — so everything here
 * happens after the fact, and the flow has already shown them their plan. That makes
 * failure cheap: the worst case is an account without its first goal, which they can
 * add by hand, and never a person stuck outside the app.
 *
 * Idempotent on `answers.finalized`: the caller writes that flag back and a second run
 * does nothing. Signing in can fire more than once (a refreshed token, a remount), and
 * without this each one would add another identical goal.
 */

export interface FinalizeResult {
  /** False when the flag said this was already done. */
  ran: boolean;
  goalId: string | null;
  /** What did not get written. Empty when everything landed. */
  problemas: string[];
}

const centavosParaReais = (centavos: number) => Math.round(centavos) / 100;

/** The target date for a goal that has a month count on it. */
function prazoParaData(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().split("T")[0];
}

/** What to call the goal when the person did not name it. */
function nomeDaMeta(a: OnboardingAnswers): string {
  const dado = a.metaNome.trim();
  if (dado) return dado;
  if (a.objetivo === "dividas") return "Sair das dívidas";
  if (a.objetivo === "investir") return RESERVE_NAME;
  return "Minha meta";
}

export async function finalizeOnboarding(
  userId: string,
  answers: OnboardingAnswers,
): Promise<FinalizeResult> {
  if (answers.finalized) return { ran: false, goalId: null, problemas: [] };

  const problemas: string[] = [];
  const plano = derivePlan(answers);

  /* The answers, whole. The Radar reads the chosen categories out of here later. */
  const { error: answersError } = await supabase
    .from("onboarding_answers" as never)
    .upsert(
      {
        user_id: userId,
        answers: answers as never,
        onboarding_completed: true,
        paywall_dismissed: answers.paywallDismissed,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
  if (answersError) problemas.push("respostas");

  /* The name is the one answer that belongs on the profile, which already has a home
     for it. There is no income column, so the income stays in the answers above. */
  if (answers.nome.trim()) {
    const { error } = await supabase
      .from("profiles" as never)
      .update({ display_name: answers.nome.trim(), has_completed_profile: true } as never)
      .eq("id", userId);
    if (error) problemas.push("perfil");
  }

  const goalId = await criarMeta(userId, answers, plano, problemas);
  return { ran: true, goalId, problemas };
}

async function criarMeta(
  userId: string,
  a: OnboardingAnswers,
  plano: ReturnType<typeof derivePlan>,
  problemas: string[],
): Promise<string | null> {
  /* Organising the month is not a goal; it is what the app does every day. */
  if (a.objetivo === "organizar" || a.objetivo === null) return null;

  const alvo = a.objetivo === "investir" ? plano.reserva?.minima ?? null : a.metaValorCentavos;
  if (!alvo || alvo <= 0) return null;

  const linha = {
    user_id: userId,
    name: nomeDaMeta(a),
    /* The goals table has always held reais, so the centavos stop here. */
    target_amount: centavosParaReais(alvo),
    monthly_contribution: plano.metaMensal ? centavosParaReais(plano.metaMensal) : null,
    deadline: a.prazoMeses ? prazoParaData(a.prazoMeses) : null,
    tipo: a.objetivo === "dividas" ? "quitar" : "juntar",
  };

  const { data, error } = await supabase.from("goals" as never).insert(linha as never).select("id").single();
  if (!error) return (data as { id: string } | null)?.id ?? null;

  /* Before the migration is applied there is no `tipo` column. Writing the goal
     without it is better than not writing it at all: the column defaults to 'juntar'
     the moment it exists, which is right for everything but a debt. */
  const { tipo, ...semTipo } = linha;
  const retry = await supabase.from("goals" as never).insert(semTipo as never).select("id").single();
  if (retry.error) {
    problemas.push("meta");
    return null;
  }
  if (tipo === "quitar") problemas.push("tipo da meta (migration ainda não aplicada)");
  return (retry.data as { id: string } | null)?.id ?? null;
}
