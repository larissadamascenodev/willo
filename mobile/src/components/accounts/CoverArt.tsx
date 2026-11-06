import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import type { CoverKind } from "~/lib/coverKind";

import { th } from "~/theme/theme";
/**
 * The picture a caixinha wears until it has one of its own.
 *
 * Each kind is a small scene drawn in flat shapes and a few gradients — a sunset over
 * the sea for a trip, a lit house at dusk, a rocket leaving — so a shelf of caixinhas
 * reads as a shelf of different things rather than the same colour with a different
 * icon. All of them are drawn on one 400 × 320 canvas and cropped to fit, with the
 * subject kept near the middle so a tall card and a wide page both show it.
 */

const W = 400;
const H = 320;

const Stars = ({ seed = 1 }: { seed?: number }) => (
  <G fill={th("#fff")}>
    {Array.from({ length: 26 }).map((_, i) => {
      const x = (i * 97 + seed * 53) % W;
      const y = (i * 61 + seed * 29) % 190;
      return <Circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.7 : 1} opacity={0.25 + (i % 4) * 0.15} />;
    })}
  </G>
);

const Sparkle = ({ x, y, s, o = 0.9 }: { x: number; y: number; s: number; o?: number }) => (
  <Polygon
    points={`${x},${y - s} ${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ${x - s * 0.28},${y - s * 0.28}`}
    fill={th("#fff")}
    opacity={o}
  />
);

function Viagem() {
  return (
    <>
      <Defs>
        <LinearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#0E2A4D", "grad")} />
          <Stop offset="0.55" stopColor={th("#2F6FA7", "grad")} />
          <Stop offset="1" stopColor={th("#F4A261", "grad")} />
        </LinearGradient>
        <LinearGradient id="v-sea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#1D5A86", "grad")} />
          <Stop offset="1" stopColor={th("#081B2E", "grad")} />
        </LinearGradient>
        <RadialGradient id="v-sun" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={th("#FFE3A8", "grad")} stopOpacity="1" />
          <Stop offset="0.4" stopColor={th("#FFC46B", "grad")} stopOpacity="0.55" />
          <Stop offset="1" stopColor={th("#FFC46B", "grad")} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#v-sky)" />
      <Circle cx={250} cy={196} r={120} fill="url(#v-sun)" />
      <Circle cx={250} cy={196} r={38} fill={th("#FFE1A6")} />
      <Ellipse cx={90} cy={92} rx={70} ry={11} fill={th("#fff")} opacity={0.1} />
      <Ellipse cx={330} cy={60} rx={56} ry={9} fill={th("#fff")} opacity={0.1} />
      <Path d="M-10 214 L60 176 L104 204 L150 168 L214 214 Z" fill={th("#0A2036")} opacity={0.85} />
      <Rect x={0} y={206} width={W} height={H - 206} fill="url(#v-sea)" />
      <G opacity={0.55}>
        <Rect x={206} y={214} width={88} height={3} rx={1.5} fill={th("#FFE1A6")} />
        <Rect x={222} y={224} width={60} height={3} rx={1.5} fill={th("#FFE1A6")} />
        <Rect x={234} y={234} width={38} height={3} rx={1.5} fill={th("#FFE1A6")} />
      </G>
      {/* The plane, climbing, with its trail behind. */}
      <G transform="translate(236 104) rotate(-18)">
        <Path d="M-150 6 L-34 0 L-34 2 Z" fill={th("#fff")} opacity={0.28} />
        <Path d="M-32 0 L26 -5 Q42 0 26 5 Z" fill={th("#fff")} />
        <Polygon points="-6,0 12,-30 21,-30 12,0" fill={th("#fff")} />
        <Polygon points="-6,0 12,30 21,30 12,0" fill={th("#E9F0F8")} />
        <Polygon points="-32,0 -42,-13 -35,-13 -22,0" fill={th("#fff")} />
      </G>
    </>
  );
}

