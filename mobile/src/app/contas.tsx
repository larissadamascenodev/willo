import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAccounts } from "@/services/transactionService";
import { colorFor, initials } from "@/lib/banks";
import { useAuth } from "~/lib/auth";
import { GREEN, GROUND, INK, RED } from "~/theme/tokens";

/**
 * The first screen that is really the app.
 *
 * It does nothing clever on purpose. What it proves is the whole chain: the shared
 * service under ../src runs unchanged on a phone, reaches the same Supabase project,
 * comes back with the same accounts, and the bank colours are decided by the same
 * function the web app uses. Everything after this is drawing.
 */

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number | null;
  color: string | null;
  is_default: boolean;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Contas() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = (await getAccounts()) as unknown as Account[];
      setAccounts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = accounts.reduce((sum, a) => sum + Number(a.balance ?? 0), 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: GROUND }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={INK.softer}
        />
      }
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.8 }}>
        Contas
      </Text>
      <Text style={{ marginTop: 4, fontSize: 13, color: INK.softer }}>{user?.email}</Text>

      {/* The total, loose on the ground, the way the web app leads a screen. */}
      <Text
        style={{
          marginTop: 24,
          fontSize: 11.5,
          fontWeight: "600",
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: INK.softer,
        }}
      >
        Saldo em contas
      </Text>
      {loading ? (
        <ActivityIndicator color={GREEN} style={{ alignSelf: "flex-start", marginTop: 14 }} />
      ) : (
        <Text
          style={{
            marginTop: 6,
            fontSize: 38,
            fontWeight: "800",
            letterSpacing: -1.3,
            color: total < 0 ? RED : "#fff",
          }}
        >
          {fmt(total)}
        </Text>
      )}

      {error && (
        <Text style={{ marginTop: 16, fontSize: 13.5, color: RED, lineHeight: 19 }}>{error}</Text>
      )}

      <View style={{ marginTop: 26 }}>
        {accounts.map((acc, i) => (
          <View
            key={acc.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: INK.hairline,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colorFor(acc.name, acc.color),
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                {initials(acc.name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>
                {acc.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer, marginTop: 1 }}>
                {acc.is_default ? "Conta padrão" : acc.type}
              </Text>
            </View>
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
              {fmt(Number(acc.balance ?? 0))}
            </Text>
          </View>
        ))}
      </View>

      {!loading && accounts.length === 0 && !error && (
        <Text style={{ marginTop: 20, fontSize: 14, color: INK.soft }}>
          Nenhuma conta encontrada nesta conta de usuário.
        </Text>
      )}

      <Pressable
        onPress={signOut}
        style={({ pressed }) => ({
          marginTop: 36,
          height: 48,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: INK.edge,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: INK.soft }}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}
