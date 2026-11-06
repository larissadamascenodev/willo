import { useEffect } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { clearDeviceNotifications, syncDeviceNotifications, urlOf } from "~/lib/deviceNotifications";

/**
 * Keeps the phone's notifications in step with the account, and opens what a tapped
 * one is about.
 *
 * Signed in, Willo's notifications are laid out again on opening and whenever the app
 * comes back to the front; signed out, they are cleared, so nothing about one account
 * reaches someone else on the same phone. A tap on one opens its screen — the invoice,
 * the bill's list, the goal — including when it is what opened the app.
 */
/* The tap that opened the app is followed once, not again on every sign-in. */
let handledLaunch: string | null = null;

export default function NotificationBridge({ userId }: { userId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) {
      void clearDeviceNotifications();
      return;
    }
    void syncDeviceNotifications(userId);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncDeviceNotifications(userId);
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const N = await import("expo-notifications");
        const first = await N.getLastNotificationResponseAsync();
        const firstUrl = first ? urlOf(first.notification.request.content.data) : null;
        const firstId = first?.notification.request.identifier ?? null;
        if (alive && firstUrl && firstId !== handledLaunch) {
          handledLaunch = firstId;
          router.push(firstUrl as never);
        }
        const sub = N.addNotificationResponseReceivedListener((r) => {
          const url = urlOf(r.notification.request.content.data);
          if (url) router.push(url as never);
        });
        remove = () => sub.remove();
        if (!alive) remove();
      } catch {
        /* No notifications on this build. */
      }
    })();
    return () => {
      alive = false;
      remove?.();
    };
  }, [userId, router]);

  return null;
}
