import LegalDocument from "@/components/legal/LegalDocument";
import { TERMS } from "@/lib/legal";

/** The Terms of Use: the same text the app shows (lib/legal). */
const TermosDeUso = () => <LegalDocument doc={TERMS} />;

export default TermosDeUso;
