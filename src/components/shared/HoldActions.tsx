import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "./AnchoredMenu";

/**
 * What a held item offers. Editing and removing live here rather than as buttons on
 * the thing itself: a list of rows each carrying two controls is a toolbar, and the
 * two actions are rare enough to be worth a deliberate gesture.
 *
 * Both answers are immediate. Editar opens the form — it used to open a card that
 * offered "edit", which is the same word twice and a tap for nothing — and Excluir
 * asks here, in the menu already under your thumb, instead of handing the question to
 * a dialog somewhere else on the screen.
 */
export default function HoldActions({
  open, title, subtitle, anchor, onClose, onEdit, onDelete,
  confirmDelete = true, deleteNote,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Where the held row is. Without one the menu sits in the middle of the screen. */
  anchor?: AnchorRect | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Off when the caller has a confirmation of its own to go to. */
  confirmDelete?: boolean;
  /** What removing this will also take with it, when that is not obvious. */
  deleteNote?: string;
}) {
  const [asking, setAsking] = useState(false);

  /* A menu that reopens should never reopen mid-question. */
  useEffect(() => { if (!open) setAsking(false); }, [open]);

  return (
    <AnchoredMenu open={open} anchor={anchor} onClose={onClose}>
      <MenuHeader title={title} subtitle={asking ? "Excluir este lançamento?" : subtitle} />

      {asking ? (
        <div className="p-3">
          <div className="flex items-start gap-2.5 px-1 pb-3">
            <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0 text-red-400" />
            <p className="text-[12.5px] leading-snug text-white/78">
              {deleteNote ?? "Isso não pode ser desfeito."}
            </p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="h-11 w-full rounded-[14px] bg-red-500 text-[14.5px] font-bold text-white active:opacity-80"
          >
            Excluir
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.07] text-[14.5px] font-semibold text-white active:opacity-70"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <MenuRow icon={Pencil} label="Editar" onClick={onEdit} />
          <MenuRow
            icon={Trash2}
            label="Excluir"
            danger
            onClick={() => (confirmDelete ? setAsking(true) : onDelete())}
          />
        </>
      )}
    </AnchoredMenu>
  );
}
