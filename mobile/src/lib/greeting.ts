/**
 * What Willo says under the sphere, instead of a label.
 *
 * The hello is told by the hour and the day, with the person's name. After it he goes
 * through what he has noticed in their numbers and a long list of things he can do, always
 * starting from what has gone longest without being said, so a day does not sound like the
 * one before. No "bem-vindo" or "bem-vinda": the app does not know which is right.
 *
 * Every line leads somewhere. Touching it opens the conversation: with `ask`, that question
 * already asked; with `say`, Willo speaking first.
 */

export interface Greeting {
  title: string;
  sub: string;
  ask?: string;
  say?: string;
}

const SEEN = "willo-said";

const readSeen = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};

/** Noted as said, so it goes to the back of the queue. */
export function markSaid(title: string) {
  const seen = readSeen();
  seen[title] = Date.now();
  const kept = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 150);
  try {
    localStorage.setItem(SEEN, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* Only means it might repeat. */
  }
}

/** Longest unsaid first; what has never been said in no particular order. */
export function longestUnsaid<T extends { title: string }>(list: T[]): T[] {
  const seen = readSeen();
  return list
    .map((item) => ({ item, at: seen[item.title] ?? 0, tie: Math.random() }))
    .sort((a, b) => a.at - b.at || a.tie - b.tie)
    .map((x) => x.item);
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

  const out = [`Que bom te ver de novo${to}.`, `Olha você aqui de novo${to}.`, `Oi${to}. Tô aqui.`, `E aí${to}?`];
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

/** What he can do and what can be asked of him. */
export const NEXT: Greeting[] = [
  /* Noting things down */
  { title: "Gastou agora há pouco?", sub: "Fala que eu anoto na hora.", say: "Qual foi o gasto? Me fala o que foi e quanto, tipo “café 12”." },
  { title: "Tem um comprovante aí?", sub: "Manda a foto que eu anoto.", say: "Manda a foto: é só tocar na câmera aqui embaixo, ao lado do campo." },
  { title: "Recebeu alguma coisa?", sub: "Me conta que eu registro.", say: "Quanto entrou, e de onde? Pode falar assim: “recebi 200 de freela”." },
  { title: "Pagou alguma conta hoje?", sub: "Eu deixo tudo em dia.", say: "Qual conta você pagou, e de quanto?" },
  { title: "Comprou no cartão?", sub: "Eu coloco na fatura certa.", say: "O que você comprou, de quanto e em qual cartão?" },
  { title: "Dividiu em parcelas?", sub: "Eu conto cada uma para você.", say: "O que foi, quanto e em quantas vezes? Tipo “tênis 600 em 3x no crédito”." },
  { title: "Falar é mais rápido.", sub: "É só tocar em mim e dizer.", say: "Pode falar comigo pelo microfone aqui embaixo: me diz o que gastou." },
  /* The bill */
  { title: "Curioso com a fatura?", sub: "Eu te digo como ela está.", ask: "Quanto está minha fatura?" },
  { title: "A fatura subiu?", sub: "Eu descubro o porquê.", ask: "Por que minha fatura aumentou?" },
  { title: "Quanto resta no limite?", sub: "Eu olho para você.", ask: "Quanto tenho de limite no cartão?" },
  { title: "O que pesou na fatura?", sub: "Eu separo as maiores.", ask: "O que mais pesou na fatura?" },
  /* The month */
  { title: "Quer saber quanto sobra?", sub: "É só perguntar.", ask: "Quanto posso gastar até o fim do mês?" },
  { title: "Como vai fechar o mês?", sub: "Eu faço a conta agora.", ask: "Como meu mês vai fechar?" },
  { title: "Quanto dá para gastar hoje?", sub: "Eu calculo com o seu mês.", ask: "Quanto posso gastar hoje?" },
  { title: "Como fica o mês que vem?", sub: "Eu já olhei lá na frente.", ask: "Como fica o mês que vem?" },
  { title: "Eu aviso antes de apertar.", sub: "Fico de olho no seu mês.", ask: "Tem algo que vai apertar nos próximos dias?" },
  { title: "Vai vencer alguma coisa?", sub: "Eu vejo os próximos dias.", ask: "O que vence nos próximos 7 dias?" },
  /* Where it goes */
  { title: "Para onde foi o dinheiro?", sub: "Eu mostro onde pesou.", ask: "Onde estou gastando mais este mês?" },
  { title: "Algum gasto estranho?", sub: "Eu procuro o que fugiu do normal.", ask: "Tenho algum gasto fora do padrão?" },
  { title: "Sabe quanto vai em assinatura?", sub: "Eu somo tudo para você.", ask: "Quais assinaturas eu pago?" },
  { title: "Quer cortar gastos?", sub: "Eu mostro por onde começar.", ask: "Onde consigo economizar este mês?" },
  { title: "Gastou mais que mês passado?", sub: "Eu comparo os dois.", ask: "Gastei mais este mês do que no mês passado?" },
  { title: "Como foi a sua semana?", sub: "Eu resumo os gastos.", ask: "Quanto gastei nos últimos 7 dias?" },
  /* Decisions */
  { title: "Pensando em comprar algo?", sub: "Me diz o valor e eu vejo se cabe.", say: "O que você quer comprar, e de quanto? Eu vejo se cabe no seu mês." },
  { title: "À vista ou parcelado?", sub: "Eu simulo os dois.", say: "Qual é a compra e o valor? Eu comparo à vista e parcelado para você." },
  { title: "Qual o melhor mês para comprar?", sub: "Eu olho os próximos meses.", say: "O que você quer comprar, e de quanto? Eu vejo qual mês é melhor." },
  { title: "Quando acabam as parcelas?", sub: "Eu te digo o mês certinho.", ask: "Quando terminam meus parcelamentos?" },
  /* Doing things for you */
  { title: "Eu crio limites para você.", sub: "“Limite de R$ 300 em farmácia.”", say: "Em qual categoria, e de quanto? Pode falar assim: “cria um limite de R$ 300 para farmácia”." },
  { title: "Eu lembro das suas contas.", sub: "“Me lembra da luz dia 10.”", say: "Do que eu te lembro, e quando? Pode falar assim: “me lembra da luz dia 10”." },
  { title: "Gasta demais em algo?", sub: "Vamos colocar um limite nisso.", say: "Em qual categoria você quer um limite, e de quanto?" },
  { title: "Medo de esquecer um boleto?", sub: "Eu te aviso antes.", say: "Qual boleto, e em que dia vence? Tipo “me lembra do boleto da escola dia 20”." },
  /* Planning */
  { title: "Quer organizar a renda?", sub: "Eu monto um plano com seus números.", ask: "Qual o melhor plano para minha renda?" },
  { title: "Dá para guardar mais?", sub: "Eu vejo quanto cabe.", ask: "Quanto consigo guardar por mês?" },
  { title: "Tem uma meta em mente?", sub: "Eu digo quanto guardar por mês.", ask: "Quero criar uma meta" },
  { title: "Quer planejar uma viagem?", sub: "Eu te ajudo a chegar lá.", ask: "Quero planejar uma viagem" },
  { title: "Pensando em trocar de carro?", sub: "Eu faço as contas com você.", ask: "Quero planejar a compra de um carro" },
  { title: "Sonho da casa própria?", sub: "A gente monta o plano juntos.", ask: "Quero planejar a compra de uma casa" },
  { title: "Quer começar a investir?", sub: "Eu vejo quanto dá por mês.", ask: "Quero planejar investir" },
  { title: "Vai ter casamento?", sub: "Eu calculo quanto guardar.", ask: "Quero planejar meu casamento" },
  { title: "Ainda sem reserva?", sub: "Eu te ajudo a montar uma.", ask: "Quero planejar minha reserva de emergência" },
  { title: "Eu crio caixinhas para você.", sub: "É só me dizer o seu objetivo.", ask: "Quero criar uma caixinha" },
  { title: "Quer sair do aperto?", sub: "A gente monta um caminho.", ask: "Como evito fechar o mês no negativo?" },
  { title: "Dúvida sobre dinheiro?", sub: "Pode perguntar, sem vergonha.", say: "Pode perguntar! O que você quer entender melhor sobre o seu dinheiro?" },
  { title: "Quer entender o seu cartão?", sub: "Eu explico sem complicar.", say: "O que você quer entender do cartão? Fechamento, juros, fatura..." },
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

/** The opening, then the rest from what has gone longest unsaid. */
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
  const sub = pick(ASKS);
  return [{ title, sub, say: `${name ? `Oi, ${name}! ` : "Oi! "}${sub}` }, ...longestUnsaid(NEXT)];
}
