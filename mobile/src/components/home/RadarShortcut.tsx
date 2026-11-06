import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useRaioX } from "@/hooks/useRaioX";
import { ChevronRight } from "~/components/icons";
import Surface from "~/components/Surface";
import { ICE, SKY } from "~/components/radar/parts";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/**
 * The way into the Radar from the home: its dial in small, its name, and what it would open on
 * if it were opened now. Fixed above the cards while it is being tried; if it stays, it can join
 * the ones that are arranged by hand.
 */

const SIZE = 46;

export function MiniDial() {
  const c = SIZE / 2;
  const r = c - 1.5;
  const core = r * 0.34;
  const point = (rad: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + rad * Math.cos(a)).toFixed(2)} ${(c + rad * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle cx={c} cy={c} r={r} stroke={th("rgba(255,255,255,0.18)")} strokeWidth={1} fill="none" />
      <Circle cx={c} cy={c} r={r * 0.66} stroke={th("rgba(255,255,255,0.1)")} strokeWidth={1} fill="none" />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const a = ((deg - 30 - 90) * Math.PI) / 180;
        return <Line key={deg} x1={c + core * Math.cos(a)} y1={c + core * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={th("rgba(255,255,255,0.12)")} strokeWidth={1} />;
      })}
      <Path d={`M${point(core, -30)}L${point(r, -30)}A${r} ${r} 0 0 1 ${point(r, 30)}L${point(core, 30)}A${core} ${core} 0 0 0 ${point(core, -30)}Z`} fill={th(SKY)} fillOpacity={0.4} stroke={th(ICE)} strokeOpacity={0.6} strokeWidth={0.8} />
      <Circle cx={c} cy={c} r={core * 0.62} fill={th(ICE)} />
    </Svg>
  );
}

/** Mounted a moment later: the Radar's reading is not what the home should wait for. */
export function Reading() {
  const data = useRaioX();
  if (data.loading) return <Text numberOfLines={1} style={[T.note, { marginTop: 2, fontSize: 13 }]}>Consumo, hábitos, futuro e simulações</Text>;
  const watching = data.report.pillars.filter((p) => p.tone === "atencao" || p.tone === "critico").length;
  const odd = data.anomalies.length;
  const said = watching > 0 ? `${watching} ${watching === 1 ? "ponto" : "pontos"} de atenção` : odd > 0 ? `${odd} ${odd === 1 ? "coisa" : "coisas"} fora do normal` : "Nada fora do normal";
  return (
    <Text numberOfLines={1} style={[T.note, { marginTop: 2, fontSize: 13 }]}>
      {said}
    </Text>
  );
}

export default function RadarShortcut() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ marginBottom: 16 }}>
      <Surface onPress={() => router.push({ pathname: "/registro", params: { view: "radar" } } as never)} style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MiniDial />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
            Radar financeiro
          </Text>
          {ready ? (
            <Reading />
          ) : (
            <Text numberOfLines={1} style={[T.note, { marginTop: 2, fontSize: 13 }]}>
              Consumo, hábitos, futuro e simulações
            </Text>
          )}
        </View>
        <ChevronRight size={16} color={th(INK.faint)} />
      </Surface>
    </View>
  );
}
