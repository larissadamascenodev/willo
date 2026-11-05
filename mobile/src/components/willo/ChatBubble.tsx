import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { face } from "~/lib/chatFont";
import { pauseAfterWord, TYPING_STARTS_AFTER, wordEnds } from "~/lib/chatText";

/**
 * One message, in the conversation and on the home alike.
 *
 * His words arrive a word at a time, as they do from someone writing, and only the bubble
 * itself redraws while they do. The whole text is laid out from the start, the part not
 * yet written invisible, so the bubble keeps its final size and nothing else on the screen
 * moves. `onDone` says when the last word is down, for whatever comes next to wait on.
 */
export default function ChatBubble({
  role,
  text,
  named = false,
  avatar = false,
  avatarRoom = true,
  instant = false,
  onDone,
}: {
  role: "bot" | "user";
  text: string;
  /** The first of his messages in a row carries his name, as in any chat. */
  named?: boolean;
  /** The sphere beside his latest words. */
  avatar?: boolean;
  /** Leaves the place the sphere goes in, so his messages line up. */
  avatarRoom?: boolean;
  /** Already written out once: shown whole. */
  instant?: boolean;
  onDone?: () => void;
}) {
  const mine = role === "user";
  const [shown, setShown] = useState(mine || instant ? text.length : 0);
  const typing = shown < text.length;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (mine || instant) return;
    const ends = wordEnds(text);
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const write = () => {
      setShown(ends[n]);
      n += 1;
      if (n < ends.length) t = setTimeout(write, pauseAfterWord(text, ends[n - 1]));
    };
    t = setTimeout(write, TYPING_STARTS_AFTER);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!mine && !typing) done.current?.();
  }, [mine, typing]);

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: mine ? "flex-end" : "flex-start" }}>
      {!mine && avatarRoom && (
        <View style={{ width: 28, height: 28 }}>
          {avatar && (
            <Animated.View entering={FadeIn.duration(300)}>
              <ParticleOrb size={28} mode={typing ? "speaking" : "idle"} />
            </Animated.View>
          )}
        </View>
      )}
      <View
        style={{
          maxWidth: mine ? "84%" : "82%",
          paddingHorizontal: 15,
          paddingVertical: 11,
          borderRadius: 22,
          borderCurve: "continuous",
          overflow: "hidden",
          ...(mine
            ? { borderBottomRightRadius: 7, backgroundColor: "#fff" }
            : {
                borderBottomLeftRadius: 7,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
                backgroundColor: "rgba(255,255,255,0.07)",
              }),
        }}
      >
        {!mine && <BlurView intensity={30} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        {!mine && named && <Text style={{ marginBottom: 3, fontSize: 14, letterSpacing: -0.1, ...face(800), color: "#fff" }}>Willo</Text>}
        <Text style={{ fontSize: 16, lineHeight: 23, letterSpacing: -0.15, ...face(mine ? 600 : 500), color: mine ? "#0B0B0B" : "rgba(255,255,255,0.95)" }}>
          {mine ? text : <Rich text={text} shown={shown} />}
        </Text>
      </View>
    </Animated.View>
  );
}

/** **Bold** and plain runs, written up to `shown`; the rest there but invisible. */
function Rich({ text, shown }: { text: string; shown: number }) {
  const parts: { t: string; bold: boolean }[] = [];
  text.split("**").forEach((t, i) => t && parts.push({ t, bold: i % 2 === 1 }));
  let left = shown;
  return (
    <>
      {parts.map((p, i) => {
        const seen = p.t.slice(0, Math.max(0, left));
        const unseen = p.t.slice(seen.length);
        left -= p.t.length;
        const style = p.bold ? { ...face(800), color: "#fff" } : undefined;
        return (
          <Text key={i} style={style}>
            {seen}
            {unseen ? <Text style={{ color: "transparent" }}>{unseen}</Text> : null}
          </Text>
        );
      })}
    </>
  );
}
