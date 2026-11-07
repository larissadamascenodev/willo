import { useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import { Bell, Bot, Camera, Check, ChevronRight, Crown, FileText, GalleryHorizontal, ImagePlus, LifeBuoy, LogOut, Pencil, Shield } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { useHomeHero, type HomeHero } from "~/lib/homeHero";
import { setSkyPhoto, useLightSkyModel, useSkyModel, useSkyPhoto, type LightSkyModel, type SkyModel } from "~/lib/skyModel";
import { PhotoError, pickAvatar, pickBackground } from "~/lib/profilePhotos";
import { BACKDROPS, BACKDROP_KEYS, LIGHT_BACKDROPS, LIGHT_BACKDROP_KEYS } from "~/lib/backdrops";
import { showToast } from "~/lib/toast";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { LIGHT_GROUND, isLight, switchTheme, th, useThemePref, type ThemeMode, useThemeRedraw } from "~/theme/theme";
import { GROUND } from "~/theme/tokens";
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

const HEROES: { key: HomeHero; label: string; line: string; Icon: typeof Bot }[] = [
  { key: "orb", label: "Robô", line: "O Willo fala com você", Icon: Bot },
  { key: "stories", label: "Slides", line: "Leituras em sequência", Icon: GalleryHorizontal },
];

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
  const [hero, setHero] = useHomeHero();
  const [sky, setSky] = useSkyModel();
  const [lightSky, setLightSky] = useLightSkyModel();
  const [theme] = useThemePref();
  const light = isLight();
  const photo = useSkyPhoto();

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [sendingAvatar, setSendingAvatar] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [asking, setAsking] = useState<"leave" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

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

  /* Each preview is the whole screen, drawn at full size and shrunk into its tile. */
  /* Four and a bit show at once, so the row says it goes on. */
  const tileW = Math.round((screenW - PAD * 2 - 10 * 3) / 4.3);
  const tileH = Math.round(tileW * 1.72);
  const shrink = tileW / screenW;

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: PAD }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
              <Crown size={17} color={th("#fff")} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Willo Beta</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>Gratuito durante a fase de testes</Text>
            </View>
            <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: th("rgba(255,255,255,0.75)") }}>SEU PLANO</Text>
            </View>
          </View>
        </Surface>

        {/* Dark or light, inside the app. */}
        <Eyebrow>Tema</Eyebrow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {THEMES.map(({ key, label }) => {
            const on = theme === key;
            return (
              <Pressable
                key={key}
                onPress={(e) => {
                  tick();
                  void switchTheme(key, "/perfil", { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Tema ${label.toLowerCase()}`}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
              >
                <ThemeSample mode={key} on={on} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: on ? "600" : "500", color: th(on ? "#fff" : INK.soft) }}>{label}</Text>
                  <Tick on={on} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* The top of the home. */}
        <Eyebrow>Tela inicial</Eyebrow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {HEROES.map(({ key, label, line, Icon }) => {
            const on = hero === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  tick();
                  setHero(key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 14,
                  borderRadius: 22,
                  borderCurve: "continuous",
                  borderWidth: 1.5,
                  borderColor: th(on ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.08)", "line"),
                  backgroundColor: th(on ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.045)", "bg"),
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Icon size={22} color={th("#fff")} strokeWidth={1.8} />
                  <Tick on={on} />
                </View>
                <Text style={{ marginTop: 18, fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>{label}</Text>
                <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>{line}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* What is behind every screen: the dark theme's or the light one's, each kept apart. */}
        <Eyebrow>Fundo</Eyebrow>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -PAD }}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: 10 }}
        >
          {(light ? LIGHT_BACKGROUNDS : BACKGROUNDS).map(({ key, label }) => {
            const on = (light ? lightSky : sky) === key;
            const empty = key === "custom" && !photo;
            return (
              <Pressable key={key} onPress={() => void chooseBackground(key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ width: tileW, alignItems: "center" }}>
                {({ pressed }) => (
                  <>
                    <View
                      style={{
                        width: tileW,
                        height: tileH,
                        borderRadius: 18,
                        borderCurve: "continuous",
                        overflow: "hidden",
                        borderWidth: 1.5,
                        borderColor: th(on ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)", "line"),
                        backgroundColor: th("rgba(255,255,255,0.04)", "bg"),
                        opacity: pressed ? 0.85 : 1,
                      }}
                    >
                      {empty ? (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <ImagePlus size={22} color={th("rgba(255,255,255,0.7)")} strokeWidth={1.8} />
                        </View>
                      ) : (
                        <View pointerEvents="none" style={{ width: screenW, height: screenH, transformOrigin: "top left", transform: [{ scale: shrink }] }}>
                          <Room preview={key} />
                        </View>
                      )}
                      {on && (
                        <View style={{ position: "absolute", top: 7, right: 7 }}>
                          <Tick on />
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12.5, fontWeight: on ? "600" : "500", color: th(on ? "#fff" : INK.soft) }}>
                      {key === "custom" && on ? "Trocar foto" : label}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* A photo of one's own is set on its preview: its veil, light or dark, and blur. */}
        {(light ? lightSky : sky) === "custom" && !!photo && (
          <Surface style={{ marginTop: 14 }}>
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

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "dark", label: "Escuro" },
  { key: "light", label: "Claro" },
];

/* A small page in each theme: a figure, a card and two lines, in that theme's own
   colours whichever theme is on screen. */
function ThemeSample({ mode, on }: { mode: ThemeMode; on: boolean }) {
  const dark = mode === "dark";
  const ink = dark ? "#FFFFFF" : "#111318";
  const soft = dark ? "rgba(255,255,255,0.45)" : "rgba(17,19,24,0.45)";
  const card = dark ? "rgba(255,255,255,0.07)" : "rgba(17,19,24,0.05)";
  return (
    <View
      style={{
        height: 112,
        borderRadius: 20,
        borderCurve: "continuous",
        overflow: "hidden",
        padding: 14,
        backgroundColor: dark ? GROUND : LIGHT_GROUND,
        borderWidth: 1.5,
        borderColor: on ? th("rgba(255,255,255,0.9)", "line") : th("rgba(255,255,255,0.1)", "line"),
      }}
    >
      <View style={{ width: 34, height: 6, borderRadius: 3, backgroundColor: soft }} />
      <Text style={{ marginTop: 8, fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: ink }}>R$ 4.280</Text>
      <View style={{ marginTop: 10, flex: 1, borderRadius: 12, backgroundColor: card, padding: 9, gap: 6 }}>
        <View style={{ width: "70%", height: 5, borderRadius: 3, backgroundColor: soft }} />
        <View style={{ width: "45%", height: 5, borderRadius: 3, backgroundColor: soft }} />
      </View>
    </View>
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
