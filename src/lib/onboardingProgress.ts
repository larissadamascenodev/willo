import type { OnboardingAnswers } from "@/lib/onboardingPlan";

/**
 * Remembers a finished onboarding on this device, so reopening the app
 * lands on the analysis result instead of asking everything again. Cleared
 * once the person has an account.
 */
const KEY = "willo.onboarding.v1";

export interface OnboardingProgress {
  answers: OnboardingAnswers;
  completedAt: string;
}

export function readOnboardingProgress(): OnboardingProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as OnboardingProgress) : null;
    return parsed?.answers ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // private mode / storage full: the flow still works, it just won't be remembered
  }
}

export function clearOnboardingProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
