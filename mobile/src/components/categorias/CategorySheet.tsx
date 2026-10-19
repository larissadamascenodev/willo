import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_SLUGS,
  DEFAULT_CATEGORY_ICON_SLUG,
  categoryNameProblem,
  firstFreeCategoryColor,
} from "@/lib/categoryPalette";
import BottomSheet from "~/components/BottomSheet";
import { iconForSlug } from "~/lib/categoryIconSlugs";
import { Check, X } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";

/**
 * Naming a category, and choosing how it will read in a chart.
 *
 * The colour matters more than it looks: a chart of categories is only legible when
 * no two slices share one, so a colour already taken is drawn struck through rather
 * than silently allowed. The glyph is the smaller decision and gets the larger grid,
 * because picking one out of seventy is a scan rather than a choice.
 */
export default function CategorySheet({
  open,
  onClose,
  onSave,
  title,
  initialName = "",
  initialIcon = DEFAULT_CATEGORY_ICON_SLUG,
  initialColor,
  existingNames = [],
  usedColors = [],
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string }) => Promise<void> | void;
  title: string;
  initialName?: string;
  initialIcon?: string;
  initialColor?: string;
  existingNames?: string[];
  /** Colours other categories already hold. */
  usedColors?: string[];
}) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor ?? CATEGORY_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  /* Opening the sheet is what resets it — a colour the person picked should not be
     taken back off them while they are still looking at it. */
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setIcon(initialIcon);
    const taken = new Set(usedColors.map((c) => c.toLowerCase()));
    const wanted = initialColor ?? CATEGORY_COLOR_OPTIONS[0];
    setColor(taken.has(wanted.toLowerCase()) ? firstFreeCategoryColor(usedColors) : wanted);
    setTouched(false);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialIcon, initialColor]);

  const problem = categoryNameProblem(name, existingNames);
  const taken = new Set(usedColors.map((c) => c.toLowerCase()));

  const submit = async () => {
    setTouched(true);
    if (problem || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), icon, color });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>{title}</Text>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color={INK.soft} />
          </Pressable>
        </View>

        {/* What it will look like, before it exists. */}
        <View style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${color}1F`,
            }}
          >
            {(() => {
              const Icon = iconForSlug(icon);
              return <Icon size={24} color={color} strokeWidth={2} />;
            })()}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setTouched(true);
              }}
              placeholder="Nome da categoria"
              placeholderTextColor={INK.faint}
              maxLength={40}
              style={{
                height: 48,
                minWidth: 0,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: INK.edge,
                backgroundColor: "rgba(255,255,255,0.05)",
                paddingHorizontal: 16,
                fontSize: 15.5,
                color: "#fff",
              }}
            />
          </View>
        </View>

        {touched && problem && (
          <Text style={{ marginTop: 10, fontSize: 12.5, color: RED }}>{problem}</Text>
        )}

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Cor</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {CATEGORY_COLOR_OPTIONS.map((c) => {
            const on = c.toLowerCase() === color.toLowerCase();
            const used = taken.has(c.toLowerCase()) && !on;
            return (
              <Pressable
                key={c}
                accessibilityLabel={`Cor ${c}`}
                disabled={used}
                onPress={() => setColor(c)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c,
                  opacity: used ? 0.18 : on ? 1 : 0.62,
                  borderWidth: on ? 2 : 0,
                  borderColor: "#fff",
                }}
              >
                {on && <Check size={15} color="#0B0B0B" strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>
        <Text style={{ marginTop: 8, fontSize: 11.5, lineHeight: 16, color: INK.softer }}>
          As cores apagadas já pertencem a outra categoria.
        </Text>

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Ícone</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORY_ICON_SLUGS.map((slug) => {
            const Icon = iconForSlug(slug);
            const on = slug === icon;
            return (
              <Pressable
                key={slug}
                accessibilityLabel={slug}
                onPress={() => setIcon(slug)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: on ? color : "rgba(255,255,255,0.07)",
                  backgroundColor: on ? `${color}1F` : "rgba(255,255,255,0.04)",
                }}
              >
                <Icon size={19} color={on ? color : INK.soft} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 26,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : problem ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
            {saving ? "Salvando..." : "Salvar"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
