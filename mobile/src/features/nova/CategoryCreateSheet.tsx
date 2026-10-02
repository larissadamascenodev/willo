import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Check, Plus, Sparkles } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { ICON_OPTIONS, getIconComponent } from "@/lib/categoryIconOptions";
import { BottomSheet, Button, Text, fonts, white } from "~/ui";
import { tint } from "~/lib/color";

const COLOR_OPTIONS = [
  "#00e676", "#f44336", "#ff9800", "#2196f3", "#9c27b0",
  "#e91e63", "#00bcd4", "#8bc34a", "#ffc107", "#795548",
  "#607060", "#3f51b5", "#009688", "#ff5722", "#673ab7",
  "#cddc39", "#4caf50", "#03a9f4", "#ff4081", "#7c4dff",
  "#18ffff", "#69f0ae", "#ffab40", "#ea80fc",
];

const FORBIDDEN = ["outros", "outro", "diversos", "geral", "varios", "sem categoria"];
const normalize = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string }) => void;
  initialName?: string;
  /** Para editar uma categoria que já existe: ela mantém o ícone e a cor e a IA não mexe. */
  initialIcon?: string;
  initialColor?: string;
  title?: string;
  existingNames?: string[];
  /** Cores que outras categorias já usam: cada categoria tem a sua. */
  usedColors?: string[];
}

/**
 * Cria uma categoria: o nome, e a IA escolhe o ícone e a cor enquanto você digita (até você
 * mexer num deles). Mostra uma prévia viva do resultado.
 */
export function CategoryCreateSheet({ open, onClose, onSave, initialName = "", initialIcon, initialColor, title = "Nova categoria", existingNames = [], usedColors = [] }: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState("file-text");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  // depois que a pessoa escolhe um ícone ou cor, a IA para de sobrescrever
  const touched = useRef(false);

  const taken = usedColors.map((c) => c.toLowerCase());
  const freeColors = COLOR_OPTIONS.filter((c) => !taken.includes(c.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setIcon(initialIcon ?? "file-text");
    setColor(initialColor ?? COLOR_OPTIONS.find((c) => !taken.includes(c.toLowerCase())) ?? COLOR_OPTIONS[0]);
    setSuggested(false);
    touched.current = !!initialIcon;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialIcon, initialColor]);

  const trimmed = name.trim();

  useEffect(() => {
    if (!open || touched.current || trimmed.length < 3) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setSuggesting(true);
      try {
        const { data } = await supabase.functions.invoke("suggest-category", { body: { mode: "style", name: trimmed, usedColors } });
        if (cancelled || touched.current || !data?.icon) return;
        setIcon(data.icon);
        if (data.color) setColor(data.color);
        setSuggested(true);
      } catch {
        /* os padrões já funcionam */
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, open]);

  const nameError = !trimmed
    ? null
    : FORBIDDEN.includes(normalize(trimmed))
      ? "Escolha um nome específico: “Outros” não ajuda a entender seus gastos"
      : existingNames.some((n) => normalize(n) === normalize(trimmed))
        ? `Já existe a categoria “${trimmed}”`
        : null;
  const colorError = taken.includes(color.toLowerCase()) ? "Essa cor já é de outra categoria" : null;
  const canSave = !!trimmed && !nameError && !colorError;

  const pick = (apply: () => void) => {
    touched.current = true;
    setSuggested(false);
    apply();
  };

  const PreviewIcon: any = getIconComponent(icon);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      footer={<Button label="Criar categoria" icon={<Check size={16} color="#0B0B0B" strokeWidth={3} />} disabled={!canSave} onPress={() => onSave({ name: trimmed, icon, color })} />}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text display weight="extrabold" size={22}>{title}</Text>

        {/* prévia viva da categoria */}
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <View style={{ width: 76, height: 76, borderRadius: 26, borderWidth: 1, borderColor: tint(color, 0.25), backgroundColor: tint(color, 0.12), alignItems: "center", justifyContent: "center" }}>
            <PreviewIcon size={32} color={color} />
          </View>
          <Text weight="semibold" size={17} numberOfLines={1} style={{ marginTop: 12 }}>{trimmed || "Sua categoria"}</Text>
          {(suggesting || suggested) && (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.04), paddingHorizontal: 10, paddingVertical: 4 }}>
              <Sparkles size={12} color={white(0.74)} />
              <Text size={11.5} color={white(0.74)}>{suggesting ? "Escolhendo o visual…" : "Sugerido pela IA"}</Text>
            </View>
          )}
        </View>

        <Text size={12} weight="semibold" color={white(0.5)} style={{ marginTop: 28, paddingHorizontal: 4, letterSpacing: 1, textTransform: "uppercase" }}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex: Streaming"
          placeholderTextColor={white(0.38)}
          maxLength={30}
          selectionColor="#fff"
          style={{ marginTop: 8, height: 56, borderRadius: 18, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.08), paddingHorizontal: 16, color: "#fff", fontSize: 16, fontFamily: fonts.regular }}
        />
        {(nameError || colorError) && <Text size={12.5} color="#F87171" style={{ marginTop: 8, paddingHorizontal: 4 }}>{nameError ?? colorError}</Text>}

        <Text size={12} weight="semibold" color={white(0.5)} style={{ marginTop: 24, paddingHorizontal: 4, letterSpacing: 1, textTransform: "uppercase" }}>Cor</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
          {freeColors.map((c) => (
            <Pressable key={c} onPress={() => pick(() => setColor(c))} accessibilityLabel={`Cor ${c}`} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c }}>
              {color === c && <View style={{ position: "absolute", top: -4, left: -4, right: -4, bottom: -4, borderRadius: 26, borderWidth: 2, borderColor: "#fff" }} />}
            </Pressable>
          ))}
          <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderStyle: "dashed", borderColor: white(0.2), alignItems: "center", justifyContent: "center" }}>
            <Plus size={16} color={white(0.66)} />
          </View>
        </ScrollView>

        <Text size={12} weight="semibold" color={white(0.5)} style={{ marginTop: 16, paddingHorizontal: 4, letterSpacing: 1, textTransform: "uppercase" }}>Ícone</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ICON_OPTIONS.map(({ name: iconName, Icon }) => {
            const active = icon === iconName;
            const I: any = Icon;
            return (
              <Pressable
                key={iconName}
                onPress={() => pick(() => setIcon(iconName))}
                style={{ width: "15%", aspectRatio: 1, borderRadius: 16, borderWidth: 1, borderColor: active ? tint(color, 0.33) : white(0.06), backgroundColor: active ? tint(color, 0.13) : white(0.06), alignItems: "center", justifyContent: "center" }}
              >
                <I size={18} color={active ? color : white(0.5)} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
