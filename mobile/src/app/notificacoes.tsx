import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteNotification,
  fetchNotifications,
  generateNotifications,
  markAllAsRead,
  markAsRead,
  type AppNotification,
} from "@/services/notificationService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RoundButton from "~/components/RoundButton";
import Surface, { Hairline } from "~/components/Surface";
import { Bell, CalendarClock, CreditCard, SlidersHorizontal, Target, Wallet, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { askPermission, permissionState, setDevicePushWanted, syncDeviceNotifications, type PermissionState } from "~/lib/deviceNotifications";
import { th } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Notifications.
 *
 * What Willo has noticed and wants the person to see: a bill or an invoice about to
 * fall due, a goal near its date, an account running low. They are worked out from
 * the person's own data each time the page opens (the same rules as the web), new
 * ones first. A tap opens what it is about and marks it read.
 *
 * At the top, while the phone has not been allowed to show Willo's notifications,
 * one line offers to switch them on — the same reminders, arriving with the app shut.
 */

const TONES: Record<string, { hex: string; Icon: typeof Bell }> = {
  vencimento: { hex: "#F5C26B", Icon: CalendarClock },
  fatura: { hex: "#8FC7FF", Icon: CreditCard },
  meta: { hex: "#B9B0FF", Icon: Target },
  saldo: { hex: "#F87171", Icon: Wallet },
};

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export default function Notificacoes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unavailable");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      await generateNotifications(user.id);
    } catch {
      /* Shows what is already there. */
    }
    setItems(await fetchNotifications(user.id, 60));
    setPermission(await permissionState());
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = async (n: AppNotification) => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (!n.is_read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
      void markAsRead(n.id);
    }
    if (n.category === "fatura" && n.related_id) {
      const { data } = await supabase.from("invoices").select("credit_card_id").eq("id", n.related_id).maybeSingle();
      const cardId = (data as { credit_card_id?: string } | null)?.credit_card_id;
      if (cardId) router.push(`/fatura/${cardId}` as never);
    } else if (n.category === "meta" && n.related_id) router.push(`/metas/${n.related_id}` as never);
    else if (n.category === "saldo" && n.related_id) router.push(`/conta/${n.related_id}` as never);
    else if (n.category === "vencimento") router.push("/transacoes" as never);
  };

  const remove = (n: AppNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? null);
    void deleteNotification(n.id);
  };

  const readAll = () => {
    if (!user) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
    void markAllAsRead(user.id);
  };

  const enableOnPhone = async () => {
    const ok = await askPermission();
    setDevicePushWanted(true);
    setPermission(ok ? "granted" : await permissionState());
    if (ok && user) void syncDeviceNotifications(user.id);
  };

  const fresh = (items ?? []).filter((n) => !n.is_read);
  const older = (items ?? []).filter((n) => n.is_read);
  const offerPhone = permission !== "granted" && permission !== "unavailable";

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={th(INK.softer)} />}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton />
          <RoundButton label="Ajustes de notificações" onPress={() => router.push("/notificacoes-ajustes" as never)}>
            <SlidersHorizontal size={17} color={th("#fff")} strokeWidth={2} />
          </RoundButton>
        </View>

        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
          <Text style={T.title}>Notificações</Text>
          {fresh.length > 0 && (
            <Pressable onPress={readAll} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ fontSize: 14, color: th(INK.soft) }}>Marcar como lidas</Text>
            </Pressable>
          )}
        </View>

        {offerPhone && (
          <Surface style={{ marginTop: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                <Bell size={18} color={th("#fff")} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Avisos no celular</Text>
                <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>
                  {permission === "denied" ? "Estão desligados nos Ajustes do iPhone, em Notificações." : "Contas e faturas chegam mesmo com o app fechado."}
                </Text>
              </View>
              {permission !== "denied" && (
                <Pressable
                  onPress={() => void enableOnPhone()}
                  style={({ pressed }) => ({ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#0B0B0B") }}>Ativar</Text>
                </Pressable>
              )}
            </View>
          </Surface>
        )}

        {items === null ? (
          <View style={{ marginTop: 60, alignItems: "center" }}>
            <ActivityIndicator color={th(INK.soft)} />
          </View>
        ) : items.length === 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 70, alignItems: "center", paddingHorizontal: 30 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              <Bell size={22} color={th(INK.soft)} strokeWidth={1.8} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: "600", color: th("#fff") }}>Tudo em dia</Text>
            <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
              Quando uma conta ou fatura estiver para vencer, ou uma meta chegando na data, o aviso aparece aqui.
            </Text>
          </Animated.View>
        ) : (
          <>
            {fresh.length > 0 && <Group title="Novas" items={fresh} onOpen={open} onRemove={remove} />}
            {older.length > 0 && <Group title="Anteriores" items={older} onOpen={open} onRemove={remove} />}
          </>
        )}
      </ScrollView>
    </Room>
  );
}

function Group({ title, items, onOpen, onRemove }: { title: string; items: AppNotification[]; onOpen: (n: AppNotification) => void; onRemove: (n: AppNotification) => void }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={[T.eyebrow, { marginBottom: 10, paddingHorizontal: 4 }]}>{title}</Text>
      <Surface>
        {items.map((n, i) => {
          const tone = TONES[n.category] ?? { hex: "#B4B8C2", Icon: Bell };
          return (
            <View key={n.id}>
              {i > 0 && <Hairline style={{ marginLeft: 66 }} />}
              <Pressable
                onPress={() => onOpen(n)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 14, paddingRight: 6, paddingVertical: 12, backgroundColor: pressed ? th("rgba(255,255,255,0.04)", "bg") : "transparent" })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th(`${tone.hex}26`, "bg") }}>
                  <tone.Icon size={18} color={th(tone.hex)} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: n.is_read ? "500" : "700", color: th("#fff") }}>
                      {n.title}
                    </Text>
                    {!n.is_read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th("#8FC7FF") }} />}
                  </View>
                  <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>
                    {n.message}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 11.5, color: th(INK.softer) }}>{when(n.created_at)}</Text>
                </View>
                <Pressable onPress={() => onRemove(n)} hitSlop={8} accessibilityLabel="Apagar notificação" style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 1 })}>
                  <X size={15} color={th(INK.faint)} strokeWidth={2} />
                </Pressable>
              </Pressable>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}
