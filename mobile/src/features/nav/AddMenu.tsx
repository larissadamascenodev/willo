import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightLeft, Camera, ImageIcon, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react-native";
import { pickFromCamera, pickFromLibrary, processScanFile, type ScanFile } from "~/lib/scan";
import { BottomSheet, Text, colors, toast, white } from "~/ui";
import { TransferSheet } from "./TransferSheet";
import { tint } from "~/lib/color";
import { addMenu, useAddMenuOpen } from "./addMenu";

const ACTIONS: { label: string; hint: string; hex: string; Icon: LucideIcon; href: Href }[] = [
  { label: "Despesa", hint: "Um gasto ou uma conta", hex: colors.red, Icon: TrendingDown, href: { pathname: "/nova", params: { type: "despesa" } } },
  { label: "Receita", hint: "Dinheiro que entrou", hex: colors.green, Icon: TrendingUp, href: { pathname: "/nova", params: { type: "receita" } } },
];

/** O "+" do site: escolher o que lançar. */
export function AddMenu() {
  const router = useRouter();
  const open = useAddMenuOpen();
  const [transfer, setTransfer] = useState(false);
  const [reading, setReading] = useState(false);

  /** Lê um comprovante com a IA e abre o lançamento já preenchido. */
  const scan = async (pick: () => Promise<ScanFile | null>) => {
    try {
      const file = await pick();
      if (!file) return;
      setReading(true);
      const data = await processScanFile(file, "transaction");
      const item = data?.items?.[0];
      if (!item) { toast.error("Nenhuma compra encontrada nessa imagem."); return; }
      addMenu.hide();
      router.push({
        pathname: "/nova",
        params: {
          type: "despesa",
          name: item.description ?? "",
          amount: item.amount ? String(Math.abs(item.amount)) : "",
          category: item.category ?? "",
          ...(item.date ? { date: item.date } : {}),
        },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler o comprovante");
    } finally {
      setReading(false);
    }
  };

  return (
    <>
    <TransferSheet open={transfer} onClose={() => setTransfer(false)} />
    <BottomSheet open={open} onClose={addMenu.hide}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text display weight="bold" size={20} style={{ marginBottom: 14 }}>O que você quer lançar?</Text>
        {reading && (
          <View style={{ alignItems: "center", paddingVertical: 28, gap: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text size={14} color={white(0.66)}>Lendo o comprovante…</Text>
          </View>
        )}
        <View style={{ gap: 10, display: reading ? "none" : "flex" }}>
          {ACTIONS.map(({ label, hint, hex, Icon, href }) => (
            <Pressable
              key={label}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                addMenu.hide();
                router.push(href);
              }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, borderColor: white(0.08), backgroundColor: white(pressed ? 0.1 : 0.06), padding: 14 })}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
                <Icon size={22} color={hex} />
              </View>
              <View>
                <Text weight="semibold" size={16}>{label}</Text>
                <Text size={12.5} color={white(0.58)}>{hint}</Text>
              </View>
            </Pressable>
          ))}
          {[
            { label: "Fotografar comprovante", hint: "A IA preenche o lançamento", Icon: Camera, run: () => scan(pickFromCamera) },
            { label: "Comprovante da galeria", hint: "Um print ou uma foto", Icon: ImageIcon, run: () => scan(pickFromLibrary) },
            { label: "Transferir", hint: "Entre as suas contas", Icon: ArrowRightLeft, run: () => { addMenu.hide(); setTransfer(true); } },
          ].map(({ label, hint, Icon, run }) => (
            <Pressable key={label} onPress={run} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, borderColor: white(0.08), backgroundColor: white(pressed ? 0.1 : 0.06), padding: 14 })}>
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: white(0.08) }}>
                <Icon size={22} color="#fff" />
              </View>
              <View>
                <Text weight="semibold" size={16}>{label}</Text>
                <Text size={12.5} color={white(0.58)}>{hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
    </>
  );
}
