// O app do celular (mobile/) usa este arquivo no lugar de client.ts: o Metro prefere o sufixo
// .native. A implementação mora em mobile/ porque depende de pacotes que só o app instala.
export { supabase } from "../../../mobile/src/platform/supabase";
