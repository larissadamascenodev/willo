/**
 * What Willo says when you come in, instead of a label.
 *
 * Told by the hour and the day, with the person's name, and never the same opening twice
 * running. No "bem-vindo" or "bem-vinda": the app does not know which of them is right,
 * and these read better anyway. After the opening he goes on through things worth asking,
 * so the sphere is not left repeating itself.
 */

export interface Greeting {
  title: string;
  sub: string;
}

const KEY = "willo-last-greeting";

const pick = <T,>(list: T[], not?: T): T => {
  const pool = list.filter((x) => x !== not);
  return pool[Math.floor(Math.random() * pool.length)] ?? list[0];
};

function openings(name: string | null, now: Date): string[] {
  const hour = now.getHours();
  const day = now.getDay();
  const to = name ? `, ${name}` : "";
  const part = hour < 5 ? "madrugada" : hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite";

  const out = [`Que bom te ver de novo${to}.`, `Você de volta${to}.`, `Oi${to}. Tô aqui.`, `E aí${to}?`];
  if (part === "manha") out.push(`Bom dia${to}.`, `Bom dia${to}. Café já foi?`);
  if (part === "tarde") out.push(`Boa tarde${to}.`, `Boa tarde${to}. Como vai o dia?`);
  if (part === "noite") out.push(`Boa noite${to}.`, `Boa noite${to}. Fechando o dia?`);
  if (part === "madrugada") out.push(`Sem sono por aqui também${to}.`, `Madrugada, hein${to}?`);
  if (day === 1 && part !== "noite") out.push(`Segunda de novo${to}.`);
  if (day === 5) out.push(`Sextou${to}.`);
  if (day === 0 || day === 6) out.push(`Bom fim de semana${to}.`);
  if (now.getDate() <= 3) out.push(`Mês novo${to}.`);
  return out;
}

const ASKS = [
  "Como posso te ajudar hoje?",
  "O que vamos resolver agora?",
  "Me conta, o que foi hoje?",
  "Por onde a gente começa?",
  "O que você quer saber?",
  "Gastou alguma coisa? Me fala.",
];

/** Things to go on to once he has said hello. */
export const NEXT: Greeting[] = [
  { title: "Pensando em comprar algo?", sub: "Me diz o valor e eu vejo se cabe." },
  { title: "Gastou agora há pouco?", sub: "Fala que eu anoto na hora." },
  { title: "Quer saber quanto sobra?", sub: "É só perguntar." },
  { title: "Curioso com a fatura?", sub: "Eu te digo como ela está." },
  { title: "Eu crio limites para você.", sub: "“Limite de R$ 300 em farmácia.”" },
  { title: "Eu lembro das suas contas.", sub: "“Me lembra da luz dia 10.”" },
  { title: "Eu aviso antes de apertar.", sub: "Fico de olho no seu mês." },
  { title: "Tem um comprovante aí?", sub: "Manda a foto que eu anoto." },
  { title: "Quer organizar a renda?", sub: "Eu monto um plano com seus números." },
];

/**
 * How a sentence sits under the sphere. What fits stays on one line. What does not splits
 * at the space nearest the middle, at the same size, so the two lines come out even and
 * no word is left alone. Only what will not fit even in two lines goes smaller.
 */
export function layOut(text: string, perLine: number, size: number): { lines: string[]; size: number } {
  if (text.length <= perLine) return { lines: [text], size };
  const words = text.split(" ");
  let best = 1;
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ").length;
    const second = text.length - first - 1;
    if (Math.abs(first - second) < gap) {
      gap = Math.abs(first - second);
      best = i;
    }
  }
  const lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  /* A long sentence goes smaller rather than off the screen. */
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: longest > perLine ? size * (perLine / longest) : size };
}

export function firstName(display: string | null | undefined): string | null {
  const first = display?.trim().split(/\s+/)[0];
  return first || null;
}

/** The opening, then the rest in a shuffled order. */
export function greetings(name: string | null, now = new Date()): Greeting[] {
  let last: string | null = null;
  try {
    last = localStorage.getItem(KEY);
  } catch {
    /* Only means it might repeat. */
  }
  const title = pick(openings(name, now), last ?? undefined);
  try {
    localStorage.setItem(KEY, title);
  } catch {
    /* Only means it might repeat. */
  }
  const rest = [...NEXT].sort(() => Math.random() - 0.5);
  return [{ title, sub: pick(ASKS) }, ...rest];
}
