import { View } from "react-native";
import { BearColors, Shadow } from "@/constants/theme";

export type BearSize = "small" | "mid" | "normal";
export type BearVariant = "papa" | "mama" | "cub";

export type BearProps = {
  size?: BearSize;
  variant?: BearVariant;
  testID?: string;
};

const SIZES = {
  normal: { headW: 46, headH: 38, ear: 14, bodyW: 52, bodyH: 32 },
  mid: { headW: 40, headH: 32, ear: 12, bodyW: 44, bodyH: 26 },
  small: { headW: 34, headH: 28, ear: 10, bodyW: 36, bodyH: 22 },
} as const;

function teddyForVariant(variant?: BearVariant): string {
  switch (variant) {
    case "papa":
      return BearColors.teddy;
    case "mama":
      return BearColors.teddyMid;
    case "cub":
      return BearColors.teddyLight;
    default:
      return BearColors.teddy;
  }
}

/**
 * Faceless bear — head + ears + body only, no eyes/nose/mouth.
 * Uses Tailwind className for layout and theme Shadow + BearColors for fill.
 * Border 2.5px white, claymorphism.
 */
export function Bear({ size = "normal", variant, testID }: BearProps) {
  const s = SIZES[size];
  const teddy = teddyForVariant(variant);
  const innerEar = BearColors.teddyLight;
  const borderWhite = "#FFFFFF";

  return (
    <View
      testID={testID ?? `bear-${size}${variant ? `-${variant}` : ""}`}
      accessibilityLabel="bear"
      accessibilityRole="image"
      className="items-center"
      style={{ alignItems: "center" }}
    >
      {/* Head + ears */}
      <View
        style={[
          Shadow.card,
          {
            width: s.headW,
            height: s.headH,
            backgroundColor: teddy,
            borderRadius: s.headH,
            borderWidth: 2.5,
            borderColor: borderWhite,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
        className="relative"
      >
        {/* left ear outer */}
        <View
          style={[
            Shadow.card,
            {
              position: "absolute",
              width: s.ear,
              height: s.ear,
              borderRadius: s.ear / 2,
              backgroundColor: teddy,
              borderWidth: 2.5,
              borderColor: borderWhite,
              top: -s.ear * 0.38,
              left: -2,
            },
          ]}
        >
          <View
            style={{
              position: "absolute",
              width: s.ear * 0.55,
              height: s.ear * 0.55,
              borderRadius: (s.ear * 0.55) / 2,
              backgroundColor: innerEar,
              top: s.ear * 0.22,
              left: s.ear * 0.22,
            }}
          />
        </View>
        {/* right ear outer */}
        <View
          style={[
            Shadow.card,
            {
              position: "absolute",
              width: s.ear,
              height: s.ear,
              borderRadius: s.ear / 2,
              backgroundColor: teddy,
              borderWidth: 2.5,
              borderColor: borderWhite,
              top: -s.ear * 0.38,
              right: -2,
            },
          ]}
        >
          <View
            style={{
              position: "absolute",
              width: s.ear * 0.55,
              height: s.ear * 0.55,
              borderRadius: (s.ear * 0.55) / 2,
              backgroundColor: innerEar,
              top: s.ear * 0.22,
              left: s.ear * 0.22,
            }}
          />
        </View>
      </View>

      {/* Body — overlaps head slightly for plush clay effect */}
      <View
        style={[
          Shadow.card,
          {
            width: s.bodyW,
            height: s.bodyH,
            backgroundColor: teddy,
            borderRadius: s.bodyW / 2.2,
            borderWidth: 2.5,
            borderColor: borderWhite,
            marginTop: -6,
          },
        ]}
      />
    </View>
  );
}

export function BearRow({
  count = 3,
  bears,
  size,
  gap = 8,
}: {
  count?: number;
  bears?: BearProps[];
  size?: BearSize;
  gap?: number;
}) {
  const items: BearProps[] =
    bears && bears.length > 0
      ? bears
      : Array.from({ length: count }, (_, i) => ({
          size: size ?? (i === 1 ? "normal" : i === 0 ? "mid" : "small"),
        }));

  return (
    <View
      testID="bear-row"
      accessibilityLabel="bear-row"
      className="flex-row items-end justify-center"
      style={{ flexDirection: "row", alignItems: "flex-end", gap }}
    >
      {items.map((b, idx) => (
        <Bear key={idx} size={b.size ?? size ?? "small"} variant={b.variant} />
      ))}
    </View>
  );
}
