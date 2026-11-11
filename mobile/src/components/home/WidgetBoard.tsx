import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  ZoomOut,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { loadPhoneLayout } from "~/lib/phoneLayout";
import { PHONE_WIDGETS, phoneWidgetById } from "~/lib/phoneWidgets";
import { dismissedIds, saveLayout, setDismissed, type WidgetSize, type WidgetSlot } from "@/lib/homeWidgets";
import BottomSheet from "~/components/BottomSheet";
import { ChevronsLeftRight, ChevronsRightLeft, Minus, Plus } from "~/components/icons";
import { INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
import { FEATURES } from "~/lib/features";

/**
 * The home screen, arranged by the person using it — the way an iPhone's is.
 *
 * Hold any card and the board goes into editing: every card trembles a little, carries
 * a "−" to take it off and, where it has a small version, a grip in its corner to swap
 * between the two. The card held comes up off the board and follows the finger; the
 * others open a space for it one seat at a time as it passes over them, and when it is
 * let go it settles into the space. A card taken off is only set aside — "Adicionar
 * widgets" lists the ones off the board, to put back.
 *
 * The card under the finger is a copy floating above the board; its own place in the
 * list is an empty seat that moves through the others. Moving the card itself made it
 * jump: each time its seat changed, the seat's move was added to the finger's.
 */

/** How a card settles into a seat it has just been given: a spring, card by card. */
const SEAT_CHANGE = LinearTransition.springify().damping(19).stiffness(170).mass(0.55);

interface Props {
  userId?: string;
  /** Draws a widget at the width it is currently set to. */
  render: (id: string, size: WidgetSize) => ReactNode;
  /** Cards with nothing to say right now: kept in the layout, left off the board. */
  skip?: (id: string) => boolean;
  /** Space between cards, and between the halves of a row. */
  gap?: number;
  /* Edit mode is held by the screen rather than here, because the bar that says
     the board is being edited has to stay put while the board scrolls under it. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** A card is being carried: the page should not scroll under it. */
  onCarrying?: (carrying: boolean) => void;
  /** Bumped by Cancelar: the board goes back to how it was when editing began. */
  revert?: number;
  /** A row of its own that follows one card wherever it is; at the top if those are off. */
  pinned?: { after: string | string[]; node: ReactNode };
}

type Rect = { x: number; y: number; w: number; h: number };

export default function WidgetBoard({ userId, render, skip, gap = 16, editing, onEditingChange, onCarrying, revert = 0, pinned }: Props) {
  const followIds = pinned ? (Array.isArray(pinned.after) ? pinned.after : [pinned.after]) : [];
  const [slots, setSlots] = useState<WidgetSlot[]>(() => loadPhoneLayout(userId));
  const [adding, setAdding] = useState(false);
  const board = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    setSlots(loadPhoneLayout(userId));
  }, [userId]);

  /* How the board was when editing began, for Cancelar to put back. */
  const before = useRef<{ slots: WidgetSlot[]; dismissed: string[] } | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(() => {
    if (editing && !before.current) before.current = { slots: slotsRef.current, dismissed: dismissedIds(userId) };
    if (!editing && revertSeen.current === revert) before.current = null;
  }, [editing, userId, revert]);
  const revertSeen = useRef(revert);
  useEffect(() => {
    if (revert === revertSeen.current) return;
    revertSeen.current = revert;
    const was = before.current;
    before.current = null;
    if (!was) return;
    const now = dismissedIds(userId);
    for (const id of now) if (!was.dismissed.includes(id)) setDismissed(userId, id, false);
    for (const id of was.dismissed) if (!now.includes(id)) setDismissed(userId, id, true);
    setSlots(was.slots);
    saveLayout(userId, was.slots);
  }, [revert, userId]);

  const commit = useCallback(
    (next: WidgetSlot[]) => {
      setSlots(next);
      saveLayout(userId, next);
    },
    [userId],
  );

  /* Where each card is right now, and how to ask it again. */
  const frames = useRef(new Map<string, Rect>());
  const measurers = useRef(new Map<string, () => Promise<Rect | null>>());
  const registerFrame = useCallback((id: string, box: Rect | null, measure?: () => Promise<Rect | null>) => {
    if (box) frames.current.set(id, box);
    else frames.current.delete(id);
    if (measure) measurers.current.set(id, measure);
    else if (!box) measurers.current.delete(id);
  }, []);

  /* ── The card being carried ── */
  const [carried, setCarried] = useState<{ id: string; size: WidgetSize; from: Rect; at: Rect } | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  /* A carry under way, on the UI thread: however the gesture ends — let go, or cut off
     by the page — the card is put down. Left to "ended normally" only, a cut-off carry
     left its copy floating over the board. */
  const active = useSharedValue(0);
  /* The seats as they were when the card was picked up: a seat is judged against where
     the cards were, not against a board that is already moving under the finger. */
  const snapshot = useRef<{ order: string[]; seats: { id: string; cx: number; cy: number }[] } | null>(null);

  const beginCarry = useCallback(
    (id: string) => {
      const slot = slots.find((s) => s.id === id);
      const from = frames.current.get(id);
      if (!slot || !from) return;
      if (!editing) onEditingChange(true);
      onCarrying?.(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      snapshot.current = {
        order: slots.map((s) => s.id),
        seats: slots
          .map((s) => {
            const r = frames.current.get(s.id);
            return r ? { id: s.id, cx: r.x + r.w / 2, cy: r.y + r.h / 2 } : null;
          })
          .filter((x): x is { id: string; cx: number; cy: number } => x !== null),
      };
      board.current?.measureInWindow((bx, by) => {
        setCarried({ id, size: slot.size, from, at: { x: from.x - bx, y: from.y - by, w: from.w, h: from.h } });
      });
    },
    [slots, editing, onEditingChange, onCarrying],
  );

  /* The seat nearest the finger, among the seats as they were; the one it is in has to
     be beaten by a clear margin, or a card held between two flickers back and forth. */
  const carryTo = useCallback(
    (id: string, x: number, y: number) => {
      const snap = snapshot.current;
      if (!snap) return;
      let to = -1;
      let best = Number.POSITIVE_INFINITY;
      snap.seats.forEach((seat) => {
        const d = Math.hypot((seat.cx - x) * 0.6, seat.cy - y);
        if (d < best) {
          best = d;
          to = snap.order.indexOf(seat.id);
        }
      });
      if (to < 0) return;
      setSlots((current) => {
        const at = current.findIndex((s) => s.id === id);
        if (at < 0 || at === to) return current;
        const here = snap.seats.find((s) => s.id === snap.order[at]);
        if (here && Math.hypot((here.cx - x) * 0.6, here.cy - y) - best < 28) return current;
        const next = [...current];
        const [moved] = next.splice(at, 1);
        next.splice(Math.min(to, next.length), 0, moved);
        void Haptics.selectionAsync().catch(() => undefined);
        return next;
      });
    },
    [],
  );

  /* Let go: the copy flies to wherever its seat has ended up, and the card is back. */
  const endCarry = useCallback(() => {
    snapshot.current = null;
    onCarrying?.(false);
    setSlots((current) => {
      saveLayout(userId, current);
      return current;
    });
    const done = () => {
      setCarried(null);
      tx.set(0);
      ty.set(0);
    };
    setTimeout(() => {
      const c = carriedRef.current;
      const measure = c ? measurers.current.get(c.id) : undefined;
      if (!c || !measure) {
        lift.set(withTiming(0, { duration: 160 }));
        done();
        return;
      }
      void measure().then((rect) => {
        if (rect) {
          tx.set(withSpring(rect.x - c.from.x, { damping: 22, stiffness: 240 }));
          ty.set(withSpring(rect.y - c.from.y, { damping: 22, stiffness: 240 }));
        }
        lift.set(withTiming(0, { duration: 220 }));
        setTimeout(done, 260);
      });
    }, 60);
  }, [userId, onCarrying, tx, ty, lift]);
  const carriedRef = useRef(carried);
  carriedRef.current = carried;
  /* Should the gesture's end never arrive, the card is put down rather than left floating. */
  useEffect(() => {
    if (!carried) return;
    const t = setInterval(() => {
      if (active.get() === 0 && carriedRef.current) endCarry();
    }, 900);
    return () => clearInterval(t);
  }, [carried, active, endCarry]);

  const remove = (id: string) => {
    setDismissed(userId, id, true);
    commit(slots.filter((s) => s.id !== id));
  };

  const setSize = (id: string, size: WidgetSize) => {
    commit(slots.map((s) => (s.id === id ? { ...s, size } : s)));
  };

  const add = (id: string) => {
    const def = phoneWidgetById(id);
    if (!def) return;
    setDismissed(userId, id, false);
    commit([...slots, { id, size: def.defaultSize }]);
  };

  /* Consecutive halves share a row; a full takes one of its own. */
  const rows = useMemo(() => {
    const out: WidgetSlot[][] = [];
    let row: WidgetSlot[] = [];
    for (const slot of slots) {
      if (skip?.(slot.id)) continue;
      if (slot.size === "full") {
        if (row.length) {
          out.push(row);
          row = [];
        }
        out.push([slot]);
        continue;
      }
      row.push(slot);
      if (row.length === 2) {
        out.push(row);
        row = [];
      }
    }
    if (row.length) out.push(row);
    return out;
  }, [slots, skip]);
  const followed = followIds.find((id) => rows.some((row) => row.some((s) => s.id === id)));

  const missing = PHONE_WIDGETS.filter((w) => !slots.some((s) => s.id === w.id) && (w.id !== "plano" || FEATURES.plano));

  const floating = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: 1 + lift.get() * 0.05 }],
    shadowOpacity: 0.3 * lift.get(),
  }));

  return (
    <>
      <View ref={board} style={{ gap }}>
        {pinned && !followed && pinned.node}
        {rows.map((row, ri) => (
          <Fragment key={row.map((s) => s.id).join("+") + ri}>
            <Animated.View layout={SEAT_CHANGE} style={row.length === 2 ? { flexDirection: "row", gap } : undefined}>
              {row.map((slot, i) => (
                <WidgetFrame
                  key={slot.id}
                  slot={slot}
                  editing={editing}
                  half={row.length === 2}
                  phase={(ri * 2 + i) % 3}
                  hidden={carried?.id === slot.id}
                  tx={tx}
                  ty={ty}
                  lift={lift}
                  active={active}
                  onCarryStart={beginCarry}
                  onCarryTo={carryTo}
                  onCarryEnd={endCarry}
                  onResize={(size) => setSize(slot.id, size)}
                  onRemove={() => remove(slot.id)}
                  registerFrame={registerFrame}
                >
                  {render(slot.id, slot.size)}
                </WidgetFrame>
              ))}
            </Animated.View>
            {pinned && followed && row.some((s) => s.id === followed) && pinned.node}
          </Fragment>
        ))}

        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => ({
            height: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: th("rgba(255,255,255,0.16)", "line"),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus size={18} color={th("rgba(255,255,255,0.8)")} strokeWidth={2.4} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: th("rgba(255,255,255,0.8)") }}>Adicionar widgets</Text>
        </Pressable>

        {/* The card being carried, above everything, under the finger. */}
        {carried && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: carried.at.x,
                top: carried.at.y,
                width: carried.at.w,
                zIndex: 50,
                shadowColor: "#000",
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 14 },
              },
              floating,
            ]}
          >
            {render(carried.id, carried.size)}
          </Animated.View>
        )}
      </View>

      {/* The ones currently off the board. */}
      <BottomSheet open={adding} onClose={() => setAdding(false)} full>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Adicionar widgets</Text>
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: th("rgba(255,255,255,0.62)") }}>
            {missing.length > 0 ? "Tudo que não está na sua tela agora." : "Todos os widgets já estão na sua tela."}
          </Text>

          <View style={{ marginTop: 20, gap: 10 }}>
            {missing.map((w, i) => (
              <Animated.View
                key={w.id}
                entering={FadeIn.delay(i * 40).duration(240)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: th(INK.edge, "line"),
                  backgroundColor: th("rgba(255,255,255,0.062)", "bg"),
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>{w.label}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.softer) }}>{w.description}</Text>
                </View>
                <Pressable
                  onPress={() => add(w.id)}
                  style={({ pressed }) => ({ borderRadius: 999, backgroundColor: th("#fff", "bg"), paddingHorizontal: 16, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: th("#0B0B0B") }}>Adicionar</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

/** One card on the board: held to pick it up, trembling while the board is edited. */
function WidgetFrame({
  slot,
  editing,
  half,
  phase,
  hidden,
  tx,
  ty,
  lift,
  active,
  children,
  onCarryStart,
  onCarryTo,
  onCarryEnd,
  onResize,
  onRemove,
  registerFrame,
}: {
  slot: WidgetSlot;
  editing: boolean;
  half: boolean;
  /** Which way round it trembles, so neighbours do not move in step. */
  phase: number;
  /** Being carried: its seat stays, empty, while the copy follows the finger. */
  hidden: boolean;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  lift: SharedValue<number>;
  active: SharedValue<number>;
  children: ReactNode;
  onCarryStart: (id: string) => void;
  onCarryTo: (id: string, x: number, y: number) => void;
  onCarryEnd: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  registerFrame: (id: string, box: Rect | null, measure?: () => Promise<Rect | null>) => void;
}) {
  const box = useRef<ComponentRef<typeof View>>(null);
  const def = phoneWidgetById(slot.id);
  /* A widget with nothing to say draws nothing; a frame with nothing in it carries no controls. */
  const [drawn, setDrawn] = useState(false);

  const measureNow = useCallback(
    () =>
      new Promise<Rect | null>((resolve) => {
        if (!box.current) return resolve(null);
        box.current.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
      }),
    [],
  );

  const measure = useCallback(() => {
    void measureNow().then((r) => {
      if (!r) return;
      registerFrame(slot.id, r, measureNow);
      setDrawn(r.h > 8);
    });
  }, [registerFrame, slot.id, measureNow]);

  useEffect(() => {
    const t = setTimeout(measure, 220);
    return () => {
      clearTimeout(t);
      registerFrame(slot.id, null);
    };
  }, [measure, registerFrame, slot.id]);

  /* Re-measured whenever the board settles, so the seats picked up from are where the cards are. */
  useEffect(() => {
    const t = setTimeout(measure, 380);
    return () => clearTimeout(t);
  }, [editing, measure]);

  /* Held: picked up, and the board goes into editing. One hold time either way: changing it
     while a finger is down would cancel the gesture under it. */
  const carry = Gesture.Pan()
    .activateAfterLongPress(340)
    .onStart(() => {
      tx.set(0);
      ty.set(0);
      active.set(1);
      lift.set(withSpring(1, { damping: 16, stiffness: 220 }));
      runOnJS(onCarryStart)(slot.id);
    })
    .onUpdate((e) => {
      tx.set(e.translationX);
      ty.set(e.translationY);
      runOnJS(onCarryTo)(slot.id, e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      if (active.get() !== 1) return;
      active.set(0);
      runOnJS(onCarryEnd)();
    });

  /* The tremble of a board being edited, as the phone's own home screen does it. */
  const wobble = useSharedValue(0);
  useEffect(() => {
    if (!editing) {
      cancelAnimation(wobble);
      wobble.set(withTiming(0, { duration: 120 }));
      return;
    }
    const swing = withSequence(
      withTiming(phase === 1 ? -1 : 1, { duration: 130 + phase * 12, easing: Easing.inOut(Easing.quad) }),
      withTiming(phase === 1 ? 1 : -1, { duration: 130 + phase * 12, easing: Easing.inOut(Easing.quad) }),
    );
    wobble.set(withRepeat(swing, -1, true, undefined, ReduceMotion.System));
  }, [editing, phase, wobble]);
  const tremble = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.get() * (half ? 0.7 : 0.35)}deg` }] }));

  return (
    <GestureDetector gesture={carry}>
      <Animated.View
        ref={box}
        layout={SEAT_CHANGE}
        exiting={ZoomOut.duration(180)}
        onLayout={measure}
        style={[{ flex: half ? 1 : undefined, position: "relative", opacity: hidden ? 0 : 1 }, tremble]}
      >
        <View pointerEvents={editing ? "none" : "auto"}>{children}</View>

        {/* Taken off the board, to be put back from "Adicionar widgets". */}
        {editing && drawn && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ position: "absolute", top: -8, left: -8, zIndex: 30 }}>
            <Pressable
              onPress={onRemove}
              hitSlop={10}
              accessibilityLabel={`Remover ${def?.label ?? "widget"}`}
              style={({ pressed }) => ({
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#3A3B41", "bg"),
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.18)", "line"),
                transform: [{ scale: pressed ? 0.88 : 1 }],
              })}
            >
              <Minus size={15} color={th("#fff")} strokeWidth={3} />
            </Pressable>
          </Animated.View>
        )}

        {/* Whole, or its small version: a button in the opposite corner to the "−". */}
        {editing && drawn && def?.resizable && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ position: "absolute", top: -8, right: -8, zIndex: 30 }}>
            <Pressable
              onPress={() => onResize(slot.size === "full" ? "half" : "full")}
              hitSlop={10}
              accessibilityLabel={slot.size === "full" ? "Versão menor" : "Versão maior"}
              style={({ pressed }) => ({
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#3A3B41", "bg"),
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.18)", "line"),
                transform: [{ scale: pressed ? 0.88 : 1 }],
              })}
            >
              {slot.size === "full" ? (
                <ChevronsRightLeft size={14} color={th("#fff")} strokeWidth={2.6} />
              ) : (
                <ChevronsLeftRight size={14} color={th("#fff")} strokeWidth={2.6} />
              )}
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
