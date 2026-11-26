import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { withPro } from "~/components/onboarding/RenewGate";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { resolveReceiptDate } from "@/lib/receiptDate";
import ScanResultCard, { type ScanAccount, type ScanItem } from "~/components/scan/ScanResultCard";
import BottomSheet from "~/components/BottomSheet";
import { type Card } from "~/components/registro/entryParts";
import TransactionExperience from "~/components/pass/TransactionExperience";
import { nowTime, passRows } from "~/components/pass/passTheme";
import RaisedButton from "~/components/RaisedButton";
import { colorFor } from "@/lib/banks";
import { preloadConfirm } from "~/lib/sounds";
import * as Crypto from "expo-crypto";
import { Camera, ChevronLeft, ImageIcon, PenLine, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { processScanPhoto, type PickedPhoto } from "~/lib/scanUpload";
import { INK } from "~/theme/tokens";

import { th as themed, thIn, useThemeRedraw, type Role } from "~/theme/theme";

/* The camera is the same in either theme: a dark picture with white words on it.
   Turning its words for the light theme made them dark on dark and unreadable. */
const th = <T,>(color: T, role?: Role): T => thIn("dark", color, role);
/**
 * A receipt, photographed and read — the phone's copy of the web's scanner.
 *
 * The camera stays inside the app, so the frame, the gallery and the manual form
 * are one screen. Once the picture is taken it fills the screen, dimmed and framed
 * while the reader works on it, and what it found comes up from the foot of the
 * screen over the photo, to be checked — and corrected in place — before anything
 * is written. A receipt that will not read says so and offers another photo or
 * the form, never a spinner left turning.
 */

type Phase = "camera" | "reading" | "result" | "failed" | "review";

function Scanner() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  /* Opened from a card: what is read is a purchase on it. */
  const { cartao } = useLocalSearchParams<{ cartao?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<ComponentRef<typeof CameraView>>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [failure, setFailure] = useState("");
  const [shooting, setShooting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [accounts, setAccounts] = useState<ScanAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const cardsRef = useRef<Card[]>([]);
  cardsRef.current = cards;
  /* What was written, as the receipt shows it, and when. */
  /* The ids the review writes the chosen lines under — fixed for the review, so a retry never doubles them. */
  const lineIds = useRef<string[]>([]);
  /* A reading the person walked away from must not land on the next photo. */
  const attempt = useRef(0);

  useEffect(() => {
    getAccounts()
      .then((list) => {
        const usable = (list as (ScanAccount & { type?: string })[]).filter((a) => a.type !== "investment");
        setAccounts(usable);
        setAccountId((usable.find((a) => a.is_default) ?? usable[0])?.id ?? null);
      })
      .catch(() => undefined);
    getCreditCards()
      .then((c) => setCards(c as unknown as Card[]))
      .catch(() => undefined);
  }, []);

  const read = useCallback(async (picked: PickedPhoto) => {
    const mine = ++attempt.current;
    setPhoto(picked.uri);
    setPhase("reading");
    try {
      const data = await processScanPhoto(picked, "transaction");
      if (mine !== attempt.current) return;
      const found: ScanItem[] = ((data.items ?? []) as ScanItem[]).map((item) => ({
        ...item,
        date: resolveReceiptDate(item.date),
        selected: true,
        ...(cartao ? { type: "despesa", payment_method: "cartao" as const, credit_card_id: cartao, status: "pendente" as const } : {}),
      })).map((item) => {
        /* A purchase in instalments is on a card. Opened from one, it is that card; otherwise
           the first card, to change in the check if it was another. */
        if (cartao || !(item.installment_total && item.installment_total > 1) || item.payment_method === "cartao") return item;
        const first = cardsRef.current[0]?.id ?? null;
        return { ...item, type: "despesa", payment_method: first ? ("cartao" as const) : item.payment_method, credit_card_id: first, status: "pendente" as const };
      });
      if (found.length === 0) {
        setFailure("Não encontramos nenhum valor nesse comprovante. Tente outra foto.");
        setPhase("failed");
        return;
      }
      setItems(found);
      setConfidence(data.avg_confidence ?? 0);
      setPhase("result");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      if (mine !== attempt.current) return;
      setFailure(err instanceof Error ? err.message : "Não foi possível ler o comprovante.");
      setPhase("failed");
    }
  }, [cartao]);

  const shoot = async () => {
    if (!camera.current || shooting) return;
    setShooting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.85 });
      if (shot?.uri) void read({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch {
      setFailure("Não consegui tirar a foto. Tente de novo.");
      setPhase("failed");
    } finally {
      setShooting(false);
    }
  };

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) void read({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const again = () => {
    attempt.current++;
    setPhoto(null);
    setItems([]);
    setFailure("");
    setPhase("camera");
  };

  const chosen = items.filter((i) => i.selected !== false);
  const confirm = () => {
    if (!user || chosen.length === 0) return;
    lineIds.current = [];
    preloadConfirm();
    setPhase("review");
  };

  /** Each chosen line written once — the first under the review's id — and only then the Pass. */
  const register = async (id: string) => {
    if (!user) throw new Error("signed out");
    setConfirming(true);
    try {
      if (lineIds.current.length !== chosen.length) lineIds.current = chosen.map((_, i) => (i === 0 ? id : Crypto.randomUUID()));
      let first: { id: string; time?: string | null } | null = null;
      for (const [i, item] of chosen.entries()) {
        const credit = item.type !== "receita" && item.payment_method === "cartao" && !!item.credit_card_id;
        const tx = (await createTransaction(
          {
            id: lineIds.current[i],
            name: item.merchant || item.description,
            type: (item.type as "receita" | "despesa") || "despesa",
            amount: item.amount,
            category: item.category || "outros",
            date: resolveReceiptDate(item.date),
            time: item.time || null,
            status: credit ? "pendente" : (item.status ?? "pago"),
            account_id: credit ? null : item.account_id || accountId,
            credit_card_id: credit ? item.credit_card_id : null,
            payment_method: credit ? "cartao" : "conta",
            recurrence_type: item.is_recurring
              ? "fixa"
              : item.installment_total && item.installment_total > 1
                ? "parcelado"
                : "unica",
            installments: item.installment_total || null,
            installment_current: item.installment_current || null,
          } as never,
          user.id,
        )) as { id: string; time?: string | null };
        first ??= tx;
      }
      window.dispatchEvent(new CustomEvent("transaction-created"));
      return { id: first!.id, time: first!.time ? String(first!.time).slice(0, 5) : nowTime() };
    } finally {
      setConfirming(false);
    }
  };

  /* What the review and the Pass show: the first line read (a receipt is nearly always one). */
  const lead = chosen[0];
  const leadCredit = !!lead && lead.type !== "receita" && lead.payment_method === "cartao" && !!lead.credit_card_id;
  const leadBank = lead
    ? leadCredit
      ? cards.find((c) => c.id === lead.credit_card_id)
      : accounts.find((a) => a.id === (lead.account_id || accountId))
    : null;
  const leadKind = lead?.type === "receita" ? ("receita" as const) : ("despesa" as const);

  /* Done: everything closes and the home is what is left. */
  const finish = () => (cartao ? router.back() : router.dismissTo("/" as never));

  const granted = permission?.granted ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: th("#000", "bg") }}>
      {/* ── What is in front of the lens, or what was taken ── */}
      {phase === "camera" ? (
        granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
        ) : null
      ) : photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={th(["rgba(0,0,0,0.6)", "transparent"], "grad")}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140 }}
      />

      {phase === "reading" && (
        <Animated.View
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: th("rgba(0,0,0,0.4)", "bg") }]}
        />
      )}

      {(phase === "reading" || (phase === "camera" && granted)) && (
        <Brackets
          top={insets.top + 66}
          bottom={phase === "reading" ? insets.bottom + 28 : insets.bottom + 128}
          sweep={phase === "reading"}
        />
      )}

      {/* ── Top: what to do, and the way out ── */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ width: 40 }} />
        {phase === "camera" && granted && (
          <View style={{ borderRadius: 999, backgroundColor: th("rgba(0,0,0,0.45)", "bg"), paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "500", color: th("#fff") }}>Aponte para o comprovante</Text>
          </View>
        )}
        <Pressable
          onPress={() => (phase === "reading" || phase === "failed" ? again() : router.back())}
          accessibilityLabel={phase === "reading" ? "Voltar à câmera" : "Fechar"}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: th("rgba(0,0,0,0.45)", "bg"),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={20} color={th("#fff")} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* ── No camera yet: ask, and offer the gallery meanwhile ── */}
      {phase === "camera" && !granted && permission && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 10 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
            }}
          >
            <Camera size={24} color={th("#fff")} />
          </View>
          <Text style={{ marginTop: 6, fontSize: 17, fontWeight: "600", color: th("#fff"), textAlign: "center" }}>
            {permission.canAskAgain ? "O Willo precisa da câmera" : "A câmera está bloqueada"}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: th(INK.soft), textAlign: "center" }}>
            {permission.canAskAgain
              ? "Para ler seus comprovantes e faturas. Você também pode escolher uma foto da galeria."
              : "Libere em Ajustes › Willo › Câmera, ou escolha uma foto da galeria."}
          </Text>
          <Pressable
            onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
            style={({ pressed }) => ({
              marginTop: 8,
              borderRadius: 999,
              backgroundColor: th("#fff", "bg"),
              paddingHorizontal: 20,
              paddingVertical: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: th("#000") }}>
              {permission.canAskAgain ? "Permitir câmera" : "Abrir Ajustes"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Camera controls ── */}
      {phase === "camera" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: insets.bottom + 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => void pick()}
              accessibilityLabel="Escolher da galeria"
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.15)", "line"),
                backgroundColor: th("rgba(0,0,0,0.45)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ImageIcon size={22} color={th("#fff")} strokeWidth={2} />
            </Pressable>

            <Pressable
              onPress={() => void shoot()}
              disabled={!granted || shooting}
              accessibilityLabel="Tirar foto"
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: th("rgba(255,255,255,0.85)", "line"),
                opacity: !granted || shooting ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: th("#fff", "bg") }} />
            </Pressable>

            {/* Typed by hand instead: across from the gallery, so the shutter sits dead centre
                and the frame can run down to it. */}
            <Pressable
              onPress={() => router.replace((cartao ? `/manual?cartao=${cartao}` : "/manual") as never)}
              accessibilityLabel="Adicionar manualmente"
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.15)", "line"),
                backgroundColor: th("rgba(0,0,0,0.45)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <PenLine size={21} color={th("#fff")} strokeWidth={2.1} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Reading ── */}
      {phase === "reading" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 120, alignItems: "center" }}>
          <StatusPill label="Lendo o comprovante…" />
        </View>
      )}

      {/* ── It would not read ── */}
      {phase === "failed" && (
        <Animated.View
          entering={SlideInDown.springify().damping(30).stiffness(260)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: th("#000", "bg"),
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: insets.bottom + 20,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: th("#fff") }}>Não deu para ler</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>{failure}</Text>
          <Pressable
            onPress={again}
            style={({ pressed }) => ({
              marginTop: 8,
              height: 52,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th("#fff", "bg"),
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: th("#0B0B0B") }}>Tentar outra foto</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/manual" as never)}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: th("rgba(255,255,255,0.18)", "line"),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Digitar manualmente</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── What it found, to check before it is written, and then the receipt: one sheet,
          the app's own, rising softly over the photo. One, not two: the phone will not
          bring up a second sheet while the first is still leaving, so the receipt never
          came and the screen was left stuck on the photo. Pulled down while checking, it
          goes back to the camera; once written, it is done. ── */}
      <BottomSheet open={phase === "result" || phase === "review"} full={phase === "review"} onClose={phase === "review" ? () => !confirming && finish() : again}>
        {phase === "review" && lead ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
            <TransactionExperience
              data={{
                kind: leadKind,
                amount: chosen.length > 1 ? chosen.reduce((n, i) => n + (Number(i.amount) || 0), 0) : lead.amount,
                title: chosen.length > 1 ? `${lead.merchant || lead.description} e mais ${chosen.length - 1}` : lead.merchant || lead.description,
                category: lead.category || "Outros",
                rows: passRows({
                  kind: leadKind,
                  category: lead.category || "Outros",
                  bank: leadBank ? { name: leadBank.name, hex: colorFor(leadBank.name, (leadBank as { color?: string | null }).color ?? null) } : null,
                  method: leadCredit ? "cartao" : "conta",
                  installments: lead.installment_total || null,
                  date: resolveReceiptDate(lead.date),
                }),
              }}
              onConfirm={register}
              onDone={finish}
              links={[
                { icon: "escanear", label: "Escanear outro", onPress: again },
                { icon: "transacoes", label: cartao ? "Ver na fatura" : "Ver transações", onPress: () => (cartao ? router.replace(`/fatura/${cartao}/lancamentos` as never) : router.dismissTo("/transacoes" as never)) },
              ]}
              left={
                <RaisedButtonBack onPress={() => !confirming && setPhase("result")} />
              }
            />
          </View>
        ) : (
          <ScanResultCard
            items={items}
            onItemsChange={setItems}
            accounts={accounts}
            cards={cards}
            accountId={accountId}
            onAccountChange={setAccountId}
            lowConfidence={confidence > 0 && confidence < 0.7}
            confirming={confirming}
            onConfirm={confirm}
          />
        )}
      </BottomSheet>
    </View>
  );
}

