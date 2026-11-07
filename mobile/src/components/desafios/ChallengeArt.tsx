import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import type { IconKey, Template } from "~/lib/challenges";

/**
 * The picture a challenge wears, drawn the way a caixinha's is.
 *
 * Each kind of challenge has its own small scene in flat shapes and a few gradients —
 * a pot on the stove for cooking at home, a phone and a closed bag for no online
 * shopping, a bicycle in the city at night for no ride apps — so a shelf of challenges
 * reads as a shelf of different things. All of them are drawn on one 400 × 320 canvas
 * and cropped to fit, with the subject kept in the middle and high, so a tall card, a
 * wide card and the top of a page all show it, and the foot is left for the words.
 */

const W = 400;
const H = 320;

export type Scene = IconKey;

/** The scene for a challenge; one made from a category of one's own is matched by its name. */
export function sceneOf(t: Pick<Template, "icon" | "name" | "match">): Scene {
  if (t.icon !== "flag") return t.icon;
  const text = `${t.match?.categories[0] ?? ""} ${t.name}`.toLowerCase();
  if (/delivery|ifood|rappi/.test(text)) return "delivery";
  if (/caf[eé]|padaria/.test(text)) return "coffee";
  if (/restaur|lanch|aliment|comida|pizza|hamb|almo|jantar|bar\b|bares/.test(text)) return "lunch";
  if (/online|amazon|shopee|mercado livre|shein/.test(text)) return "online";
  if (/roupa|vestu|compra|shop|beleza|cosm|presente|eletr|acess/.test(text)) return "bag";
  if (/uber|\b99\b|corrida|t[aá]xi|carro|estacion/.test(text)) return "car";
  if (/[oô]nibus|metr[oô]|transp/.test(text)) return "bus";
  if (/stream|assinat|netflix|spotify|lazer|cinema|jogo|game|divers/.test(text)) return "tv";
  return "flag";
}

const Sparkle = ({ x, y, s, o = 0.9, c = "#fff" }: { x: number; y: number; s: number; o?: number; c?: string }) => (
  <Polygon
    points={`${x},${y - s} ${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ${x - s * 0.28},${y - s * 0.28}`}
    fill={c}
    opacity={o}
  />
);

const Stars = ({ seed = 1, n = 22, maxY = 170 }: { seed?: number; n?: number; maxY?: number }) => (
  <G fill={"#fff"}>
    {Array.from({ length: n }).map((_, i) => (
      <Circle key={i} cx={(i * 97 + seed * 53) % W} cy={(i * 61 + seed * 29) % maxY} r={i % 5 === 0 ? 1.6 : 0.9} opacity={0.2 + (i % 4) * 0.14} />
    ))}
  </G>
);

/** A background: a gradient from top to foot, and a soft light behind the subject. */
function Ground({ id, stops, glow, gx = 200, gy = 140, gr = 150 }: { id: string; stops: [string, string, string]; glow: string; gx?: number; gy?: number; gr?: number }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}-bg`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.55" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </LinearGradient>
        <RadialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={glow} stopOpacity="0.55" />
          <Stop offset="0.5" stopColor={glow} stopOpacity="0.16" />
          <Stop offset="1" stopColor={glow} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill={`url(#${id}-bg)`} />
      <Circle cx={gx} cy={gy} r={gr} fill={`url(#${id}-glow)`} />
    </>
  );
}

const Steam = ({ x, y, h = 46, o = 0.55 }: { x: number; y: number; h?: number; o?: number }) => (
  <Path
    d={`M${x} ${y} C${x - 12} ${y - h * 0.25} ${x + 12} ${y - h * 0.5} ${x} ${y - h * 0.75} C${x - 8} ${y - h * 0.88} ${x + 4} ${y - h} ${x + 2} ${y - h}`}
    fill="none"
    stroke={"#fff"}
    strokeWidth={5}
    strokeLinecap="round"
    opacity={o}
  />
);

