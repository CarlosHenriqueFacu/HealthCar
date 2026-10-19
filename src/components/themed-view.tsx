import { View, type ViewProps } from "react-native";
import { AppPalette } from "../constants/theme";
import { useApp } from "../contexts/AppContext";

export interface ThemedViewProps extends ViewProps {
  className?: string;
}

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  const { theme } = useApp();
  const themeColors = AppPalette[theme];

  return (
    <View 
      style={[{ backgroundColor: themeColors.background }, style]} 
      {...otherProps} 
    />
  );
}