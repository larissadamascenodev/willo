import * as ImagePicker from "expo-image-picker";

/**
 * Getting a statement off the phone: a file (the PDF the bank sends), a picture already
 * in the gallery, or one taken now. Each answers with the same shape, or null when the
 * person backed out.
 *
 * The file picker is a native module that only builds made after it was added carry.
 * An update reaching an older build would crash on importing it, so it is required
 * when asked for, and a build without it says so instead.
 */

export interface PickedStatement {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
}

export class NeedsNewBuild extends Error {}

export async function pickFile(): Promise<PickedStatement | null> {
  let picker: typeof import("expo-document-picker");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require("expo-document-picker");
  } catch {
    throw new NeedsNewBuild("Para enviar arquivos, instale a versão mais nova do app.");
  }
  const result = await picker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null } : null;
}

export async function pickFromGallery(): Promise<PickedStatement | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: "image/jpeg", width: asset.width, height: asset.height } : null;
}

export async function takePhoto(): Promise<PickedStatement | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Libere a câmera para o Willo nos Ajustes do iPhone.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: "image/jpeg", width: asset.width, height: asset.height } : null;
}
