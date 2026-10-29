import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createAccount } from "@/services/transactionService";
import { BANKS, PALETTE, bankFor, colorFor } from "@/lib/banks";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import BankMark from "~/components/BankMark";
import { Check, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Opening an account.
 *
 * Three questions, in the order people think of them: what kind of place the money is
 * kept in, which bank (which also names it, and colours it, so the common case is one
 * tap), and whether there is already something in it — an account opened with a balance
 * the app does not know about would start wrong and stay wrong.
 */

type Kind = "checking" | "savings" | "cash" | "investment";

const KINDS: { key: Kind; label: string; note: string }[] = [
  { key: "checking", label: "Conta corrente", note: "O dia a dia" },
  { key: "savings", label: "Poupança", note: "Guardado no banco" },
  { key: "investment", label: "Investimento", note: "Corretora ou renda fixa" },
  { key: "cash", label: "Dinheiro", note: "Na carteira, em casa" },
];

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FIELD = {
  height: 48,
  minWidth: 0,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: INK.edge,
  backgroundColor: "rgba(255,255,255,0.05)",
  paddingHorizontal: 16,
  fontSize: 15.5,
  color: "#fff",
} as const;

export default function AccountSheet({
  open,
  onClose,
  onCreated,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingNames?: string[];
}) {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("checking");
  const [name, setName] = useState("");
  const [bankId, setBankId] = useState<string | null>(null);
  const [hasBalance, setHasBalance] = useState<"nao" | "sim">("nao");
  const [cents, setCents] = useState(0);
  const [paint, setPaint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind("checking");
    setName("");
    setBankId(null);
    setHasBalance("nao");
    setCents(0);
    setPaint(null);
    setError(null);
    setSaving(false);
  }, [open]);

  const pickBank = (id: string) => {
    const bank = BANKS.find((b) => b.id === id);
    if (!bank) return;
    setBankId(id === bankId ? null : id);
    if (id === bankId) return;
    /* The bank names the account unless something else was already typed. */
    const typed = name.trim();
    if (!typed || BANKS.some((b) => b.name === typed)) setName(bank.name);
    setPaint(null);
    setError(null);
  };

  const hex = paint ?? colorFor(name, null, "#6B7280");
  const preview = name.trim() || "Nova conta";

  const submit = async () => {
    const trimmed = name.trim();
    if (!user) return;
    if (trimmed.length < 2) {
      setError("Dê um nome à conta.");
      return;
    }
    if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
      setError("Você já tem uma conta com esse nome.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAccount(user.id, {
        name: trimmed,
        type: kind,
        initial_balance: hasBalance === "sim" ? cents / 100 : 0,
        color: paint ?? (bankFor(trimmed) ? null : hex),
      });
      onCreated();
    } catch {
      setError("Não foi possível criar a conta.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Nova conta</Text>
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

          {/* How it will look in the list, as it is filled in. */}
          <View style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <BankMark name={preview} hex={hex} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", color: name.trim() ? "#fff" : INK.faint }}>
                {preview}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.softer }}>
                {KINDS.find((k) => k.key === kind)?.label}
              </Text>
            </View>
          </View>

          <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Que tipo de conta</Text>
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={{
                    width: "48.5%",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.07)",
                    backgroundColor: on ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                    {k.label}
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, color: INK.softer }}>
                    {k.note}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Qual banco</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}
          >
            {BANKS.map((b) => {
              const on = b.id === bankId;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => pickBank(b.id)}
                  style={({ pressed }) => ({
                    height: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingLeft: 6,
                    paddingRight: 14,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.09)",
                    backgroundColor: on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <BankMark name={b.name} hex={b.hex} size={32} />
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{b.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Nome da conta</Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              setBankId(BANKS.find((b) => b.name === t.trim())?.id ?? null);
              setError(null);
            }}
            placeholder="Ex: Nubank, Carteira, Conta do trabalho"
            placeholderTextColor={INK.faint}
            maxLength={40}
            style={{ ...FIELD, marginTop: 8 }}
          />

          {!bankFor(name) && (
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              {PALETTE.map((c) => {
                const on = (paint ?? hex).toLowerCase() === c.hex.toLowerCase();
                return (
                  <Pressable
                    key={c.value}
                    accessibilityLabel={`Cor ${c.value}`}
                    onPress={() => setPaint(c.hex)}
                    hitSlop={6}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: c.hex,
                      borderWidth: on ? 2 : 0,
                      borderColor: "#fff",
                    }}
                  >
                    {on && <Check size={13} color="#0B0B0B" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Ela já tem dinheiro?</Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedTabs
              value={hasBalance}
              onChange={setHasBalance}
              options={[
                { key: "nao" as const, label: "Começa zerada" },
                { key: "sim" as const, label: "Já tem saldo" },
              ]}
            />
          </View>
          {hasBalance === "sim" && (
            <>
              <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Quanto tem hoje</Text>
              <TextInput
                value={brl(cents)}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, "").slice(0, 11);
                  setCents(Math.min(Number(digits || "0"), 999999999));
                  setError(null);
                }}
                keyboardType="number-pad"
                style={{
                  marginTop: 8,
                  minWidth: 0,
                  fontSize: 34,
                  fontWeight: "800",
                  letterSpacing: -1.2,
                  color: cents === 0 ? INK.faint : "#fff",
                  padding: 0,
                }}
              />
              <Text style={{ marginTop: 6, fontSize: 11.5, lineHeight: 16, color: INK.softer }}>
                É o ponto de partida: daqui em diante o saldo muda com o que você registrar.
              </Text>
            </>
          )}

          {error && <Text style={{ marginTop: 16, fontSize: 13, color: RED }}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => ({
              marginTop: 24,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: saving ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
              {saving ? "Criando..." : "Criar conta"}
            </Text>
          </Pressable>
      </View>
    </BottomSheet>
  );
}
