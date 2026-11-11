import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { importStatement, type ImportableItem } from "@/services/invoiceImport";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import Surface from "~/components/Surface";
import BottomSheet from "~/components/BottomSheet";
import CategoryPicker from "~/components/CategoryPicker";
import { FlexBar } from "~/components/Bar";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Pencil, Trash2 } from "~/components/icons";
import { Primary } from "~/components/registro/entryParts";
import { categoryIcon } from "~/lib/categoryIcon";
import { fitReceiptCategories } from "~/lib/receiptCategory";
import { processScanDocument, type ScanResult } from "~/lib/scanUpload";
import { takeStatement, type StatementDraft } from "~/lib/statementDraft";
import { playCash, preloadCash } from "~/lib/sounds";
import { sparkle } from "~/lib/sparkles";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th, useThemeRedraw } from "~/theme/theme";

/**
 * A card statement, read whole.
 *
 * The file goes up and the screen says what the reader is doing while it works. What it
 * found comes back as the statement itself: what it adds up to, how that splits by
 * category, and every line under it. Editar turns the list into something to correct —
 * a touch opens a line to change its name, amount, category or day, and a line that does
 * not belong is taken out. Confirmar writes them on the invoice, and a short receipt says
 * what went in.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const STEPS = ["Abrindo o arquivo…", "Separando cada compra…", "Encontrando parcelas e estornos…", "Somando o total…"];

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

interface Line extends ImportableItem {
  key: string;
}

type Phase = "reading" | "review" | "done" | "failed";

const shortDay = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "") : "—";

export default function ImportStatement() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [draft] = useState<StatementDraft | null>(() => takeStatement());
  const [phase, setPhase] = useState<Phase>("reading");
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [failure, setFailure] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Line | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ at: Date; lines: Line[] } | null>(null);
  const started = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/" as never));

  useEffect(() => {
    if (!draft) {
      back();
      return;
    }
    if (started.current) return;
    started.current = true;
    preloadCash();
    void (async () => {
      try {
        const data = await processScanDocument(draft.picked, "invoice");
        const found = fitReceiptCategories(((data.items ?? []) as ImportableItem[]).map((item) => ({ ...item, type: "despesa" }))).map(
          ({ type: _t, ...item }, i) => ({ ...(item as ImportableItem), key: `l${i}` }),
        );
        const carried = Number(data.carried_over);
        if (Number.isFinite(carried) && Math.abs(carried) >= 0.5) {
          found.push({
            key: "carry",
            description: carried < 0 ? "Crédito da fatura anterior" : "Saldo da fatura anterior",
            amount: Math.round(carried * 100) / 100,
            date: `${draft.year}-${String(draft.month).padStart(2, "0")}-01`,
            installment_current: null,
            installment_total: null,
            category: "Outros",
            is_carry: true,
          });
        }
        if (found.length === 0) {
          setFailure("Não encontrei nenhuma compra nesse arquivo. Confira se é a fatura do cartão e tente de novo.");
          setPhase("failed");
          return;
        }
        setScan(data);
        setLines(found);
        setPhase("review");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : "Não foi possível ler a fatura.");
        setPhase("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = useMemo(() => lines.reduce((s, l) => s + Number(l.amount), 0), [lines]);
  const declared = scan?.declared_total ?? null;
  const matches = declared != null && Math.abs(declared - sum) < 0.05;

  /* How the statement splits, by category: the bar, and the four largest named. */
  const split = useMemo(() => {
    const by = new Map<string, number>();
    for (const l of lines) if (Number(l.amount) > 0) by.set(l.category || "Outros", (by.get(l.category || "Outros") ?? 0) + Number(l.amount));
    return [...by.entries()].map(([name, amount]) => ({ name, amount, hex: categoryHex(name) })).sort((a, b) => b.amount - a.amount);
  }, [lines]);
  const spent = split.reduce((s, c) => s + c.amount, 0);

  const confirm = async () => {
    if (!user || !draft || lines.length === 0) return;
    setSaving(true);
    try {
      await importStatement({
        userId: user.id,
        card: { id: draft.card.id, dueDay: draft.card.dueDay },
        month: draft.month,
        year: draft.year,
        items: lines.map(({ key: _k, ...rest }) => rest),
        documentHash: null,
        documentName: draft.picked.name ?? null,
        declared: {
          cardLimit: scan?.declared_card_limit ?? null,
          usedLimit: scan?.declared_used_limit ?? null,
          total: scan?.declared_total ?? null,
          nextClosing: scan?.declared_next_invoice ?? null,
        },
      });
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      setSaved({ at: new Date(), lines });
      setEditing(false);
      setPhase("done");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Não foi possível importar.");
      setPhase("failed");
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return <Room />;
  const monthName = MONTHS[draft.month - 1];

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + (phase === "review" ? 130 : 40), paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back, and which invoice. */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundButton label="Voltar" onPress={back}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.4} />
          </RoundButton>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>
              Fatura de {monthName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.soft) }}>
              {draft.card.name}
              {draft.picked.name ? ` · ${draft.picked.name}` : ""}
            </Text>
          </View>
        </View>

        {phase === "reading" && <Reading />}

        {phase === "failed" && (
          <Animated.View entering={FadeIn.duration(240)} style={{ marginTop: 80, alignItems: "center", paddingHorizontal: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(248,113,113,0.14)", "bg") }}>
              <AlertTriangle size={28} color={th(RED)} />
            </View>
            <Text style={{ marginTop: 16, fontSize: 19, fontWeight: "800", color: th("#fff") }}>Não deu para ler</Text>
            <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, textAlign: "center", color: th(INK.soft) }}>{failure}</Text>
            <View style={{ alignSelf: "stretch", marginTop: 10 }}>
              <Primary label="Voltar ao cartão" onPress={back} />
            </View>
          </Animated.View>
        )}

        {phase === "review" && (
          <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 18 }}>
            {/* What it adds up to, and how it splits. */}
            <Surface radius={26} style={{ padding: 18 }}>
              <Text style={T.cardLabel}>Total encontrado</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[nums, { marginTop: 4, fontSize: 38, fontWeight: "800", letterSpacing: -1.4, color: th("#fff") }]}>
                {money(sum)}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
                {lines.length} {lines.length === 1 ? "lançamento" : "lançamentos"} para a fatura de {monthName}
              </Text>
              {declared != null && (
                <View
                  style={{
                    marginTop: 12,
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: th(matches ? "rgba(103,205,103,0.14)" : "rgba(249,206,78,0.14)", "bg"),
                  }}
                >
                  {matches ? <Check size={13} color={th(GREEN)} strokeWidth={3} /> : <AlertTriangle size={13} color={th("#F9CE4E")} />}
                  <Text style={[nums, { fontSize: 12.5, fontWeight: "600", color: th(matches ? GREEN : "#F9CE4E") }]}>
                    {matches ? "Bate com o total do banco" : `O banco diz ${money(declared)}`}
                  </Text>
                </View>
              )}

              {spent > 0 && (
                <>
                  <View style={{ marginTop: 16, flexDirection: "row", gap: 3, height: 8 }}>
                    {split.map((c, i) => (
                      <FlexBar key={c.name} share={c.amount / spent} color={c.hex} delay={0.04 * i} minWidth={4} />
                    ))}
                  </View>
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {split.slice(0, 4).map((c) => (
                      <View key={c.name} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(c.hex, "bg") }} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: th(INK.soft) }}>{c.name}</Text>
                        <Text style={[nums, { fontSize: 13.5, fontWeight: "600", color: th("#fff") }]}>{money(c.amount)}</Text>
                      </View>
                    ))}
                    {split.length > 4 && (
                      <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>
                        e mais {split.length - 4} {split.length - 4 === 1 ? "categoria" : "categorias"}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </Surface>

            {/* Every line. */}
            <View style={{ marginTop: 22, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <Text style={T.eyebrow}>Lançamentos</Text>
              {editing && <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Toque para editar</Text>}
            </View>
            <Surface radius={22} style={{ paddingHorizontal: 14 }}>
              {lines.map((line, i) => (
                <Animated.View key={line.key} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(160)}>
                  <Row
                    line={line}
                    first={i === 0}
                    editing={editing}
                    onPress={() => editing && setOpen(line)}
                    onRemove={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  />
                </Animated.View>
              ))}
            </Surface>
          </Animated.View>
        )}

        {phase === "done" && saved && (
          <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 22 }}>
            <Summary draft={draft} lines={saved.lines} at={saved.at} />
            <Primary label="Concluir" onPress={back} />
            <Pressable
              onPress={() => router.replace(`/fatura/${draft.card.id}/lancamentos` as never)}
              style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}>Ver lançamentos da fatura</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Edit or confirm, held at the foot. */}
      {phase === "review" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
          <LinearGradient
            pointerEvents="none"
            colors={th(["rgba(10,11,14,0)", "rgba(10,11,14,0.92)"], "grad")}
            style={{ position: "absolute", left: 0, right: 0, top: -24, bottom: 0 }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setEditing((v) => !v)}
              style={({ pressed }) => ({
                height: 54,
                paddingHorizontal: 18,
                borderRadius: 27,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.16)", "line"),
                backgroundColor: th(editing ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {editing ? <Check size={17} color={th("#fff")} strokeWidth={2.6} /> : <Pencil size={16} color={th("#fff")} />}
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>{editing ? "Pronto" : "Editar"}</Text>
            </Pressable>
            <Pressable
              onPress={() => void confirm()}
              disabled={saving || lines.length === 0}
              style={({ pressed }) => ({
                flex: 1,
                height: 54,
                borderRadius: 27,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("#fff", "bg"),
                opacity: saving || lines.length === 0 ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>
                {saving ? "Confirmando…" : `Confirmar ${lines.length}`}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <LineEditor
        line={open}
        onClose={() => setOpen(null)}
        onSave={(next) => {
          setLines((all) => all.map((l) => (l.key === next.key ? next : l)));
          setOpen(null);
        }}
        onRemove={(key) => {
          setLines((all) => all.filter((l) => l.key !== key));
          setOpen(null);
        }}
      />
    </Room>
  );
}

/** One line of the statement: its category's mark, what it was, when and in which part, how much. */
function Row({ line, first, editing, onPress, onRemove }: { line: Line; first: boolean; editing: boolean; onPress: () => void; onRemove: () => void }) {
  const Icon = categoryIcon(line.category || "Outros");
  const hex = categoryHex(line.category || "Outros");
  const refund = Number(line.amount) < 0;
  const parts = line.installment_total && line.installment_total > 1 ? ` · ${line.installment_current ?? 1} de ${line.installment_total}` : "";
  return (
    <Pressable
      onPress={onPress}
      disabled={!editing}
      style={({ pressed }) => ({
        minHeight: 62,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: th("rgba(255,255,255,0.06)", "line"),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: th(`${hex}26`, "bg") }}>
        <Icon size={17} color={th(hex)} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 10 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>{line.description}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
          {shortDay(line.date)}
          {parts} · {line.category || "Outros"}
        </Text>
      </View>
      <Text style={[nums, { fontSize: 15, fontWeight: "700", color: th(refund ? GREEN : "#fff") }]}>
        {refund ? "+" : ""}
        {money(Math.abs(Number(line.amount)))}
      </Text>
      {editing && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel={`Tirar ${line.description}`}
          hitSlop={8}
          style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(248,113,113,0.14)", "bg"), opacity: pressed ? 0.6 : 1 })}
        >
          <Trash2 size={15} color={th(RED)} />
        </Pressable>
      )}
      {editing && <ChevronRight size={15} color={th(INK.softer)} />}
    </Pressable>
  );
}

/** One line opened: its name, amount, category and day, or taken out. */
function LineEditor({ line, onClose, onSave, onRemove }: { line: Line | null; onClose: () => void; onSave: (line: Line) => void; onRemove: (key: string) => void }) {
  const [draft, setDraft] = useState<Line | null>(line);
  const [cents, setCents] = useState(0);
  const [day, setDay] = useState("");
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!line) return;
    setDraft(line);
    setCents(Math.round(Math.abs(Number(line.amount)) * 100));
    setDay(line.date ? line.date.split("-").reverse().join("/") : "");
  }, [line]);

  const refund = !!draft && Number(draft.amount) < 0;
  const save = () => {
    if (!draft) return;
    const m = day.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : draft.date;
    onSave({ ...draft, amount: (refund ? -1 : 1) * (cents / 100), date });
  };

  const field = { height: 52, borderRadius: 18, paddingHorizontal: 16, fontSize: 16.5, fontWeight: "600" as const, color: th("#fff"), backgroundColor: th("rgba(255,255,255,0.06)", "bg") };
  const label = { marginTop: 14, marginBottom: 6, fontSize: 12.5, fontWeight: "600" as const, color: th(INK.soft) };
  const CatIcon = categoryIcon(draft?.category || "Outros");

  return (
    <BottomSheet open={!!line} onClose={onClose}>
      {draft && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          <Text style={{ fontSize: 21, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Editar lançamento</Text>
          {draft.installment_total && draft.installment_total > 1 ? (
            <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
              Parcela {draft.installment_current ?? 1} de {draft.installment_total}
            </Text>
          ) : null}

          <Text style={label}>Descrição</Text>
          <TextInput value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} maxLength={60} style={field} />

          <Text style={label}>{refund ? "Valor do estorno" : "Valor"}</Text>
          <TextInput
            value={money(cents / 100)}
            onChangeText={(t) => setCents(Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999))}
            keyboardType="number-pad"
            style={[nums, field, { fontSize: 22, fontWeight: "800" }]}
          />

          <Text style={label}>Categoria</Text>
          <Pressable
            onPress={() => setPicking(true)}
            style={({ pressed }) => ({ ...field, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}
          >
            <CatIcon size={17} color={th(categoryHex(draft.category || "Outros"))} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: "600", color: th("#fff") }}>{draft.category || "Outros"}</Text>
            <ChevronRight size={16} color={th(INK.softer)} />
          </Pressable>

          <Text style={label}>Data</Text>
          <TextInput value={day} onChangeText={setDay} placeholder="dd/mm/aaaa" placeholderTextColor={th(INK.faint)} keyboardType="numbers-and-punctuation" style={[nums, field]} />

          <Primary label="Salvar" onPress={save} disabled={cents <= 0 || !draft.description.trim()} />
          <Pressable
            onPress={() => onRemove(draft.key)}
            style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Trash2 size={15} color={th(RED)} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: th(RED) }}>Tirar da importação</Text>
          </Pressable>

          <CategoryPicker
            open={picking}
            type="despesa"
            value={draft.category ?? ""}
            onPick={(category) => {
              setPicking(false);
              setDraft({ ...draft, category });
            }}
            onClose={() => setPicking(false)}
          />
        </View>
      )}
    </BottomSheet>
  );
}

