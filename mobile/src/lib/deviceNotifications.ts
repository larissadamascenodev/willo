import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSettings } from "@/services/notificationService";
import { money } from "~/lib/money";
import { buildProfile, planMethods, withFixedIncome } from "@/lib/plan/financialPlan";
import { loadPlanInputs } from "@/services/financialPlan";
import { planAlertsWanted, readActivePlan } from "~/lib/activePlan";
import { planStatus } from "~/lib/planStatus";
import { FEATURES } from "~/lib/features";

/**
 * Willo's notifications on the phone itself.
 *
 * They are scheduled by the phone, not sent from a server: every time the app opens
 * (and whenever a setting changes) the ones Willo scheduled are cleared and laid out
 * again from the person's own data — the bills and invoices about to fall due, goals
 * near their date, a weekly summary — so they always match what is true now, and
 * they arrive even with the app closed and no connection.
 *
 * The same rescheduling makes the "come back" reminders work: they are set a few days
 * ahead each time the app is opened, so they only ever fire for someone who has not
 * opened it since.
 *
 * Only notifications marked as Willo's own are cleared; reminders a person set on a
 * single bill elsewhere are left alone. Signing out clears them all.
 */

const TAG = "willo-sync";
/* iOS keeps at most 64 pending; leave room for the reminders set by hand. */
const MAX = 48;
const MORNING = 9;

const PUSH_KEY = "device-notifications";
const NUDGE_KEY = "notify-nudges";

const readFlag = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const writeFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* Kept for this session only. */
  }
};

/** Whether the person wants Willo's notifications on this phone (asked once, in the app). */
export const devicePushWanted = () => readFlag(PUSH_KEY, true);
export const setDevicePushWanted = (on: boolean) => writeFlag(PUSH_KEY, on);
/** The reminders to come back and write things down. */
export const nudgesWanted = () => readFlag(NUDGE_KEY, true);
export const setNudgesWanted = (on: boolean) => writeFlag(NUDGE_KEY, on);

type Notifs = typeof import("expo-notifications");
let handlerSet = false;

async function load(): Promise<Notifs | null> {
  try {
    const N = await import("expo-notifications");
    if (!handlerSet) {
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      handlerSet = true;
    }
    return N;
  } catch {
    return null;
  }
}

export type PermissionState = "granted" | "denied" | "undetermined" | "unavailable";

export async function permissionState(): Promise<PermissionState> {
  const N = await load();
  if (!N) return "unavailable";
  try {
    const { status } = await N.getPermissionsAsync();
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unavailable";
  }
}

/** Asks the phone for permission. Returns whether it was given. */
export async function askPermission(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  try {
    const { granted } = await N.requestPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

async function clearOwn(N: Notifs) {
  try {
    const pending = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending.filter((p) => (p.content.data as { kind?: string } | undefined)?.kind === TAG).map((p) => N.cancelScheduledNotificationAsync(p.identifier)),
    );
  } catch {
    /* Nothing scheduled, or nothing to clear. */
  }
}

/** Clears every notification Willo scheduled, e.g. on signing out. */
export async function clearDeviceNotifications() {
  const N = await load();
  if (N) await clearOwn(N);
}

const atHour = (iso: string, hour: number, daysBefore = 0) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - daysBefore);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * When something falls due, said the way a person says it, counted from the moment the
 * notice arrives: "hoje", "amanhã", "quinta", "dia 14".
 */
function whenSaid(dueIso: string, from: Date) {
  const due = new Date(`${dueIso}T00:00:00`);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days < 7) return WEEKDAYS[due.getDay()];
  return `dia ${due.getDate()}`;
}

/* Notices of one kind stack together in the notification centre. */
type Thread = "contas" | "faturas" | "metas" | "voltar" | "plano" | "semana";

interface Planned {
  date: Date;
  title: string;
  body: string;
  url: string;
  thread: Thread;
}

let running: Promise<void> | null = null;

/** Lays out Willo's notifications again from the person's data. */
export function syncDeviceNotifications(userId: string | undefined | null) {
  if (running) return running;
  running = run(userId).finally(() => {
    running = null;
  });
  return running;
}

