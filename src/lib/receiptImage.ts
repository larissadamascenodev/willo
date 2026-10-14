/**
 * The receipt, drawn as a picture that can leave the app.
 *
 * Rendering the DOM node would mean a screenshot library and a dependency on whatever
 * the screen happened to look like. Drawing it instead means the shared image is a
 * deliberate thing — Willo's own receipt, legible at thumbnail size, carrying the mark
 * — rather than a crop of a phone screen.
 */

export interface ReceiptItem {
  name: string;
  category: string;
  amount: number;
  type: "despesa" | "receita";
}

const BG = "#141416";
const RULE = "rgba(255,255,255,0.14)";
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

export async function renderReceipt(items: ReceiptItem[], when: Date = new Date()): Promise<Blob> {
  const W = 360;
  const PAD = 24;
  const ROW = 54;
  const HEAD = 104;
  const FOOT = 86;
  const TEETH = 10;
  const H = HEAD + items.length * ROW + FOOT + TEETH;

  const dpr = 3;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas indisponível");
  c.scale(dpr, dpr);

  // Body, with the bottom torn off into teeth.
  const teethCount = 18;
  const tw = W / teethCount;
  c.beginPath();
  c.moveTo(16, 0);
  c.arcTo(W, 0, W, 16, 16);
  c.lineTo(W, H - TEETH);
  for (let i = teethCount; i >= 1; i--) {
    c.lineTo(i * tw - tw / 2, H);
    c.lineTo(i * tw - tw, H - TEETH);
  }
  c.lineTo(0, 16);
  c.arcTo(0, 0, 16, 0, 16);
  c.closePath();
  c.fillStyle = BG;
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.08)";
  c.lineWidth = 1;
  c.stroke();

  // Header
  c.textBaseline = "alphabetic";
  c.fillStyle = DIM;
  c.font = `700 11px ${FONT}`;
  const title = "N O T I N H A";
  c.fillText(title, PAD, 40);

  c.font = `400 12px ${FONT}`;
  c.textAlign = "right";
  c.fillText(
    when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    W - PAD,
    40,
  );
  c.textAlign = "left";

  dashed(c, PAD, W - PAD, 62);

  // Rows
  let y = HEAD;
  for (const item of items) {
    c.fillStyle = INK;
    c.font = `600 16px ${FONT}`;
    const amount = `${item.type === "receita" ? "+" : "−"}${money(item.amount)}`;
    c.textAlign = "right";
    c.fillText(amount, W - PAD, y);
    c.textAlign = "left";

    // The name gives way to the figure rather than running under it.
    const amountWidth = c.measureText(amount).width;
    const room = W - PAD * 2 - amountWidth - 14;
    let name = item.name;
    while (c.measureText(name).width > room && name.length > 1) name = name.slice(0, -1);
    if (name !== item.name) name = `${name.slice(0, -1)}…`;
    c.fillText(name, PAD, y);

    c.fillStyle = DIM;
    c.font = `400 12.5px ${FONT}`;
    c.fillText(item.category, PAD, y + 18);

    y += ROW;
  }

  dashed(c, PAD, W - PAD, y - 18);

  // Total
  const total = items.reduce((t, i) => t + (i.type === "receita" ? i.amount : -i.amount), 0);
  c.fillStyle = DIM;
  c.font = `500 12.5px ${FONT}`;
  c.fillText("Total", PAD, y + 14);
  c.fillStyle = total >= 0 ? GREEN : INK;
  c.font = `800 20px ${FONT}`;
  c.textAlign = "right";
  c.fillText(`${total >= 0 ? "+" : "−"}${money(Math.abs(total))}`, W - PAD, y + 16);
  c.textAlign = "left";

  // The mark
  c.fillStyle = INK;
  c.font = `800 17px ${FONT}`;
  c.fillText("willo", PAD, y + 62);
  c.fillStyle = GREEN;
  c.beginPath();
  c.arc(PAD + c.measureText("willo").width + 5, y + 58, 2.6, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = DIM;
  c.font = `400 11.5px ${FONT}`;
  c.textAlign = "right";
  c.fillText(
    when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    W - PAD,
    y + 62,
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
