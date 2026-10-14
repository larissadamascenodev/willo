/**
 * The receipt, drawn as a picture that can leave the app.
 *
 * Rendering the DOM node would mean a screenshot library and a dependency on whatever
 * the screen happened to look like. Drawing it instead means the shared image is a
 * deliberate thing — Willo's own receipt, legible at thumbnail size, carrying the mark.
 *
 * It is drawn on its own ground rather than as a cut-out. A transparent PNG looks right
 * in the app and then arrives in a chat sitting on whatever that app paints behind it,
 * which turned the torn edge into notches bitten out of a white block. Giving the image
 * a background of its own means the teeth read as a torn edge everywhere.
 */

export interface ReceiptItem {
  name: string;
  category: string;
  amount: number;
  type: "despesa" | "receita";
  /** "Crédito · Nubank", "Débito", "Pix" — whatever was actually settled on. */
  method?: string;
}

const GROUND = "#0B0C0E";
const CARD = "#161619";
const RULE = "rgba(255,255,255,0.15)";
const INK = "#F6F6F4";
const DIM = "rgba(255,255,255,0.46)";
const GREEN = "#C8F36D";
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A dashed rule drawn by hand, because setLineDash is not honoured on every canvas. */
function dashed(c: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  c.strokeStyle = RULE;
  c.lineWidth = 1;
  c.beginPath();
  for (let x = x1; x < x2; x += 7) {
    c.moveTo(x, y);
    c.lineTo(Math.min(x + 3.5, x2), y);
  }
  c.stroke();
}

/** Shortens text to fit, with an ellipsis, measured in the font already set. */
function fit(c: CanvasRenderingContext2D, text: string, room: number) {
  if (c.measureText(text).width <= room) return text;
  let out = text;
  while (out.length > 1 && c.measureText(`${out}…`).width > room) out = out.slice(0, -1);
  return `${out}…`;
}

export async function renderReceipt(items: ReceiptItem[], when: Date = new Date()): Promise<Blob> {
  const MARGIN = 26;
  const CARD_W = 340;
  const W = CARD_W + MARGIN * 2;

  const PAD = 24;
  const ROW = 54;
  const HEAD = 100;
  const TEETH = 10;
  // One entry needs no total: it would repeat the figure directly above it.
  const showTotal = items.length > 1;
  const FOOT = (showTotal ? 84 : 42) + 44;
  const CARD_H = HEAD + items.length * ROW + FOOT + TEETH;
  const H = CARD_H + MARGIN * 2;

  const dpr = 3;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas indisponível");
  c.scale(dpr, dpr);

  // The ground the receipt sits on, so nothing shows through anywhere it is opened.
  c.fillStyle = GROUND;
  c.fillRect(0, 0, W, H);
  const wash = c.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
  wash.addColorStop(0, "rgba(255,255,255,0.055)");
  wash.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = wash;
  c.fillRect(0, 0, W, H);

  c.translate(MARGIN, MARGIN);

  // Card body, with the bottom torn off into teeth.
  const teethCount = 18;
  const tw = CARD_W / teethCount;
  c.beginPath();
  c.moveTo(16, 0);
  c.arcTo(CARD_W, 0, CARD_W, 16, 16);
  c.lineTo(CARD_W, CARD_H - TEETH);
  for (let i = teethCount; i >= 1; i--) {
    c.lineTo(i * tw - tw / 2, CARD_H);
    c.lineTo(i * tw - tw, CARD_H - TEETH);
  }
  c.lineTo(0, 16);
  c.arcTo(0, 0, 16, 0, 16);
  c.closePath();
  c.save();
  c.shadowColor = "rgba(0,0,0,0.55)";
  c.shadowBlur = 26;
  c.shadowOffsetY = 10;
  c.fillStyle = CARD;
  c.fill();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.09)";
  c.lineWidth = 1;
  c.stroke();

  // Header
  c.textBaseline = "alphabetic";
  c.fillStyle = DIM;
  c.font = `700 11px ${FONT}`;
  c.fillText("N O T I N H A", PAD, 38);

  c.font = `400 12px ${FONT}`;
  c.textAlign = "right";
  c.fillText(
    when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    CARD_W - PAD,
    38,
  );
  c.textAlign = "left";

  dashed(c, PAD, CARD_W - PAD, 60);

  // Rows
  let y = HEAD;
  for (const item of items) {
    c.fillStyle = INK;
    c.font = `600 16px ${FONT}`;
    const amount = `${item.type === "receita" ? "+" : "−"}${money(item.amount)}`;
    c.textAlign = "right";
    c.fillText(amount, CARD_W - PAD, y);
    const amountWidth = c.measureText(amount).width;
    c.textAlign = "left";
    c.fillText(fit(c, item.name, CARD_W - PAD * 2 - amountWidth - 14), PAD, y);

    c.fillStyle = DIM;
    c.font = `400 12.5px ${FONT}`;
    const sub = item.method ? `${item.category} · ${item.method}` : item.category;
    c.fillText(fit(c, sub, CARD_W - PAD * 2), PAD, y + 18);

    y += ROW;
  }

  let footY = y - 18;

  if (showTotal) {
    dashed(c, PAD, CARD_W - PAD, footY);
    const total = items.reduce((t, i) => t + (i.type === "receita" ? i.amount : -i.amount), 0);
    c.fillStyle = DIM;
    c.font = `500 12.5px ${FONT}`;
    c.fillText("Total", PAD, footY + 32);
    c.fillStyle = total >= 0 ? GREEN : INK;
    c.font = `800 20px ${FONT}`;
    c.textAlign = "right";
    c.fillText(`${total >= 0 ? "+" : "−"}${money(Math.abs(total))}`, CARD_W - PAD, footY + 34);
    c.textAlign = "left";
    footY += 62;
  }

  // The mark, and the moment it was filed.
  c.fillStyle = INK;
  c.font = `800 17px ${FONT}`;
  c.fillText("willo", PAD, footY + 44);
  c.fillStyle = GREEN;
  c.beginPath();
  c.arc(PAD + c.measureText("willo").width + 5, footY + 40, 2.6, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = DIM;
  c.font = `400 11.5px ${FONT}`;
  c.textAlign = "right";
  c.fillText(
    when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    CARD_W - PAD,
    footY + 44,
  );
  c.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não consegui gerar a imagem"))),
      "image/png",
    );
  });
}

export type ReceiptDelivery = "shared" | "downloaded" | "opened";

/**
 * Hands the image to the person however this device allows.
 *
 * The share sheet first, since on a phone that is what "save or send" actually means
 * and it covers both. A download anchor next, which is the desktop answer. Opening it
 * in a tab last, for the web views where neither works — the picture is still there to
 * press and hold, which is better than a button that silently does nothing.
 */
export async function deliverReceipt(blob: Blob, filename: string): Promise<ReceiptDelivery> {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Notinha Willo" });
      return "shared";
    } catch (err) {
      // A cancelled share sheet is a decision, not a failure to work around.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    if ("download" in a) {
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return "downloaded";
    }
    window.open(url, "_blank", "noopener");
    return "opened";
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 20_000);
  }
}
