import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useMonth } from "@/contexts/MonthContext";
import { BalanceHero } from "~/features/home/BalanceHero";
import { CategorySpending } from "~/features/home/CategorySpending";
import { FinanceOverview } from "~/features/home/FinanceOverview";
import { GoalsSummary } from "~/features/home/GoalsSummary";
import { RecentTransactions } from "~/features/home/RecentTransactions";
import { UpcomingEvents } from "~/features/home/UpcomingEvents";
import { Screen } from "~/ui";

export default function Home() {
  const { selectedMonth, selectedYear } = useMonth();
  const { data, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  // "Toque duas vezes na tela para lançar": abre uma nova despesa direto
  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDelay(280).runOnJS(true).onEnd((_, success) => {
    if (success) router.push({ pathname: "/nova", params: { type: "despesa" } });
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <GestureDetector gesture={doubleTap}>
    <Screen tabBar onRefresh={onRefresh} refreshing={refreshing}>
      <BalanceHero saldoAtual={data.saldoAtual} saldoPrevisto={data.saldoPrevisto} receitas={data.receitas} despesas={data.despesas} />
      <View style={{ marginTop: 12, gap: 12 }}>
        <CategorySpending categories={data.categories} month={selectedMonth} />
        <RecentTransactions transactions={data.transactions} />
        <FinanceOverview receitas={data.receitas} despesas={data.despesas} saldoPrevisto={data.saldoPrevisto} nextMonthBalance={data.projection.nextMonthBalance} />
        <UpcomingEvents events={data.events} />
        <GoalsSummary />
      </View>
    </Screen>
    </GestureDetector>
  );
}
