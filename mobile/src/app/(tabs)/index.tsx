import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGreeting } from "@/lib/greeting";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import Room from "~/components/Room";
import HomeHeader from "~/components/home/HomeHeader";
import SaldoContasCard from "~/components/home/SaldoContasCard";
import FluxoCard from "~/components/home/FluxoCard";
import SaudeDoMesCard from "~/components/home/SaudeDoMesCard";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The home.
 *
 * It gets the lit ground, like the wallet and the accounts screen — it is a place
 * you arrive at rather than work in, and the cards sit badly on flat charcoal.
 *
 * The cards come in the order the web stacks them, each one carried over reading for
 * reading. What it does not have yet is the web's board: there, the order, the width
 * and whether a card is there at all are the person's to change. That is a layer on
 * top of these cards rather than a property of them, so it comes once they are all
 * standing.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { onScroll } = useNavChrome();
  const { greeting, dateStr } = useGreeting();
  const [refreshing, setRefreshing] = useState(false);

  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  const { data, refetch } = useFinanceData(month, year, { includeHistorical: false });
  const { profile } = useProfile();

  const name = profile?.display_name || user?.email?.split("@")[0] || "você";

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 150,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.softer} />
        }
      >
        <HomeHeader name={profile?.display_name ?? name} avatarUrl={profile?.avatar_url} />

        <View>
          <Text style={[T.eyebrow, { letterSpacing: 1.1 }]}>{dateStr}</Text>
          <Text style={[T.title, { marginTop: 8 }]}>
            {greeting}, {name}.
          </Text>
          <Text style={[T.note, { marginTop: 6, fontSize: 14 }]}>
            Veja o que mudou por aqui desde a última vez.
          </Text>
        </View>

        <SaldoContasCard saldoPrevisto={data.saldoPrevisto} />

        <FluxoCard
          receitas={data.receitas}
          despesas={data.despesas}
          month={month}
          isCurrentMonth
        />

        <SaudeDoMesCard
          receitas={data.receitas}
          despesas={data.despesas}
          saldoPrevisto={data.saldoPrevisto}
          categories={data.categories ?? []}
          isCurrentMonth
        />
      </ScrollView>
    </Room>
  );
}