/** The reader at work: a page with a light passing down it, and what it is doing now. */
function Reading() {
  const pass = useSharedValue(0);
  const breath = useSharedValue(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    pass.set(withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1, false, undefined, ReduceMotion.System));
    breath.set(withRepeat(withSequence(withTiming(1, { duration: 1200 }), withTiming(0, { duration: 1200 })), -1, false, undefined, ReduceMotion.System));
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, [pass, breath]);

  const light = useAnimatedStyle(() => ({ transform: [{ translateY: pass.get() * 150 }] }));
  const page = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.get() * 0.02 }] }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 70, alignItems: "center" }}>
      <Animated.View
        style={[
          {
            width: 150,
            height: 190,
            borderRadius: 22,
            borderCurve: "continuous",
            overflow: "hidden",
            borderWidth: 1,
            borderColor: th("rgba(255,255,255,0.14)", "line"),
            backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
            padding: 18,
            gap: 10,
          },
          page,
        ]}
      >
        <FileText size={26} color={th("rgba(255,255,255,0.85)")} strokeWidth={1.8} />
        {[0.9, 0.7, 0.8, 0.55, 0.75, 0.6].map((w, i) => (
          <View key={i} style={{ width: `${w * 100}%`, height: 7, borderRadius: 4, backgroundColor: th("rgba(255,255,255,0.12)", "bg") }} />
        ))}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, height: 40 }, light]}>
          <LinearGradient colors={th(["transparent", "rgba(103,205,103,0.35)", "transparent"], "grad")} style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
      <Text style={{ marginTop: 26, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>Lendo sua fatura</Text>
      <Animated.Text key={step} entering={FadeIn.duration(300)} style={{ marginTop: 6, fontSize: 14.5, color: th(INK.soft) }}>
        {STEPS[step]}
      </Animated.Text>
      <View style={{ marginTop: 16, flexDirection: "row", gap: 6 }}>
        {STEPS.map((_, i) => (
          <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: th(i <= step ? "#fff" : "rgba(255,255,255,0.2)", "bg") }} />
        ))}
      </View>
      <Text style={{ marginTop: 18, fontSize: 12.5, color: th(INK.softer) }}>Uma fatura inteira leva alguns segundos.</Text>
    </Animated.View>
  );
}

