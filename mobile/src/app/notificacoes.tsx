import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { supabase } from "@/integrations/supabase/client";
import { deleteNotification, fetchNotifications, generateNotifications, markAsRead, type AppNotification } from "@/services/notificationService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RoundButton from "~/components/RoundButton";
import CenterModal from "~/components/CenterModal";
import Surface from "~/components/Surface";
import { Bell, CalendarClock, ChevronDown, ChevronUp, CreditCard, SlidersHorizontal, Target, Trash2, Wallet } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { askPermission, permissionState, setDevicePushWanted, syncDeviceNotifications, type PermissionState } from "~/lib/deviceNotifications";
import { th, useThemeRedraw } from "~/theme/theme";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Notifications.
 *
 * What Willo has noticed — a bill or an invoice about to fall due, a goal near its
 * date, an account running low — worked out from the person's own data each time the
 * page opens, with the same rules as the web.
 *
 * Kept short: filters across the top say how many of each there are, and each kind is
 * one card of compact rows, three at most until "Ver mais". A row is swiped to the
 * left to delete it, and tapped to open it: a small card in the middle of the screen
 * with what it is about (how much, when, where it stands) and the way to it. Ver conta
 * opens the bill on Transações with its own sheet up, where it can be marked as paid.
 */

type Kind = "vencimento" | "fatura" | "meta" | "saldo";

const KINDS: Record<Kind, { label: string; hex: string; Icon: typeof Bell; action: string }> = {
  vencimento: { label: "Contas", hex: "#F5C26B", Icon: CalendarClock, action: "Ver conta" },
  fatura: { label: "Faturas", hex: "#8FC7FF", Icon: CreditCard, action: "Ver fatura" },
  meta: { label: "Metas", hex: "#B9B0FF", Icon: Target, action: "Ver meta" },
  saldo: { label: "Saldo", hex: "#F87171", Icon: Wallet, action: "Ver conta" },
};
const ORDER: Kind[] = ["vencimento", "fatura", "meta", "saldo"];
/* Rows a kind shows before Ver mais. */
const PREVIEW = 3;
const kindOf = (c: string): Kind => (c in KINDS ? (c as Kind) : "vencimento");

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

const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

interface Detail {
  lines: { label: string; value: string }[];
  go: string | null;
}

