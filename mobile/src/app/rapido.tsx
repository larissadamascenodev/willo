import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import BottomSheet from "~/components/BottomSheet";
import QuickEntryFlow, { type Step } from "~/components/registro/QuickEntryFlow";

/**
 * Registro rápido, a double tap away: the steps in a half sheet over whatever was on
 * screen. The sheet leaves first; the screen behind it is already there.
 */
export default function Rapido() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");

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
    <BottomSheet open={open} onClose={() => leave()} full={step === "done"}>
      <QuickEntryFlow onClose={() => leave()} onSeeTransactions={() => leave(() => router.push("/(tabs)/transacoes" as never))} onStep={setStep} />
    </BottomSheet>
  );
}
