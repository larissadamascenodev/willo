import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_EMAIL } from "@/lib/support";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import ConfirmGlass from "~/components/ConfirmGlass";
import Surface, { Hairline } from "~/components/Surface";
import LegalSheet from "~/components/auth/LegalSheet";
import { Bell, Camera, Check, ChevronRight, Crown, FileText, ImagePlus, LifeBuoy, LogOut, Pencil, Shield, Zap } from "~/components/icons";
import BottomSheet from "~/components/BottomSheet";
import ThemeTile from "~/components/ThemeTile";
import { usePro } from "~/lib/purchases";
import { useAuth } from "~/lib/auth";
import { setSkyPhoto, useLightSkyModel, useSkyModel, useSkyPhoto, type LightSkyModel, type SkyModel } from "~/lib/skyModel";
import { PhotoError, pickAvatar, pickBackground } from "~/lib/profilePhotos";
import { BACKDROPS, BACKDROP_KEYS, LIGHT_BACKDROPS, LIGHT_BACKDROP_KEYS } from "~/lib/backdrops";
import { showToast } from "~/lib/toast";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { isLight, switchTheme, th, useThemeRedraw, prepareThemeShot } from "~/theme/theme";
/**
 * The profile.
 *
 * The avatar on the home opens it. It says whose account the phone is showing and
 * lets the person make it theirs: the photo and the name, the plan they are on, what
 * the top of the home is, and what is behind every screen — one of the backgrounds
 * that come with the app, or a photo of their own. Each choice is kept on the phone
 * and stays until it is changed.
 *
 * Below that, the papers (Terms and Privacy, read in the app), the way to support,
 * signing out and, last and quietest, deleting the account for good — the App Store
 * asks for it to be possible from inside the app.
 */

const PAD = 16;
const SHEET_GAP = 10;
const APPEARANCE_H = 156;

const LIGHT_BACKGROUNDS: { key: LightSkyModel; label: string }[] = [
  ...LIGHT_BACKDROP_KEYS.map((key) => ({ key, label: LIGHT_BACKDROPS[key].label })),
  { key: "custom", label: "Sua foto" },
];

const BACKGROUNDS: { key: SkyModel; label: string }[] = [
  { key: "2", label: "Céu" },
  { key: "1", label: "Céu vivo" },
  ...BACKDROP_KEYS.map((key) => ({ key, label: BACKDROPS[key].label })),
  { key: "plain", label: "Escuro" },
  { key: "custom", label: "Sua foto" },
];

