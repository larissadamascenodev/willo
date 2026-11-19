import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "~/supabase/client";
import BottomSheet from "~/components/BottomSheet";
import { Trash2, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Setting a limit.
 *
 * A limit with no category is a number nobody can check, so the category is picked
 * first and the amount second — and an existing one can be taken off, because a
 * limit you cannot remove is a limit you stop believing.
 */
export default function LimitSheet({
  open,
  category,
  categories,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: string | null;
  categories: string[];
  current: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [picked, setPicked] = useState<string | null>(category);
  const [cents, setCents] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(category);
    setCents(current ? Math.round(current * 100) : 0);
    setError(null);
    setSaving(false);
  }, [open, category, current]);

  const save = async () => {
    if (!user || !picked || cents <= 0) {
      setError("Escolha uma categoria e um valor.");
      return;
    }
    setSaving(true);
    try {
      const { data: row } = await supabase
        .from("category_limits")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", picked)
        .maybeSingle();

      if (row) {
        await supabase.from("category_limits").update({ limit_amount: cents / 100 }).eq("id", (row as any).id);
      } else {
        await supabase
          .from("category_limits")
          .insert({ user_id: user.id, category: picked, limit_amount: cents / 100 } as any);
      }
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onSaved();
    } catch {
      setError("Não foi possível salvar o limite.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!user || !picked) return;
    setSaving(true);
    try {
      await supabase.from("category_limits").delete().eq("user_id", user.id).eq("category", picked);
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onSaved();
    } catch {
      setError("Não foi possível remover o limite.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: th("#fff") }}>
            {current ? "Editar limite" : "Novo limite"}
          </Text>
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
              backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color={th(INK.soft)} />
          </Pressable>
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: th(INK.soft) }}>Categoria</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((name) => {
            const on = picked === name;
            return (
              <Pressable
                key={name}
                onPress={() => {
                  setPicked(name);
                  setError(null);
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: th(on ? "#fff" : "rgba(255,255,255,0.08)", "line"),
                  backgroundColor: th(on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.035)", "bg"),
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: on ? "600" : "400", color: th("#fff") }}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginTop: 22, fontSize: 12.5, color: th(INK.soft) }}>Limite do mês</Text>
        <TextInput
          value={brl(cents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 10);
            setCents(Math.min(Number(digits || "0"), 99999999));
            setError(null);
          }}
          keyboardType="number-pad"
          style={{
            marginTop: 8,
            minWidth: 0,
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -1.2,
            color: th(cents === 0 ? INK.faint : "#fff"),
            padding: 0,
          }}
        />

        {error && <Text style={{ marginTop: 14, fontSize: 13, color: th(RED) }}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: th("#fff", "bg"),
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>
            {saving ? "Salvando..." : "Salvar limite"}
          </Text>
        </Pressable>

        {current !== null && (
          <Pressable
            onPress={remove}
            disabled={saving}
            style={({ pressed }) => ({
              marginTop: 10,
              height: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Trash2 size={16} color={th(RED)} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: th(RED) }}>Remover limite</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}
