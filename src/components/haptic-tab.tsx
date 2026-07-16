import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";

// Biblioteca responsável por fazer o celular vibrar
import * as Haptics from "expo-haptics";

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        // Verifica se o aplicativo está rodando no iOS (iPhone)
        if (process.env.EXPO_OS === "ios") {
          // Dispara um feedback tátil (uma vibração bem leve e premium) ao tocar na aba
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        // Se existir uma função padrão de clique configurada para esta aba, ele a executa
        props.onPressIn?.(ev);
      }}
    />
  );
}