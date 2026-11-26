import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import BankMark from "~/components/BankMark";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, CreditCard, FileText, Landmark, Tag, Wallet } from "~/components/icons";
import { RED } from "~/theme/tokens";
import WilloFlow, { FLOW_MS } from "./WilloFlow";
import WilloPass from "./WilloPass";
import WilloSlide, { slideKnobEnd } from "./WilloSlide";
import { playConfirm, preloadConfirm } from "~/lib/sounds";
import { KIND_LABEL, amountSize, passAmount, passTheme, type PassData, type PassLink, type PassRow } from "./passTheme";

/**
 * The Willo Transaction Experience (Implementação 001), the same on every screen that writes an
 * entry after a check — the "+", Registro rápido, the scanner, the Copilot and the transfer.
 *
 * Willo Review: "Confirmar transação", the amount large, and six lines (description, type,
 * category, institution with its mark, payment, date). Willo Slide under it. Let go at 96 % and
 * the entry is written — once: the review carries its own id, so a retry after a failure that
 * never answered finds the entry already there instead of writing a second. The instant the
 * slide is done the coin and the light begin — the review fades and the 65 points of light leave
 * the knob for the seal (Willo Flow, 560 ms) while the entry is written — and the Willo Pass plays
 * in once the database has it. A failure keeps the review, says so, and the slide is ready again — the same id still.
 */

type Phase = "review" | "saving" | "flow" | "pass";

const ROW_ICON: Record<PassRow["icon"], typeof Tag> = {
  descricao: FileText,
  "tipo-saida": ArrowUpRight,
  "tipo-entrada": ArrowDownLeft,
  "tipo-transferencia": ArrowLeftRight,
  categoria: Tag,
  instituicao: Landmark,
  pagamento: CreditCard,
  data: CalendarDays,
  origem: Landmark,
  destino: Wallet,
};

