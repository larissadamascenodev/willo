import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, Camera, Check, ChevronRight, Eye, EyeOff, FileText, Flame, Globe, Headphones,
  HelpCircle, Loader2, Lock, LogOut, Pencil, ShieldCheck, Shuffle, Sparkles, Trash2, User, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getCurrency, setCurrency, currencyName, currencySymbol, CURRENCIES } from "@/lib/currency";
import BottomSheet from "@/components/shared/BottomSheet";
import NotificationSettingsModal from "@/components/dashboard/NotificationSettingsModal";
import { PillInput, SectionLabel, SheetAction } from "@/components/wallet/sheetParts";
import { seedDemoData } from "@/lib/demoData";

/* ══════════════════════════ Helpers ══════════════════════════ */

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
  { label: "Fraca", hint: "Use pelo menos 8 caracteres.", hex: "#F87171" },
  { label: "Média", hint: "Misture letras, números ou símbolos.", hex: "#FCD34D" },
  { label: "Forte", hint: "Ótima combinação de caracteres.", hex: "#C8F36D" },
] as const;

function passwordStrength(password: string) {
  if (!password) return null;
  const variety = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d\s]/u].filter((re) => re.test(password)).length;
  const level =
    (password.length >= 10 && variety >= 4) || (password.length >= 12 && variety >= 3) ? 2
      : password.length >= 8 && variety >= 2 ? 1
        : 0;
  return { level, ...STRENGTH[level] };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/* ══════════════════════════ Building blocks ══════════════════════════ */

function Row({ icon: Icon, label, value, danger = false, onClick }: {
  icon: typeof User;
  label: string;
  value?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]", danger ? "bg-red-400/[0.12]" : "bg-white/[0.06]")}>
        <Icon className={cn("h-[18px] w-[18px]", danger ? "text-red-400" : "text-white/80")} strokeWidth={2} />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", danger ? "text-red-400" : "text-white")}>{label}</span>
      {value && <span className="shrink-0 text-[13.5px] text-white/56">{value}</span>}
      {!danger && <ChevronRight className="h-4 w-4 shrink-0 text-white/38" />}
    </button>
  );
}

function Group({ title, children, delay = 0 }: { title: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <p className="mb-2 px-1 text-[12px] font-semibold text-white/56">{title}</p>
      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass">{children}</div>
    </motion.section>
  );
}

function Stat({ icon: Icon, value, label }: { icon?: typeof User; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5">
      <span className="flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2.2} />}
        <span className="truncate text-[17px] font-bold leading-none tracking-tight text-white tabular-nums">{value}</span>
      </span>
      <span className="mt-1.5 truncate text-[11.5px] text-white/62">{label}</span>
    </div>
  );
}

