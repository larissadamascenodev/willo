import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "./theme";

const SKY_HEIGHT = 470;

/** O fundo de toda tela: o azul-noite com o céu do entardecer no topo, dissolvendo no fundo. */
export function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground }]} />
      <Image
        source={require("@/assets/bg/dusk-sky.jpg")}
        contentFit="cover"
        contentPosition="top"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: SKY_HEIGHT }}
      />
      <LinearGradient
        colors={["rgba(10,18,32,0.10)", "rgba(10,18,32,0.30)", "rgba(10,18,32,0.72)", "#0A1220"]}
        locations={[0, 0.34, 0.72, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: SKY_HEIGHT }}
      />
    </View>
  );
}