/** Four white corners framing what is being read, breathing slowly; a soft light passes inside while it reads. */
function Brackets({ top, bottom, sweep }: { top: number; bottom: number; sweep: boolean }) {
  const breath = useSharedValue(0);
  const pass = useSharedValue(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [breath]);

  useEffect(() => {
    pass.set(
      sweep
        ? withRepeat(
            withSequence(
              withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
              withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
            undefined,
            ReduceMotion.System,
          )
        : 0,
    );
  }, [sweep, pass]);

  const frame = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.get() * 0.02 }] }));
  const light = useAnimatedStyle(() => ({ transform: [{ translateY: pass.get() * Math.max(0, height - 64) }] }));

  const corner = { position: "absolute" as const, width: 48, height: 48, borderColor: th("#fff", "line") };

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(300)}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[{ position: "absolute", left: "9%", right: "9%", top, bottom }, frame]}
    >
      <View style={[corner, { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 18 }]} />
      <View style={[corner, { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 18 }]} />
      <View style={[corner, { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 18 }]} />
      <View style={[corner, { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 18 }]} />
      {sweep && (
        <Animated.View style={[{ position: "absolute", left: 12, right: 12, top: 0, height: 64 }, light]}>
          <LinearGradient colors={th(["transparent", "rgba(255,255,255,0.08)", "transparent"], "grad")} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** Black pill with a pulsing dot: "LENDO O COMPROVANTE…". */
function StatusPill({ label }: { label: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(
      withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: 0.3 + pulse.get() * 0.7 }));

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.10)", "line"),
        backgroundColor: th("rgba(0,0,0,0.85)", "bg"),
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: th("#fff", "bg") }, dot]} />
      <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 2.4, textTransform: "uppercase", color: th("#fff") }}>{label}</Text>
    </Animated.View>
  );
}

export default withPro(Scanner);

/** Back to the lines read, from the Willo review. */
function RaisedButtonBack({ onPress }: { onPress: () => void }) {
  return (
    <RaisedButton size={46} label="Voltar" onPress={onPress}>
      <ChevronLeft size={21} color={themed("#fff")} strokeWidth={2.4} />
    </RaisedButton>
  );
}
