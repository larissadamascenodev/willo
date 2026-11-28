/**
 * What Willo says on the confirmation card the iPhone shows and in the notification after it — the
 * same voice as in the app (mobile/src/lib/copilotLines.ts): light, short, never the same line twice
 * in a row for the same person (chosen at random here).
 */

export type Kind = "compra" | "entrada" | "saida" | "transferencia" | "boleto";

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const greeting = () => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "Bom dia!" : h < 18 ? "Boa tarde!" : "Boa noite!";
};

export function titleOf(kind: Kind) {
  return kind === "transferencia" ? "Transferência entre contas" : kind === "boleto" ? "Novo boleto" : kind === "saida" ? "Registrar saída" : kind === "entrada" ? "Registrar entrada" : "Registrar gasto";
}

export function askOf(kind: Kind, bank: string | null, route?: { from: string | null; to: string | null }) {
  const at = bank ? ` no ${bank}` : "";
  const way = route?.from && route?.to ? `do ${route.from} pro ${route.to}` : route?.to ? `pro ${route.to}` : route?.from ? `do ${route.from}` : "entre suas contas";
  return pick(
    kind === "transferencia"
      ? [`Dinheiro indo ${way}. Registro?`, `Transferência ${way}. Anoto?`, `Vi você movendo dinheiro ${way}. Anoto?`]
      : kind === "boleto"
        ? [`Chegou um boleto novo${at}. Agendo?`, "Boleto novo no seu CPF! Quer agendar?", "Achei um boleto pra você. Agendo?"]
        : kind === "saida"
          ? [`Saiu um Pix${bank ? ` do ${bank}` : ""}. Anoto?`, `Pix enviado${bank ? ` pelo ${bank}` : ""}! Registro?`, `Dinheiro saindo${bank ? ` do ${bank}` : ""}. Anoto?`]
          : kind === "entrada"
            ? [`Caiu dinheiro${at}! Anoto?`, `Pix na área${at}! Registro?`, `Entrou dinheirinho${at}. Anoto?`, `${greeting()} Chegou dinheiro${at}. Anoto?`]
            : ["Opa, gastinho novo! Anoto?", `Compra nova${at}. Anoto?`, "Passou o cartão, eu vi! Registro?", "Mais uma comprinha! Deixo anotada?", "Comprinha à vista! Bora anotar?", `${greeting()} Anoto essa compra?`],
  );
}

export function doneOf(kind: Kind, e: { amount: string; who: string; where?: string | null }) {
  const where = e.where ?? "";
  return pick(
    kind === "transferencia"
      ? [
          { title: "Transferência anotada", body: `${e.amount} mudou de conta${where ? `, ${where}` : ""}.` },
          { title: "Tudo no lugar", body: `Registrei a transferência de ${e.amount}${where ? ` ${where}` : ""}.` },
        ]
      : kind === "saida"
        ? [
            { title: "Anotado!", body: `Pix de ${e.amount} saiu${where ? ` ${where}` : ""}.` },
            { title: "Pix registrado", body: `${e.amount} enviado${where ? ` ${where}` : ""}. Tá tudo no lugar.` },
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
            ],
  );
}
