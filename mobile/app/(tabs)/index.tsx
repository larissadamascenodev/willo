import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useMonth } from "@/contexts/MonthContext";
import { ActiveInstallmentsCard } from "~/features/home/ActiveInstallmentsCard";
import { BalanceHero } from "~/features/home/BalanceHero";
import { CardsOverviewCard } from "~/features/home/CardsOverviewCard";
import { OnboardingCard } from "~/features/home/OnboardingCard";
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
  const { profile, updateDisplayName } = useProfile();
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
        {profile && <OnboardingCard profile={profile} onUpdateName={updateDisplayName} />}
        <CategorySpending categories={data.categories} month={selectedMonth} />
        <RecentTransactions transactions={data.transactions} />
        <FinanceOverview receitas={data.receitas} despesas={data.despesas} saldoPrevisto={data.saldoPrevisto} nextMonthBalance={data.projection.nextMonthBalance} />
        <CardsOverviewCard />
        <UpcomingEvents events={data.events} />
        <ActiveInstallmentsCard />
        <GoalsSummary />
      </View>
    </Screen>
    </GestureDetector>
  );
}
