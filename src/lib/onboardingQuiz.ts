/**
 * Shared flag for the pre-signup onboarding quiz (Welcome carousel -> quiz ->
 * account creation -> plans). Set right after account creation so that,
 * whenever the person's session actually becomes live (immediately for
 * Google/Apple, or later — after they click the e-mail confirmation link —
 * for e-mail/password signups, since RLS on `profiles` requires
 * `auth.uid() = id` and there's no session yet at signUp() time), the OLD
 * post-signup onboarding (name/account/first-transaction, gated by
 * `profile.has_completed_profile` in DashboardLayout.tsx) is skipped instead
 * of showing a redundant second onboarding.
 */
export const SKIP_LEGACY_ONBOARDING_KEY = "willo_skip_legacy_onboarding";

/**
 * Payload carried alongside the skip flag: the display name and the
 * quiz-estimated score, collected before an account/session exists, so
 * DashboardLayout can persist them together once a real session shows up.
 */
const PENDING_PROFILE_KEY = "willo_pending_profile";

export interface PendingOnboardingProfile {
  displayName?: string;
  initialScore?: number;
  initialScoreLabel?: string;
}

export const markSkipLegacyOnboarding = (pending?: PendingOnboardingProfile) => {
  try {
    localStorage.setItem(SKIP_LEGACY_ONBOARDING_KEY, "1");
    if (pending) {
      localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));
    }
  } catch {
    // localStorage unavailable — worst case the old onboarding shows once.
  }
};

export const readPendingOnboardingProfile = (): PendingOnboardingProfile | null => {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as PendingOnboardingProfile) : null;
  } catch {
    return null;
  }
};

export const clearPendingOnboardingProfile = () => {
  try {
    localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Flag consumed once by DashboardLayout to show the "let's finish setting
 * up" welcome modal the very first time someone lands in the app after
 * completing the new onboarding.
 */
export const SHOW_WELCOME_MODAL_KEY = "willo_show_welcome_modal";

export const markShowWelcomeModal = () => {
  try {
    localStorage.setItem(SHOW_WELCOME_MODAL_KEY, "1");
  } catch {
    // ignore
  }
};
