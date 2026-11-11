import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/integrations/supabase/client";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import Surface from "~/components/Surface";
import { ChevronLeft, CreditCard, Zap } from "~/components/icons";
import { Primary } from "~/components/registro/entryParts";
import { showToast } from "~/lib/toast";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th, useThemeRedraw } from "~/theme/theme";

/**
 * The two shortcuts the iPhone can give Willo, set up step by step.
 *
 * - Two taps on the back of the phone open Registro rápido (willo://rapido).
 * - Every purchase with a card in the Wallet goes into Willo Copilot, to confirm later.
 *   The shortcut needs the person's own Copilot code, which this screen hands over.
 */

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/copilot`;

export default function Atalhos() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  /* The person's Copilot code, handed over through the share sheet so it can be copied. */
  const shareCode = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot", { body: { action: "code" } });
      if (error || !data?.code) throw new Error();
      await Share.share({ message: data.code });
    } catch {
      showToast("Não consegui gerar o código agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center" }}>
          <RoundButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.4} />
          </RoundButton>
        </View>
        <Text style={{ marginTop: 14, fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: th("#fff") }}>Atalhos do iPhone</Text>
        <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>
          Dois jeitos de anotar sem abrir o app. Configure uma vez, no app Atalhos do iPhone.
        </Text>

        {/* ── Two taps on the back ── */}
        <Section icon={<Zap size={18} color={th(GREEN)} strokeWidth={2.4} />} title="Toque duplo nas costas" note="Dois toques atrás do iPhone abrem o Registro rápido.">
          <Step n={1}>No app <B>Atalhos</B>, toque em <B>+</B>, busque e escolha a ação <B>Abrir URLs</B> (não a ação <B>URL</B> sozinha).</Step>
          <Step n={2}>
            No endereço, escreva <B>willo://rapido</B>. Dê o nome <B>Registro rápido Willo</B> ao atalho.
          </Step>
          <Step n={3}>
            Rode o atalho uma vez tocando nele no app <B>Atalhos</B>. Quando o iPhone perguntar se pode abrir o Willo, toque em <B>Sempre permitir</B>. Sem isso, o toque nas costas só mostra o aviso e não abre nada.
          </Step>
          <Step n={4}>
            Vá em <B>Ajustes › Acessibilidade › Toque › Toque traseiro › Toque duplo</B> e escolha o atalho <B>Registro rápido Willo</B>.
          </Step>
          <Step n={5} last>Pronto: dois toques nas costas do iPhone e o Willo abre direto no Registro rápido.</Step>
        </Section>

        {/* ── Wallet purchases into Copilot ── */}
        <Section
          icon={<CreditCard size={18} color={th(GREEN)} strokeWidth={2.4} />}
          title="Compras da Carteira no Copilot"
          note="Cada compra com cartão da Carteira (por aproximação) vai para o Willo Copilot, esperando você confirmar."
        >
          <Step n={1}>
            Toque em <B>Copiar meu código</B> aqui embaixo e escolha <B>Copiar</B>. É o seu código pessoal: não compartilhe.
          </Step>
          <Step n={2}>
            No app <B>Atalhos</B>, aba <B>Automação</B> › <B>+</B> › <B>Transação</B>. Marque os seus cartões, escolha <B>Executar imediatamente</B> e toque em <B>Seguinte</B> › <B>Novo atalho em branco</B>.
          </Step>
          <Step n={3}>
            Adicione a ação <B>Obter conteúdo do URL</B>. No URL, cole: <B>{FUNCTION_URL}</B>
          </Step>
          <Step n={4}>
            Toque em <B>Mostrar mais</B>: Método <B>POST</B>, Corpo da solicitação <B>JSON</B>, e adicione os campos de texto:
            {"\n"}• <B>code</B> = o seu código colado
            {"\n"}• <B>amount</B> = Entrada do atalho › <B>Valor</B>
            {"\n"}• <B>merchant</B> = Entrada do atalho › <B>Comerciante</B>
            {"\n"}• <B>card</B> = Entrada do atalho › <B>Cartão ou Passe</B>
          </Step>
          <Step n={5} last>Pronto. A próxima compra com o iPhone aparece no card Willo Copilot, na tela inicial.</Step>
          <View style={{ marginTop: 6 }}>
            <Primary label={busy ? "Gerando…" : "Copiar meu código"} onPress={() => void shareCode()} busy={busy} disabled={busy} />
          </View>
          {busy && <ActivityIndicator style={{ marginTop: 8 }} color={th(INK.soft)} />}
        </Section>

        <Text style={{ marginTop: 18, fontSize: 12.5, lineHeight: 18, color: th(INK.softer) }}>
          Pix não passa pela Carteira: ele não entra sozinho. Para um Pix, use a câmera do Registro rápido com o comprovante.
        </Text>
      </ScrollView>
    </Room>
  );
}

function Section({ icon, title, note, children }: { icon: ReactNode; title: string; note: string; children: ReactNode }) {
  return (
    <Surface radius={24} style={{ marginTop: 18, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.14)", "bg") }}>{icon}</View>
        <Text style={[T.cardLabel, { flex: 1, fontSize: 16, fontWeight: "700", color: th("#fff") }]}>{title}</Text>
      </View>
      <Text style={{ marginTop: 8, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{note}</Text>
      <View style={{ marginTop: 12 }}>{children}</View>
    </Surface>
  );
}

function Step({ n, last, children }: { n: number; last?: boolean; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: th("rgba(255,255,255,0.06)", "line") }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: th("#fff") }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>{children}</Text>
    </View>
  );
}

function B({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: "700", color: th("#fff") }}>{children}</Text>;
}
