import type { ReactNode } from "react";
import { View } from "react-native";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import { th } from "~/theme/theme";

/** Where an entry's money went through: an account or a card, by name and colour. */
export interface EntryBank {
  name: string;
  color?: string | null;
}

/**
 * An entry's own mark with the bank it went through on its corner, small, as the bank apps
 * draw it: the category says what it was, the bank says where it came out of. A thin ring of
 * the page's ground keeps the two apart.
 */
export default function WithBank({ bank, size, children }: { bank?: EntryBank | null; size: number; children: ReactNode }) {
  const mark = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size }}>
      {children}
      {bank ? (
        <View style={{ position: "absolute", right: -4, bottom: -3, padding: 2, borderRadius: mark, backgroundColor: th("#0B0C0F", "bg") }}>
          <BankMark name={bank.name} hex={colorFor(bank.name, bank.color)} size={mark} />
        </View>
      ) : null}
    </View>
  );
}

/** The bank of an entry: its card for a purchase on credit (or an invoice), its account otherwise. */
export function bankOf(
  entry: { account_id?: string | null; credit_card_id?: string | null; payment_method?: string | null },
  banks: Record<string, EntryBank> | undefined,
): EntryBank | null {
  if (!banks) return null;
  if (entry.credit_card_id && (entry.payment_method === "cartao" || !entry.account_id)) return banks[entry.credit_card_id] ?? null;
  return entry.account_id ? (banks[entry.account_id] ?? null) : null;
}

/** Every account and card by id, to find an entry's bank. */
export function banksById(...lists: ({ id: string; name: string; color?: string | null }[] | undefined)[]): Record<string, EntryBank> {
  const out: Record<string, EntryBank> = {};
  for (const list of lists) for (const b of list ?? []) out[b.id] = { name: b.name, color: b.color ?? null };
  return out;
}
