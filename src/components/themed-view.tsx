import { View, type ViewProps, useColorScheme } from "react-native";
import { Colors } from "../constants/theme";

export interface ThemedViewProps extends ViewProps {
  className?: string;
}

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View 
      style={[{ backgroundColor: themeColors.background }, style]} 
      {...otherProps} 
    />
  );
}