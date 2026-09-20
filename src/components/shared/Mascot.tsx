import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import willoAlerta from "@/assets/mascot/willo-alerta.png";
import willoComemorando from "@/assets/mascot/willo-comemorando.png";
import willoConquistando from "@/assets/mascot/willo-conquistando.png";
import willoEconomizando from "@/assets/mascot/willo-economizando.png";
import willoFeliz from "@/assets/mascot/willo-feliz.png";
import willoPensando from "@/assets/mascot/willo-pensando.png";
import willoPlanejando from "@/assets/mascot/willo-planejando.png";

export type MascotVariant =
  | "feliz"
  | "pensando"
  | "conquistando"
  | "comemorando"
  | "economizando"
  | "planejando"
  | "alerta";

const MASCOT_IMAGES: Record<MascotVariant, string> = {
  feliz: willoFeliz,
  pensando: willoPensando,
  conquistando: willoConquistando,
  comemorando: willoComemorando,
  economizando: willoEconomizando,
  planejando: willoPlanejando,
  alerta: willoAlerta,
};

const MASCOT_ALT: Record<MascotVariant, string> = {
  feliz: "Willo, o esquilo mascote, acenando feliz",
  pensando: "Willo pensativo, com a mão no queixo",
  conquistando: "Willo comemorando com o punho erguido",
  comemorando: "Willo segurando um troféu, celebrando uma conquista",
  economizando: "Willo guardando moedas em um potinho",
  planejando: "Willo com uma prancheta, planejando",
  alerta: "Willo alerta, segurando um aviso",
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "w-16 h-16",
  md: "w-28 h-28",
  lg: "w-48 h-48",
};

interface MascotProps {
  /** Which pose/expression to render. */
  variant: MascotVariant;
  /** Controls the image size — sm for inline hints, md for cards/empty states, lg for onboarding/celebration moments. */
  size?: "sm" | "md" | "lg";
  /** Optional speech-bubble style caption rendered below the mascot. */
  caption?: string;
  className?: string;
}

/**
 * Willo brand mascot — a squirrel illustration with a few pre-rendered poses
 * (see src/assets/mascot/). Pick the variant that matches the moment
 * (e.g. "comemorando" after a goal is reached, "alerta" for a budget warning).
 */
const Mascot = ({ variant, size = "md", caption, className }: MascotProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <img
        src={MASCOT_IMAGES[variant]}
        alt={MASCOT_ALT[variant]}
        className={cn("object-contain select-none pointer-events-none", SIZE_CLASSES[size])}
        draggable={false}
      />
      {caption && (
        <p className="text-sm text-center text-muted-foreground max-w-[16rem]">{caption}</p>
      )}
    </motion.div>
  );
};

export default Mascot;