/* Cooking at home: a pot on the stove, steaming. */
function Delivery() {
  return (
    <>
      <Ground id="dl" stops={["#2A0F09", "#6E2A1A", "#B4502F"]} glow={"#FFB37A"} gy={150} />
      <Steam x={176} y={112} h={56} />
      <Steam x={204} y={104} h={70} o={0.7} />
      <Steam x={232} y={112} h={52} />
      {/* The pot. */}
      <Rect x={118} y={156} width={22} height={12} rx={6} fill={"#2B2F36"} />
      <Rect x={260} y={156} width={22} height={12} rx={6} fill={"#2B2F36"} />
      <Path d="M132 140 H268 V196 Q268 222 242 222 H158 Q132 222 132 196 Z" fill={"#E9564A"} />
      <Path d="M232 140 H268 V196 Q268 222 242 222 H232 Z" fill={"#000"} opacity={0.14} />
      <Rect x={132} y={176} width={136} height={6} fill={"#fff"} opacity={0.12} />
      <Ellipse cx={200} cy={140} rx={74} ry={13} fill={"#C8423A"} />
      <Ellipse cx={200} cy={136} rx={66} ry={10} fill={"#F07466"} />
      <Rect x={190} y={120} width={20} height={12} rx={5} fill={"#2B2F36"} />
      {/* The stove and its flames. */}
      <Rect x={96} y={230} width={208} height={12} rx={6} fill={"#1A1B1F"} />
      {[150, 176, 200, 224, 250].map((x, i) => (
        <Path key={x} d={`M${x} 230 Q${x - 7} 220 ${x} ${i % 2 ? 210 : 214} Q${x + 7} 220 ${x} 230 Z`} fill={"#6FB7FF"} opacity={0.9} />
      ))}
      <Rect x={0} y={242} width={W} height={H - 242} fill={"#1E0B07"} opacity={0.55} />
      <Sparkle x={96} y={88} s={9} o={0.55} c={"#FFD9B8"} />
      <Sparkle x={316} y={120} s={7} o={0.5} c={"#FFD9B8"} />
    </>
  );
}

/* No online shopping: the phone with a shop on it, and a bag that stays closed. */
function Online() {
  return (
    <>
      <Ground id="on" stops={["#170C2C", "#43246E", "#7E50C8"]} glow={"#C9A8FF"} />
      <G transform="rotate(-8 190 150)">
        <Rect x={132} y={44} width={112} height={200} rx={20} fill={"#120A22"} />
        <Rect x={140} y={56} width={96} height={176} rx={13} fill={"#2C1C52"} />
        <Rect x={150} y={70} width={36} height={36} rx={8} fill={"#B79BF2"} opacity={0.85} />
        <Rect x={190} y={70} width={36} height={36} rx={8} fill={"#F0A3CC"} opacity={0.8} />
        <Rect x={150} y={112} width={36} height={36} rx={8} fill={"#8FD8F0"} opacity={0.75} />
        <Rect x={190} y={112} width={36} height={36} rx={8} fill={"#FFE29A"} opacity={0.8} />
        <Rect x={150} y={158} width={76} height={8} rx={4} fill={"#fff"} opacity={0.25} />
        <Rect x={150} y={172} width={52} height={8} rx={4} fill={"#fff"} opacity={0.18} />
        <Rect x={150} y={196} width={76} height={24} rx={12} fill={"#7E50C8"} />
      </G>
      {/* The bag in front, held shut. */}
      <Path d="M236 118 Q236 94 258 94 Q280 94 280 118" fill="none" stroke={"#F6EEFF"} strokeWidth={7} strokeLinecap="round" />
      <Path d="M214 118 H302 L310 236 H206 Z" fill={"#F6EEFF"} />
      <Path d="M262 118 H302 L310 236 H262 Z" fill={"#000"} opacity={0.08} />
      <Circle cx={258} cy={176} r={22} fill={"#4B2A7A"} />
      <Path d="M250 172 V164 Q250 154 258 154 Q266 154 266 164 V172" fill="none" stroke={"#F6EEFF"} strokeWidth={4} />
      <Rect x={246} y={170} width={24} height={20} rx={5} fill={"#F6EEFF"} />
      <Sparkle x={104} y={92} s={10} o={0.6} />
      <Sparkle x={326} y={74} s={8} o={0.55} />
      <Sparkle x={330} y={210} s={6} o={0.4} />
    </>
  );
}

