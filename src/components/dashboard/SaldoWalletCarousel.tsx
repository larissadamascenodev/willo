import { memo } from "react";
import { Scale, TrendingUp, CalendarCheck } from "lucide-react";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";

interface Props {
  saldoAtual: number;
  saldoPrevisto: number;
  isFutureMonth?: boolean;
  isPastMonth?: boolean;
}

/**
 * Saldo card — used to be a swipeable carousel with a second "Minha
 * Carteira" wallet-summary slide, removed per request since it duplicated
 * WalletSummaryCard shown elsewhere on the dashboard.
 */
const SaldoWalletCarousel = memo(({ saldoAtual, saldoPrevisto, isFutureMonth, isPastMonth }: Props) => {
  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedPrevisto = useFormattedCounter(saldoPrevisto);

  const gradient = "linear-gradient(160deg, hsl(0 0% 16% / 0.7) 0%, hsl(0 0% 10% / 0.85) 50%, hsl(0 0% 5% / 0.95) 100%)";

  return (
    <div
      className="relative rounded-2xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] backdrop-blur-xl overflow-hidden border border-border/10"
      style={{ background: gradient }}
    >
      <div className="relative p-4">
        {isFutureMonth ? (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-willo-green" />
              <span className="text-[10px] text-primary uppercase tracking-[0.15em] font-semibold">Saldo previsto</span>
            </div>
            <p className={`font-display text-3xl font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-willo-green" : "text-destructive"} my-[7px]`}>
              {animatedSaldo}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${saldoPrevisto >= 0 ? "bg-willo-green" : "bg-destructive"}`} />
              <span className="text-[10px] text-muted-foreground/60">Projeção ao final do mês</span>
              <span className={`text-[13px] font-semibold tabular-nums tracking-tight ${saldoPrevisto >= 0 ? "text-willo-green/80" : "text-destructive/80"}`}>
                {animatedPrevisto}
              </span>
            </div>
          </>
        ) : isPastMonth ? (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Saldo ao final do mês</span>
            </div>
            <p className={`font-display text-3xl font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-foreground" : "text-destructive"} my-[7px]`}>
              {animatedSaldo}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <Scale className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Saldo disponível</span>
            </div>
            <p className={`font-display text-3xl font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-foreground" : "text-destructive"} my-[7px]`}>
              {animatedSaldo}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${saldoPrevisto >= 0 ? "bg-willo-green" : "bg-destructive"}`} />
              <span className="text-[10px] text-muted-foreground/60">Previsto no final do mês</span>
              <span className={`text-[13px] font-semibold tabular-nums tracking-tight ${saldoPrevisto >= 0 ? "text-willo-green/80" : "text-destructive/80"}`}>
                {animatedPrevisto}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

SaldoWalletCarousel.displayName = "SaldoWalletCarousel";
export default SaldoWalletCarousel;
