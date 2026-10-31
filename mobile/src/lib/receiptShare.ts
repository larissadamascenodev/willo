import { Share, type View } from "react-native";
import type { ComponentRef, RefObject } from "react";

type Target = RefObject<ComponentRef<typeof View> | null>;

/**
 * Sharing the receipt, and keeping it in the gallery.
 *
 * Both draw the receipt as a picture first. The modules that do that are native, and a
 * build made before they were added does not carry them: there, sharing falls back to
 * the receipt as text and saving says it needs the new version — nothing crashes on an
 * update that reaches an older build.
 */

async function capture(ref: Target): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const shot = require("react-native-view-shot") as typeof import("react-native-view-shot");
  if (!ref.current) throw new Error("sem comprovante");
  return shot.captureRef(ref as never, { format: "png", quality: 1 });
}

export async function shareReceipt(ref: Target, asText: string) {
  try {
    const uri = await capture(ref);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharing = require("expo-sharing") as typeof import("expo-sharing");
    if (await sharing.isAvailableAsync()) {
      await sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar comprovante" });
      return;
    }
  } catch {
    /* Text, then. */
  }
  await Share.share({ message: asText });
}

export async function saveReceipt(ref: Target): Promise<"saved" | "denied" | "unavailable"> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const library = require("expo-media-library") as typeof import("expo-media-library");
    const permission = await library.requestPermissionsAsync(true);
    if (!permission.granted) return "denied";
    const uri = await capture(ref);
    await library.saveToLibraryAsync(uri);
    return "saved";
  } catch {
    return "unavailable";
  }
}
