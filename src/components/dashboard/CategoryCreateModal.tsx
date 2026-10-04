import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Check, Plus, Sparkles,
  ShoppingCart, Utensils, Car, Pill, Home, BookOpen, Shirt, PawPrint,
  Scissors, Gamepad2, Gift, Plane, Smartphone, DollarSign, Briefcase, Music,
  Coffee, Dumbbell, Clapperboard, FileText, Wrench, ShoppingBag, Lightbulb, Target,
  Heart, Repeat, GraduationCap, TrendingUp, Award, Users, Wallet, Vault,
  Zap, Star, Globe, Camera, Headphones, Monitor, Tv, Bus,
  Landmark, Bike, Fuel, Baby, Stethoscope, Palette, UtensilsCrossed,
  Wine, Pizza, Hammer, Key, Shield, Umbrella,
  Tent, Map, Truck, Leaf, Flame,
  Gem, Crown, BadgeDollarSign, HandCoins, Receipt, Banknote,
  Droplets, CupSoda, Package, Popcorn, Salad, IceCream,
  Plug, Wifi, Phone, Building2,
} from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string }) => void;
  initialName?: string;
  initialIcon?: string;
  initialColor?: string;
  title?: string;
  existingNames?: string[];
  /** Colors already taken by other categories — each category keeps its own color. */
  usedColors?: string[];
}

const ICON_OPTIONS: { name: string; Icon: any }[] = [
  { name: "shopping-cart", Icon: ShoppingCart },
  { name: "utensils", Icon: Utensils },
  { name: "car", Icon: Car },
  { name: "pill", Icon: Pill },
  { name: "home", Icon: Home },
  { name: "book-open", Icon: BookOpen },
  { name: "shirt", Icon: Shirt },
  { name: "paw-print", Icon: PawPrint },
  { name: "scissors", Icon: Scissors },
  { name: "gamepad-2", Icon: Gamepad2 },
  { name: "gift", Icon: Gift },
  { name: "plane", Icon: Plane },
  { name: "smartphone", Icon: Smartphone },
  { name: "dollar-sign", Icon: DollarSign },
  { name: "briefcase", Icon: Briefcase },
  { name: "music", Icon: Music },
  { name: "coffee", Icon: Coffee },
  { name: "dumbbell", Icon: Dumbbell },
  { name: "clapperboard", Icon: Clapperboard },
  { name: "file-text", Icon: FileText },
  { name: "wrench", Icon: Wrench },
  { name: "shopping-bag", Icon: ShoppingBag },
  { name: "lightbulb", Icon: Lightbulb },
  { name: "target", Icon: Target },
  { name: "heart", Icon: Heart },
  { name: "repeat", Icon: Repeat },
  { name: "graduation-cap", Icon: GraduationCap },
  { name: "trending-up", Icon: TrendingUp },
  { name: "award", Icon: Award },
  { name: "users", Icon: Users },
  { name: "wallet", Icon: Wallet },
  { name: "piggy-bank", Icon: Vault },
  { name: "zap", Icon: Zap },
  { name: "star", Icon: Star },
  { name: "globe", Icon: Globe },
  { name: "camera", Icon: Camera },
  { name: "headphones", Icon: Headphones },
  { name: "monitor", Icon: Monitor },
  { name: "tv", Icon: Tv },
  { name: "bus", Icon: Bus },
  { name: "landmark", Icon: Landmark },
  { name: "bike", Icon: Bike },
  { name: "fuel", Icon: Fuel },
  { name: "baby", Icon: Baby },
  { name: "stethoscope", Icon: Stethoscope },
  { name: "palette", Icon: Palette },
  { name: "utensils-crossed", Icon: UtensilsCrossed },
  { name: "wine", Icon: Wine },
  { name: "pizza", Icon: Pizza },
  { name: "hammer", Icon: Hammer },
  { name: "key", Icon: Key },
  { name: "shield", Icon: Shield },
  { name: "umbrella", Icon: Umbrella },
  { name: "tent", Icon: Tent },
  { name: "map", Icon: Map },
  { name: "truck", Icon: Truck },
  { name: "leaf", Icon: Leaf },
  { name: "flame", Icon: Flame },
  { name: "gem", Icon: Gem },
  { name: "crown", Icon: Crown },
  { name: "badge-dollar-sign", Icon: BadgeDollarSign },
  { name: "hand-coins", Icon: HandCoins },
  { name: "receipt", Icon: Receipt },
  { name: "banknote", Icon: Banknote },
  { name: "droplets", Icon: Droplets },
  { name: "cup-soda", Icon: CupSoda },
  { name: "package", Icon: Package },
  { name: "popcorn", Icon: Popcorn },
  { name: "salad", Icon: Salad },
  { name: "ice-cream", Icon: IceCream },
  { name: "plug", Icon: Plug },
  { name: "wifi", Icon: Wifi },
  { name: "phone", Icon: Phone },
  { name: "building-2", Icon: Building2 },
];

const COLOR_OPTIONS = [
  "#00e676", "#f44336", "#ff9800", "#2196f3", "#9c27b0",
  "#e91e63", "#00bcd4", "#8bc34a", "#ffc107", "#795548",
  "#607060", "#3f51b5", "#009688", "#ff5722", "#673ab7",
  "#cddc39", "#4caf50", "#03a9f4", "#ff4081", "#7c4dff",
  "#18ffff", "#69f0ae", "#ffab40", "#ea80fc",
];

// Find the Icon component by name
function getIconComponent(iconName: string) {
  return ICON_OPTIONS.find((i) => i.name === iconName)?.Icon || FileText;
}