async function run(userId: string | undefined | null) {
  const N = await load();
  if (!N) return;
  await clearOwn(N);
  if (!userId || !devicePushWanted()) return;
  if ((await permissionState()) !== "granted") return;

  const settings = await getOrCreateSettings(userId);
  const now = new Date();
  const today = isoOf(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 40);
  const until = isoOf(horizon);
  const before = Math.max(0, settings.bill_due_days_before ?? 3);
  const planned: Planned[] = [];

  const [bills, invoices, goals] = await Promise.all([
    settings.bill_due_reminder
      ? supabase
          .from("transactions")
          .select("id, name, date, amount")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .eq("type", "despesa")
          .neq("payment_method", "cartao")
          .is("credit_card_id", null)
          .gte("date", today)
          .lte("date", until)
          .order("date")
          .limit(30)
      : Promise.resolve({ data: null }),
    settings.invoice_reminder
      ? supabase.from("invoices").select("id, month, year, total_amount, credit_card_id").eq("user_id", userId).eq("is_paid", false).gt("total_amount", 0).limit(20)
      : Promise.resolve({ data: null }),
    settings.goal_reminder
      ? supabase
          .from("goals")
          .select("id, name, deadline, current_amount, target_amount")
          .eq("user_id", userId)
          .not("deadline", "is", null)
          .gte("deadline", today)
          .lte("deadline", until)
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);

  /* Bills: a few days ahead (as set), and on the day. */
  for (const b of (bills.data ?? []) as { id: string; name: string; date: string; amount: number }[]) {
    const amount = money(Number(b.amount));
    if (before > 0) {
      const at = atHour(b.date, MORNING, before);
      planned.push({ date: at, title: `${b.name} vence ${whenSaid(b.date, at)}`, body: `${amount}. Já está no seu mês, é só não esquecer.`, url: "/transacoes", thread: "contas" });
    }
    planned.push({ date: atHour(b.date, MORNING), title: `${b.name} vence hoje`, body: `${amount}. Pagou? Toque para marcar como paga.`, url: "/transacoes", thread: "contas" });
  }

  /* Invoices: their due day comes from the card. */
  const invList = (invoices.data ?? []) as { id: string; month: number; year: number; total_amount: number; credit_card_id: string }[];
  const cardIds = [...new Set(invList.map((i) => i.credit_card_id).filter(Boolean))];
  if (cardIds.length) {
    const { data: cards } = await supabase.from("credit_cards").select("id, name, due_day").in("id", cardIds);
    const byId = new Map(((cards ?? []) as { id: string; name: string; due_day: number }[]).map((c) => [c.id, c]));
    for (const inv of invList) {
      const card = byId.get(inv.credit_card_id);
      if (!card) continue;
      const due = isoOf(new Date(inv.year, inv.month - 1, card.due_day));
      if (due < today || due > until) continue;
      const amount = money(Number(inv.total_amount));
      const url = `/fatura/${card.id}`;
      if (before > 0) {
        const at = atHour(due, MORNING, before);
        planned.push({ date: at, title: `Fatura ${card.name} vence ${whenSaid(due, at)}`, body: `${amount}. Toque para ver o que entrou nela.`, url, thread: "faturas" });
      }
      planned.push({ date: atHour(due, MORNING), title: `Fatura ${card.name} vence hoje`, body: `${amount}. Pagou? Toque para registrar o pagamento.`, url, thread: "faturas" });
    }
  }

  /* Goals: three days before their date, if not reached. */
  for (const g of (goals.data ?? []) as { id: string; name: string; deadline: string; current_amount: number; target_amount: number }[]) {
    if (Number(g.current_amount) >= Number(g.target_amount)) continue;
    const left = money(Number(g.target_amount) - Number(g.current_amount));
    const at = atHour(g.deadline, 10, 3);
    planned.push({ date: at, title: `${g.name}: o prazo é ${whenSaid(g.deadline, at)}`, body: `Faltam ${left} para chegar lá. Dá para guardar mais um pouco?`, url: `/metas/${g.id}`, thread: "metas" });
  }

  /* Coming back: set ahead every time the app opens, so they only reach someone who
     has not opened it since. */
  if (nudgesWanted()) {
    const nudge = (days: number, hour: number, title: string, body: string) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(hour, 0, 0, 0);
      planned.push({ date: d, title, body, url: "/registro", thread: "voltar" });
    };
    nudge(2, 20, "Teve algum gasto hoje?", "Anota em dois toques e o Willo organiza o resto.");
    nudge(6, 19, "Seu mês continua andando", "Abre o Willo e veja quanto ainda sobra até o fim do mês.");
    nudge(14, 19, "O Willo sentiu sua falta", "Voltar leva um minuto: conta o que entrou e saiu e ele refaz a previsão.");
  }

  /* The plan in use: a word in the evening when a part of it is slipping, and on
     Monday morning what can be spent a day for the rest of the month. */
  const chosen = readActivePlan();
  if (FEATURES.plano && chosen && planAlertsWanted()) {
    try {
      const inputs = await loadPlanInputs();
      const built = buildProfile(inputs) ?? buildProfile({ months: [inputs.current], saved: inputs.saved });
      const profile = built ? withFixedIncome(built, inputs.current.fixedIncome ?? 0) : null;
      const plan = profile ? planMethods(profile).find((m) => m.id === chosen.method) : null;
      if (plan) {
        const status = planStatus(plan, inputs.current, now);
        const slip = status.alerts.find((a) => a.tone !== "ok");
        if (slip) {
          const evening = new Date(now);
          if (evening.getHours() >= 20) evening.setDate(evening.getDate() + 1);
          evening.setHours(20, 0, 0, 0);
          planned.push({ date: evening, title: slip.title, body: slip.body, url: "/plano", thread: "plano" });
        }
        const monday = new Date(now);
        monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
        monday.setHours(9, 0, 0, 0);
        if (monday.getMonth() === now.getMonth())
          planned.push({ date: monday, title: `Seu plano ${plan.label} esta semana`, body: `Dá para gastar até ${money(status.perDay)} por dia e continuar dentro do plano.`, url: "/plano", thread: "plano" });
      }
    } catch {
      /* No plan alerts this time. */
    }
  }

  const later = planned
    .filter((p) => p.date.getTime() > Date.now() + 60_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX - (settings.weekly_summary ? 1 : 0));

  for (const p of later) {
    try {
      await N.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { kind: TAG, url: p.url }, threadIdentifier: `willo-${p.thread}` },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.date },
      });
    } catch {
      /* One that cannot be set does not stop the rest. */
    }
  }

  /* Sunday evening: the week in Willo. */
  if (settings.weekly_summary) {
    try {
      await N.scheduleNotificationAsync({
        content: { title: "Sua semana no Willo", body: "Abre que eu te mostro o que entrou, o que saiu e como o mês está fechando.", data: { kind: TAG, url: "/" }, threadIdentifier: "willo-semana" },
        trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 0 },
      });
    } catch {
      /* Skipped. */
    }
  }
}

/** Where a tapped notification leads, if it says. */
export function urlOf(data: unknown): string | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}
