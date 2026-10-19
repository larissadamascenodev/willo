import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The way back out of a page.
 *
 * A section is somewhere you switch to and the nav bar handles it; a page is
 * somewhere you went into, and the only thing it needs is the way back. So pages
 * carry this instead of the bar, rather than offering two ways out that mean
 * different things, stacked on top of each other.
 */
export default function BackButton({ to }: { to?: string }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="Voltar"
      onPress={() => {
        if (to) router.replace(to as never);
        else if (router.canGoBack()) router.back();
        else router.replace("/" as never);
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        marginLeft: -8,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <ChevronLeft size={24} color={INK.full} />
    </Pressable>
  );
}
