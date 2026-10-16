import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, Maximize2, Minimize2, Pencil, Plus, Trash2, X } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import { useLongPress } from "@/hooks/useLongPress";
import {
  WIDGETS, loadLayout, saveLayout, setDismissed, widgetById,
  type WidgetSize, type WidgetSlot,
} from "@/lib/homeWidgets";
import { cn } from "@/lib/utils";

/**
 * The home screen, arranged by the person using it.
 *
 * Holding a card opens what can be done to it; editing turns the whole board into
 * something you can rearrange, where each card carries its own controls — up, down,
 * wider, narrower, gone. There is no free dragging: on a phone, dragging a card past
 * a screenful of other cards is a worse way to move something one place up than a
 * button that moves it one place up.
 *
 * A card taken off the board is not deleted, only set aside; the add screen is the
 * same list with the ones currently off it.
 */

interface Props {
  userId?: string;
  /** Draws a widget at the width it is currently set to. */
  render: (id: string, size: WidgetSize) => ReactNode;
}

export default function WidgetBoard({ userId, render }: Props) {
  const [slots, setSlots] = useState<WidgetSlot[]>(() => loadLayout(userId));
  const [editing, setEditing] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { setSlots(loadLayout(userId)); }, [userId]);

  const commit = useCallback((next: WidgetSlot[]) => {
    setSlots(next);
    saveLayout(userId, next);
  }, [userId]);

  const move = (id: string, delta: -1 | 1) => {
    const i = slots.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const resize = (id: string) => {
    commit(slots.map((s) => (s.id === id ? { ...s, size: s.size === "full" ? "half" : "full" } : s)));
  };

  const remove = (id: string) => {
    setDismissed(userId, id, true);
    commit(slots.filter((s) => s.id !== id));
    setHeld(null);
  };

  const add = (id: string) => {
    const def = widgetById(id);
    if (!def) return;
    setDismissed(userId, id, false);
    commit([...slots, { id, size: def.defaultSize }]);
  };

  /* Consecutive halves share a row; a full takes one of its own. Done here rather
     than with a CSS grid so a lone half at the end keeps its width instead of
     stretching to fill a row it is the only thing in. */
  const rows = useMemo(() => {
    const out: WidgetSlot[][] = [];
    let row: WidgetSlot[] = [];
    for (const slot of slots) {
      if (slot.size === "full") {
        if (row.length) { out.push(row); row = []; }
        out.push([slot]);
        continue;
      }
      row.push(slot);
      if (row.length === 2) { out.push(row); row = []; }
    }
    if (row.length) out.push(row);
    return out;
  }, [slots]);

  const missing = WIDGETS.filter((w) => !slots.some((s) => s.id === w.id));
  const heldDef = held ? widgetById(held) : null;

  return (
    <>
      {/* While editing, a bar says so and gives the way out. */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-0 z-40 flex justify-center px-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
          >
            <div
              className="flex items-center gap-3 rounded-full border border-white/[0.10] py-1.5 pl-5 pr-1.5 backdrop-blur-xl"
              style={{ background: "rgba(16,16,19,0.82)" }}
            >
              <span className="text-[14px] font-semibold text-white">Editando a tela</span>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-willo-green px-4 text-[13.5px] font-bold text-[#0B0B0B] active:opacity-80"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Concluído
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={row.map((s) => s.id).join("+") + ri} className={cn(row.length === 2 && "grid grid-cols-2 gap-3")}>
            {row.map((slot) => (
              <WidgetFrame
                key={slot.id}
                slot={slot}
                editing={editing}
                first={slots[0]?.id === slot.id}
                last={slots[slots.length - 1]?.id === slot.id}
                onHold={() => !editing && setHeld(slot.id)}
                onMove={(d) => move(slot.id, d)}
                onResize={() => resize(slot.id)}
                onRemove={() => remove(slot.id)}
              >
                {render(slot.id, slot.size)}
              </WidgetFrame>
            ))}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/[0.16] text-[14px] font-semibold text-white/80 active:opacity-70"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> Adicionar widgets
        </button>
      </div>

      {/* Held: what can be done to this one card. */}
      <BottomSheet open={!!held} onClose={() => setHeld(null)}>
        <div className="px-5 pb-2">
          <h2 className="text-[20px] font-extrabold tracking-tight text-white">{heldDef?.label}</h2>
          <p className="mt-1 text-[13px] leading-snug text-white/62">{heldDef?.description}</p>

          <div className="mt-5 space-y-2.5">
            <SheetRow
              icon={Pencil}
              label="Editar a tela"
              hint="Mover, aumentar ou tirar os cards"
              onClick={() => { setHeld(null); setEditing(true); }}
            />
            {heldDef?.resizable && (
              <SheetRow
                icon={slots.find((s) => s.id === held)?.size === "full" ? Minimize2 : Maximize2}
                label={slots.find((s) => s.id === held)?.size === "full" ? "Deixar menor" : "Ocupar a linha toda"}
                hint={slots.find((s) => s.id === held)?.size === "full"
                  ? "Divide a linha com outro card"
                  : "Ocupa a largura inteira"}
                onClick={() => { if (held) resize(held); setHeld(null); }}
              />
            )}
            <SheetRow
              icon={Trash2}
              label="Remover da tela"
              hint="Some daqui, mas continua em Adicionar widgets"
              danger
              onClick={() => held && remove(held)}
            />
          </div>
        </div>
      </BottomSheet>

      {/* The ones currently off the board. */}
      <BottomSheet open={adding} onClose={() => setAdding(false)} size="full">
        <div className="px-5 pb-2">
          <h2 className="text-[22px] font-extrabold tracking-tight text-white">Adicionar widgets</h2>
          <p className="mt-1 text-[13px] leading-snug text-white/62">
            {missing.length > 0
              ? "Tudo que não está na sua tela agora."
              : "Todos os widgets já estão na sua tela."}
          </p>

          <div className="mt-5 space-y-2.5">
            {missing.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-[20px] border border-white/[0.08] willo-glass-inset px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-white">{w.label}</p>
                  <p className="truncate text-[12.5px] t-softer">{w.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => add(w.id)}
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-[#0B0B0B] active:opacity-80"
                >
                  Adicionar
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

function SheetRow({ icon: Icon, label, hint, danger, onClick }: {
  icon: typeof Pencil;
  label: string;
  hint: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[20px] border border-white/[0.08] willo-glass-inset px-4 py-3.5 text-left active:scale-[0.99]"
    >
      <span className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        danger ? "bg-red-400/15 text-red-400" : "bg-white/[0.07] text-white/85",
      )}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-semibold", danger ? "text-red-400" : "text-white")}>{label}</span>
        <span className="block truncate text-[12.5px] t-softer">{hint}</span>
      </span>
    </button>
  );
}

/** One card on the board: held to open its options, and in edit mode, its controls. */
function WidgetFrame({ slot, editing, first, last, children, onHold, onMove, onResize, onRemove }: {
  slot: WidgetSlot;
  editing: boolean;
  first: boolean;
  last: boolean;
  children: ReactNode;
  onHold: () => void;
  onMove: (delta: -1 | 1) => void;
  onResize: () => void;
  onRemove: () => void;
}) {
  /* The hook swallows the tap for an element it wraps; here the card is a child that
     owns its own click, so the tap after a hold is caught on the way down instead. */
  const fired = useRef(false);
  const press = useLongPress(() => { fired.current = true; onHold(); });
  const def = widgetById(slot.id);

  return (
    <motion.div layout transition={{ type: "spring", stiffness: 420, damping: 36 }} className="relative min-w-0">
      <div
        onPointerDown={editing ? undefined : press.onPointerDown}
        onPointerMove={editing ? undefined : press.onPointerMove}
        onPointerUp={editing ? undefined : press.onPointerUp}
        onPointerCancel={editing ? undefined : press.onPointerCancel}
        onPointerLeave={editing ? undefined : press.onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (!fired.current) return;
          fired.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(editing && "pointer-events-none select-none")}
        style={editing ? { filter: "saturate(0.85)" } : undefined}
      >
        {children}
      </div>

      <AnimatePresence>
        {editing && (
          <>
            {/* The controls sit over the card, which is not tappable while they are up. */}
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={onRemove}
              aria-label={`Remover ${def?.label}`}
              className="absolute -left-1.5 -top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0B0B0B] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.9)]"
            >
              <X className="h-4 w-4" strokeWidth={3} />
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-center gap-1.5"
            >
              <Ctl icon={ArrowUp} disabled={first} onClick={() => onMove(-1)} label="Mover para cima" />
              <Ctl icon={ArrowDown} disabled={last} onClick={() => onMove(1)} label="Mover para baixo" />
              {def?.resizable && (
                <Ctl
                  icon={slot.size === "full" ? Minimize2 : Maximize2}
                  onClick={onResize}
                  label={slot.size === "full" ? "Deixar menor" : "Ocupar a linha"}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Ctl({ icon: Icon, onClick, disabled, label }: {
  icon: typeof ArrowUp;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] backdrop-blur-xl transition-opacity",
        disabled ? "opacity-25" : "active:scale-95",
      )}
      style={{ background: "rgba(16,16,19,0.86)" }}
    >
      <Icon className="h-4 w-4 text-white" strokeWidth={2.4} />
    </button>
  );
}
