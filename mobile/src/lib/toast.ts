/**
 * Something happened, said once.
 *
 * "Conta excluída", "Conta adicionada": a sentence that appears over whatever screen
 * you are on, and goes. It lives outside any screen on purpose — deleting an account
 * sends you back a page, and the word has to survive the trip.
 */

type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function showToast(message: string) {
  listeners.forEach((fn) => fn(message));
}

export function onToast(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
