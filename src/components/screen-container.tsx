import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { AppPalette } from "../constants/theme";
import { useApp } from "../contexts/AppContext";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  ...props
}: ScreenContainerProps) {
  const { theme } = useApp();
  const themeColors = AppPalette[theme];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]} {...props}>
      <SafeAreaView edges={edges} style={[styles.container, style]}>
        <View style={styles.container}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Isso garante que a tela ocupe o espaço total!
  },
});