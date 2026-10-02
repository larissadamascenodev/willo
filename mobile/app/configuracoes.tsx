import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Camera, Check, ChevronRight, Eye, EyeOff, FileText, Flame, Globe, Headphones, HelpCircle, Lock, LogOut, Pencil, Shuffle, ShieldCheck, Trash2, User, UserX, type LucideIcon } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, currencySymbol, getCurrency, setCurrency } from "@/lib/currency";
import { WEB_URL } from "~/config";
import { BottomSheet, Button, Glass, PageHeader, Screen, Text, colors, toast, white, fonts } from "~/ui";
import { PillInput, SectionLabel } from "~/features/wallet/sheetParts";

const BIO_SUGGESTIONS = [
  "Focado em controle financeiro e evolução diária",
  "Cada centavo conta na construção do meu futuro",
  "Economizando hoje para viver melhor amanhã",
  "Transformando hábitos financeiros, um dia de cada vez",
  "Menos impulso, mais planejamento",
  "Construindo liberdade financeira com disciplina",
  "Investindo no meu futuro com consistência",
  "Domando os gastos e conquistando objetivos",
];

const STRENGTH = [
  { label: "Fraca", hint: "Use pelo menos 8 caracteres.", hex: colors.red },
  { label: "Média", hint: "Misture letras, números ou símbolos.", hex: colors.amber },
  { label: "Forte", hint: "Ótima combinação de caracteres.", hex: colors.green },
] as const;

function passwordStrength(password: string) {
  if (!password) return null;
  const variety = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d\s]/u].filter((re) => re.test(password)).length;
  const level = (password.length >= 10 && variety >= 4) || (password.length >= 12 && variety >= 3) ? 2 : password.length >= 8 && variety >= 2 ? 1 : 0;
  return { level, ...STRENGTH[level] };
}

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
};

function Row({ icon: Icon, label, value, danger, onPress }: { icon: LucideIcon; label: string; value?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? white(0.04) : "transparent" })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: danger ? "rgba(248,113,113,0.12)" : white(0.06) }}>
        <Icon size={18} color={danger ? colors.red : white(0.8)} />
      </View>
      <Text weight="medium" size={15} color={danger ? colors.red : "#fff"} numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      {!!value && <Text size={13.5} color={white(0.56)}>{value}</Text>}
      {!danger && <ChevronRight size={16} color={white(0.38)} />}
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={{ marginTop: 24 }}>
      <Text size={12} weight="semibold" color={white(0.56)} style={{ marginBottom: 8, paddingHorizontal: 4 }}>{title}</Text>
      <Glass radius={22}>
        {items.map((c, i) => <View key={i} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>{c}</View>)}
      </Glass>
    </View>
  );
}

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <PillInput value={value} onChangeText={onChange} placeholder={placeholder} secureTextEntry={!show} autoCapitalize="none" style={{ paddingRight: 48 }} />
      <Pressable onPress={() => setShow((v) => !v)} accessibilityLabel={show ? "Esconder senha" : "Mostrar senha"} style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 40, alignItems: "center", justifyContent: "center" }}>
        {show ? <EyeOff size={16} color={white(0.62)} /> : <Eye size={16} color={white(0.62)} />}
      </Pressable>
    </View>
  );
}

type Sheet = "profile" | "password" | "currency" | "reset" | "logout" | "deleteAccount" | null;

