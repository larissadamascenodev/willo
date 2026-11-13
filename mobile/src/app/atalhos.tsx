import { useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { hasCopilotAction } from "../../modules/willo-copilot";
import { supabase } from "@/integrations/supabase/client";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import Surface from "~/components/Surface";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Compass, Copy, CreditCard, Link2, Play, Zap } from "~/components/icons";
import { showToast } from "~/lib/toast";
import { GREEN, INK } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";

/**
 * The two shortcuts the iPhone can give Willo, taught the way the Shortcuts app looks.
 *
 * - Two taps on the back of the phone open Registro rápido (willo://rapido).
 * - Every purchase with a card in the Wallet goes into Willo Copilot, to confirm later.
 *
 * One tab each. Every step has a title that says what to do, a line that says where,
 * and, where it helps, a small drawing of what the person should see on their screen —
 * the action block, the address to copy, the path in Ajustes. The one mistake people
 * make (the "URL" action instead of "Abrir URLs") is drawn too, crossed out.
 */

const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/copilot`;
const RAPIDO_URL = "willo://rapido";
const SHORTCUT_NAME = "Registro rápido Willo";
/**
 * The ready-made shortcut, shared from iCloud: one tap on "Adicionar Atalho" and it is in
 * the person's Shortcuts, nothing to build. Empty until the link exists; the steps to
 * build it by hand show instead.
 */
const RAPIDO_SHORTCUT_LINK = "https://www.icloud.com/shortcuts/55b4011c3e0346c28bb6ceb472a27312";

/* The blue of the Shortcuts app, so the drawings read as its screens. */
const SHORTCUT_BLUE = "#3B82F6";
const AMBER = "#F5B544";

type Tab = "costas" | "carteira";

export default function Atalhos() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("costas");

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center" }}>
          <RoundButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.4} />
          </RoundButton>
        </View>

        <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }}>Atalhos do iPhone</Text>
        <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: th(INK.soft) }}>
          Anote sem procurar o app. Você configura uma vez só, no app Atalhos do iPhone, e leva uns 2 minutos.
        </Text>

        <Segment tab={tab} onChange={setTab} />

        <Animated.View key={tab} entering={FadeIn.duration(220)}>
          {tab === "costas" ? <BackTap /> : <WalletCopilot />}
        </Animated.View>
      </ScrollView>
    </Room>
  );
}

/* ───────────── Two taps on the back ───────────── */

function BackTap() {
  const [byHand, setByHand] = useState(!RAPIDO_SHORTCUT_LINK);
  if (byHand) {
    return (
      <View>
        <BackTapByHand />
        {!!RAPIDO_SHORTCUT_LINK && (
          <Pressable onPress={() => setByHand(false)} style={{ marginTop: 14, alignSelf: "center", padding: 8 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: th(INK.soft) }}>Voltar ao jeito rápido</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <View>
      <Lead icon={<Zap size={18} color={th(GREEN)} strokeWidth={2.4} />} title="Dois toques atrás do iPhone" text="O Willo abre direto no Registro rápido, mesmo com o app fechado. São dois passos." />

      <Step n={1} title="Instale o atalho do Willo">
        Toque no botão abaixo. O app <B>Atalhos</B> abre com o atalho pronto: é só tocar em <B>Adicionar Atalho</B>.
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            void Linking.openURL(RAPIDO_SHORTCUT_LINK).catch(() => showToast("Não consegui abrir o app Atalhos."));
          }}
          style={({ pressed }) => ({ marginTop: 12, height: 50, borderRadius: 25, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
        >
          <Zap size={17} color={th("#0B0B0B")} strokeWidth={2.4} />
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>Instalar atalho</Text>
        </Pressable>
      </Step>

      <Step n={2} title="Ligue nas costas do iPhone" last>
        Abra os <B>Ajustes</B> do iPhone e siga:
        <Path steps={["Acessibilidade", "Toque", "Tocar Atrás", "Toque Duplo"]} />
        Na lista, escolha <B>{SHORTCUT_NAME}</B>.
      </Step>

      <Done text="Pronto. Dê dois toques firmes atrás do iPhone, perto da câmera, e o Registro rápido abre." />

      <Pressable onPress={() => setByHand(true)} style={{ marginTop: 14, alignSelf: "center", padding: 8 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: th(INK.soft) }}>Prefiro montar o atalho por conta própria</Text>
      </Pressable>
    </View>
  );
}

function BackTapByHand() {
  return (
    <View>
      <Lead icon={<Zap size={18} color={th(GREEN)} strokeWidth={2.4} />} title="Dois toques atrás do iPhone" text="O Willo abre direto no Registro rápido, mesmo com o app fechado." />

      <Step n={1} title="Crie um atalho novo">
        Abra o app <B>Atalhos</B> e toque no <B>+</B>, no canto de cima.
      </Step>

      <Step n={2} title="Adicione a ação Abrir URLs">
        Toque em <B>Buscar</B>, embaixo, digite <B>Abrir URLs</B> e toque nela.
        <Figure>
          <ActionBlock icon={<Compass size={16} color="#fff" strokeWidth={2.4} />} tint={SHORTCUT_BLUE} words={["Abrir"]} token={RAPIDO_URL} />
          <Caption ok>É assim que ela fica.</Caption>
        </Figure>
        <Figure warn>
          <ActionBlock icon={<Link2 size={16} color="#fff" strokeWidth={2.4} />} tint="#6B7280" token={RAPIDO_URL} crossed />
          <Caption>
            Não use a ação <B>URL</B>, com o ícone de corrente. Ela só guarda o endereço e o app não abre.
          </Caption>
        </Figure>
      </Step>

      <Step n={3} title="Coloque o endereço do Willo">
        Toque no campo azul da ação, onde está escrito <B>URL</B>, e cole o endereço:
        <CopyField value={RAPIDO_URL} />
      </Step>

      <Step n={4} title="Dê um nome e teste">
        No topo, toque no nome do atalho e chame de <B>{SHORTCUT_NAME}</B>. Depois toque no <B>▶</B>, embaixo à direita.
        <Figure>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
              <Play size={15} color={th("#fff")} fill={th("#fff")} />
            </View>
            <ChevronRight size={16} color={th(INK.softer)} />
            <View style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: SHORTCUT_BLUE }}>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>Sempre permitir</Text>
            </View>
          </View>
          <Caption>
            Se o iPhone perguntar se pode abrir o Willo, toque em <B>Sempre permitir</B>. Sem isso, o toque nas costas só mostra um aviso e não abre nada.
          </Caption>
        </Figure>
      </Step>

      <Step n={5} title="Ligue nas costas do iPhone" last>
        Feche o Atalhos, abra os <B>Ajustes</B> e siga:
        <Path steps={["Acessibilidade", "Toque", "Tocar Atrás", "Toque Duplo"]} />
        Na lista, escolha <B>{SHORTCUT_NAME}</B>.
      </Step>

      <Done text="Pronto. Dê dois toques firmes atrás do iPhone, perto da câmera, e o Registro rápido abre." />
    </View>
  );
}

/* ───────────── Wallet purchases into Copilot ───────────── */

/**
 * With the Willo action in the build, the Wallet automation runs it directly: no
 * address, no code, no request to fill in — only the three items of the purchase.
 */
function WalletCopilotAction() {
  return (
    <View>
      <Lead
        icon={<CreditCard size={18} color={th(GREEN)} strokeWidth={2.4} />}
        title="Compras da Carteira no Copilot"
        text="Cada compra por aproximação com o iPhone chega no Willo Copilot e espera você confirmar."
      />

      <Step n={1} title="Crie a automação">
        No app <B>Atalhos</B>, vá na aba <B>Automação</B>, embaixo, e siga:
        <Path steps={["+", "Transação"]} root="Automação" />
        Marque os seus cartões, escolha <B>Executar Imediatamente</B> e toque em <B>Seguinte</B> e depois em <B>Novo Atalho em Branco</B>.
      </Step>

      <Step n={2} title="Escolha a ação do Willo">
        Toque em <B>Buscar</B>, digite <B>Willo</B> e escolha <B>Registrar compra no Willo</B>.
      </Step>

      <Step n={3} title="Ligue a compra à ação" last>
        Toque em <B>Valor</B> e, na faixa acima do teclado, toque no botão azul <B>Transação</B>; toque nele de novo e escolha <B>Valor</B>. Faça o mesmo em <B>Comerciante</B> (escolhendo <B>Comerciante</B>) e, tocando na setinha, em <B>Cartão</B> (escolhendo <B>Cartão ou Passe</B>). Se já vierem preenchidos, é só conferir.
      </Step>

      <Done text="Pronto. Na próxima compra por aproximação, ela aparece no card Willo Copilot, na tela inicial, esperando você confirmar." />
    </View>
  );
}

function WalletCopilot() {
  if (hasCopilotAction) return <WalletCopilotAction />;
  return <WalletCopilotLink />;
}

/** Builds without the Willo action: the shortcut posts to the Copilot address itself. */
function WalletCopilotLink() {
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
    <View>
      <Lead
        icon={<CreditCard size={18} color={th(GREEN)} strokeWidth={2.4} />}
        title="Compras da Carteira no Copilot"
        text="Cada compra por aproximação com o iPhone chega no Willo Copilot e espera você confirmar."
      />

      <Step n={1} title="Copie o seu código">
        É ele que diz ao Willo que a compra é sua. Toque no botão e escolha <B>Copiar</B>. Não compartilhe com ninguém.
        <Pressable
          onPress={() => void shareCode()}
          disabled={busy}
          style={({ pressed }) => ({ marginTop: 12, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: th("#fff", "bg"), opacity: pressed || busy ? 0.8 : 1 })}
        >
          {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Copy size={16} color={th("#0B0B0B")} strokeWidth={2.4} />}
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{busy ? "Gerando…" : "Copiar meu código"}</Text>
        </Pressable>
      </Step>

      <Step n={2} title="Crie a automação">
        No app <B>Atalhos</B>, vá na aba <B>Automação</B>, embaixo, e siga:
        <Path steps={["+", "Transação"]} root="Automação" />
        Marque os seus cartões, escolha <B>Executar Imediatamente</B> e toque em <B>Seguinte</B> e depois em <B>Novo Atalho em Branco</B>.
      </Step>

      <Step n={3} title="Adicione Obter Conteúdo do URL">
        Toque em <B>Buscar</B>, digite <B>Obter conteúdo</B> e escolha <B>Obter Conteúdo do URL</B>. O Atalhos já coloca <B>Transação</B> no campo azul: toque nele e apague, até o campo ficar vazio. Depois toque no campo, segure e escolha <B>Colar</B> com este endereço copiado — o campo tem que mostrar o endereço escrito, não um botão azul de “Área de Transferência”:
        <CopyField value={FUNCTION_URL} small />
      </Step>

      <Step n={4} title="Diga o que mandar">
        Toque na setinha da ação. Em <B>Método</B>, escolha <B>POST</B>. Em <B>Corpo da Solicitação</B>, escolha <B>JSON</B>. Depois toque em <B>Adicionar novo campo</B> › <B>Texto</B>, quatro vezes:
        <Fields
          rows={[
            ["code", "o código que você copiou"],
            ["amount", "Transação › Valor"],
            ["merchant", "Transação › Comerciante"],
            ["card", "Transação › Cartão ou Passe"],
          ]}
        />
        Nos três de baixo não se digita nada: toque em <B>Texto</B> e, na faixa acima do teclado, toque no botão azul <B>Transação</B> (em alguns iPhones, <B>Entrada do Atalho</B>). Depois toque nesse botão azul que entrou no campo e escolha o item da lista: <B>Valor</B>, <B>Comerciante</B> ou <B>Cartão ou Passe</B>. No campo <B>code</B>, cole o seu código segurando o dedo e escolhendo <B>Colar</B>.
      </Step>

      <Step n={5} title="Teste com uma compra" last>
        Toque em <B>▶︎</B> embaixo. Se o iPhone perguntar se pode enviar para o endereço do Willo, toque em <B>Permitir Sempre</B>. A resposta “Valor não encontrado” quer dizer que está tudo certo (sem uma compra, não há valor). Na próxima compra por aproximação com o iPhone, ela aparece no card <B>Willo Copilot</B>, na tela inicial, esperando você confirmar.
      </Step>

      <View style={{ marginTop: 16, flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: th("rgba(255,255,255,0.04)", "bg") }}>
        <AlertTriangle size={16} color={AMBER} strokeWidth={2.4} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>
          Pix não passa pela Carteira, então não entra sozinho. Para um Pix, use a câmera do Registro rápido com o comprovante.
        </Text>
      </View>
    </View>
  );
}

/* ───────────── Pieces ───────────── */

function Segment({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const item = (id: Tab, label: string) => {
    const on = tab === id;
    return (
      <Pressable
        key={id}
        onPress={() => {
          if (on) return;
          void Haptics.selectionAsync().catch(() => undefined);
          onChange(id);
        }}
        style={{ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.12)", "bg") : "transparent" }}
      >
        <Text style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: th(on ? "#fff" : INK.soft) }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ marginTop: 20, flexDirection: "row", padding: 4, borderRadius: 23, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      {item("costas", "Toque nas costas")}
      {item("carteira", "Compras da Carteira")}
    </View>
  );
}

function Lead({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Surface radius={22} style={{ marginTop: 16, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.14)", "bg") }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{text}</Text>
      </View>
    </Surface>
  );
}

/** One step: the number on a rail that runs down to the next, a title that says what to do. */
function Step({ n, title, last, children }: { n: number; title: string; last?: boolean; children: ReactNode }) {
  /* Text runs and drawings come mixed; the text is gathered into paragraphs between drawings. */
  const parts: ReactNode[] = [];
  let run: ReactNode[] = [];
  const flush = () => {
    if (run.length) {
      parts.push(
        <Text key={`t${parts.length}`} style={{ marginTop: parts.length ? 10 : 4, fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>
          {run}
        </Text>,
      );
      run = [];
    }
  };
  const list = Array.isArray(children) ? children : [children];
  list.forEach((c, i) => {
    if (typeof c === "string" || (c && typeof c === "object" && "type" in c && c.type === B)) run.push(typeof c === "string" ? c : <B key={i}>{(c as { props: { children: ReactNode } }).props.children}</B>);
    else if (c) {
      flush();
      parts.push(<View key={`f${i}`}>{c}</View>);
    }
  });
  flush();

  return (
    <View style={{ flexDirection: "row", gap: 14, marginTop: 22 }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
          <Text style={{ fontSize: 13.5, fontWeight: "800", color: th("#0B0B0B") }}>{n}</Text>
        </View>
        {!last && <View style={{ flex: 1, width: 2, marginTop: 6, marginBottom: -16, borderRadius: 1, backgroundColor: th("rgba(255,255,255,0.08)", "line") }} />}
      </View>
      <View style={{ flex: 1, paddingTop: 3 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>{title}</Text>
        {parts}
      </View>
    </View>
  );
}

function B({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: "700", color: th("#fff") }}>{children}</Text>;
}

/** A small drawing of the screen, framed. */
function Figure({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 18,
        gap: 10,
        borderWidth: 1,
        borderColor: warn ? "rgba(245,181,68,0.28)" : th("rgba(255,255,255,0.07)", "line"),
        backgroundColor: warn ? "rgba(245,181,68,0.06)" : th("rgba(255,255,255,0.03)", "bg"),
      }}
    >
      {children}
    </View>
  );
}

function Caption({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      {ok ? <Check size={15} color={th(GREEN)} strokeWidth={3} style={{ marginTop: 2 }} /> : <AlertTriangle size={15} color={AMBER} strokeWidth={2.4} style={{ marginTop: 2 }} />}
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{children}</Text>
    </View>
  );
}

/** An action as the Shortcuts app draws it: icon, words, the blue token. */
function ActionBlock({ icon, tint, words = [], token, crossed }: { icon: ReactNode; tint: string; words?: string[]; token: string; crossed?: boolean }) {
  return (
    <View style={{ opacity: crossed ? 0.75 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 50, borderRadius: 16, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: tint }}>{icon}</View>
        {words.map((w) => (
          <Text key={w} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
            {w}
          </Text>
        ))}
        <View style={{ paddingHorizontal: 8, height: 28, borderRadius: 8, justifyContent: "center", backgroundColor: "rgba(59,130,246,0.18)" }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: SHORTCUT_BLUE }}>{token}</Text>
        </View>
      </View>
      {crossed && <View pointerEvents="none" style={{ position: "absolute", left: 10, right: 10, top: 24, height: 2, borderRadius: 1, backgroundColor: AMBER, transform: [{ rotate: "-4deg" }] }} />}
    </View>
  );
}

/** An address to paste, with the share sheet's Copiar a tap away. */
function CopyField({ value, small }: { value: string; small?: boolean }) {
  return (
    <Pressable
      onPress={() => void Share.share({ message: value }).catch(() => undefined)}
      style={({ pressed }) => ({
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingLeft: 14,
        paddingRight: 6,
        height: 50,
        borderRadius: 16,
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text selectable numberOfLines={1} ellipsizeMode="middle" style={{ flex: 1, fontSize: small ? 13 : 16, fontWeight: "600", color: SHORTCUT_BLUE, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: th("#fff", "bg") }}>
        <Copy size={14} color={th("#0B0B0B")} strokeWidth={2.4} />
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#0B0B0B") }}>Copiar</Text>
      </View>
    </Pressable>
  );
}

/** Where to go in Ajustes (or Atalhos), as a row of chips. */
function Path({ steps, root = "Ajustes" }: { steps: string[]; root?: string }) {
  const all = [root, ...steps];
  return (
    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 8, columnGap: 6 }}>
      {all.map((s, i) => (
        <View key={`${s}${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ paddingHorizontal: 11, height: 32, borderRadius: 10, justifyContent: "center", backgroundColor: i === all.length - 1 ? th("rgba(103,205,103,0.16)", "bg") : th("rgba(255,255,255,0.07)", "bg") }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: i === all.length - 1 ? th(GREEN) : th("#fff") }}>{s}</Text>
          </View>
          {i < all.length - 1 && <ChevronRight size={14} color={th(INK.softer)} strokeWidth={2.4} />}
        </View>
      ))}
    </View>
  );
}

/** The JSON fields of the request, as the Shortcuts sheet lists them. */
function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <View style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      {rows.map(([k, v], i) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 46, paddingVertical: 8, gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
          <Text style={{ width: 74, fontSize: 14, fontWeight: "700", color: th("#fff") }}>{k}</Text>
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: SHORTCUT_BLUE, fontWeight: "600" }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Done({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 24, flexDirection: "row", gap: 10, alignItems: "center", padding: 14, borderRadius: 18, backgroundColor: th("rgba(103,205,103,0.1)", "bg") }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: th(GREEN) }}>
        <Check size={15} color="#0B0B0B" strokeWidth={3} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: th("#fff") }}>{text}</Text>
    </View>
  );
}