export default function Perfil() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { user, signOut } = useAuth();
  const { profile, refetch, updateDisplayName } = useProfile();
  const [sky, setSky] = useSkyModel();
  const [lightSky, setLightSky] = useLightSkyModel();
  /* A photograph of the page, ready for the next change of theme: taken once it has
     settled, again when it has scrolled, and again after each change. */
  useFocusEffect(
    useCallback(() => {
      const a = setTimeout(() => void prepareThemeShot(), 700);
      return () => clearTimeout(a);
    }, []),
  );
  const light = isLight();
  const photo = useSkyPhoto();

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [sendingAvatar, setSendingAvatar] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [asking, setAsking] = useState<"leave" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickingBg, setPickingBg] = useState(false);
  const [bgTileW, setBgTileW] = useState(0);
  const pro = usePro();
  const [wantLight, setWantLight] = useState(light);
  useEffect(() => setWantLight(light), [light]);

  const email = user?.email ?? "";
  const name = profile?.display_name?.trim() || (user?.user_metadata?.display_name as string | undefined) || email.split("@")[0] || "Você";
  const avatar = profile?.avatar_url ?? null;

  const tick = () => void Haptics.selectionAsync().catch(() => undefined);

  const changeAvatar = async () => {
    if (!user || sendingAvatar) return;
    tick();
    setSendingAvatar(true);
    try {
      const url = await pickAvatar(user.id);
      if (url) {
        await refetch();
        showToast("Foto atualizada");
      }
    } catch (e) {
      showToast(e instanceof PhotoError ? e.message : "Não foi possível trocar a foto.");
    } finally {
      setSendingAvatar(false);
    }
  };

  const saveName = async () => {
    const next = draft.trim();
    if (!next || next === name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(next);
      setEditingName(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      showToast("Não foi possível salvar o nome.");
    } finally {
      setSavingName(false);
    }
  };

  /* Each theme keeps its own background; the one being changed is the theme on screen. */
  const chooseBackground = async (key: string) => {
    tick();
    const worn = light ? lightSky : sky;
    /* "Sua foto" asks for a photo the first time, and again when it is already worn. */
    if (key === "custom" && (!photo || worn === "custom")) {
      try {
        const file = await pickBackground(screenW / screenH);
        /* Not worn yet: it opens on the preview to set its veil first. */
        if (file) router.push({ pathname: "/fundo-foto", params: { file } } as never);
      } catch (e) {
        showToast(e instanceof PhotoError ? e.message : "Não foi possível usar essa foto.");
      }
      return;
    }
    if (light) setLightSky(key as LightSkyModel);
    else setSky(key as SkyModel);
  };

  const leave = async () => {
    setBusy(true);
    await signOut();
    /* The door takes over from here. */
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      showToast("Sua conta foi excluída.");
      await signOut();
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : "Não foi possível excluir a conta. Fale com o suporte.");
      setBusy(false);
      setAsking(null);
    }
  };

  /* Each preview is the whole screen, drawn at full size and shrunk into its tile:
     three to a row in the sheet. */
  const sheetTileW = Math.floor((screenW - 40 - SHEET_GAP * 2) / 3);
  const sheetTileH = Math.round(sheetTileW * 1.72);
  const wornKey: SkyModel | LightSkyModel = light ? lightSky : sky;
  const wornLabel = (light ? LIGHT_BACKGROUNDS : BACKGROUNDS).find((b) => b.key === wornKey)?.label ?? "";

  /* The switch and the theme move together, from the touch and in the same time: the
     knob slides while a circle of the new theme opens from the point that was tapped. */
  const flipTheme = (x: number, y: number) => {
    tick();
    const next = !wantLight;
    setWantLight(next);
    void switchTheme(next ? "light" : "dark", "/perfil", { x, y });
  };

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: PAD }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={() => void prepareThemeShot()}
        onScrollEndDrag={() => setTimeout(() => void prepareThemeShot(), 120)}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center" }}>
          <BackButton />
        </View>

        {/* Who. */}
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <Pressable onPress={() => void changeAvatar()} accessibilityRole="button" accessibilityLabel="Trocar foto de perfil" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 104, height: 104, borderRadius: 52, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              {avatar ? (
                <Image source={{ uri: avatar }} contentFit="cover" transition={200} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text style={{ fontSize: 40, fontWeight: "600", color: th("#fff") }}>{name.slice(0, 1).toUpperCase()}</Text>
              )}
              {sendingAvatar && (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(0,0,0,0.45)", "bg") }}>
                  <ActivityIndicator color={th("#fff")} />
                </View>
              )}
            </View>
            <View style={{ position: "absolute", right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
              <Camera size={15} color={th("#0B0B0B")} strokeWidth={2.2} />
            </View>
          </Pressable>
          <Text numberOfLines={1} style={{ marginTop: 16, fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: th("#fff") }}>
            {name}
          </Text>
          {!!email && <Text style={{ marginTop: 4, fontSize: 14, color: th(INK.soft) }}>{email}</Text>}
        </View>

        {/* The account. */}
        <Eyebrow>Conta</Eyebrow>
        <Surface>
          {!editingName ? (
            <Row
              label="Nome"
              value={name}
              onPress={() => {
                tick();
                setDraft(name);
                setEditingName(true);
              }}
              trailing={<Pencil size={15} color={th(INK.faint)} strokeWidth={2} />}
            />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 8, minHeight: 56 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                placeholder="Seu nome"
                placeholderTextColor={th(INK.faint)}
                selectionColor={th("#fff")}
                style={{ flex: 1, fontSize: 16, color: th("#fff"), paddingVertical: 14 }}
              />
              <Pressable
                onPress={() => void saveName()}
                disabled={savingName}
                style={({ pressed }) => ({ height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed || savingName ? 0.75 : 1 })}
              >
                {savingName ? <ActivityIndicator color={th("#0B0B0B")} size="small" /> : <Text style={{ fontSize: 14, fontWeight: "700", color: th("#0B0B0B") }}>Salvar</Text>}
              </Pressable>
            </View>
          )}
          <Hairline style={{ marginLeft: 16 }} />
          <Row label="E-mail" value={email} />
          <Hairline style={{ marginLeft: 16 }} />
          <Pressable
            onPress={() => {
              tick();
              void Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => undefined);
            }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              <Crown size={17} color={th("#fff")} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Willo PRO</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>{pro === false ? "Sem assinatura ativa" : "Gerenciar assinatura"}</Text>
            </View>
            <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: th("rgba(255,255,255,0.75)") }}>SEU PLANO</Text>
            </View>
          </Pressable>
        </Surface>

        {/* How the app looks: the theme with one switch, and what is behind every screen
            chosen in a sheet, where the previews have room. */}
        <Eyebrow>Aparência</Eyebrow>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ThemeTile light={wantLight} height={APPEARANCE_H} onPress={(e) => flipTheme(e.nativeEvent.pageX, e.nativeEvent.pageY)} />
          {/* The background worn now, filling the card; the choice opens in a sheet. */}
          <Pressable
            onPress={() => {
              tick();
              setPickingBg(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Fundo: ${wornLabel}. Trocar`}
            style={{ flex: 1 }}
          >
            {({ pressed }) => (
              <View
                onLayout={(e) => setBgTileW(e.nativeEvent.layout.width)}
                style={{ height: APPEARANCE_H, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg"), transform: [{ scale: pressed ? 0.97 : 1 }] }}
              >
                {bgTileW > 0 && !(wornKey === "custom" && !photo) && (
                  <View pointerEvents="none" style={{ position: "absolute", left: 0, top: (APPEARANCE_H - screenH * (bgTileW / screenW)) / 2, width: screenW, height: screenH, transformOrigin: "top left", transform: [{ scale: bgTileW / screenW }] }}>
                    <Room preview={wornKey} />
                  </View>
                )}
                <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 14, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.45)" }}>
                    <ImagePlus size={14} color="#fff" strokeWidth={2} />
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>Fundo · {wornLabel}</Text>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        </View>
        {/* A photo of one's own is set on its preview: its veil, light or dark, and blur. */}
        {wornKey === "custom" && !!photo && (
          <Surface style={{ marginTop: 12 }}>
            <Row
              label="Ajustar a foto"
              value={light ? "Só na tela inicial · véu claro ou escuro" : "Só na tela inicial · intensidade do véu"}
              icon={<ImagePlus size={17} color={th("#fff")} strokeWidth={1.9} />}
              onPress={() => {
                tick();
                router.push("/fundo-foto" as never);
              }}
              chevron
            />
          </Surface>
        )}

        {/* What Willo tells the person, and where. */}
        <Eyebrow>Notificações</Eyebrow>
        <Surface>
          <Row
            icon={<Bell size={17} color={th("#fff")} strokeWidth={1.9} />}
            label="Notificações"
            value="Contas, faturas, metas e avisos no celular"
            onPress={() => {
              tick();
              router.push("/notificacoes-ajustes" as never);
            }}
            chevron
          />
          <Hairline style={{ marginLeft: 64 }} />
          <Row
            icon={<Zap size={17} color={th("#fff")} strokeWidth={1.9} />}
            label="Atalhos do iPhone"
            value="Toque duplo nas costas e compras da Carteira"
            onPress={() => {
              tick();
              router.push("/atalhos" as never);
            }}
            chevron
          />
        </Surface>

        {/* The papers, and help. */}
        <Eyebrow>Sobre</Eyebrow>
        <Surface>
          <Row icon={<FileText size={17} color={th("#fff")} strokeWidth={1.9} />} label="Termos de Uso" onPress={() => { tick(); setLegal("terms"); }} chevron />
          <Hairline style={{ marginLeft: 64 }} />
          <Row icon={<Shield size={17} color={th("#fff")} strokeWidth={1.9} />} label="Política de Privacidade" onPress={() => { tick(); setLegal("privacy"); }} chevron />
          <Hairline style={{ marginLeft: 64 }} />
          <Row
            icon={<LifeBuoy size={17} color={th("#fff")} strokeWidth={1.9} />}
            label="Falar com o suporte"
            value={SUPPORT_EMAIL}
            onPress={() => {
              tick();
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Willo — suporte")}`).catch(() => showToast(SUPPORT_EMAIL));
            }}
            chevron
          />
        </Surface>

        {/* Leaving. */}
        <Surface style={{ marginTop: 24 }}>
          <Row icon={<LogOut size={17} color={th(RED)} strokeWidth={1.9} />} label="Sair da conta" danger onPress={() => { tick(); setAsking("leave"); }} />
        </Surface>

        <Pressable onPress={() => { tick(); setAsking("delete"); }} style={({ pressed }) => ({ marginTop: 22, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: th("rgba(248,113,113,0.85)") }}>Excluir conta</Text>
        </Pressable>
        <Text style={{ marginTop: 2, textAlign: "center", fontSize: 12, lineHeight: 17, color: th(INK.faint), paddingHorizontal: 24 }}>
          Apaga para sempre a sua conta e todos os seus dados no Willo.
        </Text>
      </ScrollView>

      <LegalSheet which={legal} onClose={() => setLegal(null)} />

      <BottomSheet open={pickingBg} onClose={() => setPickingBg(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.5, color: th("#fff") }}>Fundo</Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: th(INK.soft) }}>{light ? "O que fica atrás das telas no tema claro." : "O que fica atrás das telas no tema escuro."}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SHEET_GAP, marginTop: 18 }}>
            {(light ? LIGHT_BACKGROUNDS : BACKGROUNDS).map(({ key, label }) => {
              const on = wornKey === key;
              const empty = key === "custom" && !photo;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setPickingBg(false);
                    /* A photo is picked once the sheet has gone. */
                    if (key === "custom" && (!photo || on)) setTimeout(() => void chooseBackground(key), 320);
                    else void chooseBackground(key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  style={{ width: sheetTileW, alignItems: "center" }}
                >
                  {({ pressed }) => (
                    <>
                      <View
                        style={{
                          width: sheetTileW,
                          height: sheetTileH,
                          borderRadius: 18,
                          borderCurve: "continuous",
                          overflow: "hidden",
                          borderWidth: on ? 2 : 1,
                          borderColor: th(on ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.1)", "line"),
                          backgroundColor: th("rgba(255,255,255,0.04)", "bg"),
                          opacity: pressed ? 0.85 : 1,
                        }}
                      >
                        {empty ? (
                          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                            <ImagePlus size={24} color={th("rgba(255,255,255,0.7)")} strokeWidth={1.8} />
                          </View>
                        ) : (
                          <View pointerEvents="none" style={{ width: screenW, height: screenH, transformOrigin: "top left", transform: [{ scale: sheetTileW / screenW }] }}>
                            <Room preview={key} />
                          </View>
                        )}
                        {on && (
                          <View style={{ position: "absolute", top: 8, right: 8 }}>
                            <Tick on />
                          </View>
                        )}
                      </View>
                      <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 13, fontWeight: on ? "600" : "500", color: th(on ? "#fff" : INK.soft) }}>
                        {key === "custom" && on ? "Trocar foto" : label}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>

      <ConfirmGlass
        open={asking === "leave"}
        title="Sair da conta?"
        confirmLabel="Sair"
        busyLabel="Saindo…"
        icon={<LogOut size={21} color={th(RED)} strokeWidth={2} />}
        busy={busy}
        onConfirm={() => void leave()}
        onClose={() => setAsking(null)}
      >
        Você vai precisar entrar de novo para ver os seus dados neste aparelho.
      </ConfirmGlass>

      <ConfirmGlass
        open={asking === "delete"}
        title="Excluir a sua conta?"
        confirmLabel="Excluir"
        busy={busy}
        onConfirm={() => void deleteAccount()}
        onClose={() => setAsking(null)}
      >
        Lançamentos, contas, cartões, metas e a sua foto serão apagados para sempre, e isso não pode ser desfeito.
      </ConfirmGlass>
    </Room>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={[T.eyebrow, { marginTop: 30, marginBottom: 10, paddingHorizontal: 4 }]}>{children}</Text>;
}

function Tick({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th(on ? "#fff" : "transparent", "bg"),
        borderWidth: on ? 0 : 1.5,
        borderColor: th("rgba(255,255,255,0.25)", "line"),
      }}
    >
      {on && <Check size={12} color={th("#0B0B0B")} strokeWidth={3} />}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  trailing,
  chevron = false,
  danger = false,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th(danger ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.07)", "bg") }}>
          {icon}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {value !== undefined && !icon ? (
          <>
            <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{label}</Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 15.5, fontWeight: "500", color: th("#fff") }}>
              {value}
            </Text>
          </>
        ) : (
          <>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "500", color: th(danger ? RED : "#fff") }}>
              {label}
            </Text>
            {!!value && (
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
                {value}
              </Text>
            )}
          </>
        )}
      </View>
      {trailing}
      {chevron && <ChevronRight size={17} color={th(INK.faint)} strokeWidth={2} />}
    </>
  );
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 16, minHeight: 58, paddingVertical: 11 };
  if (!onPress) return <View style={row}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [row, pressed && { backgroundColor: th("rgba(255,255,255,0.04)", "bg") }]}>
      {body}
    </Pressable>
  );
}
