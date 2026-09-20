import { memo } from "react";
import { Scale, TrendingUp, CalendarCheck } from "lucide-react";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";

interface SaldoCardProps {
  saldoAtual: number;
  saldoPrevisto: number;
  isFutureMonth?: boolean;
  isPastMonth?: boolean;
  mobile?: boolean;
}

const SaldoCard = memo(({ saldoAtual, saldoPrevisto, isFutureMonth, isPastMonth, mobile }: SaldoCardProps) => {
  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedPrevisto = useFormattedCounter(saldoPrevisto);

  return (
    <div
      className={`rounded-xl border border-border/10 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)] backdrop-blur-sm flex flex-col justify-between ${mobile ? "p-4" : "p-5"}`}
      style={{ background: "linear-gradient(160deg, hsl(0 0% 16% / 0.7) 0%, hsl(0 0% 10% / 0.85) 50%, hsl(0 0% 5% / 0.95) 100%)" }}
    >
      <div>
        {isFutureMonth ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-willo-green" />
                <span className="text-[10px] text-primary uppercase tracking-[0.15em] font-semibold">Saldo previsto</span>
              </div>
            </div>
            <p className={`font-display ${mobile ? "text-3xl" : "text-4xl"} font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-willo-green" : "text-destructive"} my-[7px]`}>
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Saldo ao final do mês</span>
              </div>
            </div>
            <p className={`font-display ${mobile ? "text-3xl" : "text-4xl"} font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-foreground" : "text-destructive"} my-[7px]`}>
              {animatedSaldo}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Saldo disponível</span>
              </div>
            </div>
            <p className={`font-display ${mobile ? "text-3xl" : "text-4xl"} font-bold tracking-tight tabular-nums leading-none ${saldoAtual >= 0 ? "text-foreground" : "text-destructive"} my-[7px]`}>
              {animatedSaldo}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${saldoPrevisto >= 0 ? "bg-willo-green" : "bg-destructive"}`} />
              <span className="text-[10px] text-muted-foreground/60">Saldo previsto no final do mês</span>
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

SaldoCard.displayName = "SaldoCard";
export default SaldoCard;
