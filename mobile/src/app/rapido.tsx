import { useEffect, useState } from "react";
import { withPro } from "~/components/onboarding/RenewGate";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import ParticleOrb from "~/components/registro/ParticleOrb";
import BottomSheet from "~/components/BottomSheet";
import QuickEntryFlow, { type Step } from "~/components/registro/QuickEntryFlow";
import NewEntry from "~/components/registro/NewEntry";
import { useThemeRedraw } from "~/theme/theme";

/**
 * Registro rápido, a double tap away: the same entry as the "+" (NewEntry), nearly the whole
 * screen, over whatever was on screen. A sentence already heard (Siri, a shortcut) goes to
 * the guided steps instead, and while he listens Willo stands above the sheet, covering none
 * of it. The sheet leaves first; the screen behind it is already there.
 */
function Rapido() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  const { frase } = useLocalSearchParams<{ frase?: string }>();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");
  const [hearing, setHearing] = useState<{ reading: boolean; loudness?: number; stop: () => void } | null>(null);

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
      full={!frase || step !== "ask"}
      nearlyFull={!frase}
      above={
        hearing ? (
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)}>
            <ParticleOrb size={116} mode={hearing.reading ? "thinking" : "listening"} loudness={hearing.loudness} onPress={hearing.reading ? undefined : hearing.stop} />
          </Animated.View>
        ) : null
      }
    >
      {!frase ? (
        <NewEntry
          onScan={() => leave(() => router.push("/scanner" as never))}
          onClose={() => leave()}
          onSeeTransactions={() => leave(() => router.push("/(tabs)/transacoes" as never))}
        />
      ) : (
      <QuickEntryFlow
        heard={frase ?? null}
        onClose={() => leave()}
        onSeeTransactions={() => leave(() => router.push("/(tabs)/transacoes" as never))}
        onSeeCard={(cardId) => leave(() => router.push(`/fatura/${cardId}` as never))}
        onStep={setStep}
        onHearing={setHearing}
      />
      )}
    </BottomSheet>
  );
}

export default withPro(Rapido);
