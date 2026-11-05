import { useMemo, type ReactNode } from "react";
import { Text, View } from "react-native";
import type { InsightSlide } from "@/lib/insights";
import { useProfile } from "@/hooks/useProfile";
import { readingsFrom } from "~/components/home/OrbHero";
import { AccountMarks, AccountsBar, useAccountRows, type AccountRow } from "~/components/home/SaldoContasCard";
import GreetingLine from "~/components/willo/GreetingLine";
import { firstName, type Greeting } from "~/lib/greeting";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The balance written on the background.
 *
 * The same reading as the accounts card, with the card taken away: no surface, no
 * edge, only the figure on the ground the robot stands on. Under it, Willo goes on
 * saying what he says when he is there himself. It is pinned where the robot and the
 * slides are pinned and recedes the same way, with the other cards rising over it.
 * What can be tapped is taken care of by the page, since the scroller lies above this.
 */

const MARK = 28;
/** Label, figure, forecast, bar, and the row of accounts. */
export const SALDO_HERO_TOP = 20 + 58 + 24 + (18 + 7) + (12 + MARK + 4);
/** What he says: two lines and two more. */
const SAYING = 96;
/** All of it, plus the room before the first card. */
export const SALDO_HERO_BODY = SALDO_HERO_TOP + 14 + SAYING + 12;

const HIDDEN = "R$ ••••••";

export default function SaldoHero({
  saldoPrevisto,
  hidden,
  slides,
  onLine,
}: {
  saldoPrevisto?: number;
  hidden?: boolean;
  slides: InsightSlide[];
  onLine?: (line: Greeting) => void;
}) {
  const rows = useAccountRows();
  const { profile } = useProfile();
  const readings = useMemo(() => readingsFrom(slides), [slides]);
  return (
    <SaldoHeroView rows={rows} saldoPrevisto={saldoPrevisto} hidden={hidden}>
      <GreetingLine name={firstName(profile?.display_name)} readings={readings} onLine={onLine} titleSize={18} />
    </SaldoHeroView>
  );
}

export function SaldoHeroView({
  rows,
  saldoPrevisto,
  hidden,
  children,
}: {
  rows: AccountRow[] | null;
  saldoPrevisto?: number;
  hidden?: boolean;
  children?: ReactNode;
}) {
  const total = (rows ?? []).reduce((s, a) => s + a.balance, 0);

  return (
    <View>
      {/* Its height is fixed: the figure must not jump while the accounts come. */}
      <View style={{ height: SALDO_HERO_TOP, alignItems: "center" }}>
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
            {/* In the corner, so the middle stays with the figure. */}
            <View style={{ alignSelf: "stretch", marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <Text style={{ fontSize: 12.5, color: INK.soft }}>
                {rows.length} {rows.length === 1 ? "conta" : "contas"}
              </Text>
              <AccountMarks rows={rows} ring="transparent" overlap={7} size={MARK} />
            </View>
          </>
        )}
      </View>

      <View style={{ marginTop: 14, height: SAYING, overflow: "hidden" }}>{children}</View>
    </View>
  );
}
