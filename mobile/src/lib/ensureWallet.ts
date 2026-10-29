import { createAccount } from "@/services/transactionService";
import { WALLET } from "~/lib/bankCatalog";

/**
 * Everyone who has accounts has a wallet.
 *
 * Cash in hand is a place money is received like any other, so it is made once, for
 * anyone who already has an account, and never twice: the check is by name against
 * what was just read, and a second call while the first is still going waits for it
 * instead of making another.
 */

let inflight: Promise<boolean> | null = null;

export const isWallet = (name: string) => WALLET.match.test(name);

export function ensureWallet(userId: string, accounts: { name: string }[]): Promise<boolean> {
  if (accounts.length === 0 || accounts.some((a) => isWallet(a.name))) return Promise.resolve(false);
  if (inflight) return inflight;
  inflight = createAccount(userId, {
    name: WALLET.name,
    type: "cash",
    initial_balance: 0,
    color: WALLET.hex,
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
