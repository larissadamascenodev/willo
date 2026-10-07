import { Pencil, Trash2 } from "lucide-react";
import BottomSheet from "./BottomSheet";

/**
 * What a held item offers. Editing and removing live here rather than as buttons on
 * the thing itself: a list of rows each carrying two controls is a toolbar, and the
 * two actions are rare enough to be worth a deliberate gesture.
 */
export default function HoldActions({ open, title, subtitle, onClose, onEdit, onDelete }: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} zIndex={74}>
      <div className="px-5 pb-2">
        <p className="truncate text-[17px] font-bold text-white">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-white/50">{subtitle}</p>}

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-[52px] w-full items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.04] px-4 text-left text-[15px] font-semibold text-white active:opacity-75"
          >
            <Pencil className="h-[18px] w-[18px] text-white/60" strokeWidth={2.1} /> Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-[52px] w-full items-center gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.08] px-4 text-left text-[15px] font-semibold text-red-400 active:opacity-75"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.1} /> Excluir
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