/** The short receipt of what went on the invoice. */
function Summary({ draft, lines, at }: { draft: StatementDraft; lines: Line[]; at: Date }) {
  const charges = lines.filter((l) => Number(l.amount) > 0);
  const refunds = lines.filter((l) => Number(l.amount) < 0);
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);
  const instalments = lines.filter((l) => l.installment_total && l.installment_total > 1).length;
  const top = useMemo(() => {
    const by = new Map<string, number>();
    for (const l of charges) by.set(l.category || "Outros", (by.get(l.category || "Outros") ?? 0) + Number(l.amount));
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [charges]);
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
    const t = setTimeout(() => {
      playCash();
      sparkle();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, 380);
    return () => clearTimeout(t);
  }, [pop]);
  const seal = useAnimatedStyle(() => ({ opacity: pop.get(), transform: [{ scale: 0.5 + pop.get() * 0.5 }] }));

  const ink = "#121317";
  const dim = "rgba(18,19,23,0.52)";
  const row = (label: string, value: string, key?: string) => (
    <View key={key ?? label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 5 }}>
      <Text style={{ fontSize: 14, color: dim }}>{label}</Text>
      <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 14, fontWeight: "700", color: ink }]}>{value}</Text>
    </View>
  );

  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>Fatura atualizada</Text>
      <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
        Importado pelo Willo às {at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <View style={{ marginTop: 34, borderRadius: 24, borderCurve: "continuous", backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 34, paddingBottom: 18 }}>
        <Animated.View style={[{ position: "absolute", top: -26, alignSelf: "center", width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#1B1D22", borderWidth: 3, borderColor: GREEN }, seal]}>
          <Check size={24} color={GREEN} strokeWidth={3.2} />
        </Animated.View>
        <Text style={{ alignSelf: "center", fontSize: 11.5, fontWeight: "700", letterSpacing: 3, color: dim }}>ADICIONADO À FATURA</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[nums, { marginTop: 8, alignSelf: "center", fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: ink }]}>
          {money(total)}
        </Text>
        <Text style={{ alignSelf: "center", marginTop: 2, fontSize: 14, fontWeight: "600", color: ink }}>
          {draft.card.name} · fatura de {MONTHS[draft.month - 1]}
        </Text>
        <View style={{ marginVertical: 14, height: 1, borderStyle: "dashed", borderWidth: 1, borderColor: "rgba(18,19,23,0.16)" }} />
        {row("Compras", `${charges.length}`)}
        {instalments > 0 && row("Parceladas", `${instalments}`)}
        {refunds.length > 0 && row("Estornos", `+${money(Math.abs(refunds.reduce((s, l) => s + Number(l.amount), 0)))}`)}
        {top.map(([name, amount]) => row(name, money(amount), `c-${name}`))}
        <Text style={{ marginTop: 12, alignSelf: "flex-end", fontSize: 12, color: dim }}>Registrado pelo Willo</Text>
      </View>
    </View>
  );
}
