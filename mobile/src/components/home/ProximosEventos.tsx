import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
} from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * What is coming, in the order it matters.
 *
 * Unsettled first and paid last, each group in date order — the question this card
 * answers is what still needs doing, so what is done sinks. It shows the next few;
 * the month itself is a page.
 */

const STATUS = {
  pendente: { label: "Pendente", accent: AMBER, Icon: Clock },
  pago: { label: "Pago", accent: GREEN, Icon: Check },
  atrasado: { label: "Atrasado", accent: RED, Icon: AlertTriangle },
  recebido: { label: "Recebido", accent: GREEN, Icon: Check },
} as const;

const statusLabel = (status: string, type?: string) => {
  if (type === "receita") {
    if (status === "pago" || status === "recebido") return "Recebido";
    if (status === "pendente") return "A Receber";
  }
  if (type === "despesa") {
    if (status === "pago") return "Pago";
    if (status === "pendente") return "Pendente";
  }
  if (status === "atrasado") return "A Pagar";
  return STATUS[status as keyof typeof STATUS]?.label ?? status;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

const parseDateSafe = (dateStr: string): Date =>
  dateStr.includes("T") ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`);

const MIN_VISIBLE = 3;

/** A colour at the fill strength the app gives a chip. */
const fill = (hex: string) => `${hex}1F`;

export default function ProximosEventos({ events }: { events: FinanceEvent[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const mapped = events.map((ev) => ({ ...ev, _date: parseDateSafe(ev.rawDate || ev.date) }));
    const order = (s: string) => (s === "pago" || s === "recebido" ? 1 : 0);
    return mapped.sort((a, b) => {
      const so = order(a.status) - order(b.status);
      return so !== 0 ? so : a._date.getTime() - b._date.getTime();
    });
  }, [events]);

  const shown = expanded ? sorted : sorted.slice(0, MIN_VISIBLE);
  const hasMore = sorted.length > MIN_VISIBLE;

  return (
    <Surface>
      <Pressable
        onPress={() => router.push("/eventos")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CalendarDays size={16} color="rgba(255,255,255,0.74)" />
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Próximos eventos</Text>
        </View>
        <ChevronRight size={16} color={INK.faint} />
      </Pressable>

      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        {shown.length === 0 ? (
          <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 13, color: INK.soft }}>
            Nenhum evento este mês
          </Text>
        ) : (
          shown.map((ev, idx) => {
            const isPaid = ev.status === "pago" || ev.status === "recebido";
            const cfg = STATUS[ev.status as keyof typeof STATUS] ?? STATUS.pendente;
            const Icon = cfg.Icon;

            return (
              <Animated.View
                key={ev.id}
                entering={FadeInDown.delay(idx * 30).duration(260)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: fill(cfg.accent),
                  }}
                >
                  <Icon size={16} color={cfg.accent} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      fontWeight: "500",
                      color: isPaid ? "rgba(255,255,255,0.62)" : "#fff",
                    }}
                  >
                    {ev.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: cfg.accent, opacity: 0.85 }}>
                    {statusLabel(ev.status, ev.type)}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: isPaid ? "rgba(255,255,255,0.62)" : "#fff",
                    }}
                  >
                    {money(ev.amount)}
                  </Text>
                  <Text style={{ fontSize: 12, color: INK.soft }}>{fmtDate(ev._date)}</Text>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>

      {hasMore ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            paddingVertical: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.74)" }}>
            {expanded ? "Recolher" : `Mostrar os ${sorted.length} do mês`}
          </Text>
          {expanded ? (
            <ChevronUp size={16} color="rgba(255,255,255,0.74)" />
          ) : (
            <ChevronDown size={16} color="rgba(255,255,255,0.74)" />
          )}
        </Pressable>
      ) : (
        <View style={{ height: 4 }} />
      )}
    </Surface>
  );
}
