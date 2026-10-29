import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/integrations/supabase/client";

/**
 * Choosing a picture for a cofrinho.
 *
 * The photo is taken from the phone's library, cut to the shape of the cover, and put
 * where the web puts its own covers: the public bucket, in a folder named for the
 * person. What comes back is the address to store on the goal. It only runs when the
 * person asks for it, and nothing is written until a picture has actually been chosen.
 *
 * Returns null when the person backs out of the library.
 */
export async function pickGoalCover(userId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 10],
    quality: 0.7,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${userId}/goal-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
