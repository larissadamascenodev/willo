import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import BankMark from "~/components/BankMark";
import { FlexBar } from "~/components/Bar";
import { Landmark, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Where the money is.
 *
 * The total leads, then one bar split the way the money is split, then a line per
 * account. It scrolls with the page: the wallet pins its total because a long list
 * of cards would carry it off screen, and a handful of accounts never does — pinning
 * a header a page does not need is just a header that blurs for no reason.
 */

const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
  is_default: boolean;
}

export default function Gestao() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      return;
    }
    try {
      setAccounts((await getAccounts()) as unknown as Account[]);
    } catch {
      setAccounts([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  const rows = useMemo(
    () =>
      (accounts ?? [])
        .map((a) => ({
          account: a,
          balance: Number(a.current_balance) || 0,
          hex: colorFor(a.name, a.color, "#6B7280"),
          typeLabel: TYPE_LABEL[a.type] ?? TYPE_LABEL.checking,
        }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );

  const saldo = rows.reduce((s, r) => s + r.balance, 0);
  /* Only what is actually in hand can take up room on a share rule; an account in
     the red still gets its line, so the list stays the whole truth. */
  const positive = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/" />
          <Pressable
            accessibilityLabel="Adicionar conta"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.07)",
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Plus size={18} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>

        {accounts === null ? (
          <View style={{ marginTop: 20, gap: 16 }}>
            <View style={{ height: 96, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <Surface style={{ height: 170 }}><View /></Surface>
          </View>
        ) : rows.length === 0 ? (
          <Surface radius={26} style={{ marginTop: 16, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: INK.edge,
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <Landmark size={22} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: "700", color: "#fff" }}>
              Nenhuma conta cadastrada
            </Text>
            <Text style={{ marginTop: 6, maxWidth: 256, textAlign: "center", fontSize: 13.5, lineHeight: 18, color: INK.soft }}>
              Cadastre uma conta para acompanhar o saldo e o que entra e sai dela.
            </Text>
          </Surface>
        ) : (
          <>
            {/* ══ Everything you hold ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 12 }}>
              <Text style={{ fontSize: 13.5, color: "rgba(255,255,255,0.62)" }}>Saldo em contas</Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  fontSize: 40,
                  fontWeight: "800",
                  letterSpacing: -1.6,
                  color: saldo < 0 ? RED : "#fff",
                }}
              >
                {money(saldo)}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>
                {rows.length} {rows.length === 1 ? "conta" : "contas"}
              </Text>
            </Animated.View>

            {/* ══ The accounts, one line each ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(420)} style={{ marginTop: 24 }}>
              {/* One bar split the way the money is, each share in its bank's colour. */}
              <View style={{ flexDirection: "row", height: 8, gap: 3, paddingHorizontal: 4, marginBottom: 4 }}>
                {positive > 0 ? (
                  rows
                    .filter((r) => r.balance > 0)
                    .map((r, i) => (
                      <FlexBar
                        key={r.account.id}
                        share={r.balance / positive}
                        color={r.hex}
                        delay={0.05 * i}
                      />
                    ))
                ) : (
                  <View style={{ flex: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }} />
                )}
              </View>

              {rows.map((r, i) => {
                const share = positive > 0 ? Math.max(r.balance, 0) / positive : 0;
                return (
                  <Animated.View key={r.account.id} entering={FadeInDown.delay(40 + i * 50).duration(350)}>
                    <Pressable
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        paddingHorizontal: 4,
                        paddingVertical: 16,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: "rgba(255,255,255,0.06)",
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <BankMark name={r.account.name} hex={r.hex} size={40} />

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
                            {r.account.name}
                          </Text>
                          {r.account.is_default && (
                            <Text
                              style={{
                                borderRadius: 999,
                                overflow: "hidden",
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                fontSize: 10,
                                fontWeight: "700",
                                backgroundColor: "rgba(255,255,255,0.08)",
                                color: INK.soft,
                              }}
                            >
                              Principal
                            </Text>
                          )}
                        </View>
                        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.softer }}>
                          {r.typeLabel}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 15.5,
                            fontWeight: "700",
                            color: r.balance < 0 ? RED : r.balance > 0 ? "#fff" : INK.softer,
                          }}
                        >
                          {money(r.balance)}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 12, color: share > 0 ? r.hex : INK.faint }}>
                          {Math.round(share * 100)}%
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Room>
  );
}