/* No ride apps: a bicycle in the city at night. */
function Car() {
  return (
    <>
      <Ground id="cr" stops={["#081426", "#18375F", "#2F5F94"]} glow={"#9CCBFF"} gx={286} gy={74} gr={110} />
      <Stars seed={3} maxY={150} />
      <Circle cx={286} cy={74} r={22} fill={"#EAF4FF"} />
      {/* The city. */}
      <G fill={"#0B1A30"}>
        <Rect x={0} y={150} width={46} height={110} />
        <Rect x={50} y={124} width={38} height={136} />
        <Rect x={92} y={160} width={44} height={100} />
        <Rect x={262} y={136} width={40} height={124} />
        <Rect x={306} y={112} width={46} height={148} />
        <Rect x={356} y={152} width={44} height={108} />
      </G>
      <G fill={"#FFD27D"} opacity={0.75}>
        {[[60, 136], [72, 152], [60, 176], [316, 126], [330, 146], [316, 170], [272, 150], [366, 166], [12, 164], [104, 172]].map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={6} height={8} rx={1} />
        ))}
      </G>
      <Rect x={0} y={252} width={W} height={H - 252} fill={"#07101E"} />
      <G opacity={0.5}>
        {[30, 110, 190, 270, 350].map((x) => (
          <Rect key={x} x={x} y={280} width={40} height={4} rx={2} fill={"#9CCBFF"} />
        ))}
      </G>
      {/* The bicycle. */}
      <G stroke={"#fff"} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={146} cy={214} r={38} />
        <Circle cx={258} cy={214} r={38} />
        <Path d="M146 214 L182 150 L238 150 L258 214" />
        <Path d="M146 214 L206 214 L238 150" />
        <Path d="M182 150 L206 214" />
        <Path d="M232 132 L246 132 M238 132 L238 150" />
        <Path d="M170 140 H196" />
      </G>
      <Circle cx={146} cy={214} r={5} fill={"#FFE29A"} />
      <Circle cx={258} cy={214} r={5} fill={"#FFE29A"} />
      <Circle cx={206} cy={214} r={8} fill={"#FFE29A"} />
    </>
  );
}

/* Writing it all down: an open notebook and a pen. */
function Pen() {
  return (
    <>
      <Ground id="pn" stops={["#10141B", "#2A3444", "#4C5E78"]} glow={"#DCE6F5"} />
      <G transform="rotate(-6 200 150)">
        <Rect x={112} y={58} width={184} height={196} rx={14} fill={"#1D2533"} />
        <Rect x={118} y={52} width={176} height={196} rx={12} fill={"#F3F5F9"} />
        {[92, 118, 144, 170, 196, 222].map((y) => (
          <Rect key={y} x={150} y={y} width={124} height={2.5} rx={1.2} fill={"#B8C4D6"} />
        ))}
        {[80, 112, 144, 176, 208].map((y) => (
          <Circle key={y} cx={130} cy={y} r={5} fill={"#1D2533"} />
        ))}
        <Path d="M154 84 L162 92 L176 76" fill="none" stroke={"#3FAE5A"} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M154 110 L162 118 L176 102" fill="none" stroke={"#3FAE5A"} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M154 136 L162 144 L176 128" fill="none" stroke={"#3FAE5A"} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Rect x={184} y={80} width={70} height={8} rx={4} fill={"#2A3444"} opacity={0.75} />
        <Rect x={184} y={106} width={54} height={8} rx={4} fill={"#2A3444"} opacity={0.75} />
        <Rect x={184} y={132} width={62} height={8} rx={4} fill={"#2A3444"} opacity={0.75} />
      </G>
      {/* The pen, across the page. */}
      <G transform="rotate(38 262 176)">
        <Rect x={250} y={86} width={22} height={150} rx={8} fill={"#F2C14E"} />
        <Rect x={250} y={86} width={22} height={22} rx={8} fill={"#E86A5A"} />
        <Rect x={250} y={108} width={22} height={10} fill={"#C9CFD8"} />
        <Polygon points="250,236 272,236 261,262" fill={"#F3DDB0"} />
        <Polygon points="257,253 265,253 261,262" fill={"#2A3444"} />
      </G>
      <Sparkle x={86} y={84} s={8} o={0.5} />
      <Sparkle x={330} y={70} s={10} o={0.55} />
    </>
  );
}

