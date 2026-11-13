import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import * as Haptics from "expo-haptics";
import { supabase } from "@/integrations/supabase/client";
import { deleteNotification, fetchNotifications, generateNotifications, markAsRead, type AppNotification } from "@/services/notificationService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RoundButton from "~/components/RoundButton";
import CenterModal from "~/components/CenterModal";
import Surface from "~/components/Surface";
import { Bell, BellRing, CalendarClock, CheckCheck, CreditCard, SlidersHorizontal, Target, Trash2, Wallet } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { askPermission, permissionState, setDevicePushWanted, syncDeviceNotifications, type PermissionState } from "~/lib/deviceNotifications";
import { th, useThemeRedraw } from "~/theme/theme";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WILLO = require("../../assets/willo-icon.png") as number;

/**
 * Notifications, put in order by Willo.
 *
 * A notice is read for what it is about — the bill, the invoice, the goal, the account,
 * how much and when it falls due — and the page is arranged by that: what is for today,
 * what comes this week, what is further off, and what has gone by. At the top Willo
 * says it in one sentence: how much leaves in the next seven days and which comes
 * first. Kinds can still be picked out with the chips; everything can be marked read
 * at once. A row is swiped to the left to delete it, and tapped to open it: a small card
 * in the middle of the screen with the details and the way to it.
 */

type Kind = "vencimento" | "fatura" | "meta" | "saldo";

const KINDS: Record<Kind, { label: string; one: string; hex: string; Icon: typeof Bell; action: string }> = {
  vencimento: { label: "Contas", one: "Conta", hex: "#F5C26B", Icon: CalendarClock, action: "Ver conta" },
  fatura: { label: "Faturas", one: "Fatura", hex: "#8FC7FF", Icon: CreditCard, action: "Ver fatura" },
  meta: { label: "Metas", one: "Meta", hex: "#B9B0FF", Icon: Target, action: "Ver meta" },
  saldo: { label: "Saldo", one: "Saldo baixo", hex: "#F87171", Icon: Wallet, action: "Ver conta" },
};
const ORDER: Kind[] = ["vencimento", "fatura", "meta", "saldo"];
const kindOf = (c: string): Kind => (c in KINDS ? (c as Kind) : "vencimento");

type Bucket = "hoje" | "semana" | "depois" | "antes";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "hoje", label: "Para hoje" },
  { key: "semana", label: "Nos próximos dias" },
  { key: "depois", label: "Mais adiante" },
  { key: "antes", label: "Anteriores" },
];

const DAY = 86_400_000;
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** A notice read for what it says: who, how much, and how many days until it falls due. */
interface Read {
  n: AppNotification;
  kind: Kind;
  name: string;
  amount: number | null;
  /** Days from today until it falls due; null when it has no date (a low balance). */
  left: number | null;
  bucket: Bucket;
}

function readNotice(n: AppNotification): Read {
  const kind = kindOf(n.category);
  const [head, tail] = n.message.split(" — ");
  let name = head?.trim() || n.title;
  let amount: number | null = null;
  const money = /R\$\s*(-?[\d.]+,\d{2}|-?\d+(?:\.\d+)?)/.exec(n.message);
  if (money) amount = Number(money[1].includes(",") ? money[1].replace(/\./g, "").replace(",", ".") : money[1]);
  if (kind === "meta") name = /"(.+)"/.exec(n.title)?.[1] ?? name;
  if (kind === "saldo") name = (n.message.split(" está com")[0] ?? name).trim();
  if (kind === "meta" && tail) amount = null;

  /* "vence hoje", "vence em 3 dias", as of the day the notice was made. */
  let left: number | null = null;
  const m = /em (\d+) dia/.exec(n.title);
  const madeOn = startOf(new Date(n.created_at));
  if (/hoje/i.test(n.title)) left = Math.round((madeOn - startOf(new Date())) / DAY);
  else if (m) left = Math.round((madeOn + Number(m[1]) * DAY - startOf(new Date())) / DAY);

  const fresh = Date.now() - new Date(n.created_at).getTime() < 2 * DAY;
  const bucket: Bucket = left === null ? (fresh ? "hoje" : "antes") : left < 0 ? "antes" : left === 0 ? "hoje" : left <= 7 ? "semana" : "depois";
  return { n, kind, name, amount, left, bucket };
}

