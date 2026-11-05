import { Text, View } from "react-native";
import { AccountMarks, AccountsBar, useAccountRows, type AccountRow } from "~/components/home/SaldoContasCard";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The balance written on the background.
 *
 * The same reading as the accounts card, with the card taken away: no surface, no
 * edge, only the figure on the ground the robot stands on. It is pinned where the
 * robot and the slides are pinned and recedes the same way, with the other cards
 * rising over it. What can be tapped is taken care of by the page, since the
 * scroller lies above this.
 */

/** Label, figure, forecast, bar and marks, plus the room before the first card. */
export const SALDO_HERO_BODY = 20 + 58 + 24 + 25 + 54 + 26;

const HIDDEN = "R$ ••••••";

export default function SaldoHero({ saldoPrevisto, hidden }: { saldoPrevisto?: number; hidden?: boolean }) {
  const rows = useAccountRows();
  return <SaldoHeroView rows={rows} saldoPrevisto={saldoPrevisto} hidden={hidden} />;
}

export function SaldoHeroView({ rows, saldoPrevisto, hidden }: { rows: AccountRow[] | null; saldoPrevisto?: number; hidden?: boolean }) {
  /* Holding its place while the accounts come: the figure must not appear to jump. */
  const total = (rows ?? []).reduce((s, a) => s + a.balance, 0);

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[T.cardLabel, { lineHeight: 20 }]}>Saldo em contas</Text>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[T.figureBig, { fontSize: 46, lineHeight: 58, letterSpacing: -1.6, opacity: rows ? 1 : 0 }, total < 0 && !hidden && { color: RED }]}
      >
        {hidden ? HIDDEN : money(total)}
      </Text>

      <View style={{ height: 24, justifyContent: "flex-end" }}>
        {saldoPrevisto !== undefined && (
          <Text numberOfLines={1} style={[T.note, { fontSize: 13 }]}>
            Previsto no final do mês:{" "}
            <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
              {hidden ? HIDDEN : money(saldoPrevisto)}
            </Text>
          </Text>
        )}
      </View>

      {!!rows?.length && (
        <>
          <View style={{ alignSelf: "stretch", marginTop: 18 }}>
            <AccountsBar rows={rows} />
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AccountMarks rows={rows} ring="transparent" overlap={6} />
            <Text style={{ fontSize: 13, color: INK.soft }}>
              {rows.length} {rows.length === 1 ? "conta" : "contas"}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
