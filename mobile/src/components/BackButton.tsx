import { useRouter } from "expo-router";
import RoundButton from "~/components/RoundButton";
import { ChevronLeft } from "~/components/icons";

/**
 * The way back out of a page.
 *
 * A section is somewhere you switch to and the nav bar handles it; a page is
 * somewhere you went into, and the only thing it needs is the way back. So pages
 * carry this instead of the bar, rather than offering two ways out that mean
 * different things, stacked on top of each other.
 *
 * It is the same round glass as the other buttons in a page's header.
 */
export default function BackButton({ to, onImage = false }: { to?: string; onImage?: boolean }) {
  const router = useRouter();

  return (
    <RoundButton
      label="Voltar"
      onImage={onImage}
      onPress={() => {
        if (to) router.replace(to as never);
        else if (router.canGoBack()) router.back();
        else router.replace("/" as never);
      }}
    >
      <ChevronLeft size={20} color="rgba(255,255,255,0.9)" strokeWidth={2.2} />
    </RoundButton>
  );
}