export default function TransactionExperience({
  data,
  onConfirm,
  onDone,
  left,
  title = "Confirmar transação",
  onPhase,
  links,
}: {
  /** What is about to be written (id and time come once it is). */
  data: PassData;
  /** Writes the entry under `id`; resolves only once the database has it. */
  onConfirm: (id: string) => Promise<{ id: string; time?: string | null }>;
  /** Concluir on the Pass. */
  onDone: () => void;
  /** The top-left control of the review (back to the entry), if any. */
  left?: ReactNode;
  title?: string;
  /** Told when the review gives way to the Pass, so a sheet can resize or lock. */
  onPhase?: (p: Phase) => void;
  /** Under the Pass's Concluir: another entry, the transactions. */
  links?: PassLink[];
}) {
  const t = passTheme();
  const reduce = useReducedMotion();
  const [phase, setPhaseState] = useState<Phase>("review");
  const setPhase = (p: Phase) => {
    setPhaseState(p);
    onPhase?.(p);
  };
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [saved, setSaved] = useState<{ id: string; time?: string | null } | null>(null);
  /* One id per review: what makes a second send the same entry, never a new one. */
  const id = useRef(Crypto.randomUUID());
  /* The coin loaded while the review is read, so it starts the instant it is asked. */
  useEffect(() => {
    preloadConfirm();
  }, []);
  const sending = useRef(false);

  const [box, setBox] = useState({ w: 0, h: 0 });
  /* The review leaves as the light gathers: fading, 0.4 s. */
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ scale: 0.985 + 0.015 * fade.get() }] }));
  const [slideAt, setSlideAt] = useState({ x: 0, y: 0, w: 0 });

  const confirm = async () => {
    if (sending.current || phase !== "review") return;
    sending.current = true;
    setError(null);
    /* The coin and the light start the instant the slide is done, while the entry is written;
       the Pass comes once the database has it and the light has reached the seal — one gesture,
       from the knob to the receipt, on one sound. */
    playConfirm();
    const began = Date.now();
    if (!reduce) {
      fade.set(withTiming(0, { duration: 320 }));
      setPhase("flow");
    } else setPhase("saving");
    try {
      const done = await onConfirm(id.current);
      setSaved(done);
      const left = reduce ? 0 : Math.max(0, FLOW_MS - (Date.now() - began));
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setPhase("pass");
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      fade.set(withTiming(1, { duration: 220 }));
      setError("Não consegui salvar agora. Tente de novo.");
      setPhase("review");
      setTries((n) => n + 1);
    } finally {
      sending.current = false;
    }
  };

  if (phase === "pass" && saved) {
    return (
      <Animated.View entering={FadeIn.duration(reduce ? 160 : 120)} style={{ paddingBottom: 6 }}>
        <WilloPass data={{ ...data, id: saved.id, time: saved.time ?? data.time }} onDone={onDone} links={links} sound={false} />
      </Animated.View>
    );
  }

  const end = slideKnobEnd(slideAt.w);
  /* 38–64 for the review's amount, fitting the width. */
  const reviewSize = Math.max(38, amountSize(data.amount, (box.w || 340) - 20, 64));
  return (
    <View onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Animated.View style={fadeStyle}>
        {/* The top: back (when there is one), the title. */}
        <View style={{ height: 48, flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 46 }}>{left}</View>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 16.5, fontWeight: "700", color: t.text }}>
            {title}
          </Text>
          <View style={{ width: 46 }} />
        </View>

        <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 18 }}>
          <Text style={{ fontSize: 12, color: t.muted }}>{KIND_LABEL[data.kind]}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 2, color: t.text }}>
            {/* The same type as the amount being typed: R$ soft and bold, the figure heavy. */}
            <Text style={{ fontSize: Math.round(reviewSize * 0.42), fontWeight: "700", color: t.muted }}>R$ </Text>
            <Text style={{ fontSize: reviewSize, fontWeight: "800", letterSpacing: -reviewSize * 0.035, fontVariant: ["tabular-nums"] }}>{passAmount(data.amount)}</Text>
          </Text>
        </View>

        <View style={{ borderRadius: 21, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14, paddingVertical: 4 }}>
          {[{ icon: "descricao" as const, label: "Descrição", value: data.title }, ...data.rows].map((r, i) => (
            <ReviewLine key={i} row={r} first={i === 0} />
          ))}
        </View>

        {error && <Text style={{ marginTop: 12, textAlign: "center", fontSize: 13.5, color: RED }}>{error}</Text>}

        <View style={{ marginTop: 23 }} onLayout={(e) => setSlideAt({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width })}>
          <WilloSlide key={tries} busy={phase !== "review"} onConfirm={() => void confirm()} />
        </View>
      </Animated.View>

      {phase === "flow" && box.w > 0 && <WilloFlow width={box.w} height={box.h} from={{ x: slideAt.x + end.x, y: slideAt.y + end.y }} to={{ x: box.w / 2, y: 30 }} />}
    </View>
  );
}

/** A line of the review: icon and label on the left, the value on the right — the institution with its mark. */
function ReviewLine({ row, first }: { row: PassRow; first: boolean }) {
  const t = passTheme();
  const Icon = ROW_ICON[row.icon];
  return (
    <View style={{ minHeight: 49, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: t.line, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={15} color={t.muted} strokeWidth={1.6} />
        <Text style={{ fontSize: 13, color: t.muted }}>{row.label}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" }}>
          {row.bank ? <BankMark name={row.bank.name} hex={row.bank.hex} size={22} /> : null}
          <Text numberOfLines={2} style={{ flexShrink: 1, textAlign: "right", fontSize: 14, fontWeight: "500", color: t.text }}>
            {row.value}
          </Text>
        </View>
        {row.sub ? <Text style={{ marginTop: 1, fontSize: 11.5, color: t.muted }}>{row.sub}</Text> : null}
      </View>
    </View>
  );
}
