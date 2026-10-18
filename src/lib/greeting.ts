import { useMemo } from "react";

/**
 * The hour of the day, in words, and today's date.
 *
 * It used to live inside the dashboard header, which is a web component — it imports
 * a router, an animation library and a logo. The phone app wants the same greeting
 * and the same date, worded identically, and should not have to drag a header across
 * to get them. So the part that is only reasoning lives here, where both can reach
 * it, and the header goes on re-exporting it for everything that already asks.
 */

const DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const useGreeting = () => {
  return useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let g = "Bom dia";
    if (hour >= 12 && hour < 18) g = "Boa tarde";
    else if (hour >= 18) g = "Boa noite";
    return {
      greeting: g,
      dateStr: `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`,
    };
  }, []);
};
