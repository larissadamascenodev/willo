import { useEffect } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import ParticleOrb from "~/components/registro/ParticleOrb";

/**
 * Willo at the foot of the conversation while he listens: just above the field, not on
 * it, the way the phone's own assistant comes up. Behind him the conversation goes out of
 * focus, little by little, so what is further up stays as it was and what is under him does
 * not fight with him. The field stays where it is below, and its microphone sends and its
 * corner cancels. He stops by himself when you do; a tap on him stops him sooner.
 */

/** Clears the field (56 tall, 8 from the foot), less the empty margin around his sphere. */
const FIELD_TOP = 70;
const FIELD_CLEAR = 64;

/* Blur that builds up: each layer starts lower and adds to those above it. */
const BLUR_HEIGHTS = [230, 190, 150, 110, 70];

export default function ListeningDock({ reading, bottom, loudness, onStop }: { reading: boolean; bottom: number; loudness?: number; onStop: () => void }) {
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: bottom + FIELD_CLEAR, height: BLUR_HEIGHTS[0] }}>
        {BLUR_HEIGHTS.map((height) => (
          <BlurView key={height} intensity={16} tint="dark" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }} />
        ))}
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.72)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ marginBottom: bottom + FIELD_TOP }}>
        <ParticleOrb size={116} mode={reading ? "thinking" : "listening"} loudness={loudness} onPress={reading ? undefined : onStop} />
      </Animated.View>
    </View>
  );
}
