import { toast } from "sonner";
import { Check } from "lucide-react";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";

/** Warm sign-in confirmation, in the app's graphite style. */
export function showWelcomeToast(name?: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  toast.custom(
    () => (
      <div className="flex w-[calc(100vw-24px)] max-w-[380px] items-center gap-3 rounded-[22px] border border-white/[0.1] bg-[#1A1A1A]/95 p-3.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-willo-green/15">
          <img src={wordmarkOnDark} alt="" className="h-3 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1A1A1A] bg-willo-green">
            <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.5} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {greeting}{first ? `, ${first}` : ""}!
          </p>
          <p className="truncate text-[12.5px] text-white/50">Seu painel está pronto</p>
        </div>
      </div>
    ),
    { duration: 3000, position: "top-center" },
  );
}
