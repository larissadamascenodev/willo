/**
 * Whether the opening animation has finished, for screens that play something of
 * their own and should not spend it under the opening (the welcome's scenes).
 */

let done = false;
const waiting = new Set<() => void>();

export function markIntroDone() {
  done = true;
  for (const run of waiting) run();
  waiting.clear();
}

export function isIntroDone() {
  return done;
}

/** Runs `run` once the opening is over (at once if it already is); returns a way to cancel. */
export function onIntroDone(run: () => void) {
  if (done) {
    run();
    return () => {};
  }
  waiting.add(run);
  return () => {
    waiting.delete(run);
  };
}
