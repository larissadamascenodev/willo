import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Background } from "./Background";

/** Quanto a barra flutuante ocupa no pé da tela: o conteúdo rola por cima dela sem ficar escondido. */
export const TAB_BAR_SPACE = 104;

interface ScreenProps {
  children: ReactNode;
  /** false para telas que cuidam da própria rolagem (listas, mapas). */
  scroll?: boolean;
  /** Reserva espaço para a barra inferior; telas fora das abas não precisam. */
  tabBar?: boolean;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** A moldura de toda tela: fundo, área segura do iPhone, margens laterais e rolagem. */
export function Screen({ children, scroll = true, tabBar = false, onRefresh, refreshing = false, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: insets.top + 6, paddingBottom: insets.bottom + (tabBar ? TAB_BAR_SPACE : 28), paddingHorizontal: 16 };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <Background />
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[padding, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </View>
  );
}
