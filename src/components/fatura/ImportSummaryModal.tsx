import { AlertTriangle, Check, Layers, RotateCcw, Wallet } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import { fmtCents } from "@/lib/invoice/money";
import { cn } from "@/lib/utils";
import type { InvoiceImportResult } from "@/lib/invoice/types";
import type { PaymentMatchResult } from "@/services/importedPayments";

/**
 * What the import did, said once, afterwards.
 *
 * The review before it asks a question; this answers it. The two figures that matter sit at
 * the top, the bank's and ours, and a difference is stated rather than smoothed: the
 * statement's number was preserved and nothing was adjusted to make the two agree.
 */

const Line = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-[7px]">
    <span className="text-[13px] text-white/55">{label}</span>
    <span className={cn("shrink-0 text-[14px] font-semibold tabular-nums", muted ? "text-white/70" : "text-white")}>
      {value}
    </span>
  </div>
);

export default function ImportSummaryModal({
  open,
  onClose,
  result,
  rowsWritten,
  payments,
}: {
  open: boolean;
  onClose: () => void;
  result: InvoiceImportResult | null;
  rowsWritten: number;
  payments: PaymentMatchResult | null;
}) {
  if (!result) return null;

  const { reconciliation: rec, limitReconciliation: lim } = result;
  const reconciled = rec.status === "RECONCILED";
  const future = result.installments.filter((i) => i.status === "FUTURE");
  const anticipated = result.installments.filter((i) => i.status === "ANTICIPATED");
  const credits = result.operations.filter((o) => o.amountThisInvoice < 0);
  const creditTotal = credits.reduce((s, o) => s + o.amountThisInvoice, 0);

  return (
    <BottomSheet open={open} onClose={onClose} zIndex={76}>
      <div className="px-5 pb-1">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              reconciled ? "bg-willo-green" : "bg-amber-300",
            )}
          >
            {reconciled ? (
              <Check className="h-[18px] w-[18px] text-[#0B0B0B]" strokeWidth={3.2} />
            ) : (
              <AlertTriangle className="h-[18px] w-[18px] text-[#0B0B0B]" strokeWidth={2.4} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-tight text-white">Fatura importada</p>
            <p className="mt-0.5 text-[12.5px] text-white/50">
              {rowsWritten} lançamento{rowsWritten === 1 ? "" : "s"} gravado{rowsWritten === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
          {rec.officialTotal != null && <Line label="Valor oficial da fatura" value={fmtCents(rec.officialTotal)} />}
          <Line label="Valor reconciliado" value={fmtCents(rec.calculatedTotal)} muted />
          {!reconciled && rec.difference != null && (
            <div className="mt-2 border-t border-white/[0.07] pt-2.5">
              <p className="text-[12.5px] leading-snug text-amber-300">
                Diferença de {fmtCents(Math.abs(rec.difference))}.
              </p>
              <p className="mt-1 text-[12px] leading-snug text-white/50">
                O valor da fatura foi preservado. Nada foi ajustado para os dois baterem.
              </p>
            </div>
          )}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
            <Layers className="h-4 w-4 text-white/40" />
            <p className="mt-1.5 text-[18px] font-bold leading-none tabular-nums text-white">{future.length}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-white/50">
              parcelas futuras{anticipated.length > 0 ? `, ${anticipated.length} antecipada${anticipated.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
            <RotateCcw className="h-4 w-4 text-white/40" />
            <p className="mt-1.5 text-[18px] font-bold leading-none tabular-nums text-white">
              {fmtCents(Math.abs(creditTotal))}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-white/50">
              em créditos e estornos{credits.length ? `, ${credits.length} linha${credits.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>

        {result.payments.length > 0 && (
          <div className="mt-2.5 rounded-[20px] border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-white/40" />
              <span className="text-[13px] text-white/60">Pagamentos identificados</span>
              <span className="ml-auto text-[14px] font-semibold tabular-nums text-white">
                {fmtCents(result.payments.reduce((s, p) => s + p.amount, 0))}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-white/45">
              {payments && payments.matched.length > 0
                ? `${payments.matched.length} de ${result.payments.length} foram lançados nas faturas que você tem aqui, liberando limite. Os outros quitaram faturas anteriores ao que o app guarda.`
                : "Nenhum deles corresponde a uma fatura que o app tem. O efeito já está no saldo que veio da fatura anterior."}
            </p>
          </div>
        )}

        <div className="mt-2.5 rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
          <Line label="Limite utilizado, nossa conta" value={fmtCents(lim.calculatedUsed)} />
          {lim.officialUsed != null && (
            <Line label="Limite utilizado, na fatura" value={fmtCents(lim.officialUsed)} muted />
          )}
          {lim.status === "DISCREPANCY" && lim.difference != null && (
            <p className="mt-2 border-t border-white/[0.07] pt-2.5 text-[12px] leading-snug text-white/50">
              {fmtCents(Math.abs(lim.difference))} de diferença. Guardamos os dois, e o número do banco
              não entra em nenhum cálculo.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 flex h-[52px] w-full items-center justify-center rounded-full bg-white text-[15.5px] font-bold text-[#0B0B0B] active:opacity-80"
        >
          Entendi
        </button>
      </div>
    </BottomSheet>
  );
}
