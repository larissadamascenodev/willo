import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import ParticleOrb from "~/components/registro/ParticleOrb";
import BottomSheet from "~/components/BottomSheet";
import QuickEntryFlow, { type Step } from "~/components/registro/QuickEntryFlow";

/**
 * Registro rápido, a double tap away: the steps in a half sheet over whatever was on
 * screen. The sheet leaves first; the screen behind it is already there. While he listens,
 * Willo stands above the sheet, covering none of it.
 */
export default function Rapido() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");
  const [hearing, setHearing] = useState<{ reading: boolean; stop: () => void } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  const leave = (then?: () => void) => {
    setOpen(false);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/" as never);
      then?.();
    }, 260);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => leave()}
      full={step !== "ask"}
      above={
        hearing ? (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)}>
            <ParticleOrb size={116} mode={hearing.reading ? "thinking" : "listening"} onPress={hearing.reading ? undefined : hearing.stop} />
          </Animated.View>
        ) : null
      }
    >
      <QuickEntryFlow
        onClose={() => leave()}
        onSeeTransactions={() => leave(() => router.push("/(tabs)/transacoes" as never))}
        onSeeCard={(cardId) => leave(() => router.push(`/fatura/${cardId}` as never))}
        onStep={setStep}
        onHearing={setHearing}
      />
    </BottomSheet>
  );
}
