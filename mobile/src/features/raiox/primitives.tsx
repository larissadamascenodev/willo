import type { ReactNode } from "react";
import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { getCurrency } from "@/lib/currency";
import { Glass, ProgressBar, Text, white } from "~/ui";

export const TONE_HEX = { otimo: "#C8F36D", ok: "#7DD3FC", atencao: "#FCD34D", critico: "#F87171" } as const;
export const LIGHT_HEX = { verde: "#C8F36D", amarelo: "#FCD34D", vermelho: "#F87171" } as const;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });
export const brlCents = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** O cartão de vidro de uma análise. */
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <Glass radius={24} style={style}>{children}</Glass>;
}

/** Uma seção do Raio-X: ícone, título, dica e o conteúdo. */
export function Section({ icon: Icon, title, hint, aside, children }: { icon: LucideIcon; title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ marginBottom: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
              <Icon size={15} color={white(0.82)} strokeWidth={2.2} />
            </View>
            <Text display weight="bold" size={18} style={{ letterSpacing: -0.3 }} numberOfLines={1}>{title}</Text>
          </View>
          {!!hint && <Text size={12} color={white(0.56)} style={{ marginTop: 2, paddingLeft: 36 }}>{hint}</Text>}
        </View>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** Frase amiga em cima de uma análise, com uma faixa colorida na lateral. */
export function Verdict({ children, hex = "#FFFFFF" }: { children: ReactNode; hex?: string }) {
  return (
    <View style={{ borderRadius: 16, backgroundColor: white(0.04), paddingVertical: 10, paddingLeft: 16, paddingRight: 12 }}>
      <View style={{ position: "absolute", top: 10, bottom: 10, left: 0, width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: hex }} />
      <Text size={13} color={white(0.85)} style={{ lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/** Barrinha fina de progresso (0 a 1). */
export function Bar({ value, hex, style, delay = 0 }: { value: number; hex: string; style?: object; delay?: number }) {
  return (
    <View style={style}>
      <ProgressBar ratio={Math.min(Math.max(value, 0), 1)} color={hex} height={6} track={white(0.07)} delay={delay * 1000} />
    </View>
  );
}
