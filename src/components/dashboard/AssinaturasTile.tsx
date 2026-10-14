import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { StatTile } from "@/components/dashboard/StatTile";
import { useRecorrentes, daysUntil } from "@/hooks/useRecorrentes";
import { getCurrency } from "@/lib/currency";

/**
 * What repeats every month and carries a brand: Netflix, the gym, the phone plan.
 *
 * It is a slice of the recurring charges rather than a list of its own, because
 * nothing in the data marks a row as a subscription — see subscriptionBrands.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const AssinaturasTile = memo(() => {
  const navigate = useNavigate();
  const { assinaturas, totalAssinaturas, loading } = useRecorrentes();

  if (loading) {
    return <div className="h-[176px] animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />;
  }

  const n = assinaturas.length;

  if (n === 0) {
    return (
      <StatTile
        label="Assinaturas"
        value={fmt(0)}
        caption="Nenhuma assinatura ativa"
        icon={RefreshCw}
        accent="#7DD3FC"
        empty
        onClick={() => navigate("/transacoes?filtro=recorrentes")}
      />
    );
  }

  // The one falling due soonest is the only thing here you might still act on.
  const proxima = assinaturas.filter((a) => !a.isPaidThisMonth)
    .sort((a, b) => daysUntil(a.dueDay) - daysUntil(b.dueDay))[0];

  return (
    <StatTile
      label="Assinaturas"
      value={fmt(totalAssinaturas)}
      caption={proxima
        ? `${n} ${n === 1 ? "ativa" : "ativas"} · ${proxima.name} dia ${proxima.dueDay}`
        : `${n} ${n === 1 ? "ativa" : "ativas"} · tudo pago no mês`}
      icon={RefreshCw}
      accent="#7DD3FC"
      onClick={() => navigate("/transacoes?filtro=recorrentes")}
    />
  );
});

AssinaturasTile.displayName = "AssinaturasTile";
export default AssinaturasTile;