/* Bills on time: a calendar page with the days ticked, and a coin. */
function Calendar() {
  return (
    <>
      <Ground id="cl" stops={["#081A20", "#1A4652", "#2C7F8E"]} glow={"#9BE7F2"} />
      <Rect x={118} y={58} width={164} height={184} rx={18} fill={"#0B232A"} opacity={0.5} transform="translate(6 8)" />
      <Rect x={118} y={58} width={164} height={184} rx={18} fill={"#F2FBFC"} />
      <Path d="M118 76 Q118 58 136 58 H264 Q282 58 282 76 V96 H118 Z" fill={"#E8656A"} />
      <Rect x={150} y={46} width={10} height={26} rx={5} fill={"#2C3A40"} />
      <Rect x={240} y={46} width={10} height={26} rx={5} fill={"#2C3A40"} />
      {Array.from({ length: 20 }).map((_, i) => {
        const x = 134 + (i % 5) * 28;
        const y = 108 + Math.floor(i / 5) * 30;
        const done = i < 12;
        return done ? (
          <G key={i}>
            <Rect x={x} y={y} width={22} height={22} rx={7} fill={"#3FAE5A"} opacity={0.16} />
            <Path d={`M${x + 5} ${y + 11} L${x + 9.5} ${y + 15.5} L${x + 17} ${y + 7}`} fill="none" stroke={"#2F9A4B"} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : (
          <Rect key={i} x={x} y={y} width={22} height={22} rx={7} fill={i === 12 ? "#E8656A" : "#D5E3E6"} opacity={i === 12 ? 0.9 : 0.8} />
        );
      })}
      {/* A coin, leaning on the page. */}
      <Circle cx={292} cy={220} r={34} fill={"#C99A2E"} />
      <Circle cx={288} cy={216} r={34} fill={"#F2C14E"} />
      <Circle cx={288} cy={216} r={24} fill="none" stroke={"#C99A2E"} strokeWidth={3} />
      <Path d="M288 202 V230 M280 208 Q280 203 288 203 Q296 203 296 209 Q296 215 288 216 Q280 217 280 223 Q280 229 288 229 Q296 229 296 224" fill="none" stroke={"#A97C1C"} strokeWidth={3.2} strokeLinecap="round" />
      <Sparkle x={92} y={96} s={9} o={0.5} />
      <Sparkle x={330} y={92} s={7} o={0.5} />
    </>
  );
}

/* No impulse buys: a bag set down, and an hourglass — wait a day. */
function Bag() {
  return (
    <>
      <Ground id="bg" stops={["#240A1A", "#5E1E44", "#A84079"]} glow={"#FFB8DA"} gx={190} />
      <Path d="M164 110 Q164 78 194 78 Q224 78 224 110" fill="none" stroke={"#3A0F2A"} strokeWidth={8} strokeLinecap="round" />
      <Path d="M130 110 H258 L268 248 H120 Z" fill={"#F7B6D6"} />
      <Path d="M210 110 H258 L268 248 H210 Z" fill={"#000"} opacity={0.08} />
      <Rect x={130} y={110} width={128} height={14} fill={"#fff"} opacity={0.25} />
      <Circle cx={168} cy={136} r={5} fill={"#3A0F2A"} />
      <Circle cx={220} cy={136} r={5} fill={"#3A0F2A"} />
      <Sparkle x={194} y={190} s={16} o={0.9} c={"#fff"} />
      {/* The hourglass. */}
      <G>
        <Rect x={262} y={124} width={66} height={10} rx={5} fill={"#F2C14E"} />
        <Rect x={262} y={240} width={66} height={10} rx={5} fill={"#F2C14E"} />
        <Path d="M272 134 H318 Q318 166 300 184 Q318 202 318 240 H272 Q272 202 290 184 Q272 166 272 134 Z" fill={"#FDF3FF"} opacity={0.35} />
        <Path d="M280 148 H310 Q306 166 295 176 Q284 166 280 148 Z" fill={"#FFE29A"} />
        <Path d="M276 238 Q282 214 295 210 Q308 214 314 238 Z" fill={"#FFE29A"} />
        <Rect x={293.5} y={178} width={3} height={32} fill={"#FFE29A"} />
      </G>
      <Rect x={0} y={248} width={W} height={H - 248} fill={"#1A0612"} opacity={0.5} />
      <Sparkle x={90} y={80} s={9} o={0.5} />
      <Sparkle x={340} y={86} s={7} o={0.45} />
    </>
  );
}

/* Coffee at home: a cup on a saucer, steaming, by the morning window. */
function Coffee() {
  return (
    <>
      <Ground id="cf" stops={["#1E1209", "#4E321D", "#8C5E3A"]} glow={"#FFD9A8"} gx={170} gy={120} />
      {/* The window, with the morning in it. */}
      <Rect x={58} y={40} width={124} height={136} rx={10} fill={"#FFE7BF"} opacity={0.2} />
      <Rect x={118} y={40} width={4} height={136} fill={"#4E321D"} opacity={0.6} />
      <Rect x={58} y={106} width={124} height={4} fill={"#4E321D"} opacity={0.6} />
      <Steam x={190} y={118} h={54} />
      <Steam x={218} y={112} h={64} o={0.7} />
      {/* The cup. */}
      <Ellipse cx={206} cy={238} rx={92} ry={18} fill={"#E9D8C4"} />
      <Ellipse cx={206} cy={234} rx={74} ry={12} fill={"#F6EBDD"} />
      <Path d="M268 156 Q306 156 306 186 Q306 214 266 214" fill="none" stroke={"#F6EBDD"} strokeWidth={13} />
      <Path d="M140 140 H272 V196 Q272 234 236 234 H176 Q140 234 140 196 Z" fill={"#F6EBDD"} />
      <Path d="M236 140 H272 V196 Q272 234 236 234 Z" fill={"#000"} opacity={0.07} />
      <Ellipse cx={206} cy={140} rx={66} ry={12} fill={"#E9D8C4"} />
      <Ellipse cx={206} cy={141} rx={58} ry={8.5} fill={"#5A321A"} />
      <Ellipse cx={194} cy={139} rx={18} ry={3} fill={"#C78A5A"} opacity={0.55} />
      {/* Beans. */}
      {[[96, 252, 20], [118, 266, -30], [320, 258, 40], [300, 272, -10]].map(([x, y, a]) => (
        <G key={`${x}`} transform={`rotate(${a} ${x} ${y})`}>
          <Ellipse cx={x} cy={y} rx={10} ry={7} fill={"#3A2010"} />
          <Path d={`M${x - 8} ${y} Q${x} ${y - 3} ${x + 8} ${y}`} fill="none" stroke={"#8C5E3A"} strokeWidth={1.6} />
        </G>
      ))}
    </>
  );
}

/* Lunch from home: a lunchbox with rice, beans, salad and tomato. */
function Lunch() {
  return (
    <>
      <Ground id="ln" stops={["#151A06", "#404A18", "#7A8A32"]} glow={"#EAF5A8"} />
      <Rect x={98} y={74} width={204} height={162} rx={30} fill={"#20260C"} opacity={0.45} transform="translate(6 10)" />
      <Rect x={98} y={74} width={204} height={162} rx={30} fill={"#EEF2E4"} />
      <Rect x={110} y={86} width={180} height={138} rx={22} fill={"#DDE4CF"} />
      <Rect x={198} y={86} width={4} height={138} fill={"#C6CFB4"} />
      <Rect x={202} y={153} width={88} height={4} fill={"#C6CFB4"} />
      {/* Rice. */}
      <Rect x={116} y={92} width={78} height={126} rx={18} fill={"#FBFBF6"} />
      {Array.from({ length: 16 }).map((_, i) => (
        <Ellipse key={i} cx={128 + (i % 4) * 18} cy={106 + Math.floor(i / 4) * 28} rx={4} ry={2} fill={"#E4E6DA"} transform={`rotate(${(i * 37) % 90} ${128 + (i % 4) * 18} ${106 + Math.floor(i / 4) * 28})`} />
      ))}
      {/* Beans. */}
      <Rect x={208} y={92} width={76} height={56} rx={16} fill={"#5A3420"} />
      {Array.from({ length: 9 }).map((_, i) => (
        <Ellipse key={i} cx={222 + (i % 3) * 24} cy={106 + Math.floor(i / 3) * 14} rx={7} ry={4.5} fill={"#7A4A2E"} />
      ))}
      {/* Salad and tomato. */}
      <Rect x={208} y={162} width={76} height={56} rx={16} fill={"#7DBE4E"} />
      <Ellipse cx={226} cy={180} rx={14} ry={9} fill={"#9BD66A"} />
      <Ellipse cx={250} cy={198} rx={16} ry={9} fill={"#5FA33A"} />
      <Circle cx={268} cy={178} r={11} fill={"#E8564A"} />
      <Circle cx={268} cy={178} r={6} fill={"#F28A7E"} />
      <Circle cx={236} cy={206} r={8} fill={"#E8564A"} />
      {/* A fork, beside it. */}
      <G transform="rotate(8 330 160)">
        <Rect x={326} y={120} width={8} height={130} rx={4} fill={"#DDE2E8"} />
        <Path d="M316 86 V118 Q316 128 330 128 Q344 128 344 118 V86" fill="none" stroke={"#DDE2E8"} strokeWidth={5} strokeLinecap="round" />
        <Path d="M330 86 V118" stroke={"#DDE2E8"} strokeWidth={5} strokeLinecap="round" />
      </G>
      <Sparkle x={70} y={92} s={8} o={0.5} />
    </>
  );
}

/* No extra streaming: the screen off, a book and a blanket on the sofa. */
function Tv() {
  return (
    <>
      <Ground id="tv" stops={["#0D0B24", "#2A2664", "#4E48A8"]} glow={"#B9B4FF"} gy={110} />
      {/* The screen, switched off. */}
      <Rect x={112} y={46} width={176} height={110} rx={12} fill={"#0B0A1C"} />
      <Rect x={120} y={54} width={160} height={94} rx={7} fill={"#1A1838"} />
      <Path d="M126 60 L196 60 L140 142 L126 142 Z" fill={"#fff"} opacity={0.06} />
      <Rect x={190} y={156} width={20} height={14} fill={"#0B0A1C"} />
      <Rect x={164} y={168} width={72} height={6} rx={3} fill={"#0B0A1C"} />
      <Circle cx={272} cy={140} r={3} fill={"#FF7A7A"} />
      {/* The sofa, with a blanket and a book on it. */}
      <Rect x={68} y={206} width={264} height={46} rx={18} fill={"#7A6CF0"} />
      <Rect x={84} y={188} width={110} height={40} rx={16} fill={"#9488F5"} />
      <Rect x={206} y={188} width={110} height={40} rx={16} fill={"#9488F5"} />
      <Rect x={52} y={196} width={34} height={70} rx={14} fill={"#6A5CE0"} />
      <Rect x={314} y={196} width={34} height={70} rx={14} fill={"#6A5CE0"} />
      <Path d="M210 190 Q250 182 300 196 L306 236 Q262 226 214 236 Z" fill={"#F2B66D"} />
      <Path d="M210 206 Q250 198 302 210" fill="none" stroke={"#fff"} strokeWidth={2.5} opacity={0.4} />
      <G transform="rotate(-10 134 196)">
        <Rect x={108} y={186} width={56} height={14} rx={3} fill={"#F3F5F9"} />
        <Rect x={108} y={182} width={56} height={6} rx={3} fill={"#E8656A"} />
      </G>
      <Rect x={0} y={262} width={W} height={H - 262} fill={"#08071A"} opacity={0.6} />
      <Sparkle x={74} y={70} s={8} o={0.5} />
      <Sparkle x={334} y={88} s={9} o={0.55} />
    </>
  );
}

/* The cheaper way, every day: a bus on the road at sunrise. */
function Bus() {
  return (
    <>
      <Defs>
        <LinearGradient id="bs-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={"#0B2530"} />
          <Stop offset="0.55" stopColor={"#1E5A6E"} />
          <Stop offset="1" stopColor={"#F2B66D"} />
        </LinearGradient>
        <RadialGradient id="bs-sun" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={"#FFE3A8"} stopOpacity="0.9" />
          <Stop offset="1" stopColor={"#FFE3A8"} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#bs-bg)" />
      <Circle cx={300} cy={156} r={100} fill="url(#bs-sun)" />
      <Circle cx={300} cy={156} r={30} fill={"#FFE1A6"} />
      <Path d="M0 186 L70 156 L130 178 L190 150 L260 182 L330 160 L400 180 V200 H0 Z" fill={"#123B49"} opacity={0.8} />
      <Rect x={0} y={232} width={W} height={H - 232} fill={"#0E2A33"} />
      <G opacity={0.6}>
        {[20, 100, 180, 260, 340].map((x) => (
          <Rect key={x} x={x} y={266} width={44} height={4} rx={2} fill={"#FFE1A6"} />
        ))}
      </G>
      {/* The bus. */}
      <Rect x={84} y={130} width={232} height={100} rx={18} fill={"#F2C14E"} />
      <Rect x={84} y={196} width={232} height={14} fill={"#E0A93A"} />
      {[100, 148, 196, 244].map((x) => (
        <Rect key={x} x={x} y={144} width={40} height={36} rx={7} fill={"#173B4A"} />
      ))}
      <Rect x={286} y={144} width={22} height={58} rx={6} fill={"#173B4A"} />
      <Rect x={84} y={138} width={8} height={18} rx={3} fill={"#FFF4D6"} />
      <Rect x={308} y={204} width={10} height={10} rx={3} fill={"#FFF4D6"} />
      <Circle cx={138} cy={232} r={20} fill={"#0B1E26"} />
      <Circle cx={138} cy={232} r={8} fill={"#9AA6AE"} />
      <Circle cx={264} cy={232} r={20} fill={"#0B1E26"} />
      <Circle cx={264} cy={232} r={8} fill={"#9AA6AE"} />
      <Sparkle x={70} y={70} s={8} o={0.5} />
    </>
  );
}

/* A habit of one's own: a mountain at dawn, with a flag at the top. */
function Flag() {
  return (
    <>
      <Defs>
        <LinearGradient id="fl-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={"#141733"} />
          <Stop offset="0.6" stopColor={"#46457E"} />
          <Stop offset="1" stopColor={"#E2957A"} />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#fl-bg)" />
      <Stars seed={5} maxY={120} />
      {/* Held low enough that a wide card, which shows only the middle band, keeps the flag. */}
      <G transform="translate(0 44)">
        <Path d="M-20 260 L90 150 L150 200 L206 86 L268 180 L320 140 L420 260 V300 H-20 Z" fill={"#2A2B52"} />
        <Path d="M206 86 L232 126 L216 120 L204 134 L190 116 L180 128 Z" fill={"#F3F2FF"} opacity={0.9} />
        <Path d="M206 86 L268 180 L240 180 Z" fill={"#000"} opacity={0.14} />
        <Line x1={206} y1={86} x2={206} y2={36} stroke={"#F3F2FF"} strokeWidth={4} strokeLinecap="round" />
        <Path d="M208 38 L246 48 L208 60 Z" fill={"#FF9F45"} />
      </G>
      <Path d="M-20 310 L60 250 L130 284 L210 236 L300 280 L360 250 L420 290 V320 H-20 Z" fill={"#1A1B38"} />
      <Sparkle x={300} y={92} s={9} o={0.6} />
      <Sparkle x={96} y={110} s={7} o={0.5} />
    </>
  );
}

const SCENES: Record<Scene, () => React.JSX.Element> = {
  delivery: Delivery,
  online: Online,
  car: Car,
  pen: Pen,
  calendar: Calendar,
  bag: Bag,
  coffee: Coffee,
  lunch: Lunch,
  tv: Tv,
  bus: Bus,
  flag: Flag,
};

export default function ChallengeArt({ scene, width, height }: { scene: Scene; width?: number | string; height?: number | string }) {
  const Drawn = SCENES[scene];
  return (
    <View style={{ width: (width ?? "100%") as number, height: (height ?? "100%") as number }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Drawn />
      </Svg>
    </View>
  );
}
