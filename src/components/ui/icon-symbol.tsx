// Fallback for using MaterialIcons on Android and web.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

// MANUTENÇÃO FUTURA: A biblioteca 'expo-symbols' atualizou o tipo do "name" para um objeto complexo.
// O TypeScript bloqueava o uso disso como chave de um Record (Dicionário).
// A solução foi remover a tipagem estrita do Record e usar 'as const' para que o sistema 
// entenda as chaves automaticamente, mantendo o autocompletar perfeito.
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "car.fill": "directions-car",
  "wrench.fill": "build",
  "chart.bar.fill": "bar-chart",
  "gearshape.fill": "settings",
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons 
      color={color} 
      size={size} 
      // MANUTENÇÃO FUTURA: O bypass 'as any' garante que o componente aceite a string 
      // mapeada perfeitamente sem disparar falsos alertas no VS Code.
      name={MAPPING[name] as any} 
      style={style} 
    />
  );
}