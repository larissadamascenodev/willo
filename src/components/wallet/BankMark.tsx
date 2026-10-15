import { bankFor, initials } from "@/lib/banks";
import { inkOn, shade } from "@/lib/tone";

/**
 * The bank, as a mark.
 *
 * Not the bank's own logo: those are trademarks, and shipping them means shipping
 * someone else's artwork inside the app. This is the next most recognisable thing —
 * the bank's initials on a tile in the bank's own colour, which is how you pick your
 * card out of a wallet anyway, by colour first and letters second.
 *
 * A card with no bank behind it (a store card, a "cartão da obra") gets the initials
 * of whatever it was called, so every card has a face.
 */
export default function BankMark({ name, hex, size = 44 }: {
  name: string;
  /** The card's colour, already resolved. */
  hex: string;
  size?: number;
}) {
  const bank = bankFor(name);
  const letters = initials(bank?.name ?? name) || "••";

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-[14px]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${shade(hex, 0.18)} 0%, ${hex} 58%, ${shade(hex, -0.26)} 100%)`,
        boxShadow: `0 10px 22px -12px ${hex}, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
        color: inkOn(hex),
      }}
    >
      <span
        className="text-[14px] font-extrabold leading-none tracking-[-0.02em]"
        style={{ fontVariantCaps: "all-small-caps" }}
      >
        {letters}
      </span>
    </span>
  );
}
