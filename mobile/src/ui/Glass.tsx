import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { white } from "./theme";

interface GlassProps {
  children?: ReactNode;
  radius?: number;
  /** A versão escura, para folhas e modais com conteúdo qualquer por trás. */
  strong?: boolean;
  /** Sem desfoque: só o tom. Para itens de lista e superfícies dentro de vidro, onde um segundo desfoque só pesa. */
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * O "vidro fosco" do site (.willo-glass): um painel translúcido com desfoque, um brilho
 * leve na diagonal e um fio de luz só na borda de cima.
 */
export function Glass({ children, radius = 22, strong, flat, style }: GlassProps) {
  return (
    <View
      style={[
        {
          // zIndex 0 isola as camadas abaixo: elas ficam atrás do conteúdo em qualquer plataforma
          zIndex: 0,
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: white(strong ? 0.12 : 0.14),
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
        {!flat && <BlurView intensity={strong ? 60 : 32} tint="dark" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? "rgba(16,24,40,0.74)" : white(flat ? 0.1 : 0.105) }]} />
        {!strong && (
          <LinearGradient
            colors={[white(0.08), white(0.015), "rgba(255,255,255,0)"]}
            locations={[0, 0.44, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: white(strong ? 0.14 : 0.24) }} />
      </View>
      {children}
    </View>
  );
}

/** O cartão padrão das telas. */
export function Surface({ children, style, flat }: { children?: ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  return (
    <Glass flat={flat} style={style}>
      {children}
    </Glass>
  );
}
