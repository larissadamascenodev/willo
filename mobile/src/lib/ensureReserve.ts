import { RESERVE_NAME, createGoal, isReserveGoal, type Goal } from "@/services/goalService";

/**
 * The reserve is there from the start.
 *
 * The one caixinha everyone needs is the emergency reserve, and it has no amount to reach —
 * it is only filled as life allows — so it arrives already made. It is made once per person
 * on this phone: if they delete it, it stays deleted.
 */

const flag = (userId: string) => `reserve-made:${userId}`;

const remembered = (userId: string) => {
  try {
    return localStorage.getItem(flag(userId)) === "1";
  } catch {
    return false;
  }
};

const remember = (userId: string) => {
  try {
    localStorage.setItem(flag(userId), "1");
  } catch {
    /* Looked at again next time; a reserve that already exists is never made twice. */
  }
};

let making: Promise<boolean> | null = null;

/** Makes the reserve when the person has none and has not had one here. True when it did. */
export function ensureReserve(userId: string, goals: Goal[]): Promise<boolean> {
  if (goals.some(isReserveGoal)) {
    remember(userId);
    return Promise.resolve(false);
  }
  if (remembered(userId)) return Promise.resolve(false);
  if (making) return making;

  making = (async () => {
    try {
      await createGoal({ name: RESERVE_NAME, target_amount: 0 }, userId);
      remember(userId);
      return true;
    } catch {
      return false;
    } finally {
      making = null;
    }
  })();
  return making;
}
