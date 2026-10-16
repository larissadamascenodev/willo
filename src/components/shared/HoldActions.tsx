import { Pencil, Trash2 } from "lucide-react";
import AnchoredMenu, { MenuRow, type AnchorRect } from "./AnchoredMenu";

/**
 * What a held item offers. Editing and removing live here rather than as buttons on
 * the thing itself: a list of rows each carrying two controls is a toolbar, and the
 * two actions are rare enough to be worth a deliberate gesture.
 *
 * It opens beside what is held, over a blurred page, the way the home screen's cards
 * do — the gesture is the same, so the answer to it should look the same.
 */
export default function HoldActions({ open, title, subtitle, anchor, onClose, onEdit, onDelete }: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Where the held row is. Without one the menu sits in the middle of the screen. */
  anchor?: AnchorRect | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <AnchoredMenu open={open} anchor={anchor} onClose={onClose}>
      <div className="border-b border-white/[0.08] px-4 pb-2.5 pt-3">
        <p className="truncate text-[13.5px] font-semibold text-white">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-[11.5px] t-softer">{subtitle}</p>}
      </div>
      <MenuRow icon={Pencil} label="Editar" onClick={onEdit} />
      <MenuRow icon={Trash2} label="Excluir" danger onClick={onDelete} />
    </AnchoredMenu>
  );
}
