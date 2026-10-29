/**
 * Which recurring charges are subscriptions, and which are just fixed bills.
 *
 * Nothing in the data says so — a row for Netflix and a row for rent are the same
 * shape. The name is the only signal there is, so a charge counts as a subscription
 * when its name matches a service people actually subscribe to. That is a guess, and
 * it is wrong at the edges (a phone plan is a fixed bill to some people and a
 * subscription to others), but it is a guess made from something real rather than
 * from a flag nobody fills in.
 *
 * The map doubles as the artwork: a matched name brings its own logo and colours.
 */

export type BrandInfo = {
  bg: string;
  fg: string;
  logo?: string;
  icon?: string;
};

const BRAND_MAP: Record<string, BrandInfo> = {
  netflix:        { bg: "#000000", fg: "#E50914", logo: "https://images.ctfassets.net/4cd45et68cgf/7LrExJ6PAj6MSIPkDrGdbk/c30d6fc8f5a9f1d73ac79e3fb5a2353e/Netflix-Brand-Symbol.png" },
  spotify:        { bg: "#191414", fg: "#1DB954", logo: "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png" },
  "apple music":  { bg: "#000000", fg: "#FC3C44", logo: "https://music.apple.com/assets/knowledge-graph/music.png" },
  "youtube music":{ bg: "#000000", fg: "#FF0000", logo: "https://lh3.googleusercontent.com/z6Sl4j9zQ88oUKNy0G3PAMiVwy8DzQLh_ygyvBXv0zVNUZ_wQPN_n7EAR2By3dhoUpX7kTpaHjRPni1MHwKpaBJbpNqdEsHZsH4q" },
  youtube:        { bg: "#000000", fg: "#FF0000", logo: "https://www.youtube.com/s/desktop/29d9ee5c/img/favicon_144x144.png" },
  deezer:         { bg: "#000000", fg: "#A238FF", logo: "https://e-cdns-files.dzcdn.net/cache/slash/images/common/logos/deezer_logo_circle.png" },
  "disney+":      { bg: "#040714", fg: "#0063e5", logo: "https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67/original" },
  disney:         { bg: "#040714", fg: "#0063e5", logo: "https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67/original" },
  "hbo max":      { bg: "#000000", fg: "#5822B4", icon: "HBO" },
  hbo:            { bg: "#000000", fg: "#fff", icon: "HBO" },
  max:            { bg: "#002BE7", fg: "#fff", icon: "MAX" },
  "prime video":  { bg: "#00131F", fg: "#00A8E1", logo: "https://m.media-amazon.com/images/G/01/digital/video/web/Logo-sm.png" },
  "amazon prime": { bg: "#00131F", fg: "#00A8E1", logo: "https://m.media-amazon.com/images/G/01/digital/video/web/Logo-sm.png" },
  amazon:         { bg: "#131921", fg: "#FF9900", icon: "A" },
  icloud:         { bg: "#000000", fg: "#3693F3", logo: "https://www.apple.com/v/icloud/d/images/overview/icloud-storage-icon__bxnlrftjhdiq_large.png" },
  "google one":   { bg: "#000000", fg: "#4285F4", logo: "https://www.gstatic.com/images/branding/product/2x/google_one_64dp.png" },
  dropbox:        { bg: "#000000", fg: "#0061FF", icon: "DB" },
  onedrive:       { bg: "#000000", fg: "#0078D4", icon: "OD" },
  claude:         { bg: "#000000", fg: "#D97757", icon: "CL" },
  anthropic:      { bg: "#000000", fg: "#D97757", icon: "CL" },
  cursor:         { bg: "#000000", fg: "#fff", icon: "Cu" },
  midjourney:     { bg: "#000000", fg: "#fff", icon: "MJ" },
  adobe:          { bg: "#000000", fg: "#FF0000", icon: "Ad" },
  "microsoft 365":{ bg: "#000000", fg: "#F25022", icon: "M" },
  "google workspace": { bg: "#000000", fg: "#4285F4", icon: "G" },
  chatgpt:        { bg: "#000000", fg: "#10A37F", logo: "https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nytnj.png" },
  openai:         { bg: "#000000", fg: "#10A37F", logo: "https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nytnj.png" },
  academia:       { bg: "#1a1a2e", fg: "#FF6B35" },
  "smart fit":    { bg: "#000000", fg: "#FFD100", icon: "SF" },
  smartfit:       { bg: "#000000", fg: "#FFD100", icon: "SF" },
  bluefit:        { bg: "#000000", fg: "#0077C8", icon: "BF" },
  claro:          { bg: "#000000", fg: "#ED1C24", icon: "C" },
  vivo:           { bg: "#1B003A", fg: "#660099", logo: "https://appvivo.vivo.com.br/images/icons/vivo-icon-192x192.png" },
  tim:            { bg: "#000000", fg: "#004B93", icon: "TIM" },
  uber:           { bg: "#000000", fg: "#fff", logo: "https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.3.8/d1a3f4spazzrp4.cloudfront.net/icons/uber_home_UberLogo_night_192x192.png" },
  "99":           { bg: "#000000", fg: "#FFCB05", icon: "99" },
  ifood:          { bg: "#000000", fg: "#EA1D2C", logo: "https://static.ifood-static.com.br/image/upload/t_high/webapp/landing/landing-logo-ifood.png" },
  rappi:          { bg: "#000000", fg: "#FF441F", icon: "R" },
  nubank:         { bg: "#1A0533", fg: "#8A05BE", logo: "https://nubank.com.br/images-cms/1652883558-nu-icon.png" },
  xbox:           { bg: "#000000", fg: "#107C10", icon: "X" },
  playstation:    { bg: "#000000", fg: "#003087", icon: "PS" },
  psn:            { bg: "#000000", fg: "#003087", icon: "PS" },
  "game pass":    { bg: "#000000", fg: "#107C10", icon: "GP" },
  canva:          { bg: "#000000", fg: "#00C4CC", icon: "Ca" },
  notion:         { bg: "#000000", fg: "#fff", icon: "N" },
  figma:          { bg: "#000000", fg: "#F24E1E", icon: "F" },
  github:         { bg: "#000000", fg: "#fff", logo: "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png" },
  globoplay:      { bg: "#000000", fg: "#E21B22", icon: "G" },
  crunchyroll:    { bg: "#000000", fg: "#F47521", icon: "CR" },
  paramount:      { bg: "#000000", fg: "#0064FF", icon: "P+" },
  "paramount+":   { bg: "#000000", fg: "#0064FF", icon: "P+" },
  "star+":        { bg: "#000000", fg: "#fff", icon: "S+" },
  twitch:         { bg: "#000000", fg: "#9146FF", logo: "https://static.twitchcdn.net/assets/mobile_iphone-526a7948e69b1a48.png" },
  kwai:           { bg: "#000000", fg: "#FF4906", icon: "K" },
  tiktok:         { bg: "#000000", fg: "#fff", icon: "TT" },
  telegram:       { bg: "#000000", fg: "#26A5E4", icon: "TG" },
  whatsapp:       { bg: "#000000", fg: "#25D366", icon: "WA" },
  linkedin:       { bg: "#000000", fg: "#0A66C2", icon: "In" },
  "apple tv":     { bg: "#000000", fg: "#fff", icon: "TV" },
  "apple tv+":    { bg: "#000000", fg: "#fff", icon: "TV" },
  mubi:           { bg: "#000000", fg: "#fff", icon: "M" },
  starzplay:      { bg: "#000000", fg: "#D4A017", icon: "SZ" },
  starz:          { bg: "#000000", fg: "#D4A017", icon: "SZ" },
  "lionsgate+":   { bg: "#000000", fg: "#F5A623", icon: "LG" },
  pluto:          { bg: "#000000", fg: "#fff", icon: "PT" },
  "pluto tv":     { bg: "#000000", fg: "#fff", icon: "PT" },
  duolingo:       { bg: "#000000", fg: "#58CC02", icon: "DL" },
  coursera:       { bg: "#000000", fg: "#0056D2", icon: "Co" },
  udemy:          { bg: "#000000", fg: "#A435F0", icon: "U" },
  alura:          { bg: "#000000", fg: "#0056FF", icon: "Al" },
  hotmart:        { bg: "#000000", fg: "#F04E23", icon: "HM" },
  mercado:        { bg: "#000000", fg: "#FFE600", icon: "ML" },
  "mercado livre": { bg: "#000000", fg: "#FFE600", icon: "ML" },
  shopee:         { bg: "#000000", fg: "#EE4D2D", icon: "Sh" },
  shein:          { bg: "#000000", fg: "#fff", icon: "SH" },
  magalu:         { bg: "#000000", fg: "#0086FF", icon: "MG" },
  "magazine luiza": { bg: "#000000", fg: "#0086FF", icon: "MG" },
  gympass:        { bg: "#000000", fg: "#D4FF00", icon: "GP" },
  wellhub:        { bg: "#000000", fg: "#D4FF00", icon: "WH" },
  totalpass:      { bg: "#000000", fg: "#FF6B00", icon: "TP" },
};

export function getBrand(name: string): BrandInfo & { matched: boolean } {
  const n = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_MAP)) {
    if (n.includes(key)) return { ...val, matched: true };
  }
  return { bg: "transparent", fg: "hsl(var(--primary))", matched: false };
}

/** A name that says so itself: "Assinatura da academia", "Mensalidade do curso". */
const SAYS_SO = /(assinatura|mensalidade)/i;

/** A recurring charge people would call an assinatura, rather than a fixed bill. */
export function isSubscription(name: string): boolean {
  return getBrand(name).matched || SAYS_SO.test(name);
}
