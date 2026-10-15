import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getCurrency } from "@/lib/currency";
import { shade } from "@/lib/tone";
import { cn } from "@/lib/utils";
import BankMark from "./BankMark";

/**
 * One account, in the shape a card has.
 *
 * Glass, like everything else, with the bank's colour on its mark and on the share
 * rule and nowhere else — so a wallet of four banks is four marks you recognise rather
 * than four coloured panels fighting each other. The rule says how much of everything
 * you hold sits in this one account, which is the question a list of balances cannot
 * answer on its own.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

export interface AccountFace {
  id: string;
  name: string;
  typeLabel: string;
  balance: number;
  isDefault: boolean;
}

export default function AccountTile({ account, hex, share, index, onOpen, onHold }: {
  account: AccountFace;
  /** The bank's colour, already resolved. */
  hex: string;
  /** This account's part of everything held, 0–1. */
  share: number;
  index: number;
  onOpen: () => void;
  onHold?: () => void;
}) {
  const negative = account.balance < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onContextMenu={(e) => { if (onHold) e.preventDefault(); }}
      onClick={onOpen}
      style={{
        background: "rgba(255, 255, 255, 0.055)",
        backdropFilter: "blur(26px) saturate(140%)",
        WebkitBackdropFilter: "blur(26px) saturate(140%)",
        boxShadow: "0 24px 50px -32px rgb(0 0 0 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.08)",
      }}
      className="relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.10] px-[18px] pb-[18px] pt-[17px] transition-transform duration-200 active:scale-[0.985]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
      />

      <div className="relative flex items-center gap-3">
        <BankMark name={account.name} hex={hex} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-white">{account.name}</p>
          <p className="truncate text-[11.5px] t-softer">{account.typeLabel}</p>
        </div>

        {account.isDefault && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
            style={{ background: `rgb(255 255 255 / 0.08)`, color: shade(hex, 0.66) }}
          >
            Principal
          </span>
        )}
        <ChevronRight className="h-[18px] w-[18px] shrink-0 t-faint" />
      </div>

      <p className={cn(
        "relative mt-5 truncate text-[29px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
        negative ? "text-red-400" : account.balance > 0 ? "text-white" : "t-softer",
      )}>
        {fmt(account.balance)}
      </p>

      <div className="relative mt-4 h-[7px] overflow-hidden rounded-full bg-white/[0.08]">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: hex, boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(share * 100, share > 0 ? 4 : 0)}%` }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 + index * 0.07 }}
        />
      </div>

      <p className="relative mt-2 text-[11.5px] t-softer">
        {share > 0 ? (
          <>
            <span className="font-semibold tabular-nums" style={{ color: shade(hex, 0.58) }}>
              {Math.round(share * 100)}%
            </span>{" "}
            do que você tem
          </>
        ) : negative ? (
          "Conta no negativo"
        ) : (
          "Sem saldo nesta conta"
        )}
      </p>
    </motion.div>
  );
}
