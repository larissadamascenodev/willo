import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ScanFile {
  uri: string;
  name: string;
  type: string;
}

const MAX_SIDE = 2000;
/** Cobre as duas tentativas de IA no servidor (55 s cada) mais o envio de uma fatura inteira. */
const SCAN_TIMEOUT_MS = 130_000;

/** Reduz a foto do celular (muitas vezes enorme ou HEIC) para um JPEG que a IA aceita. */
async function toJpeg(uri: string, width?: number): Promise<ScanFile> {
  const actions = width && width > MAX_SIDE ? [{ resize: { width: MAX_SIDE } }] : [];
  const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: out.uri, name: "comprovante.jpg", type: "image/jpeg" };
}

/** Abre a câmera. Devolve null se a pessoa cancelar ou negar o acesso. */
export async function pickFromCamera(): Promise<ScanFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Permita o uso da câmera nos Ajustes para fotografar comprovantes.");
  const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
  if (res.canceled || !res.assets[0]) return null;
  return toJpeg(res.assets[0].uri, res.assets[0].width);
}

/** Escolhe uma imagem da galeria. */
export async function pickFromLibrary(): Promise<ScanFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
  if (res.canceled || !res.assets[0]) return null;
  return toJpeg(res.assets[0].uri, res.assets[0].width);
}

/** Escolhe um PDF ou planilha (a fatura baixada do app do banco). */
export async function pickDocument(): Promise<ScanFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.mimeType?.startsWith("image/")) return toJpeg(a.uri);
  return { uri: a.uri, name: a.name, type: a.mimeType ?? "application/pdf" };
}

/** Manda o comprovante ou a fatura para a função process-invoice e devolve o que a IA leu. */
export async function processScanFile(file: ScanFile, context?: "transaction" | "invoice") {
  const formData = new FormData();
  // no React Native o arquivo vai como { uri, name, type }
  formData.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  if (context) formData.append("context", context);

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("A leitura demorou demais. Tente novamente.")), SCAN_TIMEOUT_MS));
  const { data, error } = await Promise.race([supabase.functions.invoke("process-invoice", { body: formData }), timeout]);

  if (error) {
    let message = "Não foi possível ler o comprovante. Tente novamente.";
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch {
        /* mantém a mensagem genérica */
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
