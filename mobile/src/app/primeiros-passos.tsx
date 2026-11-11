import { View } from "react-native";
import Funnel from "~/components/onboarding/Funnel";
import { useAuth } from "~/lib/auth";
import { setAccountStage } from "~/lib/accountStage";
import { markOnboarded, saveOnboardingAnswers, savePendingOnboarding } from "~/lib/onboarding";
import { supabase } from "~/supabase/client";
import { C } from "~/components/onboarding/kit";

/**
 * The questions, for someone whose account came first.
 *
 * An Apple or Google tap on "Já tenho conta" with no account behind it makes one; the
 * account is kept and the person comes here instead of the app. The same questions as
 * a newcomer's, the name already known, and no account form at the end: once the
 * profile is made (and, when there is one, paid), the welcome comes next.
 */
export default function PrimeirosPassos() {
  const { user } = useAuth();
  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; name?: string };
  const known = (meta.display_name || meta.full_name || meta.name || "").trim();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Funnel
        knownName={known || undefined}
        onSaved={(answers) => {
          void saveOnboardingAnswers(answers);
          void markOnboarded();
        }}
        /* Leaving the questions here leaves the account too: back to the start. */
        onExit={() => void supabase.auth.signOut()}
        onDone={async (answers, plan) => {
          await saveOnboardingAnswers({ ...answers, plan });
          await savePendingOnboarding({ email: user?.email ?? "", name: answers.name.trim(), goal: answers.goal, bank: null, balance: 0 });
          await setAccountStage("boas-vindas").catch(() => undefined);
        }}
      />
    </View>
  );
}
