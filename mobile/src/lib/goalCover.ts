import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/integrations/supabase/client";

/**
 * Choosing a picture for a caixinha.
 *
 * The photo is taken from the phone's library, cut to the shape of the cover, shrunk
 * and turned into a JPEG — a photo straight off the camera is a dozen megapixels, and
 * on an iPhone is often HEIC, which nothing else reads — and put where the web puts its
 * own covers: the public bucket, in a folder named for the person. What comes back is
 * the address to store on the goal. It only runs when the person asks for it, and
 * nothing is written until a picture has actually been chosen.
 *
 * Sending is tried the way a phone sends files best — as a file handed to the network
 * layer, never read into JavaScript — and, if that is refused, as the bytes themselves.
 * Whatever goes wrong is thrown with the step it happened in, so the screen can say it
 * instead of a guess.
 *
 * Returns null when the person backs out of the library.
 */

const COVER_WIDTH = 1400;
const BUCKET = "avatars";

export class CoverError extends Error {}

export async function pickGoalCover(userId: string): Promise<string | null> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    /* No editing step: on an iPhone asking for one swaps the quick photo picker for the
       old, slow one. The picture is cut to the cover's shape below instead. */
    picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
  } catch {
    throw new CoverError("Não foi possível abrir a galeria. Confira a permissão de fotos do Willo nos Ajustes do aparelho.");
  }
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  /* Shrunk and made a JPEG on the phone. Both the file and its bytes are kept: the file
     is what is sent first, the bytes are the second way if the first is refused. */
  let uri: string;
  let base64: string;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    /* Cut from the middle to the cover's shape (4:3), so a tall phone photo keeps its centre. */
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    if (w > 0 && h > 0) {
      const cropW = Math.min(w, Math.round((h * 4) / 3));
      const cropH = Math.min(h, Math.round((w * 3) / 4));
      context.crop({ originX: Math.round((w - cropW) / 2), originY: Math.round((h - cropH) / 2), width: cropW, height: cropH });
      if (cropW > COVER_WIDTH) context.resize({ width: COVER_WIDTH });
    } else if (w > COVER_WIDTH) {
      context.resize({ width: COVER_WIDTH });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) throw new Error("empty");
    uri = saved.uri;
    base64 = saved.base64;
  } catch (e) {
    throw new CoverError(`Não foi possível preparar a foto (${e instanceof Error ? e.message : "erro"}). Tente outra imagem.`);
  }

  const path = `${userId}/goal-${Date.now()}.jpg`;
  const reasons: string[] = [];

  /* 1 — the file itself, as a form: the phone streams it, JavaScript never holds it. */
  try {
    const form = new FormData();
    form.append("file", { uri, name: "cover.jpg", type: "image/jpeg" } as unknown as Blob);
    const { error } = await supabase.storage.from(BUCKET).upload(path, form, { contentType: "image/jpeg", upsert: true });
    if (!error) return publicUrl(path);
    reasons.push(error.message);
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : "arquivo recusado");
  }

  /* 2 — the bytes, as a plain buffer. */
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes.buffer, { contentType: "image/jpeg", upsert: true });
    if (!error) return publicUrl(path);
    reasons.push(error.message);
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : "bytes recusados");
  }

  throw new CoverError(`Não foi possível enviar a foto: ${reasons.join(" / ")}`);
}

function publicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
