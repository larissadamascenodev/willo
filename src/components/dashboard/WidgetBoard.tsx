import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsLeftRight, ChevronsRightLeft, Plus, X } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import WidgetMenu, { type WidgetMenuTarget } from "./WidgetMenu";
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
  const [held, setHeld] = useState<WidgetMenuTarget | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { setSlots(loadLayout(userId)); }, [userId]);

  const commit = useCallback((next: WidgetSlot[]) => {
    setSlots(next);
    saveLayout(userId, next);
  }, [userId]);

  /* Where each card is right now, so a dragged one knows what it is over. */
  const frames = useRef(new Map<string, HTMLDivElement>());
  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) frames.current.set(id, el);
    else frames.current.delete(id);
  }, []);

  /* Dragging moves the order, not the card: whatever is under the finger changes
     places with it, and the layout animation carries everything to its new seat. */
  const dragTo = (id: string, x: number, y: number) => {
    let overId: string | null = null;
    frames.current.forEach((el, key) => {
      if (key === id) return;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) overId = key;
    });
    if (!overId) return;
    setSlots((current) => {
      const from = current.findIndex((s) => s.id === id);
      const to = current.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveLayout(userId, next);
      return next;
    });
  };

  const remove = (id: string) => {
    setDismissed(userId, id, true);
    commit(slots.filter((s) => s.id !== id));
    setHeld(null);
  };

  const setSize = (id: string, size: WidgetSize) => {
    commit(slots.map((s) => (s.id === id ? { ...s, size } : s)));
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
              <span className="text-[14px] font-semibold text-white">Arraste para mover</span>
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
                onHold={(rect) => {
                  if (editing) return;
                  const def = widgetById(slot.id);
                  if (!def) return;
                  setHeld({
                    id: slot.id,
                    label: def.label,
                    description: def.description,
                    size: slot.size,
                    resizable: def.resizable,
                    rect,
                  });
                }}
                onDragTo={dragTo}
                onResize={(size) => setSize(slot.id, size)}
                onRemove={() => remove(slot.id)}
                registerRef={registerRef}
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

      {/* Held: a menu beside the card, not a sheet from the foot of the screen. */}
      <WidgetMenu
        target={held}
        onClose={() => setHeld(null)}
        onEdit={() => { setHeld(null); setEditing(true); }}
        onResize={(size) => { if (held) setSize(held.id, size); setHeld(null); }}
        onRemove={() => held && remove(held.id)}
      />

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

/** One card on the board: held to open its menu, and in edit mode, moved by hand. */
function WidgetFrame({ slot, editing, children, onHold, onDragTo, onResize, onRemove, registerRef }: {
  slot: WidgetSlot;
  editing: boolean;
  children: ReactNode;
  onHold: (rect: { top: number; bottom: number; left: number; width: number }) => void;
  /** Where the finger is, so the board can decide what this card is now over. */
  onDragTo: (id: string, x: number, y: number) => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  /* The hook swallows the tap for an element it wraps; here the card is a child that
     owns its own click, so the tap after a hold is caught on the way down instead. */
  const fired = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const press = useLongPress(() => {
    fired.current = true;
    const r = box.current?.getBoundingClientRect();
    onHold(r ? { top: r.top, bottom: r.bottom, left: r.left, width: r.width } : { top: 80, bottom: 200, left: 16, width: 300 });
  });
  const def = widgetById(slot.id);

  return (
    <motion.div
      ref={(el) => { box.current = el; registerRef(slot.id, el); }}
      layout
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      /* Dragged by hand in edit mode, and it springs back to wherever the board has
         since put it — the card does not travel, the order does. */
      drag={editing}
      dragSnapToOrigin
      dragElastic={0.14}
      dragMomentum={false}
      onDragStart={() => setDragging(true)}
      onDrag={(e) => {
        const p = e as PointerEvent;
        onDragTo(slot.id, p.clientX, p.clientY);
      }}
      onDragEnd={() => setDragging(false)}
      animate={{ scale: dragging ? 1.04 : 1 }}
      style={{ zIndex: dragging ? 40 : undefined, cursor: editing ? "grab" : undefined }}
      className={cn("relative min-w-0", dragging && "cursor-grabbing")}
    >
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
        style={editing ? { filter: "saturate(0.9)" } : undefined}
      >
        {children}
      </div>

      <AnimatePresence>
        {editing && (
          <>
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

            {/* The grip, in the corner where a card is resized: pull it across, or
                tap it, and the card takes the other width. */}
            {def?.resizable && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                drag="x"
                dragSnapToOrigin
                dragElastic={0.2}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 26) onResize("full");
                  else if (info.offset.x < -26) onResize("half");
                }}
                onClick={() => onResize(slot.size === "full" ? "half" : "full")}
                aria-label={slot.size === "full" ? "Deixar menor" : "Ocupar a linha"}
                className="absolute -bottom-1.5 -right-1.5 z-20 flex h-8 w-8 cursor-ew-resize items-center justify-center rounded-full border border-white/[0.14] text-white backdrop-blur-xl"
                style={{ background: "rgba(16,16,19,0.9)" }}
              >
                {slot.size === "full"
                  ? <ChevronsLeftRight className="h-[15px] w-[15px]" strokeWidth={2.4} />
                  : <ChevronsRightLeft className="h-[15px] w-[15px]" strokeWidth={2.4} />}
              </motion.button>
            )}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
