import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import CenterModal from "~/components/CenterModal";
import { Check, ChevronDown } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Choosing an account (or a card), the same way in every sheet.
 *
 * Two or fewer: both side by side, one tap. More than two: one button showing the one
 * chosen, and a tap on it opens every one of them in the middle of the screen — so a
 * long list never pushes the rest of the sheet away or hides under the keyboard.
 */

export interface AccountOption {
  id: string;
  name: string;
  color?: string | null;
  /** Under the name in the list: a balance, "padrão", the card's limit… */
  note?: string;
}

const tick = () => void Haptics.selectionAsync().catch(() => undefined);

export default function AccountSelect({
  options,
  value,
  onChange,
  title = "Escolha a conta",
  placeholder = "Escolher conta",
}: {
  options: AccountOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** The list's heading, when it opens. */
  title?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.id === value) ?? null;

  if (options.length === 0) return null;

  if (options.length <= 2) {
    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((o) => {
          const on = o.id === value;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tick();
                onChange(o.id);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                height: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                paddingLeft: 8,
                paddingRight: 12,
                borderRadius: 18,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: th(on ? "#fff" : "rgba(255,255,255,0.10)", "line"),
                backgroundColor: th(on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)", "bg"),
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={32} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: on ? "700" : "500", color: th("#fff") }}>
                {o.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chosen ? `${chosen.name}. Trocar` : placeholder}
        onPress={() => {
          tick();
          setOpen(true);
        }}
        style={({ pressed }) => ({
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingLeft: 10,
          paddingRight: 14,
          borderRadius: 18,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: th("rgba(255,255,255,0.14)", "line"),
          backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {chosen ? <BankMark name={chosen.name} hex={colorFor(chosen.name, chosen.color)} size={36} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th(chosen ? "#fff" : INK.soft) }}>
            {chosen?.name ?? placeholder}
          </Text>
          {chosen?.note ? (
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
              {chosen.note}
            </Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>Trocar</Text>
        <ChevronDown size={16} color={th(INK.soft)} strokeWidth={2.2} />
      </Pressable>

      <CenterModal open={open} onClose={() => setOpen(false)} title={title} subtitle={`${options.length} opções`}>
        <View style={{ gap: 6 }}>
          {options.map((o) => {
            const on = o.id === value;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tick();
                  onChange(o.id);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 58,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: th(on ? "#fff" : "rgba(255,255,255,0.06)", "line"),
                  backgroundColor: th(on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", "bg"),
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>
                    {o.name}
                  </Text>
                  {o.note ? (
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.softer) }}>
                      {o.note}
                    </Text>
                  ) : null}
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: th("rgba(255,255,255,0.3)", "line"), backgroundColor: th(on ? "#fff" : "transparent", "bg") }}>
                  {on && <Check size={13} color={th("#0B0B0B")} strokeWidth={3.2} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </CenterModal>
    </>
  );
}
