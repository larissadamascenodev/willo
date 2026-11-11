import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a photo of a receipt to the reader — the phone's half of the web's
 * scanUpload.
 *
 * The web redraws the picture on a canvas to shrink it and turn HEIC into JPEG
 * before sending; here the image manipulator does the same, so a 12-megapixel
 * photo goes up at the size the reader actually needs.
 *
 * The file goes up as base64 inside JSON, a shape the same function already reads.
 * A multipart form with a { uri } part never left the phone: the request failed
 * before reaching the server, and every photo and PDF came back "não foi possível ler".
 */

const MAX_SIDE = 2000;
/** Covers the server trying two AI models (55s each) plus the upload. */
const SCAN_TIMEOUT_MS = 130_000;

export interface ScanResult {
  items?: unknown[];
  avg_confidence?: number;
  message?: string;
  declared_total?: number | null;
  carried_over?: number | null;
  declared_next_invoice?: number | null;
  declared_card_limit?: number | null;
  declared_used_limit?: number | null;
}

export interface PickedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

async function prepare(photo: PickedPhoto): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(photo.uri);
    const w = photo.width ?? 0;
    const h = photo.height ?? 0;
    if (Math.max(w, h) > MAX_SIDE) context.resize(w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE });
    const image = await context.renderAsync();
    const out = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return photo.uri;
  }
}

export async function processScanPhoto(photo: PickedPhoto, context: "transaction" | "invoice" = "transaction") {
  const uri = await prepare(photo);
  return send({ uri, name: "comprovante.jpg", type: "image/jpeg" }, context);
}

/** A file picked from the phone — a statement PDF, most often — sent as it is. */
export async function processScanDocument(doc: { uri: string; name?: string | null; mimeType?: string | null }, context: "transaction" | "invoice" = "invoice") {
  const type = doc.mimeType || (doc.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (type.startsWith("image/")) return processScanPhoto({ uri: doc.uri }, context);
  return send({ uri: doc.uri, name: doc.name || "fatura.pdf", type }, context);
}

async function send(file: { uri: string; name: string; type: string }, context: "transaction" | "invoice") {
  let image_base64: string;
  try {
    image_base64 = await new File(file.uri).base64();
  } catch (e) {
    console.warn("scan: read file", e);
    throw new Error(`Não foi possível abrir o arquivo. (${detail(e)})`);
  }

  /* Straight to the function with the signed-in session, no client layer in between:
     through supabase.functions.invoke the request never reached the server, and the
     error it gave back said nothing about why. */
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre de novo e tente outra vez.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify({ image_base64, mime_type: file.type, context }),
      signal: controller.signal,
    });
  } catch (e) {
    console.warn("scan: request", e);
    if (controller.signal.aborted) throw new Error("A leitura demorou demais. Tente novamente.");
    throw new Error(`Sem conexão com o leitor. Confira a internet e tente novamente. (${detail(e)})`);
  } finally {
    clearTimeout(timer);
  }

  let body: (ScanResult & { error?: string }) | null = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON: the status says enough */
  }
  if (!res.ok || body?.error) {
    console.warn("scan: reply", res.status, body);
    throw new Error(body?.error || `Não foi possível ler o comprovante. (erro ${res.status})`);
  }
  return (body ?? {}) as ScanResult;
}

/** A short reason to show with a failure, so the next one says what actually went wrong. */
function detail(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 120);
  return String(e).slice(0, 120);
}
