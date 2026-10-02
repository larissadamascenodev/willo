import { memo, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronUp, Clock } from "lucide-react-native";
import type { FinanceEvent } from "@/types/finance";
import { useMoney } from "@/components/projecoes/shared";
import { Surface, Text, white } from "~/ui";
import { hsl } from "~/lib/color";

const STATUS = {
  pago: { label: "Pago", accent: "80 84% 69%", Icon: Check },
  pendente: { label: "Pendente", accent: "45 93% 64%", Icon: Clock },
  atrasado: { label: "Atrasado", accent: "0 91% 71%", Icon: AlertTriangle },
  recebido: { label: "Recebido", accent: "80 84% 69%", Icon: Check },
} as const;

function statusLabel(status: string, type?: string) {
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
}

const parseDate = (value: string) => (value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`));
const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const MIN_VISIBLE = 3;

interface Props {
  events: FinanceEvent[];
  /** Toque num evento pendente que é uma transação: abre o pagar/editar. */
  onEventPress?: (event: FinanceEvent) => void;
}

/** O que vence ou entra neste mês: pendentes primeiro, depois o que já foi pago. */
export const UpcomingEvents = memo(function UpcomingEvents({ events, onEventPress }: Props) {
  const { fmt } = useMoney();
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const order = (s: string) => (s === "pago" || s === "recebido" ? 1 : 0);
    return events
      .map((ev) => ({ ev, date: parseDate(ev.rawDate || ev.date) }))
      .sort((a, b) => order(a.ev.status) - order(b.ev.status) || a.date.getTime() - b.date.getTime());
  }, [events]);

  const shown = expanded ? sorted : sorted.slice(0, MIN_VISIBLE);
  const hasMore = sorted.length > MIN_VISIBLE;

  return (
    <Surface>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
        <CalendarDays size={16} color={white(0.74)} />
        <Text weight="semibold" size={16}>Próximos eventos</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        {shown.length === 0 ? (
          <Text size={13} color={white(0.56)} align="center" style={{ paddingVertical: 20 }}>Nenhum evento este mês</Text>
        ) : (
          shown.map(({ ev, date }, i) => {
            const paid = ev.status === "pago" || ev.status === "recebido";
            const cfg = STATUS[ev.status] ?? STATUS.pendente;
            const pressable = !!ev.isTransaction && ev.status === "pendente" && !!onEventPress;
            return (
              <Pressable
                key={ev.id}
                disabled={!pressable}
                onPress={() => onEventPress?.(ev)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 }, i > 0 && { borderTopWidth: 1, borderTopColor: white(0.06) }]}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: hsl(cfg.accent, 0.12) }}>
                  <cfg.Icon size={16} color={hsl(cfg.accent)} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium" size={15} numberOfLines={1} color={paid ? white(0.62) : "#fff"}>{ev.name}</Text>
                  <Text size={12} color={hsl(cfg.accent, 0.85)}>{statusLabel(ev.status, ev.type)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text weight="semibold" size={15} tabular color={paid ? white(0.62) : "#fff"}>{fmt(ev.amount)}</Text>
                  <Text size={12} color={white(0.56)}>{shortDate(date)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {hasMore ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderTopWidth: 1, borderTopColor: white(0.06), paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <Text size={13} weight="medium" color={white(0.74)}>{expanded ? "Recolher" : `Ver todos (${sorted.length})`}</Text>
          {expanded ? <ChevronUp size={16} color={white(0.74)} /> : <ChevronDown size={16} color={white(0.74)} />}
        </Pressable>
      ) : (
        <View style={{ height: 4 }} />
      )}
    </Surface>
  );
});
