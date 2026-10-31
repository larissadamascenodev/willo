import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import BottomSheet from "~/components/BottomSheet";
import EditEntry from "~/components/registro/EditEntry";
import ManualEntryFlow, { type ManualStep } from "~/components/registro/ManualEntryFlow";

/**
 * Adicionar manualmente — guided, in a sheet over whatever was on screen — and the same
 * sheet to change an entry already written (`editar`). Opened inside a card (`cartao`) it
 * is a purchase on that card. The sheet leaves first; the screen behind it is already there.
 */
export default function Manual() {
  const router = useRouter();
  const { cartao, editar, mes, ano } = useLocalSearchParams<{ cartao?: string; editar?: string; mes?: string; ano?: string }>();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ManualStep>("value");
  const now = new Date();
  const month = mes != null && mes !== "" ? Number(mes) : now.getMonth();
  const year = ano ? Number(ano) : now.getFullYear();

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
    <BottomSheet open={open} onClose={() => leave()} full={!!editar || step === "confirm" || step === "done"}>
      {editar ? (
        <EditEntry id={editar} month={month} year={year} onDone={() => leave()} />
      ) : (
        <ManualEntryFlow
          cardId={cartao ?? null}
          onClose={() => leave()}
          onSeeTransactions={() => leave(() => router.push("/(tabs)/transacoes" as never))}
          onSeeCard={(cardId) => leave(() => router.push(`/fatura/${cardId}` as never))}
          onStep={setStep}
        />
      )}
    </BottomSheet>
  );
}
