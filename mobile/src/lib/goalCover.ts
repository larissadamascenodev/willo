import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/integrations/supabase/client";

/**
 * Choosing a picture for a cofrinho.
 *
 * The photo is taken from the phone's library, cut to the shape of the cover, shrunk
 * and turned into a JPEG — a photo straight off the camera is a dozen megapixels, and
 * on an iPhone is often HEIC, which nothing else reads — and put where the web puts its
 * own covers: the public bucket, in a folder named for the person. What comes back is
 * the address to store on the goal. It only runs when the person asks for it, and
 * nothing is written until a picture has actually been chosen.
 *
 * Returns null when the person backs out of the library. When something goes wrong it
 * throws with the reason in words, so the screen can say it instead of a guess.
 */

const COVER_WIDTH = 1400;

export class CoverError extends Error {}

export async function pickGoalCover(userId: string): Promise<string | null> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
  } catch {
    throw new CoverError("Não foi possível abrir a galeria. Confira a permissão de fotos do Willo nos Ajustes do aparelho.");
  }
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return null;

  let uri = asset.uri;
  try {
    const context = ImageManipulator.manipulate(uri);
    if ((asset.width ?? 0) > COVER_WIDTH) context.resize({ width: COVER_WIDTH });
    const image = await context.renderAsync();
    uri = (await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })).uri;
  } catch {
    /* Sent as it is; the picker already cut it. */
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(uri)).arrayBuffer();
  } catch {
    throw new CoverError("Não foi possível ler a foto escolhida.");
  }

  const path = `${userId}/goal-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new CoverError(`Não foi possível enviar a foto: ${error.message}`);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
