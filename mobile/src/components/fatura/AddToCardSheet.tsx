import { useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { importStatement, type ImportableItem } from "@/services/invoiceImport";
import BottomSheet from "~/components/BottomSheet";
import { Camera, Check, FileText, ImageIcon, PenLine, Receipt } from "~/components/icons";
import { NeedsNewBuild, pickFile, pickFromGallery, takePhoto, type PickedStatement } from "~/lib/pickStatement";
import { processScanDocument, processScanPhoto, type ScanResult } from "~/lib/scanUpload";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Putting something on the card, the two ways the web offers: by hand, or by sending the
 * statement and letting Willo read it.
 *
 * Sending asks where the statement is in the phone's own words — a file, the gallery or
 * the camera — and then reads it. What was read comes back as a list to check before
 * anything is written: every line ticked, any of them can be unticked, and the total of
 * what is ticked sits beside the total the bank printed, so a misread shows before it
 * lands. Importing runs the very sequence the web runs, one function for both.
 */

type Step = "choose" | "source" | "reading" | "review";

interface Line extends ImportableItem {
  selected: boolean;
  is_refund?: boolean;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function AddToCardSheet({
  open,
  card,
  month,
  year,
  onClose,
  onImported,
}: {
  open: boolean;
  card: { id: string; dueDay: number } | null;
  month: number;
  year: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("choose");
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* A reading the person walked away from must not land later. */
  const attempt = useRef(0);

  useEffect(() => {
    if (!open) return;
    attempt.current++;
    setStep("choose");
    setLines([]);
    setScan(null);
    setError(null);
    setSaving(false);
  }, [open]);

  const close = () => {
    attempt.current++;
    onClose();
  };

  const manual = () => {
    onClose();
    if (card) router.push({ pathname: "/novo", params: { cartao: card.id } } as never);
  };

  const read = async (get: () => Promise<PickedStatement | null>) => {
    setError(null);
    let picked: PickedStatement | null;
    try {
      picked = await get();
    } catch (e) {
      setError(e instanceof NeedsNewBuild || e instanceof Error ? e.message : "Não foi possível abrir.");
      setStep("choose");
      return;
    }
    if (!picked) return;

    const mine = ++attempt.current;
    setFileName(picked.name ?? null);
    setStep("reading");
    try {
      const data =
        picked.mimeType && !picked.mimeType.startsWith("image/")
          ? await processScanDocument(picked, "invoice")
          : await processScanPhoto({ uri: picked.uri, width: picked.width, height: picked.height }, "invoice");
      if (mine !== attempt.current) return;

      const found: Line[] = ((data.items ?? []) as any[]).map((item) => ({ ...item, selected: true }));
      if (found.length === 0) {
        setError("Não encontrei nenhuma compra nesse arquivo. Tente outro, ou uma foto mais nítida.");
        setStep("choose");
        return;
      }
      /* What the statement brought from last month comes in as its own line, so the
         invoice ends up asking for what the bank asks for. */
      const carried = Number(data.carried_over);
      if (Number.isFinite(carried) && Math.abs(carried) >= 0.5) {
        found.push({
          description: carried < 0 ? "Crédito da fatura anterior" : "Saldo da fatura anterior",
          amount: Math.round(carried * 100) / 100,
          is_refund: carried < 0,
          date: `${year}-${String(month).padStart(2, "0")}-01`,
          installment_current: null,
          installment_total: null,
          category: "Outros",
          is_carry: true,
          selected: true,
        });
      }
      setScan(data);
      setLines(found);
      setStep("review");
    } catch (e) {
      if (mine !== attempt.current) return;
      setError(e instanceof Error ? e.message : "Não foi possível ler a fatura.");
      setStep("choose");
    }
  };

  const upload = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Enviar fatura",
          message: "O Willo lê o PDF ou a foto e separa cada compra.",
          options: ["Escolher arquivo", "Escolher da galeria", "Tirar foto", "Cancelar"],
          cancelButtonIndex: 3,
        },
        (i) => {
          if (i === 0) void read(pickFile);
          if (i === 1) void read(pickFromGallery);
          if (i === 2) void read(takePhoto);
        },
      );
      return;
    }
    setStep("source");
  };

  const chosen = lines.filter((l) => l.selected);
  const sum = useMemo(() => chosen.reduce((s, l) => s + Number(l.amount), 0), [chosen]);
  const declared = scan?.declared_total ?? null;
  const matches = declared != null && Math.abs(declared - sum) < 0.05;

  const confirm = async () => {
    if (!user || !card || chosen.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const outcome = await importStatement({
        userId: user.id,
        card,
        month,
        year,
        items: chosen.map(({ selected: _s, ...rest }) => rest),
        documentHash: null,
        documentName: fileName,
        declared: {
          cardLimit: scan?.declared_card_limit ?? null,
          usedLimit: scan?.declared_used_limit ?? null,
          total: scan?.declared_total ?? null,
          nextClosing: scan?.declared_next_invoice ?? null,
        },
      });
      const n = outcome.rowCount;
      onClose();
      onImported();
      showToast(`${n} ${n === 1 ? "lançamento importado" : "lançamentos importados"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={close} full={step === "review"}>
      <View style={{ paddingHorizontal: 20 }}>
        {step === "choose" && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Adicionar ao cartão</Text>
            <Text style={{ marginTop: 4, fontSize: 13.5, color: INK.soft }}>Fatura de {MONTHS[month - 1]}</Text>
            <View style={{ marginTop: 18, gap: 10 }}>
              <Option icon={PenLine} title="Adicionar manualmente" note="Uma compra, digitada por você" onPress={manual} />
              <Option icon={FileText} title="Enviar fatura" note="PDF, foto da galeria ou da câmera" onPress={upload} />
            </View>
            {error && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{error}</Text>}
          </Animated.View>
        )}

        {step === "source" && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Enviar fatura</Text>
            <View style={{ marginTop: 18, gap: 10 }}>
              <Option icon={FileText} title="Escolher arquivo" note="O PDF que o banco enviou" onPress={() => void read(pickFile)} />
              <Option icon={ImageIcon} title="Escolher da galeria" note="Um print ou foto da fatura" onPress={() => void read(pickFromGallery)} />
              <Option icon={Camera} title="Tirar foto" note="Da fatura impressa ou na tela" onPress={() => void read(takePhoto)} />
            </View>
          </Animated.View>
        )}

        {step === "reading" && (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center", paddingVertical: 36 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ marginTop: 16, fontSize: 16.5, fontWeight: "700", color: "#fff" }}>Lendo sua fatura…</Text>
            <Text style={{ marginTop: 6, fontSize: 13.5, color: INK.soft, textAlign: "center" }}>
              Separando cada compra, parcela e estorno. Pode levar alguns segundos.
            </Text>
          </Animated.View>
        )}

        {step === "review" && (
          <Animated.View entering={FadeIn.duration(220)}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Confira antes de importar</Text>
            <Text style={{ marginTop: 4, fontSize: 13.5, color: INK.soft }}>
              {lines.length} {lines.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"} · fatura de {MONTHS[month - 1]}
            </Text>

            <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, color: INK.softer }}>Selecionado</Text>
                <Text style={{ marginTop: 2, fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{money(sum)}</Text>
              </View>
              {declared != null && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11.5, color: INK.softer }}>Total da fatura</Text>
                  <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{money(declared)}</Text>
                    {matches && <Check size={16} color={GREEN} strokeWidth={3} />}
                  </View>
                </View>
              )}
            </View>

            <View style={{ marginTop: 14 }}>
              {lines.map((line, i) => (
                <Pressable
                  key={i}
                  onPress={() => setLines((all) => all.map((l, j) => (j === i ? { ...l, selected: !l.selected } : l)))}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 11,
                    borderBottomWidth: i === lines.length - 1 ? 0 : 1,
                    borderBottomColor: "rgba(255,255,255,0.06)",
                    opacity: pressed ? 0.7 : line.selected ? 1 : 0.45,
                  })}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: line.selected ? 0 : 1.5,
                      borderColor: "rgba(255,255,255,0.3)",
                      backgroundColor: line.selected ? "#fff" : "transparent",
                    }}
                  >
                    {line.selected && <Check size={13} color="#0B0B0B" strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{line.description}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
                      {line.date ? new Date(`${line.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "—"}
                      {line.installment_total && line.installment_total > 1 ? ` · ${line.installment_current} de ${line.installment_total}` : ""}
                      {line.category ? ` · ${line.category}` : ""}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: Number(line.amount) < 0 ? GREEN : "#fff" }}>
                    {Number(line.amount) < 0 ? "+" : ""}
                    {money(Math.abs(Number(line.amount)))}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}

            <Pressable
              onPress={() => void confirm()}
              disabled={saving || chosen.length === 0}
              style={({ pressed }) => ({
                marginTop: 18,
                height: 54,
                borderRadius: 27,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                opacity: saving || chosen.length === 0 ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>
                {saving ? "Importando…" : `Importar ${chosen.length} ${chosen.length === 1 ? "lançamento" : "lançamentos"}`}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

function Option({
  icon: Icon,
  title,
  note,
  onPress,
}: {
  icon: typeof Receipt;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: "rgba(255,255,255,0.06)",
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" }}>
        <Icon size={19} color="#fff" strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>{note}</Text>
      </View>
    </Pressable>
  );
}