function PasswordField({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <PillInput type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Esconder senha" : "Mostrar senha"}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/62 active:bg-white/[0.06]"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ══════════════════════════ Page ══════════════════════════ */

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  const { profile, updateDisplayName, updateBio, uploadAvatar } = useProfile();
  const { streak } = useLoginStreak();
  const navigate = useNavigate();
  const avatarInput = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<"profile" | "password" | "currency" | "reset" | "logout" | "demo" | "deleteAccount" | null>(null);
  // Hidden testing helper: /configuracoes?demo=1
  const [searchParams] = useSearchParams();
  const demoEnabled = searchParams.get("demo") === "1";
  const [seedProgress, setSeedProgress] = useState<number | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const close = () => setSheet(null);

  // Profile
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const strength = passwordStrength(newPassword);

  // Reset
  const [resetMode, setResetMode] = useState<"choose" | "transactions" | "all">("choose");
  const [resetting, setResetting] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [accountsCount, setAccountsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ count }) => setAccountsCount(count ?? 0));
  }, [user]);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email ?? "";
  const avatar = previewUrl ?? profile?.avatar_url ?? null;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ")
    : "—";

  /* ── Profile ── */
  const openProfile = () => {
    setEditName(displayName);
    setEditBio(profile?.bio || "");
    setSheet("profile");
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success("Foto atualizada!");
    } catch {
      setPreviewUrl(null);
      toast.error("Não foi possível enviar a foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const shuffleBio = () => {
    let next = editBio;
    while (next === editBio) next = BIO_SUGGESTIONS[Math.floor(Math.random() * BIO_SUGGESTIONS.length)];
    setEditBio(next);
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      await updateDisplayName(editName.trim());
      await updateBio(editBio.trim());
      toast.success("Perfil atualizado!");
      close();
    } catch {
      toast.error("Não foi possível salvar o perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  /* ── Password ── */
  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const changePassword = async () => {
    if (!currentPassword) return toast.error("Digite sua senha atual");
    if (newPassword.length < 6) return toast.error("A nova senha deve ter no mínimo 6 caracteres");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    setChangingPassword(true);
    try {
      // Confirms the current password by signing in again
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) {
        toast.error("Senha atual incorreta");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada!");
      resetPasswordFields();
      close();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar a senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) return;
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      toast.success("Enviamos um e-mail para você criar uma nova senha.");
      close();
    } catch {
      toast.error("Não foi possível enviar o e-mail");
    }
  };

  /* ── Reset ── */
  const openReset = () => {
    setResetMode("choose");
    setSheet("reset");
  };

  const resetTransactions = async () => {
    if (!user) return;
    setResetting(true);
    try {
      await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("invoices").delete().eq("user_id", user.id);
      await supabase.from("recurring_exclusions").delete().eq("user_id", user.id);
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.from("finance_events").delete().eq("user_id", user.id);

      // Balances go back to where each account started
      const { data: accounts } = await supabase.from("accounts").select("id, initial_balance").eq("user_id", user.id);
      for (const acc of accounts ?? []) {
        await supabase.from("accounts").update({ current_balance: acc.initial_balance }).eq("id", acc.id);
      }
      await supabase.from("credit_cards").update({ used_limit: 0 }).eq("user_id", user.id);
      await supabase.from("profiles").update({ has_transactions: false }).eq("id", user.id);

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
      await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("invoices").delete().eq("user_id", user.id);
      await supabase.from("recurring_exclusions").delete().eq("user_id", user.id);
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.from("finance_events").delete().eq("user_id", user.id);
      await supabase.from("credit_cards").delete().eq("user_id", user.id);
      await supabase.from("accounts").delete().eq("user_id", user.id);
      await supabase.from("profiles").update({
        has_transactions: false,
        has_account: false,
        has_card: false,
        has_fixed_expenses: false,
      }).eq("id", user.id);

      toast.success("Todos os dados foram apagados");
      close();
      // Bring back the "let's set everything up" prompt, like right after signup.
      window.dispatchEvent(new CustomEvent("show-welcome-modal"));
    } catch {
      toast.error("Não foi possível apagar os dados");
    } finally {
      setResetting(false);
    }
  };

  /* ── Delete the account for good (App Store guideline 5.1.1) ── */
  const deleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Sua conta foi excluída.");
      await signOut();
      navigate("/welcome");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível excluir a conta. Fale com o suporte.");
      setDeletingAccount(false);
    }
  };

  /* ── Logout ── */
  const logout = async () => {
    // AuthContext ignores a bare supabase.auth.signOut() to avoid false
    // logouts from background token-refresh failures — go through its own
    // signOut() so `user` actually clears and the redirect below sticks.
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-6 pb-10 pt-2">
      {/* ═══ Profile ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col items-center overflow-hidden rounded-[28px] border border-white/[0.08] willo-glass-strong px-5 pb-6 pt-7 text-center"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/[0.08] blur-[70px]" />

        <button type="button" onClick={() => avatarInput.current?.click()} disabled={uploadingAvatar} aria-label="Trocar foto" className="relative">
          <span className="block rounded-full bg-gradient-to-b from-white/50 via-white/15 to-white/[0.03] p-[2.5px]">
            <span className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full bg-[#1C1C1C]">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[30px] font-bold text-white/80">{initials(displayName) || <User className="h-9 w-9 text-white/66" />}</span>
              )}
            </span>
          </span>
          <span className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#111111] bg-white text-[#0B0B0B]">
            {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />}
          </span>
        </button>
        <input ref={avatarInput} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />

        <h1 className="relative mt-4 max-w-full truncate text-[22px] font-bold tracking-tight text-white">{displayName}</h1>
        <p className="relative max-w-full truncate text-[13px] text-white/62">{email}</p>
        {profile?.bio && <p className="relative mt-2.5 max-w-[290px] text-[14px] leading-snug text-white/78">{profile.bio}</p>}

        {/* At a glance — one strip inside the card, not three loose boxes */}
        <div className="relative mt-5 grid w-full grid-cols-3 divide-x divide-white/[0.08] rounded-[20px] border border-white/[0.08] bg-white/[0.03] py-3.5">
          <Stat icon={Flame} value={String(streak)} label={streak === 1 ? "dia seguido" : "dias seguidos"} />
          <Stat value={accountsCount === null ? "—" : String(accountsCount)} label={accountsCount === 1 ? "conta ativa" : "contas ativas"} />
          <Stat value={memberSince} label="membro desde" />
        </div>

        <button
          type="button"
          onClick={openProfile}
          className="relative mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#0B0B0B] active:scale-[0.99]"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar perfil
        </button>
      </motion.section>

      {/* ═══ Settings ═══ */}
      <Group title="Conta" delay={0.08}>
        <Row icon={User} label="Dados pessoais" onClick={openProfile} />
        <Row icon={ShieldCheck} label="Senha e segurança" onClick={() => { resetPasswordFields(); setSheet("password"); }} />
        <Row icon={Bell} label="Lembretes e alertas" onClick={() => setNotifOpen(true)} />
      </Group>

      <Group title="Preferências" delay={0.1}>
        <Row icon={Globe} label="Moeda" value={`${getCurrency()} · ${currencySymbol()}`} onClick={() => setSheet("currency")} />
      </Group>

      <Group title="Ajuda" delay={0.12}>
        <Row icon={HelpCircle} label="Central de ajuda" onClick={() => navigate("/ajuda")} />
        <Row icon={Headphones} label="Falar com o suporte" onClick={() => navigate("/suporte")} />
      </Group>

      <Group title="Sobre" delay={0.14}>
        <Row icon={FileText} label="Termos de uso" onClick={() => navigate("/termos-de-uso")} />
        <Row icon={Lock} label="Política de privacidade" onClick={() => navigate("/politica-privacidade")} />
      </Group>

      <Group title="Dados" delay={0.16}>
        {demoEnabled && <Row icon={Sparkles} label="Preencher com dados de exemplo" onClick={() => setSheet("demo")} />}
        <Row icon={Trash2} label="Apagar dados" danger onClick={openReset} />
        <Row icon={UserX} label="Excluir minha conta" danger onClick={() => { setDeleteConfirm(""); setSheet("deleteAccount"); }} />
      </Group>

      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        onClick={() => setSheet("logout")}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] willo-glass text-[15px] font-semibold text-white active:scale-[0.99]"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </motion.button>

      <p className="text-center text-[11.5px] text-white/38">Willo · seu dinheiro, organizado</p>

      {/* ═══ Edit profile ═══ */}
      <BottomSheet
        open={sheet === "profile"}
        onClose={close}
        footer={<SheetAction onClick={saveProfile} disabled={!editName.trim() || uploadingAvatar} loading={savingProfile} loadingLabel="Salvando…">Salvar</SheetAction>}
      >
        <div className="px-5 pb-4">
          <p className="text-[22px] font-bold tracking-tight text-white">Dados pessoais</p>
          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={() => avatarInput.current?.click()} disabled={uploadingAvatar} className="relative shrink-0" aria-label="Trocar foto">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#1C1C1C] ring-1 ring-white/10">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-[20px] font-bold text-white/80">{initials(editName || displayName)}</span>}
              </span>
              {uploadingAvatar && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </span>
              )}
            </button>
            <button type="button" onClick={() => avatarInput.current?.click()} disabled={uploadingAvatar} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-white active:opacity-70">
              <Camera className="h-3.5 w-3.5" /> {avatar ? "Trocar foto" : "Adicionar foto"}
            </button>
          </div>

          <SectionLabel>Nome</SectionLabel>
          <PillInput value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Seu nome" maxLength={40} />

          <SectionLabel>E-mail</SectionLabel>
          <PillInput value={email} disabled className="text-white/62" />

          <SectionLabel
            right={
              <button type="button" onClick={shuffleBio} className="flex items-center gap-1 text-[12px] font-semibold text-white/74 active:opacity-70">
                <Shuffle className="h-3.5 w-3.5" /> Sugerir
              </button>
            }
          >
            Frase do perfil
          </SectionLabel>
          <PillInput value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Uma frase que te motiva" maxLength={100} />
        </div>
      </BottomSheet>

      {/* ═══ Password ═══ */}
      <BottomSheet
        open={sheet === "password"}
        onClose={() => { if (!changingPassword) close(); }}
        footer={
          <SheetAction
            onClick={changePassword}
            disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
            loading={changingPassword}
            loadingLabel="Alterando…"
          >
            Alterar senha
          </SheetAction>
        }
      >
        <div className="px-5 pb-4">
          <p className="text-[22px] font-bold tracking-tight text-white">Senha e segurança</p>
          <p className="text-[14px] text-white/62">Troque a senha que você usa para entrar.</p>

          <SectionLabel right={<button type="button" onClick={forgotPassword} className="text-[12px] font-semibold text-white/74 active:opacity-70">Esqueci</button>}>
            Senha atual
          </SectionLabel>
          <PasswordField value={currentPassword} onChange={setCurrentPassword} placeholder="Digite sua senha atual" label="Senha atual" />

          <SectionLabel>Nova senha</SectionLabel>
          <PasswordField value={newPassword} onChange={setNewPassword} placeholder="Mínimo 6 caracteres" label="Nova senha" />
          <AnimatePresence>
            {strength && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-1">
                <div className="mt-3 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ background: strength.hex }}
                        initial={false}
                        animate={{ width: i <= strength.level ? "100%" : "0%" }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                      />
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px]">
                  <span className="font-semibold" style={{ color: strength.hex }}>{strength.label}</span>
                  <span className="text-white/56"> · {strength.hint}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <SectionLabel>Confirmar nova senha</SectionLabel>
          <PasswordField value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" label="Confirmar nova senha" />
          {confirmPassword && newPassword !== confirmPassword && <p className="mt-2 px-1 text-[12px] text-red-400">As senhas não coincidem</p>}
        </div>
      </BottomSheet>

      {/* ═══ Currency ═══ */}
      <BottomSheet open={sheet === "currency"} onClose={close}>
        <div className="px-5 pb-4">
          <p className="text-[22px] font-bold tracking-tight text-white">Moeda</p>
          <p className="mt-1 text-[13.5px] text-white/62">Muda como os valores aparecem no app. Os números que você lançou continuam os mesmos.</p>
          <div className="mt-4 max-h-[55vh] divide-y divide-white/[0.06] overflow-y-auto rounded-[22px] border border-white/[0.08] willo-glass">
            {CURRENCIES.map((c) => {
              const selected = c.code === getCurrency();
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    close();
                    if (!selected) setCurrency(c.code);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]"
                >
                  <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.06] px-2 text-[13px] font-bold text-white/80">
                    {currencySymbol(c.code)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-white">{c.name}</span>
                    <span className="block text-[12px] text-white/56">{c.code}</span>
                  </span>
                  {selected && <Check className="h-5 w-5 shrink-0 text-willo-green" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>

      {/* ═══ Erase data ═══ */}
      <BottomSheet open={sheet === "reset"} onClose={() => { if (!resetting) close(); }}>
        <div className="px-5 pb-4">
          <AnimatePresence mode="wait" initial={false}>
            {resetMode === "choose" ? (
              <motion.div key="choose" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <p className="text-[22px] font-bold tracking-tight text-white">Apagar dados</p>
                <p className="text-[14px] text-white/62">Escolha o que sai do app.</p>

                <button type="button" onClick={() => setResetMode("transactions")} className="mt-5 w-full rounded-[22px] border border-white/[0.08] willo-glass-inset p-4 text-left active:scale-[0.99]">
                  <p className="text-[16px] font-semibold text-white">Só as transações</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/66">Lançamentos, faturas e eventos somem e os saldos voltam ao valor inicial. Contas e cartões ficam.</p>
                </button>
                <button type="button" onClick={() => setResetMode("all")} className="mt-2.5 w-full rounded-[22px] border border-red-400/20 bg-red-400/[0.06] p-4 text-left active:scale-[0.99]">
                  <p className="text-[16px] font-semibold text-red-400">Tudo</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/66">Transações, contas, cartões e faturas. O app volta como se fosse novo.</p>
                </button>
              </motion.div>
            ) : (
              <motion.div key="confirm" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-400/[0.12]">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </span>
                <p className="mt-4 text-[22px] font-bold tracking-tight text-white">
                  {resetMode === "all" ? "Apagar tudo?" : "Apagar as transações?"}
                </p>
                <p className="text-[14px] text-white/62">Isso não pode ser desfeito.</p>

                <div className="mt-5 space-y-2 rounded-[20px] border border-white/[0.08] willo-glass-inset p-4 text-[13.5px]">
                  {(resetMode === "all"
                    ? ["Todas as transações", "Contas e carteiras", "Cartões de crédito e faturas", "Eventos financeiros"]
                    : ["Todas as transações", "Faturas e limite usado dos cartões", "Eventos financeiros", "Saldos voltam ao valor inicial"]
                  ).map((t) => (
                    <p key={t} className="flex items-center gap-2 text-white/82"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" /> {t}</p>
                  ))}
                  {resetMode === "transactions" && (
                    <p className="flex items-center gap-2 pt-1 text-white/82"><Check className="h-3.5 w-3.5 shrink-0 text-willo-green" strokeWidth={3} /> Contas, cartões e perfil ficam</p>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setResetMode("choose")} disabled={resetting} className="h-14 rounded-full border border-white/[0.1] bg-white/[0.06] text-[15px] font-semibold text-white">
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={resetMode === "all" ? resetAll : resetTransactions}
                    disabled={resetting}
                    className="flex h-14 items-center justify-center gap-2 rounded-full bg-red-500 text-[15px] font-bold text-white disabled:opacity-60"
                  >
                    {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {resetting ? "Apagando…" : "Apagar"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </BottomSheet>

      {/* ═══ Sample data (testing) ═══ */}
      <BottomSheet open={sheet === "demo"} onClose={() => { if (seedProgress === null) close(); }}>
        <div className="px-5 pb-4">
          <p className="text-[22px] font-bold tracking-tight text-white">Dados de exemplo</p>
          <p className="mt-1 text-[14px] leading-snug text-white/66">
            Preenche esta conta com 3 meses de dados fictícios para testar o app: contas, cartões, salário, gastos fixos e do dia a dia, uma compra parcelada e metas.
          </p>
          {accountsCount ? (
            <p className="mt-3 rounded-[16px] bg-amber-300/10 px-3.5 py-2.5 text-[12.5px] leading-snug text-amber-200">
              Esta conta já tem dados. Os exemplos entram junto com o que já existe.
            </p>
          ) : null}
          {seedProgress !== null && (
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div className="h-full rounded-full bg-willo-green" animate={{ width: `${seedProgress}%` }} />
              </div>
              <p className="mt-2 text-center text-[12.5px] text-white/62">Criando os dados… {seedProgress}%</p>
            </div>
          )}
          <div className="mt-6">
            <SheetAction
              loading={seedProgress !== null}
              loadingLabel="Criando…"
              onClick={async () => {
                if (!user) return;
                setSeedProgress(0);
                try {
                  await seedDemoData(user.id, (done, total) => setSeedProgress(Math.round((done / total) * 100)));
                  toast.success("Dados de exemplo criados");
                  close();
                  navigate("/");
                } catch (err: any) {
                  toast.error(err?.message || "Não foi possível criar os dados");
                } finally {
                  setSeedProgress(null);
                }
              }}
            >
              Preencher agora
            </SheetAction>
          </div>
        </div>
      </BottomSheet>

      {/* ═══ Delete account ═══ */}
      <BottomSheet open={sheet === "deleteAccount"} onClose={() => { if (!deletingAccount) close(); }}>
        <div className="px-5 pb-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-400/[0.12]">
            <UserX className="h-5 w-5 text-red-400" />
          </span>
          <p className="mt-4 text-[22px] font-bold tracking-tight text-white">Excluir minha conta</p>
          <p className="mt-1 text-[14px] leading-snug text-white/66">
            Apaga para sempre sua conta {email ? `(${email})` : ""} e tudo que está nela: transações, contas, cartões, faturas, metas e fotos. Não dá para desfazer nem recuperar depois.
          </p>

          <SectionLabel>Digite EXCLUIR para confirmar</SectionLabel>
          <PillInput
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
            placeholder="EXCLUIR"
            autoCapitalize="characters"
            aria-label="Digite EXCLUIR para confirmar"
          />

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleteConfirm !== "EXCLUIR" || deletingAccount}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-red-500 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
            >
              {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletingAccount ? "Excluindo…" : "Excluir minha conta"}
            </button>
            <button type="button" onClick={close} disabled={deletingAccount} className="w-full py-3 text-[14px] text-white/66">Cancelar</button>
          </div>
        </div>
      </BottomSheet>

      {/* ═══ Log out ═══ */}
      <BottomSheet open={sheet === "logout"} onClose={close}>
        <div className="px-5 pb-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08]">
            <LogOut className="h-5 w-5 text-white" />
          </span>
          <p className="mt-4 text-[22px] font-bold tracking-tight text-white">Sair da conta?</p>
          <p className="mt-1 text-[14px] text-white/62">Seus dados continuam salvos. É só entrar de novo com {email || "seu e-mail"}.</p>
          <div className="mt-6 space-y-2">
            <SheetAction onClick={logout}>Sair</SheetAction>
            <button type="button" onClick={close} className="w-full py-3 text-[14px] text-white/66">Cancelar</button>
          </div>
        </div>
      </BottomSheet>

      <NotificationSettingsModal open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
};

export default Configuracoes;
