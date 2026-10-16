import { Eye, EyeOff, Pencil, RectangleHorizontal, Square, Trash2 } from "lucide-react";
import AnchoredMenu, { MenuRow, type AnchorRect } from "@/components/shared/AnchoredMenu";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "@/lib/homeWidgets";

/** What can be done to the card you are holding, opened beside it. */

export interface WidgetMenuTarget {
  id: string;
  label: string;
  description: string;
  size: WidgetSize;
  resizable: boolean;
  rect: AnchorRect;
}

export default function WidgetMenu({ target, onClose, onEdit, onResize, onRemove }: {
  target: WidgetMenuTarget | null;
  onClose: () => void;
  onEdit: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}) {
  const hidden = useHiddenValues();

  return (
    <AnchoredMenu open={!!target} anchor={target?.rect} onClose={onClose}>
      <MenuRow
        icon={hidden ? Eye : EyeOff}
        label={hidden ? "Mostrar dados" : "Ocultar dados"}
        onClick={() => { setHiddenValues(!hidden); onClose(); }}
      />
      <MenuRow icon={Pencil} label="Editar widgets" onClick={onEdit} />
      <MenuRow icon={Trash2} label="Remover" danger onClick={onRemove} />

      {target?.resizable && (
        <div className="flex items-center justify-center gap-2 border-t border-white/[0.08] px-3 py-2.5">
          <SizeButton
            icon={Square}
            active={target.size === "half"}
            label="Metade da linha"
            onClick={() => onResize("half")}
          />
          <SizeButton
            icon={RectangleHorizontal}
            active={target.size === "full"}
            label="Linha inteira"
            onClick={() => onResize("full")}
          />
        </div>
      )}
    </AnchoredMenu>
  );
}

function SizeButton({ icon: Icon, active, label, onClick }: {
  icon: typeof Square;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-11 flex-1 items-center justify-center rounded-[14px] border transition-colors",
        active
          ? "border-willo-green/60 bg-willo-green/[0.12] text-willo-green-ink"
          : "border-white/[0.10] bg-white/[0.04] text-white/70",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </button>
  );
}
