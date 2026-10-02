import { useLocalSearchParams } from "expo-router";
import { NovaTransacao, type NovaParams } from "~/features/nova/NovaTransacao";

/** Nova receita/despesa ou edição, aberta por cima das abas. */
export default function Nova() {
  const params = useLocalSearchParams<Record<string, string>>() as unknown as NovaParams;
  return <NovaTransacao params={params} />;
}
