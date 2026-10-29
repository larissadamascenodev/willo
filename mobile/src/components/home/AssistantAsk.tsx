import { useEffect, useRef } from "react";
import { useAssistantSnapshot } from "@/hooks/useAssistantSnapshot";
import { askWillo, asking, brief } from "~/lib/assistantAsk";

/**
 * Puts one question to the Willo assistant, using the same snapshot of the person's
 * money the web's assistant page sends — so the numbers it answers with are the
 * app's own, not a guess.
 *
 * It draws nothing. It exists as a component, and is mounted only while a question
 * is open, because the snapshot is a hook: gathering it costs a few requests, and
 * the home should not pay for that on every visit when most visits ask nothing.
 */

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

    void (async () => {
      try {
        const reply = await askWillo([{ role: "user", content: asking(question) }], latest.current.build());
        if (alive.current) latest.current.onReply(brief(reply));
      } catch (err) {
        if (alive.current) latest.current.onFail(err instanceof Error ? err.message : "Não consegui falar com o Willo agora.");
      }
    })();
  }, [loading, question]);

  return null;
}
