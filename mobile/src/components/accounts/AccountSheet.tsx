import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createAccount } from "@/services/transactionService";
import { PALETTE } from "@/lib/banks";
import { CATALOG, POPULAR, type CatalogBank } from "~/lib/bankCatalog";
import StepSheet, { Ask } from "~/components/StepSheet";
import Created from "~/components/accounts/Created";
import BankMark from "~/components/BankMark";
import { Banknote, Check, Landmark, PiggyBank, Plus, TrendingUp } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Opening an account, one question at a time.
 *
 * Which bank — the logos first, because that is how you find yours — then what kind of
 * account it is and what to call it, then what is in it today. An account opened with a
 * balance the app does not know about would start wrong and stay wrong, so that is
 * asked rather than assumed; but "zero" is one tap.
 */

export type Kind = "checking" | "savings" | "cash" | "investment";

export const KINDS: { key: Kind; label: string; note: string; icon: typeof Landmark }[] = [
  { key: "checking", label: "Conta corrente", note: "O dia a dia", icon: Landmark },
  { key: "savings", label: "Poupança", note: "Guardado no banco", icon: PiggyBank },
  { key: "investment", label: "Investimento", note: "Corretora, renda fixa", icon: TrendingUp },
  { key: "cash", label: "Dinheiro", note: "Carteira, em casa", icon: Banknote },
];

