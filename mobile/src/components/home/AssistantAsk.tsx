import { useEffect, useRef } from "react";
import { useAssistantSnapshot } from "@/hooks/useAssistantSnapshot";
import { supabase } from "~/supabase/client";
import { asking, brief } from "~/lib/assistantAsk";

/**
 * Puts one question to the Willo assistant, using the same snapshot of the person's
 * money the web's assistant page sends — so the numbers it answers with are the
 * app's own, not a guess.
 *
 * It draws nothing. It exists as a component, and is mounted only while a question
 * is open, because the snapshot is a hook: gathering it costs a few requests, and
 * the home should not pay for that on every visit when most visits ask nothing.
 */

const GIVE_UP_MS = 50_000;

export default function AssistantAsk({
  question,
  onReply,
  onFail,
}: {
  question: string;
  onReply: (text: string) => void;
  onFail: (reason: string) => void;
}) {
  const { build, loading } = useAssistantSnapshot();
  const sent = useRef(false);
  /* The screen redraws while this waits, and the callbacks it was handed with it.
     What counts is whether it has been taken away, not whether it was redrawn. */
  const alive = useRef(true);
  const latest = useRef({ onReply, onFail, build });
  latest.current = { onReply, onFail, build };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (loading || sent.current) return;
    sent.current = true;

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("O Willo demorou a responder. Tente de novo.")), GIVE_UP_MS));

    void (async () => {
      try {
        const { data, error } = await Promise.race([
          supabase.functions.invoke("willo-assistant", {
            body: { messages: [{ role: "user", content: asking(question) }], snapshot: latest.current.build() },
          }),
          timeout,
        ]);
        if (error) {
          let said: string | null = null;
          try {
            said = (await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.())?.error ?? null;
          } catch {
            said = null;
          }
          throw new Error(said || "Não consegui falar com o Willo agora.");
        }
        if (data?.error) throw new Error(data.error);
        if (alive.current) latest.current.onReply(brief(String(data?.reply ?? "")));
      } catch (err) {
        if (alive.current) latest.current.onFail(err instanceof Error ? err.message : "Não consegui falar com o Willo agora.");
      }
    })();
  }, [loading, question]);

  return null;
}
