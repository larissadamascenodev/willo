import { useCallback, useState, type ReactNode } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { getOrCreateSettings, updateSettings, type NotificationSettings } from "@/services/notificationService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import Surface, { Hairline } from "~/components/Surface";
import { Toggle } from "~/components/registro/entryParts";
import { useAuth } from "~/lib/auth";
import {
  askPermission,
  devicePushWanted,
  nudgesWanted,
  permissionState,
  setDevicePushWanted,
  setNudgesWanted,
  syncDeviceNotifications,
  type PermissionState,
} from "~/lib/deviceNotifications";
import { th, useThemeRedraw } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What Willo tells the person, and where.
 *
 * First, whether this phone shows Willo's notifications at all — the phone's own
 * permission, asked here and not before, and switchable off without going to the
 * phone's settings. Then each kind on its own: bills, invoices (and how many days
 * ahead), goals, low balance, the Sunday summary, and the reminders to come back and
 * write things down. The kinds are the account's (the web reads the same ones); the
 * phone switch and the come-back reminders belong to this phone.
 */

const DAYS = [
  { key: "1", label: "1 dia" },
  { key: "3", label: "3 dias" },
  { key: "5", label: "5 dias" },
] as const;

export default function NotificacoesAjustes() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unavailable");
  const [onPhone, setOnPhone] = useState(devicePushWanted());
  const [nudges, setNudges] = useState(nudgesWanted());

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getOrCreateSettings(user.id).then(setSettings);
      void permissionState().then(setPermission);
    }, [user]),
  );

  const resync = () => {
    if (user) void syncDeviceNotifications(user.id);
  };

  const change = (patch: Partial<Omit<NotificationSettings, "id" | "user_id">>) => {
    if (!settings) return;
    void Haptics.selectionAsync().catch(() => undefined);
    const next = { ...settings, ...patch };
    setSettings(next);
    void (async () => {
      if (settings.id) await updateSettings(settings.id, patch);
      resync();
    })();
  };

  const togglePhone = async (on: boolean) => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (on && permission !== "granted") {
      const ok = await askPermission();
      setPermission(ok ? "granted" : await permissionState());
      if (!ok) {
        /* Refused before: only the phone's settings can turn them back on. */
        void Linking.openSettings();
        return;
      }
    }
    setDevicePushWanted(on);
    setOnPhone(on);
    resync();
  };

  const phoneOn = onPhone && permission === "granted";

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Notificações</Text>

        <Section title="Neste celular">
          <Row
            label="Avisos no celular"
            note={permission === "denied" && onPhone ? "Desligados nos Ajustes do iPhone. Toque para abrir." : "Chegam mesmo com o app fechado"}
            value={phoneOn}
            onChange={(v) => void togglePhone(v)}
          />
          <Hairline style={{ marginLeft: 16 }} />
          <Row
            label="Lembretes para anotar"
            note="Se passar uns dias sem abrir o Willo"
            value={nudges}
            disabled={!phoneOn}
            onChange={(v) => {
              setNudgesWanted(v);
              setNudges(v);
              resync();
            }}
          />
        </Section>

        <Section title="O que avisar">
          <Row label="Contas a vencer" note="Contas e boletos ainda não pagos" value={!!settings?.bill_due_reminder} onChange={(v) => change({ bill_due_reminder: v })} />
          <Hairline style={{ marginLeft: 16 }} />
          <Row label="Faturas do cartão" note="Antes do vencimento de cada fatura" value={!!settings?.invoice_reminder} onChange={(v) => change({ invoice_reminder: v })} />
          <Hairline style={{ marginLeft: 16 }} />
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 13.5, color: th(INK.soft), marginBottom: 10 }}>Avisar com antecedência de</Text>
            <SegmentedTabs
              compact
              height={34}
              value={String(settings?.bill_due_days_before ?? 3) as (typeof DAYS)[number]["key"]}
              onChange={(k) => change({ bill_due_days_before: Number(k) })}
              options={DAYS.map((d) => ({ key: d.key, label: d.label }))}
            />
          </View>
          <Hairline style={{ marginLeft: 16 }} />
          <Row label="Metas" note="Quando uma meta estiver perto da data" value={!!settings?.goal_reminder} onChange={(v) => change({ goal_reminder: v })} />
          <Hairline style={{ marginLeft: 16 }} />
          <Row label="Saldo baixo" note="Quando uma conta ficar quase sem saldo" value={!!settings?.low_balance_alert} onChange={(v) => change({ low_balance_alert: v })} />
          <Hairline style={{ marginLeft: 16 }} />
          <Row label="Resumo da semana" note="Domingo à noite, como o mês está fechando" value={!!settings?.weekly_summary} onChange={(v) => change({ weekly_summary: v })} />
        </Section>

        <Text style={{ marginTop: 16, paddingHorizontal: 4, fontSize: 12.5, lineHeight: 18, color: th(INK.softer) }}>
          O Willo não manda propaganda. Os avisos são sobre o seu próprio dinheiro e você pode desligar cada um aqui.
        </Text>
      </ScrollView>
    </Room>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Text style={[T.eyebrow, { marginTop: 28, marginBottom: 10, paddingHorizontal: 4 }]}>{title}</Text>
      <Surface>{children}</Surface>
    </>
  );
}

function Row({ label, note, value, onChange, disabled = false }: { label: string; note?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, opacity: disabled ? 0.45 : 1 }} pointerEvents={disabled ? "none" : "auto"}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "500", color: th("#fff") }}>{label}</Text>
        {!!note && <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>{note}</Text>}
      </View>
      <Toggle label={label} value={value} onChange={onChange} />
    </View>
  );
}
