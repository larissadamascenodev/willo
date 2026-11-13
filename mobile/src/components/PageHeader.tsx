import type { ReactNode } from "react";
import { Text, View } from "react-native";
import BackButton from "~/components/BackButton";
import { th } from "~/theme/theme";

/**
 * The top of a page: the way back, the page's name small in the middle — the way the
 * card's name sits on its own page — and room for one button on the right.
 */
export default function PageHeader({ title, back, right, mark }: { title: string; /** Where back goes, when not simply back. */ back?: string; right?: ReactNode; /** A small mark before the name. */ mark?: ReactNode }) {
  return (
    <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <BackButton to={back} />
      <View pointerEvents="none" style={{ position: "absolute", left: 56, right: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mark}
        <Text numberOfLines={1} accessibilityRole="header" style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
          {title}
        </Text>
      </View>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}
