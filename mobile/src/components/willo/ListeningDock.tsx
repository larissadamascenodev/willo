import { useEffect } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import ParticleOrb from "~/components/registro/ParticleOrb";

/**
 * Willo at the foot of the conversation while he listens: just above the field, not on
 * it, the way the phone's own assistant comes up, with the screen behind him left as it
 * is. The field stays where it is under him, and its microphone sends and its corner
 * cancels. He stops by himself when you do; a tap on him stops him sooner.
 */

/** Clears the field (56 tall, 8 from the foot), less the empty margin around his sphere. */
const FIELD_TOP = 70;

export default function ListeningDock({ reading, bottom, onStop }: { reading: boolean; bottom: number; onStop: () => void }) {
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ marginBottom: bottom + FIELD_TOP }}>
        <ParticleOrb size={116}mode={reading ? "thinking" : "listening"} onPress={reading ? undefined : onStop} />
      </Animated.View>
    </View>
  );
}
