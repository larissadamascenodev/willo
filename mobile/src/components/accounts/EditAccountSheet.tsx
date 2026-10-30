import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BankMark from "~/components/BankMark";
import { X } from "~/components/icons";
import { KINDS, type Kind } from "~/components/accounts/AccountSheet";
import { INK, RED } from "~/theme/tokens";

/**
 * Changing an account: its name and what kind it is.
 *
 * Its colour is not here because it is not the person's to pick — it is the bank's,
 * and the mark above the name shows it. Glass over the page, like the sheet that made
 * the account, so the two read as the same thing seen twice.
 */

export default function EditAccountSheet({
  open,
  name: initialName,
  kind: initialKind,
  hex,
  existingNames,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  kind: string;
  hex: string;
  /** The other accounts' names, so two never share one. */
  existingNames: string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (next: { name: string; type: Kind }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<Kind>((initialKind as Kind) ?? "checking");
  const [lift, setLift] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setKind((initialKind as Kind) ?? "checking");
    setProblem(null);
  }, [open, initialName, initialKind]);

  useEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) =>
      setLift(Math.max(0, e.endCoordinates.height - (ios ? insets.bottom : 0))),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, insets.bottom]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setProblem("Dê um nome à conta.");
      return;
    }
    if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
      setProblem("Você já tem uma conta com esse nome.");
      return;
    }
    onSave({ name: trimmed, type: kind });
  };

  const unchanged = name.trim() === initialName && kind === initialKind;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={saving ? undefined : onClose}>
        <BlurView intensity={18} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
      </Pressable>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: lift,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.5)" }} />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Editar conta</Text>
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
                backgroundColor: "rgba(255,255,255,0.09)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={16} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Nome</Text>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BankMark name={name.trim() || initialName} hex={hex} size={52} />
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setProblem(null);
              }}
              placeholder="Nome da conta"
              placeholderTextColor={INK.faint}
              maxLength={40}
              style={{
                flex: 1,
                minWidth: 0,
                height: 52,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.06)",
                paddingHorizontal: 16,
                fontSize: 16.5,
                color: "#fff",
              }}
            />
          </View>

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Tipo</Text>
          <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              const Icon = k.icon;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={({ pressed }) => ({
                    width: "48.4%",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 20,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                    backgroundColor: on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)",
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Icon size={18} color={on ? "#fff" : INK.soft} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {(problem || error) && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{problem ?? error}</Text>}

          <Pressable
            onPress={submit}
            disabled={saving || unchanged}
            style={({ pressed }) => ({
              marginTop: 22,
              height: 54,
              borderRadius: 27,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: saving || unchanged ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>{saving ? "Salvando…" : "Salvar"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
