import { useRef, type ComponentRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { shade, withAlpha } from "@/lib/tone";
import BankMark from "~/components/BankMark";
import StatusTag, { TAG_TONES } from "~/components/StatusTag";
import { Check, Clock, Lock } from "~/components/icons";
import Bar from "~/components/Bar";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * A card, as a face.
 *
 * Glass and nothing else. The bank's colour appears three times — on its mark, on
 * the limit rule and on the two figures under it — and those three are enough to
 * tell one card from another without painting the whole thing.
 *
 * Every figure is the open invoice, the one still to be paid. A credit card is a
 * bill, not a balance.
 */

export const USED_LIMIT_HEX = "rgba(255,255,255,0.42)";
export const FREE_LIMIT_HEX = "#C8F36D";

/**
 * The badge that says where an invoice stands, in the card's own colour: a light
 * translucent fill with a deeper edge of the same hue. Grey said nothing and agreed
 * with nothing; this belongs to the card it sits on, whichever bank that is.
 */
export function statusPill(hex: string, strong = false) {
  return {
    backgroundColor: th(withAlpha(hex, strong ? 0.26 : 0.16), "bg"),
    borderWidth: 1,
    borderColor: th(withAlpha(shade(hex, -0.28), 0.95), "line"),
    color: th(shade(hex, 0.66)),
  };
}

export interface CardFace {
  id: string;
  name: string;
  lastFour: string | null;
  closingDay: number;
  dueDay: number;
  limit: number;
  used: number;
}

export default function CardFaceTile({
  card,
  hex,
  owed,
  status,
  index,
  onOpen,
  onHold,
}: {
  card: CardFace;
  hex: string;
  owed: number;
  status: { label: string; isClosed: boolean };
  index: number;
  onOpen: () => void;
  onHold: (rect: { top: number; bottom: number; left: number; width: number }) => void;
}) {
  const box = useRef<ComponentRef<typeof View>>(null);
  const usedPct = card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0;
  const available = Math.max(card.limit - card.used, 0);
  const freeTone = shade(hex, 0.58);

  return (
    <Animated.View ref={box} entering={FadeInDown.delay(index * 70).duration(450)}>
      <Pressable
        onPress={onOpen}
        onLongPress={() => {
          box.current?.measureInWindow((x, y, w, h) =>
            onHold({ top: y, bottom: y + h, left: x, width: w }),
          );
        }}
        delayLongPress={420}
        style={({ pressed }) => ({
          overflow: "hidden",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: th("rgba(255,255,255,0.10)", "line"),
          backgroundColor: th("rgba(255,255,255,0.062)", "bg"),
          paddingHorizontal: 18,
          paddingTop: 17,
          paddingBottom: 18,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BankMark name={card.name} hex={hex} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>
              {card.name}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: th(INK.softer) }}>
              •••• {card.lastFour ?? "••••"}
              <Text style={{ color: th("rgba(255,255,255,0.2)") }}> · </Text>
              vence dia {card.dueDay}
            </Text>
          </View>

          {/* Where the invoice stands, as a mark rather than a sentence. */}
          {owed <= 0 ? (
            <StatusTag small label="Em dia" tone={TAG_TONES.paid} Icon={Check} />
          ) : (
            <StatusTag small label={status.isClosed ? "Fechada" : "Aberta"} tone={status.isClosed ? TAG_TONES.closed : TAG_TONES.open} Icon={status.isClosed ? Lock : Clock} />
          )}
        </View>

        <Text
          numberOfLines={1}
          style={{
            marginTop: 20,
            fontSize: 29,
            fontWeight: "800",
            letterSpacing: -1,
            color: th(owed > 0 ? "#fff" : INK.softer),
          }}
        >
          {money(owed)}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, color: th(INK.softer) }}>
          {owed > 0 ? status.label : "Sem fatura em aberto"}
        </Text>

        {/* The card's colour for what is spent, its lighter tone for what is left. */}
        <View style={{ marginTop: 16, flexDirection: "row", height: 7, gap: 3 }}>
          <Bar
            share={usedPct / 100}
            color={hex}
            minWidth={card.used > 0 ? 6 : 0}
            delay={0.1 + index * 0.07}
          />
          <Bar
            share={card.limit > 0 ? Math.max(1 - usedPct / 100, 0) : 1}
            color={freeTone}
            minWidth={available > 0 ? 6 : 0}
            delay={0.18 + index * 0.07}
          />
        </View>

        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: th(INK.softer) }}>
            Usado <Text style={{ fontWeight: "600", color: th("#fff") }}>{money(card.used)}</Text>
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: th(INK.softer) }}>
            Disponível{" "}
            <Text
              style={{
                fontWeight: "600",
                color: th(available > 0 ? "#fff" : "rgba(255,255,255,0.55)"),
              }}
            >
              {money(available)}
            </Text>
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