const whenLeft = (left: number | null) =>
  left === null ? "" : left < 0 ? (left === -1 ? "venceu ontem" : `venceu há ${-left} dias`) : left === 0 ? "vence hoje" : left === 1 ? "vence amanhã" : `vence em ${left} dias`;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
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
  const [shown, setShown] = useState<Read | null>(null);
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

  const read = useMemo(() => (items ?? []).map(readNotice), [items]);
  const kinds = useMemo(() => ORDER.filter((k) => read.some((r) => r.kind === k)), [read]);
  const picked = filter === "all" ? read : read.filter((r) => r.kind === filter);
  const sections = BUCKETS.map((b) => ({
    ...b,
    rows: picked.filter((r) => r.bucket === b.key).sort((a, z) => (a.left ?? -1) - (z.left ?? -1) || +new Date(z.n.created_at) - +new Date(a.n.created_at)),
  })).filter((s) => s.rows.length > 0);

  /* What Willo says at the top: what leaves in the next seven days, and what comes first. */
  const soon = read.filter((r) => (r.kind === "vencimento" || r.kind === "fatura") && r.left !== null && r.left >= 0 && r.left <= 7);
  const soonTotal = soon.reduce((t, r) => t + (r.amount ?? 0), 0);
  const first = [...soon].sort((a, z) => (a.left ?? 0) - (z.left ?? 0))[0];
  const low = read.find((r) => r.kind === "saldo" && r.bucket === "hoje");
  const bills = soon.filter((r) => r.kind === "vencimento").length;
  const invoices = soon.filter((r) => r.kind === "fatura").length;
  const what = [bills ? `${bills} ${bills === 1 ? "conta" : "contas"}` : "", invoices ? `${invoices} ${invoices === 1 ? "fatura" : "faturas"}` : ""].filter(Boolean).join(" e ");

  const remove = (n: AppNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? null);
    void deleteNotification(n.id);
  };

  const readAll = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const ids = (items ?? []).filter((n) => !n.is_read).map((n) => n.id);
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
    ids.forEach((id) => void markAsRead(id));
  };

  /* Opening a notice: mark it read, and look up what it is about. */
  const show = async (r: Read) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setShown(r);
    setDetail(null);
    if (!r.n.is_read) {
      setItems((list) => list?.map((x) => (x.id === r.n.id ? { ...x, is_read: true } : x)) ?? null);
      void markAsRead(r.n.id);
    }
    setDetail(await describe(r.n));
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

        <View style={{ marginTop: 8, paddingHorizontal: 4, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={T.title}>Notificações</Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: th(INK.soft) }}>
              {items === null ? " " : total === 0 ? "Nada pedindo atenção agora" : unread > 0 ? `${unread} ${unread === 1 ? "nova" : "novas"}` : "Tudo lido"}
            </Text>
          </View>
          {unread > 0 && (
            <Pressable onPress={readAll} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 2, opacity: pressed ? 0.6 : 1 })}>
              <CheckCheck size={15} color={th(INK.soft)} strokeWidth={2.2} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>Marcar como lidas</Text>
            </Pressable>
          )}
        </View>

        {/* Willo, in one sentence: what leaves this week and what comes first. */}
        {items !== null && total > 0 && (
          <Animated.View entering={FadeInDown.duration(320)}>
            <Surface style={{ marginTop: 18 }}>
              <View style={{ padding: 16, flexDirection: "row", gap: 14 }}>
                <Image source={WILLO} style={{ width: 40, height: 40, borderRadius: 12 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, color: th(INK.softer) }}>RESUMO DO WILLO</Text>
                  {soon.length > 0 ? (
                    <>
                      <Text style={{ marginTop: 6, fontSize: 16.5, lineHeight: 22, fontWeight: "600", color: th("#fff") }}>
                        Nos próximos 7 dias saem <Text style={{ fontWeight: "800" }}>{money(soonTotal)}</Text> em {what}.
                      </Text>
                      {first && (
                        <Text style={{ marginTop: 6, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
                          Primeiro: <Text style={{ fontWeight: "700", color: th((first.left ?? 9) <= 1 ? AMBER : "#fff") }}>{first.name}</Text>, {whenLeft(first.left)}.
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={{ marginTop: 6, fontSize: 16.5, lineHeight: 22, fontWeight: "600", color: th("#fff") }}>Nada vence nos próximos 7 dias.</Text>
                  )}
                  {low && (
                    <Text style={{ marginTop: 6, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
                      Atenção ao saldo de <Text style={{ fontWeight: "700", color: th(RED) }}>{low.name}</Text>.
                    </Text>
                  )}
                </View>
              </View>
            </Surface>
          </Animated.View>
        )}

        {offerPhone && (
          <Surface style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.14)", "bg") }}>
                <BellRing size={18} color={GREEN} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Avisos no celular</Text>
                <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>
                  {permission === "denied" ? "Desligados nos Ajustes do iPhone, em Notificações." : "Contas e faturas chegam mesmo com o app fechado."}
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

        {/* Picking out one kind. */}
        {kinds.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Chip label="Tudo" count={total} on={filter === "all"} onPress={() => setFilter("all")} />
            {kinds.map((k) => (
              <Chip key={k} label={KINDS[k].label} count={read.filter((r) => r.kind === k).length} hex={KINDS[k].hex} on={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
        )}

        {items === null ? (
          <View style={{ marginTop: 60, alignItems: "center" }}>
            <ActivityIndicator color={th(INK.soft)} />
          </View>
        ) : total === 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 60, alignItems: "center", paddingHorizontal: 30 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.12)", "bg") }}>
              <CheckCheck size={26} color={GREEN} strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "700", color: th("#fff") }}>Tudo em dia</Text>
            <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
              Quando uma conta ou fatura estiver para vencer, ou uma meta chegando na data, o Willo avisa aqui.
            </Text>
          </Animated.View>
        ) : (
          <View style={{ marginTop: 20, gap: 22 }}>
            {sections.map((s) => (
              <Animated.View key={s.key} layout={LinearTransition.duration(240)}>
                <Text style={[T.eyebrow, { marginBottom: 8, paddingHorizontal: 4 }]}>{s.label}</Text>
                <Surface>
                  {s.rows.map((r, i) => (
                    <Animated.View key={r.n.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(220)}>
                      {i > 0 && <View style={{ height: 1, marginLeft: 66, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />}
                      <SwipeToDelete onDelete={() => remove(r.n)}>
                        <Notice r={r} past={s.key === "antes"} onPress={() => void show(r)} />
                      </SwipeToDelete>
                    </Animated.View>
                  ))}
                </Surface>
              </Animated.View>
            ))}
            <Text style={{ textAlign: "center", fontSize: 12.5, color: th(INK.softer) }}>Arraste um aviso para o lado para apagar</Text>
          </View>
        )}
      </ScrollView>

      {/* A notice, opened: small, in the middle of the screen. */}
      <CenterModal
        open={!!shown}
        onClose={() => setShown(null)}
        title={shown ? shown.name : ""}
        subtitle={shown ? [KINDS[shown.kind].one, whenLeft(shown.left) || ago(shown.n.created_at)].filter(Boolean).join(" · ") : undefined}
      >
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
              <Text style={{ fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>{shown.n.message}</Text>
            )}

            <View style={{ marginTop: 16, gap: 4 }}>
              {detail?.go && (
                <Pressable
                  onPress={go}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{KINDS[shown.kind].action}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  const n = shown.n;
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

/** One notice: its kind's mark, who it is about and when, and how much. */
function Notice({ r, past, onPress }: { r: Read; past: boolean; onPress: () => void }) {
  const k = KINDS[r.kind];
  const urgent = r.left !== null && r.left >= 0 && r.left <= 1;
  const sub = [k.one, whenLeft(r.left) || ago(r.n.created_at)].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name}, ${sub}`}>
      {({ pressed }) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, opacity: past ? 0.6 : 1, backgroundColor: pressed ? th("rgba(255,255,255,0.04)", "bg") : "transparent" }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th(`${k.hex}24`, "bg") }}>
            <k.Icon size={18} color={th(k.hex)} strokeWidth={2} />
            {!r.n.is_read && <View style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN, borderWidth: 2, borderColor: th("#101114", "bg") }} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: r.n.is_read ? "600" : "700", color: th("#fff") }}>
              {r.name}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, fontWeight: urgent ? "600" : "400", color: th(urgent ? AMBER : INK.soft) }}>
              {sub}
            </Text>
          </View>
          {r.amount !== null && (
            <Text style={{ fontSize: 15, fontWeight: "700", color: th(r.kind === "saldo" ? RED : "#fff"), fontVariant: ["tabular-nums"] }}>{money(r.amount)}</Text>
          )}
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