/** Ajustes: perfil, senha, moeda, ajuda, termos, apagar dados e excluir a conta. */
export default function Configuracoes() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, updateDisplayName, updateBio, refetch } = useProfile();
  const { streak } = useLoginStreak();
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [changing, setChanging] = useState(false);
  const [resetMode, setResetMode] = useState<"choose" | "transactions" | "all">("choose");
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [accountsCount, setAccountsCount] = useState<number | null>(null);
  const strength = passwordStrength(next);

  useEffect(() => {
    if (!user) return;
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true).then(({ count }) => setAccountsCount(count ?? 0));
  }, [user]);

  const email = user?.email ?? "";
  const displayName = profile?.display_name || email.split("@")[0] || "Usuário";
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ") : "—";

  const openProfile = () => { setEditName(displayName); setEditBio(profile?.bio || ""); setSheet("profile"); };

  const pickAvatar = async () => {
    if (!user) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (res.canceled || !res.assets[0]) return;
      setUploading(true);
      const small = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const bytes = await (await fetch(small.uri)).arrayBuffer();
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, bytes, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles" as any).update({ avatar_url: `${publicUrl}?t=${Date.now()}` } as any).eq("id", user.id);
      await refetch();
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Não foi possível enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  const shuffleBio = () => {
    let n = editBio;
    while (n === editBio) n = BIO_SUGGESTIONS[Math.floor(Math.random() * BIO_SUGGESTIONS.length)];
    setEditBio(n);
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(editName.trim());
      await updateBio(editBio.trim());
      toast.success("Perfil atualizado!");
      close();
    } catch {
      toast.error("Não foi possível salvar o perfil");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!cur) return toast.error("Digite sua senha atual");
    if (next.length < 6) return toast.error("A nova senha deve ter no mínimo 6 caracteres");
    if (next !== again) return toast.error("As senhas não coincidem");
    setChanging(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (signInError) { toast.error("Senha atual incorreta"); return; }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Senha alterada!");
      setCur(""); setNext(""); setAgain("");
      close();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível alterar a senha");
    } finally {
      setChanging(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) return;
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${WEB_URL}/reset-password` });
      toast.success("Enviamos um e-mail para você criar uma nova senha.");
      close();
    } catch {
      toast.error("Não foi possível enviar o e-mail");
    }
  };

  const wipeTransactions = async () => {
    await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoices").delete().eq("user_id", user!.id);
    await supabase.from("recurring_exclusions").delete().eq("user_id", user!.id);
    await supabase.from("transactions").delete().eq("user_id", user!.id);
    await supabase.from("finance_events").delete().eq("user_id", user!.id);
  };

  const resetTransactions = async () => {
    if (!user) return;
    setResetting(true);
    try {
      await wipeTransactions();
      const { data: accounts } = await supabase.from("accounts").select("id, initial_balance").eq("user_id", user.id);
      for (const acc of accounts ?? []) await supabase.from("accounts").update({ current_balance: acc.initial_balance }).eq("id", acc.id);
      await supabase.from("credit_cards").update({ used_limit: 0 }).eq("user_id", user.id);
      await supabase.from("profiles").update({ has_transactions: false }).eq("id", user.id);
      (window as any).dispatchEvent(new CustomEvent("finance-data-changed"));
      toast.success("Transações apagadas");
      close();
    } catch {
      toast.error("Não foi possível apagar as transações");
    } finally {
      setResetting(false);
    }
  };

  const resetAll = async () => {
    if (!user) return;
    setResetting(true);
    try {
      await wipeTransactions();
      await supabase.from("credit_cards").delete().eq("user_id", user.id);
      await supabase.from("accounts").delete().eq("user_id", user.id);
      await supabase.from("profiles").update({ has_transactions: false, has_account: false, has_card: false, has_fixed_expenses: false }).eq("id", user.id);
      (window as any).dispatchEvent(new CustomEvent("finance-data-changed"));
      toast.success("Todos os dados foram apagados");
      close();
    } catch {
      toast.error("Não foi possível apagar os dados");
    } finally {
      setResetting(false);
    }
  };

  /** Exclusão definitiva da conta (diretriz 5.1.1 da App Store). */
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Sua conta foi excluída.");
      await signOut();
      router.replace("/welcome");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir a conta. Fale com o suporte.");
      setDeleting(false);
    }
  };

  const logout = async () => { close(); await signOut(); router.replace("/auth"); };
  const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`).catch(() => {});

  return (
    <Screen>
      <PageHeader title="Ajustes" />

      <Glass radius={28} style={{ marginTop: 16, alignItems: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 }}>
        <Pressable onPress={pickAvatar} disabled={uploading} accessibilityLabel="Trocar foto">
          <View style={{ width: 98, height: 98, borderRadius: 49, padding: 3, backgroundColor: white(0.18) }}>
            <View style={{ flex: 1, borderRadius: 46, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1C" }}>
              {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 92, height: 92 }} contentFit="cover" /> : initials(displayName) ? <Text weight="bold" size={30} color={white(0.8)}>{initials(displayName)}</Text> : <User size={36} color={white(0.66)} />}
            </View>
          </View>
          <View style={{ position: "absolute", right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 3, borderColor: "#111" }}>
            <Camera size={14} color={colors.black} strokeWidth={2.4} />
          </View>
        </Pressable>
        <Text weight="bold" size={22} numberOfLines={1} style={{ marginTop: 16, letterSpacing: -0.4 }}>{displayName}</Text>
        <Text size={13} color={white(0.62)} numberOfLines={1}>{email}</Text>
        {!!profile?.bio && <Text size={14} color={white(0.78)} align="center" style={{ marginTop: 10, maxWidth: 290, lineHeight: 19 }}>{profile.bio}</Text>}

        <View style={{ marginTop: 20, width: "100%", flexDirection: "row", borderRadius: 20, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.03), paddingVertical: 14 }}>
          {[
            { icon: <Flame size={16} color={colors.amber} />, value: String(streak), label: streak === 1 ? "dia seguido" : "dias seguidos" },
            { value: accountsCount === null ? "—" : String(accountsCount), label: accountsCount === 1 ? "conta ativa" : "contas ativas" },
            { value: memberSince, label: "membro desde" },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: white(0.08), paddingHorizontal: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{s.icon}<Text weight="bold" size={17} tabular numberOfLines={1}>{s.value}</Text></View>
              <Text size={11.5} color={white(0.62)} numberOfLines={1} style={{ marginTop: 6 }}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Button label="Editar perfil" height={44} icon={<Pencil size={14} color={colors.black} />} style={{ marginTop: 16, alignSelf: "stretch" }} onPress={openProfile} />
      </Glass>

      <Group title="Conta">
        <Row icon={User} label="Dados pessoais" onPress={openProfile} />
        <Row icon={ShieldCheck} label="Senha e segurança" onPress={() => { setCur(""); setNext(""); setAgain(""); setSheet("password"); }} />
      </Group>
      <Group title="Preferências">
        <Row icon={Globe} label="Moeda" value={`${getCurrency()} · ${currencySymbol()}`} onPress={() => setSheet("currency")} />
      </Group>
      <Group title="Ajuda">
        <Row icon={HelpCircle} label="Central de ajuda" onPress={() => openWeb("/ajuda")} />
        <Row icon={Headphones} label="Falar com o suporte" onPress={() => openWeb("/suporte")} />
      </Group>
      <Group title="Sobre">
        <Row icon={FileText} label="Termos de uso" onPress={() => openWeb("/termos-de-uso")} />
        <Row icon={Lock} label="Política de privacidade" onPress={() => openWeb("/politica-privacidade")} />
      </Group>
      <Group title="Dados">
        <Row icon={Trash2} label="Apagar dados" danger onPress={() => { setResetMode("choose"); setSheet("reset"); }} />
        <Row icon={UserX} label="Excluir minha conta" danger onPress={() => { setConfirmText(""); setSheet("deleteAccount"); }} />
      </Group>

      <Pressable onPress={() => setSheet("logout")} style={({ pressed }) => ({ marginTop: 24, height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: white(0.12), opacity: pressed ? 0.7 : 1 })}>
        <LogOut size={16} color={white(0.82)} />
        <Text weight="semibold" size={15} color={white(0.82)}>Sair</Text>
      </Pressable>
      <Text size={11.5} color={white(0.38)} align="center" style={{ marginTop: 16 }}>Willo</Text>

      <BottomSheet open={sheet === "profile"} onClose={close} size="full" footer={<Button label={saving ? "Salvando…" : "Salvar"} disabled={!editName.trim() || uploading} loading={saving} onPress={saveProfile} />}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>Dados pessoais</Text>
          <SectionLabel>Nome</SectionLabel>
          <PillInput value={editName} onChangeText={setEditName} placeholder="Seu nome" maxLength={40} />
          <SectionLabel right={<Pressable onPress={shuffleBio} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Shuffle size={13} color={white(0.74)} /><Text size={12} color={white(0.74)}>Sugestão</Text></Pressable>}>Bio</SectionLabel>
          <TextInput value={editBio} onChangeText={setEditBio} placeholder="Conte um pouco sobre você" placeholderTextColor={white(0.4)} multiline maxLength={120} style={{ minHeight: 88, borderRadius: 22, borderWidth: 1, borderColor: white(0.1), backgroundColor: "#0B0B0B", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, color: "#fff", fontSize: 15, fontFamily: fonts.regular, textAlignVertical: "top" }} />
          <Text size={11.5} color={white(0.4)} align="right" style={{ marginTop: 4 }}>{editBio.length}/120</Text>
        </ScrollView>
      </BottomSheet>

      <BottomSheet open={sheet === "password"} onClose={close} size="full" footer={<Button label={changing ? "Alterando…" : "Alterar senha"} disabled={!cur || !next || !again} loading={changing} onPress={changePassword} />}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>Senha e segurança</Text>
          <SectionLabel>Senha atual</SectionLabel>
          <PasswordField value={cur} onChange={setCur} placeholder="Sua senha atual" />
          <Pressable onPress={forgotPassword} style={{ marginTop: 8, alignSelf: "flex-start" }}><Text size={13} color={white(0.66)}>Esqueci minha senha</Text></Pressable>
          <SectionLabel>Nova senha</SectionLabel>
          <PasswordField value={next} onChange={setNext} placeholder="Mínimo de 6 caracteres" />
          {strength && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", gap: 4 }}>{[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= strength.level ? strength.hex : white(0.1) }} />)}</View>
              <Text size={12} color={strength.hex} style={{ marginTop: 6 }}>{strength.label} · <Text size={12} color={white(0.56)}>{strength.hint}</Text></Text>
            </View>
          )}
          <SectionLabel>Repita a nova senha</SectionLabel>
          <PasswordField value={again} onChange={setAgain} placeholder="Repita a nova senha" />
        </ScrollView>
      </BottomSheet>

      <BottomSheet open={sheet === "currency"} onClose={close}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>Moeda</Text>
          <Text size={13.5} color={white(0.62)} style={{ marginTop: 4 }}>Muda como os valores aparecem no app. Os números que você lançou continuam os mesmos.</Text>
          <ScrollView style={{ marginTop: 16, maxHeight: 380 }}>
            <Glass radius={22}>
              {CURRENCIES.map((c, i) => {
                const selected = c.code === getCurrency();
                return (
                  <Pressable key={c.code} onPress={() => { close(); if (!selected) setCurrency(c.code); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
                    <View style={{ minWidth: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: white(0.06) }}><Text weight="bold" size={13} color={white(0.8)}>{currencySymbol(c.code)}</Text></View>
                    <View style={{ flex: 1 }}><Text weight="medium" size={15} numberOfLines={1}>{c.name}</Text><Text size={12} color={white(0.56)}>{c.code}</Text></View>
                    {selected && <Check size={20} color={colors.green} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </Glass>
          </ScrollView>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "reset"} onClose={() => { if (!resetting) close(); }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>Apagar dados</Text>
          {resetMode === "choose" ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Pressable onPress={() => setResetMode("transactions")}><Glass radius={20} style={{ padding: 16 }}><Text weight="semibold" size={15.5}>Só as transações</Text><Text size={13} color={white(0.62)} style={{ marginTop: 2 }}>Zera lançamentos e faturas. Contas e cartões ficam.</Text></Glass></Pressable>
              <Pressable onPress={() => setResetMode("all")}><Glass radius={20} style={{ padding: 16 }}><Text weight="semibold" size={15.5} color={colors.red}>Tudo</Text><Text size={13} color={white(0.62)} style={{ marginTop: 2 }}>Apaga também as contas e os cartões. Recomeça do zero.</Text></Glass></Pressable>
            </View>
          ) : (
            <View>
              <Text size={14} color={white(0.66)} style={{ marginTop: 8, lineHeight: 20 }}>{resetMode === "transactions" ? "Todas as transações e faturas serão apagadas e os saldos voltam ao valor inicial. Não dá para desfazer." : "Contas, cartões, transações e faturas serão apagados. Não dá para desfazer."}</Text>
              <Button label={resetting ? "Apagando…" : "Apagar"} variant="danger" loading={resetting} style={{ marginTop: 20 }} onPress={resetMode === "transactions" ? resetTransactions : resetAll} />
              <Pressable onPress={() => setResetMode("choose")} disabled={resetting} style={{ paddingVertical: 14, alignItems: "center" }}><Text size={14} color={white(0.66)}>Voltar</Text></Pressable>
            </View>
          )}
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "deleteAccount"} onClose={() => { if (!deleting) close(); }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(248,113,113,0.12)" }}><UserX size={20} color={colors.red} /></View>
          <Text display weight="bold" size={22} style={{ marginTop: 16 }}>Excluir minha conta</Text>
          <Text size={14} color={white(0.66)} style={{ marginTop: 4, lineHeight: 20 }}>Apaga para sempre sua conta {email ? `(${email}) ` : ""}e tudo que está nela: transações, contas, cartões, faturas, metas e fotos. Não dá para desfazer nem recuperar depois.</Text>
          <SectionLabel>Digite EXCLUIR para confirmar</SectionLabel>
          <PillInput value={confirmText} onChangeText={(v) => setConfirmText(v.toUpperCase())} placeholder="EXCLUIR" autoCapitalize="characters" />
          <Button label={deleting ? "Excluindo…" : "Excluir minha conta"} variant="danger" disabled={confirmText !== "EXCLUIR"} loading={deleting} style={{ marginTop: 20 }} onPress={deleteAccount} />
          <Pressable onPress={close} disabled={deleting} style={{ paddingVertical: 14, alignItems: "center" }}><Text size={14} color={white(0.66)}>Cancelar</Text></Pressable>
        </View>
      </BottomSheet>

      <BottomSheet open={sheet === "logout"} onClose={close}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text display weight="bold" size={22}>Sair da conta?</Text>
          <Text size={14} color={white(0.66)} style={{ marginTop: 4 }}>Você vai precisar entrar de novo da próxima vez.</Text>
          <Button label="Sair" style={{ marginTop: 20 }} onPress={logout} />
          <Pressable onPress={close} style={{ paddingVertical: 14, alignItems: "center" }}><Text size={14} color={white(0.66)}>Cancelar</Text></Pressable>
        </View>
      </BottomSheet>
    </Screen>
  );
}
