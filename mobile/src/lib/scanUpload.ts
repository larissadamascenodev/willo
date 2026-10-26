import { FunctionsHttpError } from "@supabase/supabase-js";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a photo of a receipt to the reader — the phone's half of the web's
 * scanUpload.
 *
 * The web redraws the picture on a canvas to shrink it and turn HEIC into JPEG
 * before sending; here the image manipulator does the same, so a 12-megapixel
 * photo goes up at the size the reader actually needs. The request is the same
 * multipart form the web sends, to the same function.
 */

const MAX_SIDE = 2000;
/** Covers the server trying two AI models (55s each) plus the upload. */
const SCAN_TIMEOUT_MS = 130_000;

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
  const form = new FormData();
  /* React Native's fetch reads a file part as { uri, name, type }. */
  form.append("file", { uri, name: "comprovante.jpg", type: "image/jpeg" } as unknown as Blob);
  form.append("context", context);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("A leitura demorou demais. Tente novamente.")), SCAN_TIMEOUT_MS),
  );
  const { data, error } = await Promise.race([supabase.functions.invoke("process-invoice", { body: form }), timeout]);

  if (error) {
    let message = "Não foi possível ler o comprovante. Tente novamente.";
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep the plain message */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as { items?: unknown[]; avg_confidence?: number };
}
