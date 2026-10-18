import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGreeting } from "@/lib/greeting";
import Room from "~/components/Room";
import SaldoContasCard from "~/components/home/SaldoContasCard";
import { useAuth } from "~/lib/auth";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The home.
 *
 * It gets the lit ground, like the wallet and the accounts screen — it is a place
 * you arrive at rather than work in, and the cards sit badly on flat charcoal.
 *
 * Being rebuilt a card at a time, in the order the web screen stacks them. The
 * greeting comes from the shared hook, so the hour it decides and the words it
 * chooses are the same on both.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { greeting, dateStr } = useGreeting();
  const [refreshing, setRefreshing] = useState(false);

  const name = user?.email?.split("@")[0] ?? "você";

  const refresh = useCallback(() => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent("finance-data-changed"));
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  return (
    <Room lit>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 120,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.softer} />
        }
      >
        <View>
          <Text style={[T.eyebrow, { letterSpacing: 1.1 }]}>{dateStr}</Text>
          <Text style={[T.title, { marginTop: 8 }]}>
            {greeting}, <Text style={{ color: "#fff" }}>{name}</Text>.
          </Text>
          <Text style={[T.note, { marginTop: 6, fontSize: 14 }]}>
            Veja o que mudou por aqui desde a última vez.
          </Text>
        </View>

        <SaldoContasCard />
      </ScrollView>
    </Room>
  );
}
