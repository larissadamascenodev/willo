import { useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * A value from 0 to 1, set by dragging along a track or tapping on it.
 *
 * It runs on the JavaScript side on purpose: it only has to move as fast as a finger,
 * and keeping it out of the animation thread keeps it out of that thread's rules.
 * Colours are passed in, so it reads on whatever is behind it.
 */
export default function PlainSlider({
  value,
  onChange,
  onDone,
  fill,
  track,
  knob = "#FFFFFF",
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  onDone?: (final: number) => void;
  fill: string;
  track: string;
  knob?: string;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const last = useRef(value);
  const startX = useRef(0);
  const KNOB = 26;
  /* The responder is made once; it calls whatever handlers the latest render gave. */
  const handlers = useRef({ onChange, onDone });
  handlers.current = { onChange, onDone };

  const at = (x: number) => {
    const usable = Math.max(1, widthRef.current - KNOB);
    return Math.min(1, Math.max(0, (x - KNOB / 2) / usable));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        const v = at(startX.current);
        last.current = v;
        handlers.current.onChange(v);
        void Haptics.selectionAsync().catch(() => undefined);
      },
      onPanResponderMove: (_, g) => {
        const v = at(startX.current + g.dx);
        last.current = v;
        handlers.current.onChange(v);
      },
      onPanResponderRelease: () => handlers.current.onDone?.(last.current),
      onPanResponderTerminate: () => handlers.current.onDone?.(last.current),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const x = value * Math.max(0, width - KNOB);

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === "increment" ? 0.1 : -0.1;
        const v = Math.min(1, Math.max(0, value + step));
        onChange(v);
        onDone?.(v);
      }}
      style={{ height: 36, justifyContent: "center" }}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: "hidden" }}>
        <View style={{ width: x + KNOB / 2, height: 6, backgroundColor: fill }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: x,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: knob,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      />
    </View>
  );
}
