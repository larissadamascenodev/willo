import { View, Pressable, LayoutAnimation, type LayoutChangeEvent } from "react-native";
import { ChevronDown, Equal, Info } from "lucide-react-native";
import type { MonthComposition } from "@/lib/monthComposition";
import { MONTH_NAMES, riskOf, useMoney } from "@/components/projecoes/shared";
import { Glass, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

export interface ProjectionRow {
  month: number;
  year: number;
  income: number;
  expense: number;
  delta: number;
  balance: number;
  prevBalance: number;
  risk: string;
  /** Nada cadastrado para este mês. */
  empty: boolean;
  short: string;
  yearTag: string;
}

interface Props {
  row: ProjectionRow;
  composition?: MonthComposition;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

const visible = (v: number) => Math.abs(v) >= 0.5;

function Line({ label, hint, value, tone }: { label: string; hint?: string; value: number; tone?: string }) {
  const { fmt } = useMoney();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 6 }}>
      <View style={{ flexShrink: 1 }}>
        <Text size={13.5} color={white(0.8)}>{label}</Text>
        {!!hint && <Text size={11.5} color={white(0.5)}>{hint}</Text>}
      </View>
      <Text size={14} weight="medium" tabular color={tone ?? "#fff"}>{fmt(value)}</Text>
    </View>
  );
}

const Heading = ({ children, first }: { children: string; first?: boolean }) => (
  <Text size={11.5} weight="semibold" color={white(0.5)} style={{ letterSpacing: 1, textTransform: "uppercase", marginTop: first ? 0 : 12 }}>
    {children}
  </Text>
);

/** Um dos meses à frente: o resumo na frente e, aberto, do que ele é feito. */
export function FutureMonthCard({ row, composition, loading, expanded, onToggle, onLayout }: Props) {
  const { fmt } = useMoney();
  const risk = riskOf(row.risk);
  const title = `${MONTH_NAMES[row.month]}${row.yearTag ? `/${row.yearTag}` : ""}`;

  if (loading) {
    return <View onLayout={onLayout} style={{ height: 84, borderRadius: 22, borderWidth: 1, borderColor: white(0.08), backgroundColor: white(0.06) }} />;
  }

  const e = composition?.expense;
  const i = composition?.income;

  return (
    <View onLayout={onLayout}>
      <Glass radius={22}>
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggle();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, opacity: pressed ? 0.8 : 1 })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text weight="semibold" size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Text>
              {row.empty ? (
                <Text size={10.5} weight="semibold" color={white(0.66)} numberOfLines={1} style={{ flexShrink: 0, backgroundColor: white(0.08), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>
                  Sem lançamentos
                </Text>
              ) : (
                <Text size={10.5} weight="semibold" color={row.balance < 0 ? colors.red : risk.hex} numberOfLines={1} style={{ flexShrink: 0, backgroundColor: tint(row.balance < 0 ? colors.red : risk.hex, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>
                  {row.balance < 0 ? "Negativo" : risk.label}
                </Text>
              )}
            </View>
            <Text size={12.5} color={white(0.58)} tabular numberOfLines={2} style={{ marginTop: 4 }}>
              Entra {fmt(row.income)} · Sai {fmt(row.expense)}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text size={11} color={white(0.5)}>{row.delta < 0 ? "Falta" : "Sobra"}</Text>
            <Text weight="bold" size={17} tabular color={row.delta < 0 ? colors.red : colors.green}>{fmt(Math.abs(row.delta))}</Text>
          </View>
          <ChevronDown size={16} color={white(0.45)} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
        </Pressable>

        {expanded && (
          <View style={{ borderTopWidth: 1, borderTopColor: white(0.08), paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}>
            {row.empty || !composition ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 14, backgroundColor: white(0.05), paddingHorizontal: 12, paddingVertical: 10 }}>
                <Info size={14} color={white(0.72)} style={{ marginTop: 2 }} />
                <Text size={12.5} color={white(0.72)} style={{ flex: 1, lineHeight: 18 }}>
                  Nada cadastrado para este mês ainda. Receitas, contas fixas, parcelas e faturas que você lançar para ele aparecem aqui.
                </Text>
              </View>
            ) : (
              <>
                <Heading first>Entradas previstas</Heading>
                <View style={{ marginTop: 4 }}>
                  {i && visible(i.fixas) && <Line label="Receitas fixas" value={i.fixas} tone={colors.green} />}
                  {i && visible(i.outras) && <Line label="Outras entradas" value={i.outras} tone={colors.green} />}
                  {i && !visible(i.fixas) && !visible(i.outras) && <Line label="Nenhuma entrada lançada" value={0} />}
                </View>

                <Heading>Saídas previstas</Heading>
                <View style={{ marginTop: 4 }}>
                  {e && visible(e.fixas) && <Line label="Contas fixas" hint="Aluguel, assinaturas, mensalidades" value={e.fixas} tone={colors.red} />}
                  {e && visible(e.parcelas) && <Line label="Parcelas" hint="Compras parceladas fora do cartão" value={e.parcelas} tone={colors.red} />}
                  {e && visible(e.cartao) && (
                    <Line label="Faturas de cartão" hint={visible(e.cartaoParcelas) ? `Inclui ${fmt(e.cartaoParcelas)} em parcelas` : undefined} value={e.cartao} tone={colors.red} />
                  )}
                  {e && visible(e.outras) && <Line label="Outros lançamentos" value={e.outras} tone={colors.red} />}
                </View>
              </>
            )}

            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: white(0.05), paddingHorizontal: 12, paddingVertical: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <Equal size={12} color={colors.black} strokeWidth={3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="semibold">Saldo no fim do mês</Text>
                <Text size={11.5} color={white(0.5)}>Parte de {fmt(row.prevBalance)} do mês anterior</Text>
              </View>
              <Text weight="bold" size={17} tabular color={row.balance < 0 ? colors.red : "#fff"}>{fmt(row.balance)}</Text>
            </View>

            {!row.empty && composition && (
              <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Info size={14} color={white(0.5)} style={{ marginTop: 2 }} />
                <Text size={12} color={white(0.5)} style={{ flex: 1, lineHeight: 17 }}>Soma só o que está cadastrado para este mês.</Text>
              </View>
            )}
          </View>
        )}
      </Glass>
    </View>
  );
}
