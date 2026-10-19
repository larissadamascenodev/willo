import { useLocalSearchParams } from "expo-router";
import EmBreve from "~/components/EmBreve";

/** The card's own panel: the invoice, its cycle and what is on it. */
export default function Fatura() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  return <EmBreve title="Fatura" note={`O painel do cartão chega em seguida.${cardId ? "" : ""}`} />;
}
