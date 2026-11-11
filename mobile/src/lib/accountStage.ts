import type { User } from "@supabase/supabase-js";
import { supabase } from "~/supabase/client";

/**
 * Where a signed-in person is on the way into the app, kept on the account itself
 * (user metadata), so it follows them to any phone.
 *
 * - "funil": the account came first — an Apple or Google tap on "Já tenho conta" with
 *   no account behind it. The questions come next, and no account form at the end.
 * - "boas-vindas": the account and the questions are done (and, once there is one,
 *   the payment): the welcome comes next.
 * - nothing: in the app. Every account from before this existed reads as in the app.
 */

export type AccountStage = "funil" | "boas-vindas" | "app";

export function stageOf(user: User | null | undefined): AccountStage {
  const v = (user?.user_metadata as { willo_onboarding?: string } | undefined)?.willo_onboarding;
  return v === "funil" || v === "boas-vindas" ? v : "app";
}

export async function setAccountStage(stage: AccountStage): Promise<void> {
  await supabase.auth.updateUser({ data: { willo_onboarding: stage === "app" ? null : stage } });
}