function Reserva() {
  return (
    <>
      <Defs>
        <LinearGradient id="r-bg" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={th("#06231B", "grad")} />
          <Stop offset="0.6" stopColor={th("#0F4A33", "grad")} />
          <Stop offset="1" stopColor={th("#1C7A4C", "grad")} />
        </LinearGradient>
        <LinearGradient id="r-shield" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#DFFF9A", "grad")} />
          <Stop offset="1" stopColor={th("#7BD34A", "grad")} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#r-bg)" />
      {[60, 105, 150, 200, 255].map((r, i) => (
        <Circle key={r} cx={236} cy={126} r={r} fill="none" stroke={th("#C8F36D")} strokeWidth={1.5} opacity={0.2 - i * 0.03} />
      ))}
      <Circle cx={236} cy={126} r={62} fill={th("#C8F36D")} opacity={0.1} />
      <Path d="M236 56 L292 78 V126 C292 162 268 186 236 200 C204 186 180 162 180 126 V78 Z" fill="url(#r-shield)" />
      <Path d="M236 56 L292 78 V126 C292 162 268 186 236 200 Z" fill={th("#000")} opacity={0.1} />
      <Path d="M210 124 L230 144 L264 104" fill="none" stroke={th("#0A3524")} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={96} cy={74} r={5} fill={th("#C8F36D")} opacity={0.5} />
      <Circle cx={330} cy={196} r={4} fill={th("#C8F36D")} opacity={0.45} />
      <Circle cx={140} cy={210} r={3} fill={th("#C8F36D")} opacity={0.4} />
    </>
  );
}

function Casa() {
  return (
    <>
      <Defs>
        <LinearGradient id="c-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#15123A", "grad")} />
          <Stop offset="0.6" stopColor={th("#5A3A8B", "grad")} />
          <Stop offset="1" stopColor={th("#F08A6B", "grad")} />
        </LinearGradient>
        <RadialGradient id="c-glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={th("#FFD27D", "grad")} stopOpacity="0.7" />
          <Stop offset="1" stopColor={th("#FFD27D", "grad")} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#c-sky)" />
      <Stars seed={3} />
      <Circle cx={96} cy={78} r={20} fill={th("#FFF3D6")} opacity={0.92} />
      <Circle cx={104} cy={72} r={18} fill={th("#2C2160")} opacity={0.0} />
      <Rect x={0} y={236} width={W} height={H - 236} fill={th("#120D26")} />
      <Circle cx={252} cy={186} r={96} fill="url(#c-glow)" />
      <Polygon points="168,150 252,92 336,150" fill={th("#0D0A20")} />
      <Rect x={184} y={148} width={136} height={92} fill={th("#1B1538")} />
      <Rect x={206} y={168} width={34} height={32} rx={3} fill={th("#FFD27D")} />
      <Rect x={207} y={183} width={32} height={2.5} fill={th("#B8863A")} opacity={0.6} />
      <Rect x={222} y={169} width={2.5} height={30} fill={th("#B8863A")} opacity={0.6} />
      <Rect x={268} y={186} width={30} height={54} rx={3} fill={th("#0D0A20")} />
      <Circle cx={292} cy={214} r={2} fill={th("#FFD27D")} />
      <Rect x={298} y={104} width={14} height={34} fill={th("#0D0A20")} />
      <Circle cx={128} cy={214} r={26} fill={th("#0B1D1F")} />
      <Circle cx={112} cy={226} r={20} fill={th("#0B1D1F")} />
      <Rect x={124} y={226} width={6} height={14} fill={th("#0B1D1F")} />
      <Path d="M270 240 Q262 262 232 320 H300 Q290 270 280 240 Z" fill={th("#241B45")} opacity={0.7} />
    </>
  );
}

function Reforma() {
  return (
    <>
      <Defs>
        <LinearGradient id="f-bg" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={th("#2B1B0E", "grad")} />
          <Stop offset="0.55" stopColor={th("#8A4B16", "grad")} />
          <Stop offset="1" stopColor={th("#E9A23B", "grad")} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#f-bg)" />
      <Polygon points="150,150 236,86 322,150" fill={th("#FFF0D6")} opacity={0.95} />
      <Rect x={166} y={148} width={140} height={92} fill={th("#FFE2B3")} opacity={0.95} />
      {/* Half painted: the left wall already is. */}
      <Rect x={166} y={148} width={62} height={92} fill={th("#4FA3D9")} opacity={0.95} />
      <Rect x={188} y={170} width={30} height={30} rx={3} fill={th("#EAF6FF")} />
      <Rect x={252} y={170} width={30} height={30} rx={3} fill={th("#C98D45")} opacity={0.7} />
      <Rect x={0} y={240} width={W} height={H - 240} fill={th("#3A2210")} opacity={0.75} />
      {/* A roller leaning on the house. */}
      <G transform="translate(334 196) rotate(24)">
        <Rect x={-32} y={-12} width={64} height={22} rx={7} fill={th("#4FA3D9")} />
        <Rect x={-32} y={-12} width={64} height={7} rx={3.5} fill={th("#fff")} opacity={0.25} />
        <Path d="M0 10 V26 H-18" fill="none" stroke={th("#2A1809")} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <Rect x={-24} y={24} width={12} height={46} rx={5} fill={th("#2A1809")} />
      </G>
      {[["#4FA3D9", 86], ["#F2B8A0", 112], ["#9CCB86", 138]].map(([c, x]) => (
        <Circle key={c as string} cx={x as number} cy={228} r={11} fill={th(c as string)} />
      ))}
    </>
  );
}