export default function Notificacoes() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unavailable");
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [open, setOpen] = useState<Set<Kind>>(new Set());
  const [shown, setShown] = useState<AppNotification | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

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

  const groups = useMemo(() => {
    const by = new Map<Kind, AppNotification[]>();
    for (const n of items ?? []) {
      const k = kindOf(n.category);
      by.set(k, [...(by.get(k) ?? []), n]);
    }
    return ORDER.filter((k) => by.has(k)).map((k) => ({ kind: k, list: by.get(k)! }));
  }, [items]);

  const remove = (n: AppNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? null);
    void deleteNotification(n.id);
  };

  /* Opening a notice: mark it read, and look up what it is about. */
  const show = async (n: AppNotification) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setShown(n);
    setDetail(null);
    if (!n.is_read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
      void markAsRead(n.id);
    }
    setDetail(await describe(n));
  };

  const go = () => {
    const to = detail?.go;
    setShown(null);
    if (to) setTimeout(() => router.push(to as never), 220);
  };

  const enableOnPhone = async () => {
    const ok = await askPermission();
    setDevicePushWanted(true);
    setPermission(ok ? "granted" : await permissionState());
    if (ok && user) void syncDeviceNotifications(user.id);
  };

  const total = items?.length ?? 0;
  const unread = (items ?? []).filter((n) => !n.is_read).length;
  const visible = filter === "all" ? groups : groups.filter((g) => g.kind === filter);
  const offerPhone = permission !== "granted" && permission !== "unavailable";

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={th(INK.softer)}
          />
        }
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton />
          <RoundButton label="Ajustes de notificações" onPress={() => router.push("/notificacoes-ajustes" as never)}>
            <SlidersHorizontal size={17} color={th("#fff")} strokeWidth={2} />
          </RoundButton>
        </View>

        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Notificações</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 14, color: th(INK.soft) }}>
          {items === null ? " " : total === 0 ? "Nada pedindo atenção agora" : unread > 0 ? `${unread} ${unread === 1 ? "nova" : "novas"} de ${total}` : `${total} ${total === 1 ? "aviso" : "avisos"}, todos lidos`}
        </Text>

        {/* What there is, by kind: also the way to see only one kind. */}
        {groups.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Chip label="Tudo" count={total} on={filter === "all"} onPress={() => setFilter("all")} />
            {groups.map((g) => (
              <Chip key={g.kind} label={KINDS[g.kind].label} count={g.list.length} hex={KINDS[g.kind].hex} on={filter === g.kind} onPress={() => setFilter(g.kind)} />
            ))}
          </ScrollView>
        )}

        {offerPhone && (
          <Surface style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
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
        ) : total === 0 ? (
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
          <View style={{ marginTop: 18, gap: 18 }}>
            {visible.map((g) => {
              const all = filter === g.kind || open.has(g.kind);
              const rows = all ? g.list : g.list.slice(0, PREVIEW);
              const hidden = g.list.length - rows.length;
              const canFold = open.has(g.kind) && filter === "all" && g.list.length > PREVIEW;
              return (
                <Animated.View key={g.kind} layout={LinearTransition.duration(240)}>
                  <Text style={[T.eyebrow, { marginBottom: 8, paddingHorizontal: 4 }]}>{KINDS[g.kind].label}</Text>
                  <Surface>
                    {rows.map((n, i) => (
                      <Animated.View key={n.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(220)}>
                        {i > 0 && <View style={{ height: 1, marginLeft: 64, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />}
                        <SwipeToDelete onDelete={() => remove(n)}>
                          <Notice n={n} onPress={() => void show(n)} />
                        </SwipeToDelete>
                      </Animated.View>
                    ))}
                    {(hidden > 0 || canFold) && (
                      <Pressable
                        onPress={() => {
                          void Haptics.selectionAsync().catch(() => undefined);
                          setOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.kind)) next.delete(g.kind);
                            else next.add(g.kind);
                            return next;
                          });
                        }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          height: 44,
                          borderTopWidth: 1,
                          borderTopColor: th("rgba(255,255,255,0.06)", "line"),
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: "500", color: th(INK.soft) }}>{hidden > 0 ? `Ver mais ${hidden}` : "Mostrar menos"}</Text>
                        {hidden > 0 ? <ChevronDown size={14} color={th(INK.soft)} /> : <ChevronUp size={14} color={th(INK.soft)} />}
                      </Pressable>
                    )}
                  </Surface>
                </Animated.View>
              );
            })}
          </View>
        )}

        {total > 0 && (
          <Text style={{ marginTop: 18, textAlign: "center", fontSize: 12.5, color: th(INK.softer) }}>Arraste um aviso para o lado para apagar</Text>
        )}
      </ScrollView>

      {/* A notice, opened: small, in the middle of the screen. */}
      <CenterModal open={!!shown} onClose={() => setShown(null)} title={shown?.title ?? ""} subtitle={shown ? `${KINDS[kindOf(shown.category)].label} · ${when(shown.created_at)}` : undefined}>
        {shown && (
          <View>
            {detail === null ? (
              <ActivityIndicator color={th(INK.soft)} style={{ marginVertical: 18 }} />
            ) : detail.lines.length > 0 ? (
              <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
                {detail.lines.map((l, i) => (
                  <View key={l.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                    <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>{l.label}</Text>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: "600", color: th("#fff"), textAlign: "right" }}>
                      {l.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>{shown.message}</Text>
            )}

            <View style={{ marginTop: 16, gap: 4 }}>
              {detail?.go && (
                <Pressable
                  onPress={go}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{KINDS[kindOf(shown.category)].action}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  const n = shown;
                  setShown(null);
                  remove(n);
                }}
                style={({ pressed }) => ({ height: 42, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ fontSize: 14.5, fontWeight: "500", color: th(RED) }}>Apagar aviso</Text>
              </Pressable>
            </View>
          </View>
        )}
      </CenterModal>
    </Room>
  );
}

/** What a notice is about, looked up when it is opened, and where its button leads. */
async function describe(n: AppNotification): Promise<Detail> {
  const id = n.related_id;
  try {
    if (n.category === "vencimento" && id) {
      const { data } = await supabase.from("transactions").select("id, name, amount, date, status").eq("id", id).maybeSingle();
      const t = data as { id: string; name: string; amount: number; date: string; status: string } | null;
      if (!t) return { lines: [], go: "/transacoes" };
      const d = new Date(`${t.date}T12:00:00`);
      return {
        lines: [
          { label: "Conta", value: t.name },
          { label: "Valor", value: money(Number(t.amount)) },
          { label: "Vencimento", value: longDate(t.date) },
          { label: "Situação", value: t.status === "pago" ? "Paga" : "Pendente" },
        ],
        go: `/transacoes?abrir=${t.id}&mes=${d.getMonth()}&ano=${d.getFullYear()}`,
      };
    }
    if (n.category === "fatura" && id) {
      const { data } = await supabase.from("invoices").select("month, year, total_amount, is_paid, credit_card_id").eq("id", id).maybeSingle();
      const inv = data as { month: number; year: number; total_amount: number; is_paid: boolean; credit_card_id: string } | null;
      if (!inv) return { lines: [], go: "/cartoes" };
      const { data: c } = await supabase.from("credit_cards").select("name, due_day").eq("id", inv.credit_card_id).maybeSingle();
      const card = c as { name: string; due_day: number } | null;
      const due = card ? new Date(inv.year, inv.month - 1, card.due_day) : null;
      return {
        lines: [
          ...(card ? [{ label: "Cartão", value: card.name }] : []),
          { label: "Valor", value: money(Number(inv.total_amount)) },
          ...(due ? [{ label: "Vencimento", value: due.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) }] : []),
          { label: "Situação", value: inv.is_paid ? "Paga" : "Em aberto" },
        ],
        go: `/fatura/${inv.credit_card_id}`,
      };
    }
    if (n.category === "meta" && id) {
      const { data } = await supabase.from("goals").select("name, current_amount, target_amount, deadline").eq("id", id).maybeSingle();
      const g = data as { name: string; current_amount: number; target_amount: number; deadline: string | null } | null;
      if (!g) return { lines: [], go: null };
      const pct = g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
      return {
        lines: [
          { label: "Meta", value: g.name },
          { label: "Guardado", value: `${money(Number(g.current_amount))} de ${money(Number(g.target_amount))}` },
          { label: "Progresso", value: `${pct}%` },
          ...(g.deadline ? [{ label: "Data", value: longDate(g.deadline) }] : []),
        ],
        go: `/metas/${id}`,
      };
    }
    if (n.category === "saldo" && id) {
      const { data } = await supabase.from("accounts").select("name, current_balance").eq("id", id).maybeSingle();
      const a = data as { name: string; current_balance: number } | null;
      if (!a) return { lines: [], go: null };
      return { lines: [{ label: "Conta", value: a.name }, { label: "Saldo agora", value: money(Number(a.current_balance)) }], go: `/conta/${id}` };
    }
  } catch {
    /* Shown without the details. */
  }
  return { lines: [], go: null };
}

/** One notice, as a compact row. */
function Notice({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const k = KINDS[kindOf(n.category)];
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? th("rgba(255,255,255,0.04)", "bg") : "transparent" }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th(`${k.hex}26`, "bg") }}>
            <k.Icon size={17} color={th(k.hex)} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: n.is_read ? "500" : "700", color: th("#fff") }}>
                {n.title}
              </Text>
              {!n.is_read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th("#8FC7FF") }} />}
            </View>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
              {n.message}
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>{when(n.created_at)}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Swiped to the left past the mark and let go, the notice is deleted. */
function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  return (
    <ReanimatedSwipeable
      friction={1.6}
      rightThreshold={90}
      overshootRight={false}
      renderRightActions={(progress) => <DeleteAction progress={progress} />}
      onSwipeableOpen={() => onDelete()}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

/* Behind a translucent card, so it only shows as the card moves aside. */
function DeleteAction({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value * 1.6 - 0.15)) }));
  return (
    <Animated.View style={[{ flex: 1, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 22 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Trash2 size={16} color={RED} strokeWidth={2.2} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: RED }}>Apagar</Text>
      </View>
    </Animated.View>
  );
}

function Chip({ label, count, hex, on, onPress }: { label: string; count: number; hex?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 13,
        borderRadius: 17,
        backgroundColor: on ? th("#fff", "bg") : th("rgba(255,255,255,0.07)", "bg"),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {hex && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th(hex) }} />}
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: on ? th("#0B0B0B") : th("#fff") }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? th("rgba(11,11,11,0.55)") : th(INK.softer) }}>{count}</Text>
    </Pressable>
  );
}
