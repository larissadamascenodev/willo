import { useMemo } from "react";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Bom dia" / "Boa tarde" / "Boa noite" e a data por extenso. */
export function useGreeting() {
  return useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour >= 18 ? "Boa noite" : hour >= 12 ? "Boa tarde" : "Bom dia";
    return { greeting, dateStr: `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}` };
  }, []);
}
