import { money } from "~/lib/money";

/**
 * Reminders that reach the phone: the day before and on the day, at nine in the morning.
 * Scheduled on the phone itself, so they arrive with the app closed and need no server.
 * Returns whether they were scheduled; on a phone that refused, the reminder still stands
 * in the app's events.
 */

const AT_HOUR = 9;

export async function scheduleReminder(name: string, amount: number | null, iso: string): Promise<boolean> {
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return false;

    const value = amount ? `${money(amount)}. ` : "";
    const day = new Date(`${iso}T00:00:00`);
    day.setHours(AT_HOUR);
    const before = new Date(day);
    before.setDate(before.getDate() - 1);

    const times = [
      { date: before, title: `${name} vence amanhã`, body: `${value}Já está no seu mês, é só não esquecer.` },
      { date: day, title: `${name} vence hoje`, body: `${value}Pagou? Toque para marcar como paga.` },
    ].filter((t) => t.date.getTime() > Date.now());
    for (const t of times) {
      await Notifications.scheduleNotificationAsync({
        content: { title: t.title, body: t.body, threadIdentifier: "willo-contas" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.date },
      });
    }
    return times.length > 0;
  } catch {
    return false;
  }
}