const MORE = CATALOG.filter((b) => !POPULAR.includes(b));
const OTHER_HEX = "#7C8AA5";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FIELD = {
  height: 54,
  minWidth: 0,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
  paddingHorizontal: 18,
  fontSize: 17,
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
  const [step, setStep] = useState(0);
  const [bank, setBank] = useState<CatalogBank | null>(null);
  /* A bank that is not in the list: typed, and given a colour. */
  const [other, setOther] = useState(false);
  const [typed, setTyped] = useState("");
  const [paint, setPaint] = useState(PALETTE[1].hex);
  const [kind, setKind] = useState<Kind>("checking");
  const [name, setName] = useState("");
  /* Once the person has written a name it is theirs; until then it follows the bank. */
  const [named, setNamed] = useState(false);
  const [cents, setCents] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; hex: string; balance: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setBank(null);
    setOther(false);
    setTyped("");
    setPaint(PALETTE[1].hex);
    setKind("checking");
    setName("");
    setNamed(false);
    setCents(0);
    setSaving(false);
    setError(null);
    setMade(null);
  }, [open]);

  const wallet = bank?.id === "wallet";

  /* The wallet is cash by nature; any other choice puts that back to the usual. */
  const choose = (next: CatalogBank | null) => {
    setBank(next);
    if (next?.id === "wallet") setKind("cash");
    else if (wallet) setKind("checking");
  };

  const hex = bank?.hex ?? (other ? paint : OTHER_HEX);
  const chosen = bank?.name ?? typed.trim();

  const next = async () => {
    setError(null);
    if (step === 0) {
      /* The bank names the account, unless a name was written for it by hand. */
      if (!named) setName(chosen);
      setStep(wallet ? 2 : 1);
      return;
    }
    if (step === 1) {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        setError("Dê um nome à conta.");
        return;
      }
      if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
        setError("Você já tem uma conta com esse nome.");
        return;
      }
      setStep(2);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await createAccount(user.id, {
        name: name.trim(),
        type: kind,
        initial_balance: cents / 100,
        color: hex,
      });
      setMade({ name: name.trim(), hex, balance: cents / 100 });
      onCreated();
    } catch {
      setError("Não foi possível criar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? !!bank || (other && typed.trim().length >= 2) : step === 1 ? name.trim().length >= 2 : true;

  return (
    <StepSheet
      open={open}
      onClose={onClose}
      step={wallet && step === 2 ? 1 : step}
      steps={wallet ? 2 : 3}
      onBack={() => setStep(wallet ? 0 : Math.max(step - 1, 0))}
      onNext={next}
      nextLabel={step === 2 ? "Criar conta" : "Continuar"}
      nextDisabled={!canNext}
      busy={saving}
      done={
        made ? (
          <Created
            accent={made.hex}
            mark={<BankMark name={made.name} hex={made.hex} size={96} />}
            title="Conta criada"
            subtitle={
              made.balance > 0
                ? `${made.name} já está nas suas contas, com ${money(made.balance)}.`
                : `${made.name} já está nas suas contas.`
            }
            onClose={onClose}
          />
        ) : null
      }
    >
      {step === 0 && !other && (
        <View style={{ flex: 1 }}>
          <Ask title="Qual é o banco?" note="Toque no seu. Se não estiver aqui, use Outro banco." />
          <View style={{ marginTop: 22, flexDirection: "row", flexWrap: "wrap", rowGap: 14 }}>
            {POPULAR.map((b) => (
              <Tile key={b.id} label={b.id === "bb" ? "B. do Brasil" : b.name} on={bank?.id === b.id} onPress={() => choose(bank?.id === b.id ? null : b)}>
                <BankMark name={b.name} hex={b.hex} size={58} />
              </Tile>
            ))}
            <Tile
              label="Outro banco"
              on={false}
              onPress={() => {
                choose(null);
                setOther(true);
              }}
            >
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Plus size={22} color="#fff" strokeWidth={2.2} />
              </View>
            </Tile>
          </View>
        </View>
      )}

      {step === 0 && other && (
        <View style={{ flex: 1 }}>
          <Ask title="Qual banco?" note="Escolha entre os outros ou escreva o nome do seu." />
          <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {MORE.map((b) => {
              const on = bank?.id === b.id;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    choose(on ? null : b);
                    setTyped(on ? "" : b.name);
                  }}
                  style={({ pressed }) => ({
                    height: 42,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingLeft: 5,
                    paddingRight: 14,
                    borderRadius: 21,
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                    backgroundColor: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <BankMark name={b.name} hex={b.hex} size={32} />
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{b.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Ou escreva o nome</Text>
          <TextInput
            value={typed}
            onChangeText={(t) => {
              setTyped(t);
              choose(CATALOG.find((b) => b.name.toLowerCase() === t.trim().toLowerCase()) ?? null);
            }}
            placeholder="Ex: Banco Digital, Cooperativa"
            placeholderTextColor={INK.faint}
            maxLength={40}
            style={{ ...FIELD, marginTop: 8 }}
          />

          {!bank && (
            <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BankMark name={typed.trim() || "?"} hex={paint} size={36} />
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
                {PALETTE.map((c) => {
                  const on = paint.toLowerCase() === c.hex.toLowerCase();
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
            </View>
          )}

          <Pressable
            onPress={() => {
              setOther(false);
              choose(null);
              setTyped("");
            }}
            hitSlop={10}
            style={{ marginTop: 18, alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>‹ Voltar à lista</Text>
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={{ flex: 1 }}>
          <Ask title="Que tipo de conta é?" />
          <View style={{ marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              const Icon = k.icon;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={({ pressed }) => ({
                    width: "48.4%",
                    borderRadius: 22,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                    backgroundColor: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                    padding: 14,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Icon size={20} color={on ? "#fff" : INK.soft} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: "#fff" }}>
                    {k.label}
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.softer }}>
                    {k.note}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Como quer chamar</Text>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BankMark name={name.trim() || chosen || "?"} hex={hex} size={54} />
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNamed(true);
                setError(null);
              }}
              placeholder="Nome da conta"
              placeholderTextColor={INK.faint}
              maxLength={40}
              style={{ ...FIELD, flex: 1 }}
            />
          </View>
          {error && <Text style={{ marginTop: 10, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}

      {step === 2 && (
        <View style={{ flex: 1 }}>
          <Ask
            title={wallet ? "Quanto tem em dinheiro?" : "Quanto tem nela hoje?"}
            note={
              wallet
                ? "Em espécie, na carteira ou em casa. É o ponto de partida: daqui em diante muda com o que você registrar."
                : "É o ponto de partida do saldo. Daqui em diante ele muda com o que você registrar."
            }
          />
          <View style={{ marginTop: 26, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BankMark name={name.trim() || chosen} hex={hex} size={44} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "#fff" }}>
              {name.trim()}
            </Text>
          </View>
          <TextInput
            value={brl(cents)}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, "").slice(0, 11);
              setCents(Math.min(Number(digits || "0"), 999999999));
              setError(null);
            }}
            keyboardType="number-pad"
            style={{
              marginTop: 18,
              minWidth: 0,
              fontSize: 44,
              fontWeight: "800",
              letterSpacing: -1.6,
              color: cents === 0 ? INK.faint : "#fff",
              padding: 0,
            }}
          />
          <Pressable onPress={() => setCents(0)} hitSlop={10} style={{ marginTop: 14, alignSelf: "flex-start", opacity: cents === 0 ? 0.4 : 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>Começar zerada</Text>
          </Pressable>
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}
    </StepSheet>
  );
}

/** A mark and its name, as a cell of the grid; the chosen one is ringed. */
function Tile({ label, on, onPress, children }: { label: string; on: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: "25%", alignItems: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <View style={{ padding: 3, borderRadius: 24, borderWidth: 2, borderColor: on ? "#fff" : "transparent" }}>{children}</View>
      <Text numberOfLines={1} style={{ marginTop: 6, maxWidth: "100%", paddingHorizontal: 2, fontSize: 11.5, fontWeight: on ? "700" : "500", color: on ? "#fff" : INK.soft }}>
        {label}
      </Text>
    </Pressable>
  );
}
