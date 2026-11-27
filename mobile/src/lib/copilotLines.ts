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
  /* Short: on the iPhone this is the notification's title, one line. */
  const lines =
    kind === "transferencia"
      ? ["Transferência entre suas contas. Registro?", "Dinheiro mudando de casa! Registro?", "Vi você movendo dinheiro. Anoto?", `${greeting()} Registro essa transferência?`]
      : kind === "entrada"
        ? ["Olha só, caiu um Pix! Anoto?", "Pix na área! Posso registrar?", "Chegou dinheirinho! Anoto?", `Dinheiro novo${at}! Bora anotar?`, `${greeting()} Caiu um Pix. Anoto?`]
        : ["Opa, gastinho novo! Anoto?", `Compra nova${at}. Anoto?`, "Passou o cartão, eu vi! Registro?", "Mais uma comprinha! Deixo anotada?", "Comprinha à vista! Bora anotar?", `${greeting()} Anoto essa compra?`];
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
      ? ["Tudo **em dia** por aqui. Pode relaxar!", "Nada esperando. Quando eu vir algo, **te chamo**.", "**Zerado!** Sigo de olho pra você.", "Fila vazia, **coração tranquilo**."]
      : count === 1
        ? ["Tem **um lançamento** esperando seu ok.", "Peguei **uma movimentação** sua. Confere comigo?", "Só **um detalhe** pra deixar tudo certinho."]
        : [`Peguei **${count} movimentações** suas. Bora deixar tudo certinho?`, `**${count} lançamentos** esperando seu ok.`, `Separei **${count} novidades** do seu dinheiro pra você conferir.`, `Rolaram **${count} movimentações** por aí. Confere comigo?`];
  return choose(lines, `${today()}-${Math.min(count, 2)}`);
}

/** When something is let go. */
export function skipLine(seed?: string) {
  return choose(["Beleza, deixei esse de fora.", "Tranquilo, esse não entra.", "Ok! Esse eu esqueço.", "Combinado, não vou anotar esse."], seed);
}

/** Many confirmed at once: one notice for all of them, never one each. */
export function allDoneLine(e: { count: number; out: string | null; inn: string | null; moves: number }) {
  const what = [e.out ? `${e.out} em gastos` : null, e.inn ? `${e.inn} em entradas` : null, e.moves ? `${e.moves} ${e.moves === 1 ? "transferência" : "transferências"}` : null].filter(Boolean);
  const list = what.length > 1 ? `${what.slice(0, -1).join(", ")} e ${what[what.length - 1]}` : (what[0] ?? "");
  const n = `${e.count} ${e.count === 1 ? "movimentação" : "movimentações"}`;
  return choose([
    { title: "Tudo anotado!", body: `Registrei suas ${n}: ${list}.` },
    { title: "Fila zerada!", body: `${n} registradas de uma vez: ${list}.` },
    { title: "Missão cumprida!", body: `Anotei ${n}: ${list}. Pode seguir.` },
  ]);
}
