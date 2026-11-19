/**
 * Whose figures the in-memory caches hold.
 *
 * The finance caches are kept per month and the database answers for whoever is signed
 * in, so a month cached for one account is not the same month for another. Every cache
 * key starts with this scope — the signed-in person's id — set by the auth the moment the
 * session changes. A read still on its way for the previous account lands under that
 * account's scope, where the new one never looks.
 */
let scope = "";

export function setCacheScope(userId: string | null | undefined) {
  scope = userId ?? "";
}

export function cacheScope() {
  return scope;
}
