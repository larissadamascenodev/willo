/**
 * Willo PRO through the App Store, by way of RevenueCat.
 *
 * RevenueCat keeps the subscriptions: it reads the App Store's receipts, knows who is
 * in the free week, who pays and who has stopped, and answers one question — is
 * "pro" active for this person. The person is known to it by their Willo account id,
 * so a subscription bought on one iPhone follows the account to another.
 *
 * Expo Go has no App Store purchases (it is Expo's app, not ours): there everything
 * behaves as if bought, so the rest of the app can be walked through while testing.
 */
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

/** The App Store app's public key in RevenueCat. Public by design: it only identifies the app. */
const IOS_KEY = "appl_yXBQHaHFsggjWyxuTYystRSXjOs";

/** What a subscription unlocks, as named in RevenueCat. */
export const ENTITLEMENT = "pro";

type Sdk = typeof import("react-native-purchases").default;

/** Real purchases only in a build of our own on an iPhone. */
export const purchasesLive = () => Platform.OS === "ios" && Constants.appOwnership !== "expo" && IOS_KEY.length > 0;

let sdkRef: Sdk | null = null;
function sdk(): Sdk | null {
  if (!purchasesLive()) return null;
  if (!sdkRef) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdkRef = (require("react-native-purchases") as { default: Sdk }).default;
    /* Set up on first use, so it is ready whichever call comes first. */
    sdkRef.configure({ apiKey: IOS_KEY });
  }
  return sdkRef;
}

let who: string | null = null;

/**
 * Tells RevenueCat who is using the app: called whenever the signed-in account changes.
 * A purchase made before the account existed is carried over to it on sign-in.
 */
export async function syncPurchasesUser(userId: string | null): Promise<void> {
  const P = sdk();
  if (!P) return;
  try {
    if (userId && userId !== who) {
      await P.logIn(userId);
      who = userId;
    } else if (!userId && who) {
      who = null;
      await P.logOut();
    }
  } catch {
    /* RevenueCat unreachable: it catches up on the next change or launch. */
  }
}

export const hasPro = (info: CustomerInfo | null | undefined) => !!info?.entitlements.active[ENTITLEMENT];

async function findPackage(P: Sdk, productId: string): Promise<PurchasesPackage | null> {
  const offerings = await P.getOfferings();
  const all = [offerings.current, ...Object.values(offerings.all)].filter(Boolean);
  for (const o of all) {
    const p = o!.availablePackages.find((x) => x.product.identifier === productId);
    if (p) return p;
  }
  return null;
}

export type BuyResult = { ok: true } | { ok: false; cancelled: boolean; message?: string };

/** Buys a plan; the App Store shows its own sheet (Face ID, the price, the free week). */
export async function buy(productId: string): Promise<BuyResult> {
  const P = sdk();
  if (!P) return { ok: true };
  try {
    const pkg = await findPackage(P, productId);
    if (!pkg) return { ok: false, cancelled: false, message: "Os planos não carregaram. Confira a internet e tente de novo." };
    const { customerInfo } = await P.purchasePackage(pkg);
    if (hasPro(customerInfo)) return { ok: true };
    return { ok: false, cancelled: false, message: "A compra não foi confirmada pela App Store. Tente de novo em instantes." };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, message: "Não foi possível falar com a App Store agora. Tente de novo em instantes." };
  }
}

/** Brings back a subscription bought before, on this Apple ID. */
export async function restore(): Promise<{ ok: boolean; active: boolean }> {
  const P = sdk();
  if (!P) return { ok: true, active: true };
  try {
    const info = await P.restorePurchases();
    return { ok: true, active: hasPro(info) };
  } catch {
    return { ok: false, active: false };
  }
}

/**
 * Whether Willo PRO is active, kept up to date: null while it is not known yet.
 * In Expo Go, and wherever purchases are not live, it is always true.
 */
export function usePro(): boolean | null {
  const [pro, setPro] = useState<boolean | null>(purchasesLive() ? null : true);
  useEffect(() => {
    const P = sdk();
    if (!P) return;
    let alive = true;
    const listener = (info: CustomerInfo) => {
      if (alive) setPro(hasPro(info));
    };
    P.getCustomerInfo()
      .then(listener)
      .catch(() => undefined);
    P.addCustomerInfoUpdateListener(listener);
    return () => {
      alive = false;
      P.removeCustomerInfoUpdateListener(listener);
    };
  }, []);
  return pro;
}
