/* The last picture the home's header showed, kept while the profile loads again (as it
   does after the theme changes), so the circle is never empty. Per person: dropped when
   the account changes, so another account never shows it. */
let last: { userId: string; url: string } | null = null;

export function rememberHeaderAvatar(userId: string | undefined, url: string | null | undefined) {
  if (userId && url) last = { userId, url };
}

export function lastHeaderAvatar(userId: string | undefined): string | null {
  return last && userId && last.userId === userId ? last.url : null;
}

export function forgetHeaderAvatar() {
  last = null;
}
