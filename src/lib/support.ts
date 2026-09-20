/**
 * Where people reach a human. The App Store requires a support contact that
 * works without an account, so these also power the public /suporte page.
 *
 * TODO: troque pelos canais reais antes de publicar na App Store.
 */
export const SUPPORT_EMAIL = "suporte@willo.app";

/** Only digits, with country and area code (e.g. 5511999999999). Empty hides the WhatsApp button. */
export const SUPPORT_WHATSAPP = "";

export const supportMailto = (subject = "Suporte Willo") =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const supportWhatsApp = (text = "Olá! Vim pelo suporte do Willo.") =>
  `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
