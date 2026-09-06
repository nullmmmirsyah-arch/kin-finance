import Svg, { Circle, Ellipse } from "react-native-svg";
import { View } from "react-native";

type Variant = "papa" | "mama" | "cub";

const VARIANT: Record<Variant, { fur: string; earInner: string; muzzle: string }> = {
  papa: { fur: "#5C2E0E", earInner: "#92400E", muzzle: "#FEF3C7" },
  mama: { fur: "#92400E", earInner: "#D97706", muzzle: "#FFFBF5" },
  cub: { fur: "#D97706", earInner: "#FDE68A", muzzle: "#FFFBF5" },
};

export function BearFaceless({
  size = 36,
  variant = "mama",
}: {
  size?: number;
  variant?: Variant;
}) {
  const c = VARIANT[variant];
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 80 72">
        {/* ears */}
        <Circle cx={20} cy={20} r={14} fill={c.fur} />
        <Circle cx={60} cy={20} r={14} fill={c.fur} />
        <Circle cx={20} cy={20} r={7} fill={c.earInner} />
        <Circle cx={60} cy={20} r={7} fill={c.earInner} />
        {/* head */}
        <Ellipse cx={40} cy={40} rx={28} ry={26} fill={c.fur} />
        {/* muzzle - faceless, just cream oval, no nose/mouth */}
        <Ellipse cx={40} cy={50} rx={14} ry={10} fill={c.muzzle} opacity={0.95} />
        {/* subtle highlight */}
        <Ellipse cx={32} cy={30} rx={6} ry={4} fill="white" opacity={0.12} />
      </Svg>
    </View>
  );
}

export function BearFamilyRow({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
      <View style={{ marginBottom: 2 }}>
        <BearFaceless size={size + 8} variant="papa" />
      </View>
      <BearFaceless size={size + 2} variant="mama" />
      <View style={{ marginBottom: 4 }}>
        <BearFaceless size={size - 4} variant="cub" />
      </View>
    </View>
  );
}
