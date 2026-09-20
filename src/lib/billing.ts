/**
 * Real billing isn't wired yet (no StoreKit / Play Billing), and Apple
 * rejects apps that advertise a subscription you can't actually buy in-app
 * (guideline 3.1.1). So every price, plan and discount screen stays hidden
 * until the purchase flow exists — flip this to true on the same day it does.
 */
export const BILLING_ENABLED = false;
