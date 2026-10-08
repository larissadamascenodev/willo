import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = {
  connected: boolean;
  email: string | null;
  configurado: boolean;
};

const STATE_KEY = "willo-gmail-oauth-state";

/** Where Google sends the person back. Must match the Google Cloud client exactly. */
const redirectUri = () => `${window.location.origin}/assistente`;

async function call(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("gmail-connect", {
    body: { action, ...extra },
  });
  if (error) {
    let said: string | null = null;
    try {
      said = (await (error as any)?.context?.json?.())?.error ?? null;
    } catch {
      said = null;
    }
    throw new Error(said || "Não consegui falar com o servidor.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Connecting the mailbox the assistant reads from.
 *
 * The browser never holds the client id, the secret or the tokens: it asks the function
 * for a URL to open and hands back the code Google returns. The random state is kept
 * here and checked on the way back, so a code someone else obtained cannot be used to
 * attach their mailbox to this account.
 */
export default function GmailConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await call("status"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error");

    const clean = () =>
      window.history.replaceState({}, "", window.location.pathname);

    if (denied) {
      clean();
      sessionStorage.removeItem(STATE_KEY);
      toast.error("Você cancelou a conexão com o Gmail.");
      void load();
      return;
    }

    if (!code) {
      void load();
      return;
    }

    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    clean();

    if (!expected || expected !== state) {
      toast.error("A volta do Google não confere. Tente conectar de novo.");
      void load();
      return;
    }

    setBusy(true);
    call("exchange", { code, redirect_uri: redirectUri() })
      .then((r) => {
        toast.success(`Gmail conectado${r?.email ? `: ${r.email}` : ""}.`);
        return load();
      })
      .catch((err) => toast.error(err?.message || "Não consegui conectar o Gmail."))
      .finally(() => setBusy(false));
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem(STATE_KEY, state);
      const { url } = await call("auth_url", { redirect_uri: redirectUri(), state });
      window.location.href = url;
    } catch (err: any) {
      sessionStorage.removeItem(STATE_KEY);
      toast.error(err?.message || "Não consegui abrir a autorização do Google.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await call("disconnect");
      setConfirmOff(false);
      toast.success("Gmail desconectado.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Não consegui desconectar.");
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className="rounded-[20px] border border-white/[0.07] willo-glass px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
          <Mail className="h-[17px] w-[17px] text-white/75" strokeWidth={2.1} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white">
            {status.connected ? "Gmail conectado" : "Conectar o Gmail"}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-white/48">
            {status.connected
              ? status.email
              : status.configurado
                ? "Para eu achar fatura, comprovante e cobrança na sua caixa"
                : "Falta cadastrar as credenciais do Google no servidor"}
          </p>
        </div>

        {status.connected ? (
          <button
            type="button"
            onClick={() => setConfirmOff((v) => !v)}
            disabled={busy}
            aria-label="Desconectar o Gmail"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/60 active:opacity-60 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy || !status.configurado}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold text-[#0B0B0B] active:opacity-80 disabled:opacity-25"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            Conectar
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {confirmOff && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <p className="text-[12.5px] leading-snug text-white/65">
                Desconectar remove o acesso do Willo à sua caixa, na sua conta Google também.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOff(false)}
                  className="h-10 flex-1 rounded-full border border-white/[0.1] bg-white/[0.04] text-[13.5px] font-semibold text-white/80 active:opacity-70"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="h-10 flex-1 rounded-full bg-red-400 text-[13.5px] font-bold text-[#0B0B0B] active:opacity-80 disabled:opacity-50"
                >
                  Desconectar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!status.connected && status.configurado && (
        <p className="mt-2.5 text-[11.5px] leading-snug text-white/35">
          O Willo pede permissão só de leitura. Ele não envia, não apaga e não altera nada no seu email.
        </p>
      )}
    </div>
  );
}