function Carro() {
  return (
    <>
      <Defs>
        <LinearGradient id="k-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#2A0F52", "grad")} />
          <Stop offset="0.55" stopColor={th("#C42E6B", "grad")} />
          <Stop offset="1" stopColor={th("#FDB347", "grad")} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#k-sky)" />
      <Circle cx={216} cy={196} r={78} fill={th("#FFD27A")} />
      {[168, 180, 192, 204].map((y, i) => (
        <Rect key={y} x={130} y={y} width={176} height={2 + i} fill={th("#C42E6B")} opacity={0.55} />
      ))}
      <Path d="M0 206 L70 184 L130 206 L196 176 L270 206 L330 188 L400 206 V230 H0 Z" fill={th("#26103F")} opacity={0.85} />
      <Rect x={0} y={218} width={W} height={H - 218} fill={th("#1A0D2E")} />
      <Polygon points="150,218 250,218 330,320 70,320" fill={th("#2A1744")} />
      <G fill={th("#FDB347")} opacity={0.8}>
        <Rect x={196} y={226} width={8} height={12} rx={2} />
        <Rect x={194} y={252} width={12} height={20} rx={2} />
        <Rect x={190} y={290} width={20} height={30} rx={3} />
      </G>
      <G transform="translate(200 238)">
        <Path d="M-66 14 L-52 -6 Q-42 -16 -22 -16 L22 -16 Q42 -14 54 2 L68 6 Q76 8 76 18 L76 26 L-70 26 L-70 20 Q-70 16 -66 14 Z" fill={th("#0B0618")} />
        <Path d="M-38 -4 L-26 -12 L-4 -12 L-4 4 L-42 4 Z" fill={th("#5A3E8B")} opacity={0.85} />
        <Path d="M4 -12 L26 -12 Q38 -8 46 4 L4 4 Z" fill={th("#5A3E8B")} opacity={0.85} />
        <Circle cx={-38} cy={28} r={15} fill={th("#0B0618")} />
        <Circle cx={48} cy={28} r={15} fill={th("#0B0618")} />
        <Circle cx={-38} cy={28} r={6} fill={th("#6B5A8E")} />
        <Circle cx={48} cy={28} r={6} fill={th("#6B5A8E")} />
        <Rect x={66} y={10} width={10} height={5} rx={2} fill={th("#FFE9A8")} />
      </G>
    </>
  );
}

function Carreira() {
  return (
    <>
      <Defs>
        <LinearGradient id="e-bg" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={th("#0A0E2B", "grad")} />
          <Stop offset="0.6" stopColor={th("#1B2670", "grad")} />
          <Stop offset="1" stopColor={th("#4B5BD6", "grad")} />
        </LinearGradient>
        <LinearGradient id="e-trail" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={th("#FDBA74", "grad")} stopOpacity="0" />
          <Stop offset="1" stopColor={th("#FDBA74", "grad")} stopOpacity="0.85" />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#e-bg)" />
      <Stars seed={7} />
      <Polygon points="40,320 196,196 214,212 120,320" fill="url(#e-trail)" opacity={0.7} />
      <Circle cx={72} cy={262} r={44} fill={th("#fff")} opacity={0.05} />
      <Circle cx={130} cy={214} r={30} fill={th("#fff")} opacity={0.07} />
      <G transform="translate(248 124) rotate(38)">
        <Path d="M-20 38 L0 86 L20 38 Z" fill={th("#FDBA74")} />
        <Path d="M-10 38 L0 66 L10 38 Z" fill={th("#FFF1C9")} />
        <Path d="M0 -70 C26 -44 28 6 18 40 L-18 40 C-28 6 -26 -44 0 -70 Z" fill={th("#EEF1FA")} />
        <Path d="M0 -70 C26 -44 28 6 18 40 L0 40 Z" fill={th("#B9C2E4")} opacity={0.6} />
        <Circle cx={0} cy={-18} r={13} fill={th("#2F6BE0")} />
        <Circle cx={0} cy={-18} r={13} fill="none" stroke={th("#fff")} strokeWidth={3} opacity={0.8} />
        <Path d="M-18 14 L-40 44 L-18 40 Z" fill={th("#F0605D")} />
        <Path d="M18 14 L40 44 L18 40 Z" fill={th("#F0605D")} />
      </G>
    </>
  );
}

