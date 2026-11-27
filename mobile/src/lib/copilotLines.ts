/**
 * What Willo says about something the Copilot caught: on its card (asking) and once it is
 * written (done). Light and playful, and varied, so it reads as someone and not a form. On a
 * page the line for an item is chosen by its id, so it does not change each time the page draws.
 */

export type LineKind = "compra" | "entrada" | "transferencia";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia!" : h < 18 ? "Boa tarde!" : "Boa noite!";
};

/* A number from an id, the same every time. */
const seedOf = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const choose = <T,>(list: T[], seed?: string) => list[seed ? seedOf(seed) % list.length : Math.floor(Math.random() * list.length)];

export function askLine(kind: LineKind, bank: string | null, seed?: string) {
  const at = bank ? ` no ${bank}` : "";
  const lines =
    kind === "transferencia"
      ? ["Identifiquei uma transferência sua entre contas. Posso registrar?", "Dinheiro mudando de casa! Registro essa transferência?", "Vi você movendo dinheiro entre suas contas. Anoto?", `${greeting()} Rolou uma transferência entre suas contas. Registro?`]
      : kind === "entrada"
        ? ["Olha só, caiu um Pix! Anoto como entrada?", "Pix na área! Posso registrar?", `Opa, dinheiro novo${at}! Bora anotar?`, `${greeting()} Pingou um dinheirinho na sua conta. Registro?`, "Chegou dinheirinho! Deixo anotado?"]
        : [`Opa, gastinho novo${at}! Anoto?`, "Vi você passando o cartão por aí. Posso anotar?", "Mais uma comprinha na conta! Deixo registrada?", `Psiu! Rolou uma compra${at}. Anoto pra você?`, "Comprinha à vista! Bora anotar?", `${greeting()} Já tô de olho nessa compra. Anoto?`];
  return choose(lines, seed);
}

/** The words after a confirmation: a short title and one line. */
export function doneLine(kind: LineKind, e: { amount: string; who: string; where?: string | null }) {
  const where = e.where ?? "";
  const lines =
    kind === "transferencia"
      ? [
          { title: "Transferência anotada", body: `${e.amount} mudou de conta${where ? `, ${where}` : ""}.` },
          { title: "Tudo no lugar", body: `Registrei a transferência de ${e.amount}${where ? ` ${where}` : ""}.` },
        ]
      : kind === "entrada"
        ? [
            { title: "Oba, dinheiro no bolso!", body: `${e.amount} de ${e.who} já estão no seu saldo.` },
            { title: "Anotadinho!", body: `${e.amount} de ${e.who} registrado.` },
            { title: "Saldo feliz", body: `${e.amount} de ${e.who} entraram no seu mês.` },
          ]
        : [
            { title: "Anotadinho!", body: `${e.amount} na ${e.who}${where ? `, ${where}` : ""}.` },
            { title: "Pode deixar comigo", body: `${e.amount} na ${e.who} já tá anotado.` },
            { title: "Missão cumprida", body: `${e.amount} na ${e.who} registrados. Segue o jogo!` },
            { title: "Tá anotado!", body: `${e.amount} na ${e.who}${where ? `, ${where}` : ""}. Eu cuido do resto.` },
          ];
  return choose(lines);
}

/* Today's number, so the line at the top stays the same through the day and changes the next. */
const today = () => new Date().toISOString().slice(0, 10);

/** Willo at the top of his page, about what is waiting. */
export function moodLine(count: number) {
  const lines =
    count === 0
      ? ["Tudo em dia por aqui. Pode relaxar!", "Nada esperando. Quando eu vir algo, te chamo.", "Zerado! Sigo de olho pra você.", "Fila vazia, coração tranquilo."]
      : count === 1
        ? ["Separei uma coisinha pra você conferir.", "Tem 1 aqui esperando seu ok.", "Só uma pendência. Rapidinho, vai?"]
        : [`Juntei ${count} coisinhas pra você. Bora conferir?`, `${count} movimentações esperando seu ok. Vamos nessa?`, `Olha só, ${count} novidades no seu dinheiro. Confere comigo?`, `Tenho ${count} aqui pra você dar uma olhada.`];
  return choose(lines, `${today()}-${Math.min(count, 2)}`);
}

/** When something is let go. */
export function skipLine(seed?: string) {
  return choose(["Beleza, deixei esse de fora.", "Tranquilo, esse não entra.", "Ok! Esse eu esqueço.", "Combinado, não vou anotar esse."], seed);
}
