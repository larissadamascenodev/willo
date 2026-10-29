import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { loadPhoneLayout } from "~/lib/phoneLayout";
import {
  WIDGETS,
  saveLayout,
  setDismissed,
  widgetById,
  type WidgetSize,
  type WidgetSlot,
} from "@/lib/homeWidgets";
import BottomSheet from "~/components/BottomSheet";
import WidgetMenu, { type WidgetMenuTarget } from "~/components/home/WidgetMenu";
import { Plus } from "~/components/icons";
import ResizeGrip, { GRIP_OFFSET } from "~/components/home/ResizeGrip";
import { INK } from "~/theme/tokens";

/**
 * The home screen, arranged by the person using it.
 *
 * Holding a card opens what can be done to it; editing turns the whole board into
 * something you can rearrange, where a card is moved by hand and resized by the grip
 * in its corner. A card taken off the board is not deleted, only set aside — the add
 * screen is the same list with the ones currently off it.
 *
 * Which widgets exist, what order they are in and how wide each one is all live in
 * the shared registry, stored under the same key the web uses. The layout does not
 * travel between the two, because it is kept in each app's own storage, but the
 * rules for it are one set.
 */

/** How a card settles into a seat it has just been given. A duration makes the
    whole board arrive at once, which reads as a redraw; a spring lets each card
    find its place, which is what rearranging an app looks like. */
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
     the board is being edited has to stay put while the board scrolls under it —
     and inside a scroller nothing stays put. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export default function WidgetBoard({ userId, render, skip, gap = 16, editing, onEditingChange }: Props) {
  const [slots, setSlots] = useState<WidgetSlot[]>(() => loadPhoneLayout(userId));
  const [held, setHeld] = useState<WidgetMenuTarget | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSlots(loadPhoneLayout(userId));
  }, [userId]);

  const commit = useCallback(
    (next: WidgetSlot[]) => {
      setSlots(next);
      saveLayout(userId, next);
    },
    [userId],
  );

  /* Where each card is right now, so a dragged one knows what it is over. */
  const frames = useRef(new Map<string, { x: number; y: number; w: number; h: number }>());
  const registerFrame = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number } | null) => {
      if (box) frames.current.set(id, box);
      else frames.current.delete(id);
    },
    [],
  );

  /* Where the cards were when the drag began, and in what order. Everything about
     the move is judged against this rather than against the board as it moves:
     reading live frames meant that the moment one swap landed, the next frame of
     the gesture measured a board that had already changed under it and swapped
     again, and again — which is why a card nudged upwards shot to the top. */
  const snapshot = useRef<{ order: string[]; seats: { id: string; cy: number }[] } | null>(null);

  const beginDrag = useCallback(() => {
    const seats = slots
      .map((slot) => {
        const r = frames.current.get(slot.id);
        return r ? { id: slot.id, cy: r.y + r.h / 2 } : null;
      })
      .filter((x): x is { id: string; cy: number } => x !== null);
    snapshot.current = { order: slots.map((s) => s.id), seats };
  }, [slots]);

  const endDrag = useCallback(() => {
    snapshot.current = null;
  }, []);

  /* Dragging moves the order, not the card. The seat the finger is over is found in
     the snapshot, and the card takes that seat — one place at a time, because the
     seats it passes are the ones it was sitting next to when it set off. */
  const dragTo = useCallback(
    (id: string, _x: number, y: number) => {
      const snap = snapshot.current;
      if (!snap) return;

      const from = snap.order.indexOf(id);
      if (from < 0) return;

      /* The nearest seat to the finger, measured from where the seats were. The
         one it is already in has to be beaten by a clear margin, or a card held
         halfway between two of them flickers back and forth all the way up. */
      let to = from;
      let best = Number.POSITIVE_INFINITY;
      snap.seats.forEach((seat, i) => {
        const d = Math.abs(seat.cy - y);
        if (d < best) {
          best = d;
          to = i;
        }
      });
      if (to === from) return;
      const hereSeat = snap.seats[from];
      if (hereSeat && Math.abs(hereSeat.cy - y) - best < 24) return;

      setSlots((current) => {
        const at = current.findIndex((s) => s.id === id);
        if (at < 0 || at === to) return current;
        const next = [...current];
        const [moved] = next.splice(at, 1);
        next.splice(Math.min(to, next.length), 0, moved);
        saveLayout(userId, next);
        return next;
      });
    },
    [userId],
  );

  const remove = (id: string) => {
    setDismissed(userId, id, true);
    commit(slots.filter((s) => s.id !== id));
    setHeld(null);
  };

  const setSize = (id: string, size: WidgetSize) => {
    commit(slots.map((s) => (s.id === id ? { ...s, size } : s)));
  };

  const add = (id: string) => {
    const def = widgetById(id);
    if (!def) return;
    setDismissed(userId, id, false);
    commit([...slots, { id, size: def.defaultSize }]);
  };

  /* Consecutive halves share a row; a full takes one of its own. Done here rather
     than with a grid so a lone half at the end keeps its width instead of
     stretching to fill a row it is the only thing in. */
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

  const missing = WIDGETS.filter((w) => !slots.some((s) => s.id === w.id));

  return (
    <>
      <View style={{ gap }}>
        {rows.map((row, ri) => (
          <Animated.View
            key={row.map((s) => s.id).join("+") + ri}
            layout={SEAT_CHANGE}
            style={row.length === 2 ? { flexDirection: "row", gap } : undefined}
          >
            {row.map((slot) => {
              const content = render(slot.id, slot.size);
              return (
              <WidgetFrame
                key={slot.id}
                slot={slot}
                editing={editing}
                half={row.length === 2}
                onHold={(rect) => {
                  if (editing) return;
                  const def = widgetById(slot.id);
                  if (!def) return;
                  setHeld({
                    id: slot.id,
                    label: def.label,
                    description: def.description,
                    size: slot.size,
                    resizable: def.resizable,
                    rect,
                  });
                }}
                onDragTo={dragTo}
                onDragStart={beginDrag}
                onDragEnd={endDrag}
                onResize={(size) => setSize(slot.id, size)}
                onRemove={() => remove(slot.id)}
                registerFrame={registerFrame}
              >
                {content}
              </WidgetFrame>
              );
            })}
          </Animated.View>
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
            borderColor: "rgba(255,255,255,0.16)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Plus size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            Adicionar widgets
          </Text>
        </Pressable>
      </View>

      {/* Held: a menu beside the card, not a sheet from the foot of the screen. */}
      <WidgetMenu
        target={held}
        onClose={() => setHeld(null)}
        onEdit={() => {
          setHeld(null);
          onEditingChange(true);
        }}
        onResize={(size) => {
          if (held) setSize(held.id, size);
          setHeld(null);
        }}
        onRemove={() => held && remove(held.id)}
      />

      {/* The ones currently off the board. */}
      <BottomSheet open={adding} onClose={() => setAdding(false)} full>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>
            Adicionar widgets
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.62)" }}>
            {missing.length > 0
              ? "Tudo que não está na sua tela agora."
              : "Todos os widgets já estão na sua tela."}
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
                  borderColor: INK.edge,
                  backgroundColor: "rgba(255,255,255,0.062)",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                    {w.label}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: INK.softer }}>
                    {w.description}
                  </Text>
                </View>
                <Pressable
                  onPress={() => add(w.id)}
                  style={({ pressed }) => ({
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#0B0B0B" }}>Adicionar</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

/** What a card looks like while its corner is being pulled: the shape it is taking,
    with nothing in it to read. */
function Ghost() {
  return (
    <View
      style={{
        minHeight: 150,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.09)",
      }}
    />
  );
}

/** One card on the board: held to open its menu, and in edit mode, moved by hand. */
function WidgetFrame({
  slot,
  editing,
  half,
  children,
  onHold,
  onDragTo,
  onDragStart,
  onDragEnd,
  onResize,
  onRemove,
  registerFrame,
}: {
  slot: WidgetSlot;
  editing: boolean;
  half: boolean;
  children: ReactNode;
  onHold: (rect: { top: number; bottom: number; left: number; width: number }) => void;
  onDragTo: (id: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  registerFrame: (id: string, box: { x: number; y: number; w: number; h: number } | null) => void;
}) {
  const box = useRef<ComponentRef<typeof View>>(null);
  const def = widgetById(slot.id);
  /* A widget decides for itself whether it has anything to say, and several answer
     by drawing nothing at all. The board cannot read that from the element it was
     handed, so it reads it from the height: a frame with no card in it must not
     carry controls, or they stack on top of the card below. */
  const [drawn, setDrawn] = useState(false);
  const [resizing, setResizing] = useState(false);

  /* The card travels under the finger; the order is what actually changes, and the
     layout animation carries everything else to its new seat. It springs back to
     wherever the board has since put it, so the card never keeps the offset. */
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);

  const measure = useCallback(() => {
    box.current?.measureInWindow((x, y, w, h) => {
      registerFrame(slot.id, { x, y, w, h });
      setDrawn(h > 8);
    });
  }, [registerFrame, slot.id]);

  useEffect(() => {
    const t = setTimeout(measure, 220);
    return () => {
      clearTimeout(t);
      registerFrame(slot.id, null);
    };
  }, [measure, registerFrame, slot.id]);

  const drag = Gesture.Pan()
    .enabled(editing)
    .onStart(() => {
      lifted.value = withSpring(1, { damping: 18 });
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
      runOnJS(onDragTo)(slot.id, e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      dx.value = withSpring(0, { damping: 20, stiffness: 220 });
      dy.value = withSpring(0, { damping: 20, stiffness: 220 });
      lifted.value = withSpring(0, { damping: 18 });
      runOnJS(onDragEnd)();
    });

  /* Pulled outwards for the whole row, inwards for half of it. The card shows the
     size it is taking while the finger is still down, as a plain shape — what it
     will hold is not the question being asked. */
  const resize = Gesture.Pan()
    .onUpdate((e) => {
      const next = e.translationX > 26 ? "full" : e.translationX < -26 ? "half" : null;
      if (next && next !== slot.size) runOnJS(onResize)(next);
      if (Math.abs(e.translationX) > 6) runOnJS(setResizing)(true);
    })
    .onFinalize(() => {
      runOnJS(setResizing)(false);
    });

  const carried = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { scale: 1 + lifted.value * 0.04 },
    ],
    zIndex: lifted.value > 0 ? 40 : 0,
  }));

  return (
    <GestureDetector gesture={drag}>
    <Animated.View
      ref={box}
      layout={SEAT_CHANGE}
      onLayout={measure}
      style={[{ flex: half ? 1 : undefined, position: "relative" }, carried]}
    >
      <Pressable
        onLongPress={() => {
          box.current?.measureInWindow((x, y, w, h) =>
            onHold({ top: y, bottom: y + h, left: x, width: w }),
          );
        }}
        delayLongPress={420}
        disabled={editing}
        /* In edit mode the card is a handle, not a thing you can press into. */
        style={editing ? { opacity: 0.92 } : undefined}
      >
        <View pointerEvents={editing ? "none" : "auto"}>
          {resizing ? <Ghost /> : children}
        </View>
      </Pressable>

      {/* The grip, in the corner a card is resized from. Removing a card is not here:
          it is in the menu you get by holding one, which is where the reference
          keeps it and where it belongs — a cross on every card turns editing into a
          field of things to delete. */}
      {editing && drawn && def?.resizable && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(140)}
          /* Pushed out by the corner's radius, so the grip's own centre of turn
             lands on the one the card's corner turns around. */
          style={{ position: "absolute", bottom: -GRIP_OFFSET, right: -GRIP_OFFSET, zIndex: 20 }}
        >
          <GestureDetector gesture={resize}>
            <View accessibilityLabel={slot.size === "full" ? "Deixar menor" : "Ocupar a linha"}>
              <ResizeGrip />
            </View>
          </GestureDetector>
        </Animated.View>
      )}
    </Animated.View>
    </GestureDetector>
  );
}