function Consumo() {
  return (
    <>
      <Defs>
        <LinearGradient id="g-bg" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={th("#190B33", "grad")} />
          <Stop offset="0.55" stopColor={th("#52209E", "grad")} />
          <Stop offset="1" stopColor={th("#B779F2", "grad")} />
        </LinearGradient>
        <LinearGradient id="g-top" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={th("#F4E9FF", "grad")} />
          <Stop offset="1" stopColor={th("#C9A4FA", "grad")} />
        </LinearGradient>
        <LinearGradient id="g-body" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={th("#B98BF5", "grad")} />
          <Stop offset="1" stopColor={th("#6C34C9", "grad")} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#g-bg)" />
      <Circle cx={236} cy={134} r={120} fill={th("#C9A4FA")} opacity={0.1} />
      <G transform="translate(236 128)">
        <Polygon points="-66,-46 66,-46 90,-4 -90,-4" fill="url(#g-top)" />
        <Polygon points="-90,-4 90,-4 0,92" fill="url(#g-body)" />
        <Polygon points="-90,-4 -30,-4 0,92" fill={th("#fff")} opacity={0.12} />
        <Polygon points="-66,-46 -30,-4 -22,-46" fill={th("#fff")} opacity={0.35} />
        <Polygon points="22,-46 30,-4 66,-46" fill={th("#fff")} opacity={0.2} />
        <Polygon points="-30,-4 30,-4 0,92" fill={th("#000")} opacity={0.1} />
      </G>
      <Sparkle x={104} y={92} s={16} />
      <Sparkle x={338} y={70} s={12} o={0.8} />
      <Sparkle x={316} y={226} s={9} o={0.6} />
      <Sparkle x={140} y={218} s={7} o={0.5} />
    </>
  );
}

function Educacao() {
  return (
    <>
      <Defs>
        <LinearGradient id="d-bg" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={th("#14123F", "grad")} />
          <Stop offset="0.55" stopColor={th("#3730A3", "grad")} />
          <Stop offset="1" stopColor={th("#8B93F5", "grad")} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#d-bg)" />
      <Circle cx={236} cy={118} r={110} fill={th("#A5B4FC")} opacity={0.1} />
      <G transform="translate(236 112)">
        <Path d="M-62 10 V54 Q0 84 62 54 V10 L0 36 Z" fill={th("#C7D2FE")} />
        <Path d="M0 36 L62 10 V54 Q32 70 0 74 Z" fill={th("#000")} opacity={0.1} />
        <Polygon points="0,-52 112,-6 0,40 -112,-6" fill={th("#F5F7FF")} />
        <Polygon points="0,-52 112,-6 0,40" fill={th("#C7D2FE")} opacity={0.55} />
        <Path d="M86 2 V58" stroke={th("#FBBF24")} strokeWidth={4} strokeLinecap="round" />
        <Circle cx={86} cy={64} r={8} fill={th("#FBBF24")} />
      </G>
      <G>
        <Rect x={120} y={232} width={168} height={22} rx={4} fill={th("#EEF0FF")} opacity={0.95} />
        <Rect x={130} y={254} width={150} height={20} rx={4} fill={th("#A5B4FC")} />
        <Rect x={112} y={274} width={176} height={22} rx={4} fill={th("#FDE68A")} opacity={0.95} />
      </G>
      <Sparkle x={86} y={84} s={11} o={0.7} />
      <Sparkle x={352} y={156} s={9} o={0.6} />
    </>
  );
}

const SCENES: Record<CoverKind, () => React.JSX.Element> = {
  viagem: Viagem,
  reserva: Reserva,
  casa: Casa,
  reforma: Reforma,
  carro: Carro,
  carreira: Carreira,
  consumo: Consumo,
  educacao: Educacao,
};

export default function CoverArt({ kind, width, height }: { kind: CoverKind; width?: number | string; height?: number | string }) {
  const Scene = SCENES[kind];
  return (
    <View style={{ width: width ?? "100%", height: height ?? "100%" }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Scene />
      </Svg>
    </View>
  );
}
