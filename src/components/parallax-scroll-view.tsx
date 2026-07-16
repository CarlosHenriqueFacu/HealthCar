import type { PropsWithChildren, ReactElement } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from '../constants/theme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor?: string;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const headerHeight = HEADER_HEIGHT + insets.top;

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollOffset.value,
          [-headerHeight, 0, headerHeight],
          [-headerHeight / 2, 0, headerHeight * 0.75],
        ),
      },
      {
        scale: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [2, 1, 1]),
      },
    ],
  }));

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.background, flex: 1 }}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      scrollEventThrottle={16}
    >
      <Animated.View
        style={[
          {
            overflow: "hidden",
            backgroundColor: headerBackgroundColor ?? (colors as any).primary ?? (colors as any).tint ?? "#00B4FF",
            height: headerHeight,
            paddingTop: insets.top,
          },
          headerAnimatedStyle,
        ]}
      >
        {headerImage}
      </Animated.View>
      
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {children}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1, // Expande o conteúdo do scroll
    padding: 32,
    gap: 16,
    overflow: "hidden",
  },
});