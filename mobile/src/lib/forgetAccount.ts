import { forgetWarmStart } from "~/lib/warmStart";
import { forgetHeaderAvatar } from "~/lib/headerAvatar";

/* The shared services are required when used, not imported at the top: this file loads
   with the auth, before the shims give the phone `window` (see warmStart). */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Everything one account left in the app's memory, dropped.
 *
 * Several caches are kept per month, not per person: the month's transactions, the
 * invoices, the lists of accounts and cards. Signing out and into another account
 * within their few minutes showed the first account's balance, expenses and picture
 * in the second one until the screen was reloaded a few times. Called on sign-out
 * and whenever the signed-in person changes.
 */
export function forgetAccountData() {
  forgetWarmStart();
  forgetHeaderAvatar();
  try {
    require("@/services/transactionService").clearFinanceQueryCache();
    require("@/services/dashboardData").clearDashboardCache();
    require("@/lib/financeEngine").clearMaterializedCache();
    require("@/services/projection/getProjection").invalidateProjectionCache();
    require("@/services/categoryService").invalidateCustomCategoryCache();
    require("@/hooks/useRecorrentes").forgetRecorrentes();
  } catch {
    /* a service not loaded yet has nothing kept */
  }
  /* Screens already on screen read again. */
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    }
  } catch {
    /* before the shims there is nothing on screen to refresh */
  }
}
