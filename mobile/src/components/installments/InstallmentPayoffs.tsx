import { useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { categoryHex } from "@/lib/categoryData";
import type { ProjectionMonth, ProjectionPart } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import Surface from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import { ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What you finish paying, month by month.
 *
 * The chart says the monthly figure falls; this says why, in the words a person
 * would use — "este mês você quita o dentista e o curso" — and what each of those
 * hands back the month after. The next few months sit on the page; the rest of the
 * way to the last instalment opens in the middle of the screen.
 */

const SHOWN = 3;
const MAX_ROWS = 6;
const RULE = "rgba(255,255,255,0.07)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface Payoff {
  key: string;
  offset: number;
  month: number;
  year: number;
  parts: ProjectionPart[];
  freed: number;
}

export default function InstallmentPayoffs({
  projection,
  customCats,
}: {
  projection: ProjectionMonth[];
  customCats: CustomCategory[];
}) {
  const [open, setOpen] = useState(false);

  const payoffs = useMemo<Payoff[]>(
    () =>
      projection
        .map((p, offset) => {
          const parts = p.parts.filter((x) => x.number === x.total);
          return { key: p.key, offset, month: p.month, year: p.year, parts, freed: parts.reduce((s, x) => s + x.amount, 0) };
        })
        .filter((p) => p.parts.length > 0),
    [projection],
  );

  if (payoffs.length === 0) return null;

  /* Up to three months, but never more than a handful of rows on the page. */
  let rows = 0;
  const shown = payoffs.filter((p, i) => {
    if (i >= SHOWN || (i > 0 && rows + p.parts.length > MAX_ROWS)) return false;
    rows += p.parts.length;
    return true;
  });
  const hidden = payoffs.length - shown.length;
  const more = hidden > 0;
  const last = payoffs[payoffs.length - 1];
  const count = payoffs.reduce((s, p) => s + p.parts.length, 0);

  return (
    <>
      <Surface onPress={more ? () => setOpen(true) : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Quitações</Text>
          <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
            O que termina em cada mês, e quanto fica livre no seguinte.
          </Text>

          <View style={{ marginTop: 6 }}>
            {shown.map((p, i) => (
              <PayoffGroup key={p.key} payoff={p} customCats={customCats} first={i === 0} />
            ))}
          </View>
        </View>

        {more ? (
          <View
            style={{
              marginHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: RULE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, color: INK.soft }}>
              Mais {hidden} {hidden === 1 ? "mês" : "meses"} até {MONTHS[last.month].slice(0, 3)} {last.year}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.82)" }}>Ver todas</Text>
              <ChevronRight size={15} color="rgba(255,255,255,0.82)" />
            </View>
          </View>
        ) : (
          <View style={{ height: 6 }} />
        )}
      </Surface>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Quitações"
        subtitle={`${count} ${count === 1 ? "compra termina" : "compras terminam"} até ${MONTHS[last.month]} de ${last.year}`}
      >
        {payoffs.map((p, i) => (
          <PayoffGroup key={p.key} payoff={p} customCats={customCats} first={i === 0} />
        ))}
      </CenterModal>
    </>
  );
}

/** One month: what ends in it, and what that hands back. */
function PayoffGroup({ payoff: p, customCats, first }: { payoff: Payoff; customCats: CustomCategory[]; first: boolean }) {
  const thisYear = new Date().getFullYear();
  const name = MONTHS[p.month];

  return (
    <View style={{ paddingTop: first ? 8 : 14, paddingBottom: 6, borderTopWidth: first ? 0 : 1, borderTopColor: RULE }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: INK.soft }}>
          {p.offset === 0 ? (
            <Text style={{ fontWeight: "700", color: "#fff" }}>Este mês</Text>
          ) : (
            <>
              Em <Text style={{ fontWeight: "700", color: "#fff" }}>{name}{p.year !== thisYear ? ` de ${p.year}` : ""}</Text>
            </>
          )}{" "}
          você quita
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={[nums, { fontSize: 12.5, color: INK.soft }]}>
            libera <Text style={{ fontWeight: "600", color: "#fff" }}>{money(p.freed)}</Text>
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 4 }}>
        {p.parts.map((part) => {
          const Icon = categoryIcon(part.category, customCats);
          const hex = categoryHex(part.category, customCats);
          return (
            <View key={part.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: chipFill(hex),
                }}
              >
                <Icon size={15} color={chipInk(hex)} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, color: "#fff" }}>
                  {part.name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
                  Última de {part.total} parcelas
                </Text>
              </View>
              <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(part.amount)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
