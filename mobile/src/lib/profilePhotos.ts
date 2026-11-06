import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { supabase } from "@/integrations/supabase/client";

/**
 * The two photos the profile lets a person choose: their own picture, and a
 * background for the screens.
 *
 * Both come from the phone's library and are cut and shrunk on the phone first — a
 * photo straight off the camera is a dozen megapixels and often HEIC. The profile
 * picture goes where the web keeps it (the public `avatars` bucket, in the person's
 * folder) and its address is written on the profile. The background never leaves the
 * phone: it is copied into the app's documents and only its file name is kept.
 *
 * Each returns null when the person backs out of the library, and throws a
 * `PhotoError` with a sentence the screen can show when something goes wrong.
 */

export class PhotoError extends Error {}

async function pick(): Promise<ImagePicker.ImagePickerAsset | null> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    /* No editing step: on an iPhone it swaps the quick picker for the old one. */
    picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
  } catch {
    throw new PhotoError("Não foi possível abrir a galeria. Confira a permissão de fotos do Willo nos Ajustes do aparelho.");
  }
  return picked.canceled ? null : (picked.assets[0] ?? null);
}

/** Cuts from the middle to `ratio` (width / height) and shrinks to `maxWidth`. */
async function shape(asset: ImagePicker.ImagePickerAsset, ratio: number, maxWidth: number, base64: boolean) {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    if (w > 0 && h > 0) {
      const cropW = Math.min(w, Math.round(h * ratio));
      const cropH = Math.min(h, Math.round(w / ratio));
      context.crop({ originX: Math.round((w - cropW) / 2), originY: Math.round((h - cropH) / 2), width: cropW, height: cropH });
      if (cropW > maxWidth) context.resize({ width: maxWidth });
    } else if (w > maxWidth) {
      context.resize({ width: maxWidth });
    }
    const image = await context.renderAsync();
    return await image.saveAsync({ compress: 0.84, format: SaveFormat.JPEG, base64 });
  } catch (e) {
    throw new PhotoError(`Não foi possível preparar a foto (${e instanceof Error ? e.message : "erro"}). Tente outra imagem.`);
  }
}

/** Chooses, sends and records a new profile picture. Returns its address. */
export async function pickAvatar(userId: string): Promise<string | null> {
  const asset = await pick();
  if (!asset) return null;
  const saved = await shape(asset, 1, 640, true);

  const path = `${userId}/avatar.jpg`;
  const reasons: string[] = [];
  let sent = false;

  /* The file itself first: the phone streams it and JavaScript never holds it. */
  try {
    const form = new FormData();
    form.append("file", { uri: saved.uri, name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob);
    const { error } = await supabase.storage.from("avatars").upload(path, form, { contentType: "image/jpeg", upsert: true });
    if (error) reasons.push(error.message);
    else sent = true;
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : "arquivo recusado");
  }

  /* Then the bytes, if the file was refused. */
  if (!sent && saved.base64) {
    try {
      const binary = atob(saved.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from("avatars").upload(path, bytes.buffer, { contentType: "image/jpeg", upsert: true });
      if (error) reasons.push(error.message);
      else sent = true;
    } catch (e) {
      reasons.push(e instanceof Error ? e.message : "bytes recusados");
    }
  }
  if (!sent) throw new PhotoError(`Não foi possível enviar a foto: ${reasons.join(" / ")}`);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  /* The address stays the same on every change, so it carries when it changed. */
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const { error } = await supabase
    .from("profiles" as never)
    .update({ avatar_url: url } as never)
    .eq("id", userId);
  if (error) throw new PhotoError(`A foto foi enviada, mas não foi possível salvá-la no perfil: ${error.message}`);
  return url;
}

/** Chooses a background and keeps it on the phone. Returns its file name. */
export async function pickBackground(screenRatio: number): Promise<string | null> {
  const asset = await pick();
  if (!asset) return null;
  const saved = await shape(asset, screenRatio, 1290, false);
  try {
    const name = `background-${Date.now()}.jpg`;
    new File(saved.uri).copy(new File(Paths.document, name));
    return name;
  } catch (e) {
    throw new PhotoError(`Não foi possível guardar a foto no aparelho (${e instanceof Error ? e.message : "erro"}).`);
  }
}
