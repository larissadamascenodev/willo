import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * The bridge to the iPhone action "Registrar compra no Willo". Absent in Expo Go and in
 * builds made before it existed, so every call is optional.
 */
type Native = { setCode(code: string | null, url: string | null): void; hasCode(): boolean };

const native = requireOptionalNativeModule<Native>("WilloCopilot");

/** Whether this build has the action at all. */
export const hasCopilotAction = !!native;

export function setCopilotCode(code: string | null, url: string | null) {
  try {
    native?.setCode(code, url);
  } catch {
    /* an older build: nothing to hand over */
  }
}