const FORBIDDEN = ["outros", "outro", "diversos", "geral", "varios", "sem categoria"];
const normalize = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export default function CategoryCreateModal({
  open, onClose, onSave,
  initialName = "", initialIcon = "file-text", initialColor = "#00e676",
  title = "Nova Categoria",
  existingNames = [],
  usedColors = [],
}: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  // Once the user picks an icon or colour themselves, the AI stops overriding it
  const touched = useRef(false);

  const takenColors = usedColors.map((c) => c.toLowerCase());
  const freeColors = COLOR_OPTIONS.filter((c) => !takenColors.includes(c.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setIcon(initialIcon);
    const taken = new Set(usedColors.map((c) => c.toLowerCase()));
    const free = COLOR_OPTIONS.find((c) => !taken.has(c.toLowerCase()));
    setColor(taken.has(initialColor.toLowerCase()) && free ? free : initialColor);
    setSuggested(false);
    touched.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialIcon, initialColor]);

  const trimmed = name.trim();

  // The AI dresses the category while the name is typed
  useEffect(() => {
    if (!open || touched.current || trimmed.length < 3) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setSuggesting(true);
      try {
        const { data } = await supabase.functions.invoke("suggest-category", {
          body: { mode: "style", name: trimmed, usedColors },
        });
        if (cancelled || touched.current || !data?.icon) return;
        setIcon(data.icon);
        if (data.color) setColor(data.color);
        setSuggested(true);
      } catch {
        /* the defaults already work */
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, open]);

  const nameError = !trimmed
    ? null
    : FORBIDDEN.includes(normalize(trimmed))
      ? "Escolha um nome específico: “Outros” não ajuda a entender seus gastos"
      : existingNames.some((n) => normalize(n) === normalize(trimmed) && normalize(n) !== normalize(initialName))
        ? `Já existe a categoria “${trimmed}”`
        : null;

  const colorError = takenColors.includes(color.toLowerCase()) ? "Essa cor já é de outra categoria" : null;
  const canSave = !!trimmed && !nameError && !colorError;

  const pick = (apply: () => void) => {
    touched.current = true;
    setSuggested(false);
    apply();
  };

  const PreviewIcon = getIconComponent(icon);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      zIndex={95}
      footer={
        <button
          type="button"
          onClick={() => canSave && onSave({ name: trimmed, icon, color })}
          disabled={!canSave}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] transition-opacity disabled:opacity-30"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {title === "Nova Categoria" ? "Criar categoria" : "Salvar"}
        </button>
      }
    >
      <div className="px-5 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-[22px] font-extrabold tracking-tight text-white">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/74 active:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live preview of the category being built */}
        <div className="relative mt-6 flex flex-col items-center">
          <span
            className="pointer-events-none absolute top-2 h-24 w-40 rounded-full blur-[46px] transition-colors duration-300"
            style={{ background: `${color}33` }}
          />
          <motion.span
            key={icon}
            initial={{ scale: 0.82, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border"
            style={{ background: `${color}1F`, borderColor: `${color}40` }}
          >
            <PreviewIcon className="h-8 w-8" style={{ color }} />
          </motion.span>
          <p className="relative mt-3 max-w-full truncate text-[17px] font-semibold tracking-tight text-white">
            {trimmed || "Sua categoria"}
          </p>
          <AnimatePresence>
            {(suggesting || suggested) && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/74"
              >
                <Sparkles className="h-3 w-3" />
                {suggesting ? "Escolhendo o visual…" : "Sugerido pela IA"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-7">
          <p className="px-1 text-[12px] font-semibold uppercase tracking-wider text-white/50">Nome</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Streaming"
            maxLength={30}
            autoFocus
            className="mt-2 h-14 w-full rounded-[18px] border border-white/[0.08] willo-glass px-4 text-[16px] text-white placeholder:text-white/38 focus:border-white/20 focus:outline-none"
          />
          <AnimatePresence>
            {(nameError || colorError) && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 px-1 text-[12.5px] leading-snug text-red-400"
              >
                {nameError ?? colorError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6">
          <p className="px-1 text-[12px] font-semibold uppercase tracking-wider text-white/50">Cor</p>
          <div className="-mx-5 mt-2.5 flex gap-3 overflow-x-auto px-5 pb-1.5 pt-1 scrollbar-none">
            {freeColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(() => setColor(c))}
                aria-label={`Cor ${c}`}
                className="relative h-11 w-11 shrink-0 rounded-full transition-transform active:scale-95"
                style={{ background: c }}
              >
                {color === c && (
                  <motion.span
                    layoutId="cat-color-ring"
                    className="absolute -inset-1 rounded-full border-2 border-white"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            ))}
            <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-white/20">
              <Plus className="h-4 w-4 text-white/66" />
              <input type="color" value={color} onChange={(e) => pick(() => setColor(e.target.value))} className="sr-only" />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <p className="px-1 text-[12px] font-semibold uppercase tracking-wider text-white/50">Ícone</p>
          <div className="mt-2.5 grid grid-cols-6 gap-2">
            {ICON_OPTIONS.map(({ name: iconName, Icon: IconComp }) => {
              const active = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => pick(() => setIcon(iconName))}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-[16px] border transition-colors",
                    active ? "border-transparent" : "border-white/[0.06] willo-glass-inset active:bg-white/[0.06]",
                  )}
                  style={active ? { background: `${color}22`, borderColor: `${color}55` } : undefined}
                >
                  <IconComp className="h-[18px] w-[18px]" style={{ color: active ? color : "rgba(255,255,255,0.5)" }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

export { ICON_OPTIONS, getIconComponent };
