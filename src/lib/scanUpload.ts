import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const MAX_SIDE = 2000;
/** Covers the server trying two AI models (55s each) plus the upload of a full statement. */
const SCAN_TIMEOUT_MS = 130_000;
const PASSTHROUGH = /\.(pdf|csv|xls|xlsx)$/i;

/**
 * Phone photos are often large or HEIC. Re-encode images as a resized JPEG so
 * they stay under the AI's size limit and use a supported format.
 */
export async function prepareScanFile(file: File): Promise<File> {
  if (PASSTHROUGH.test(file.name) || file.type === "application/pdf") return file;
  if (file.type && !file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "comprovante";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Sends a receipt/invoice to the process-invoice function and surfaces its real error message. */
export async function processScanFile(file: File, context?: "transaction" | "invoice") {
  const formData = new FormData();
  formData.append("file", await prepareScanFile(file));
  if (context) formData.append("context", context);

  // Never leave the scan screen spinning forever
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("A leitura demorou demais. Tente novamente.")), SCAN_TIMEOUT_MS),
  );
  const { data, error } = await Promise.race([
    supabase.functions.invoke("process-invoice", { body: formData }),
    timeout,
  ]);

  if (error) {
    let message = "Não foi possível ler o comprovante. Tente novamente.";
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep generic message */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
