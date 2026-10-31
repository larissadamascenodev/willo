import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
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
  ZoomIn,
} from "react-native-reanimated";
import { createTransaction, getAccounts } from "@/services/transactionService";
import { resolveReceiptDate } from "@/lib/receiptDate";
import ScanResultCard, { type ScanAccount, type ScanItem } from "~/components/scan/ScanResultCard";
import { Camera, Check, ImageIcon, PenLine, X } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { processScanPhoto, type PickedPhoto } from "~/lib/scanUpload";
import { GREEN, INK } from "~/theme/tokens";

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

type Phase = "camera" | "reading" | "result" | "failed" | "saved";

export default function Scanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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
  const [savedCount, setSavedCount] = useState(0);
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
      }));
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
  }, []);

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

  const confirm = async () => {
    const chosen = items.filter((i) => i.selected !== false);
    if (!user || chosen.length === 0) return;
    setConfirming(true);
    try {
      for (const item of chosen) {
        await createTransaction(
          {
            name: item.description,
            type: (item.type as "receita" | "despesa") || "despesa",
            amount: item.amount,
            category: item.category || "outros",
            date: resolveReceiptDate(item.date),
            time: item.time || null,
            status: "pago",
            account_id: item.account_id || accountId,
            payment_method: "conta",
            recurrence_type: item.is_recurring
              ? "fixa"
              : item.installment_total && item.installment_total > 1
                ? "parcelado"
                : "unica",
            installments: item.installment_total || null,
            installment_current: item.installment_current || null,
          } as never,
          user.id,
        );
      }
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setSavedCount(chosen.length);
      setPhase("saved");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Não consegui salvar agora.");
      setPhase("failed");
    } finally {
      setConfirming(false);
    }
  };

  const granted = permission?.granted ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
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
        colors={["rgba(0,0,0,0.6)", "transparent"]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140 }}
      />

      {phase === "reading" && (
        <Animated.View
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]}
        />
      )}

      {(phase === "reading" || (phase === "camera" && granted)) && (
        <Brackets top={insets.top + 86} bottom={insets.bottom + 210} sweep={phase === "reading"} />
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
          <View style={{ borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#fff" }}>Aponte para o comprovante</Text>
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
            backgroundColor: "rgba(0,0,0,0.45)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={20} color="#fff" strokeWidth={2.2} />
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
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Camera size={24} color="#fff" />
          </View>
          <Text style={{ marginTop: 6, fontSize: 17, fontWeight: "600", color: "#fff", textAlign: "center" }}>
            {permission.canAskAgain ? "O Willo precisa da câmera" : "A câmera está bloqueada"}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: INK.soft, textAlign: "center" }}>
            {permission.canAskAgain
              ? "Para ler seus comprovantes e faturas. Você também pode escolher uma foto da galeria."
              : "Libere em Ajustes › Willo › Câmera, ou escolha uma foto da galeria."}
          </Text>
          <Pressable
            onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
            style={({ pressed }) => ({
              marginTop: 8,
              borderRadius: 999,
              backgroundColor: "#fff",
              paddingHorizontal: 20,
              paddingVertical: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#000" }}>
              {permission.canAskAgain ? "Permitir câmera" : "Abrir Ajustes"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Camera controls ── */}
      {phase === "camera" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: insets.bottom + 26 }}>
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={() => router.replace("/manual" as never)}
              style={({ pressed }) => ({
                marginBottom: 24,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: "rgba(0,0,0,0.55)",
                paddingHorizontal: 16,
                paddingVertical: 12,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <PenLine size={16} color="#fff" strokeWidth={2.2} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Adicionar manualmente</Text>
            </Pressable>
          </View>

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
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: "rgba(0,0,0,0.45)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ImageIcon size={22} color="#fff" strokeWidth={2} />
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
                borderColor: "rgba(255,255,255,0.85)",
                opacity: !granted || shooting ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" }} />
            </Pressable>

            {/* Balances the gallery button so the shutter sits dead centre. */}
            <View style={{ width: 52, height: 52 }} />
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
            backgroundColor: "#000",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: insets.bottom + 20,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>Não deu para ler</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: INK.soft }}>{failure}</Text>
          <Pressable
            onPress={again}
            style={({ pressed }) => ({
              marginTop: 8,
              height: 52,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>Tentar outra foto</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/manual" as never)}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Digitar manualmente</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── What it found, to check before it is written ── */}
      {phase === "result" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%" }}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInDown.springify().damping(30).stiffness(260)}
            style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: "#000", overflow: "hidden" }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom }}>
              <ScanResultCard
                items={items}
                onItemsChange={setItems}
                accounts={accounts}
                accountId={accountId}
                onAccountChange={setAccountId}
                lowConfidence={confidence > 0 && confidence < 0.7}
                confirming={confirming}
                onConfirm={() => void confirm()}
              />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {/* ── Written ── */}
      {phase === "saved" && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 }]}
        >
          <Animated.View
            entering={ZoomIn.springify().damping(12).stiffness(420)}
            style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}
          >
            <Check size={32} color="#0B0B0B" strokeWidth={3.4} />
          </Animated.View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff" }}>
            {savedCount > 1 ? `${savedCount} lançamentos salvos` : "Salvo no Willo"}
          </Text>
          <View style={{ marginTop: 10, width: "100%", gap: 10 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>Concluir</Text>
            </Pressable>
            <Pressable
              onPress={again}
              style={({ pressed }) => ({
                height: 48,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Ler outro comprovante</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
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

  const corner = { position: "absolute" as const, width: 48, height: 48, borderColor: "#fff" };

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
          <LinearGradient colors={["transparent", "rgba(255,255,255,0.08)", "transparent"]} style={{ flex: 1 }} />
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
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(0,0,0,0.85)",
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }, dot]} />
      <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 2.4, textTransform: "uppercase", color: "#fff" }}>{label}</Text>
    </Animated.View>
  );
}
