import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";

interface SpeedometerMinimalProps {
  speed: number;
  maxSpeed?: number;
  isActive: boolean;
}

export function SpeedometerMinimal({
  speed,
  maxSpeed = 240,
  isActive,
}: SpeedometerMinimalProps) {
  const glowOpacity = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);

  useEffect(() => {
    if (isActive) {
      scaleAnim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.2)) });
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1500 }),
          withTiming(0.3, { duration: 1500 })
        ),
        -1,
        true
      );
    } else {
      scaleAnim.value = withTiming(0.8, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: scaleAnim.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 100;

  // Calculate speed percentage and angle
  const speedPercent = Math.min(speed / maxSpeed, 1);
  const angle = speedPercent * 270; // 270 degrees arc (from -135 to 135)

  // Generate tick marks (24 ticks for 240 km/h = 10 km/h per tick)
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const tickAngle = (i / 24) * 270 - 135;
    const rad = (tickAngle * Math.PI) / 180;
    const x1 = cx + (radius - 12) * Math.cos(rad);
    const y1 = cy + (radius - 12) * Math.sin(rad);
    const x2 = cx + radius * Math.cos(rad);
    const y2 = cy + radius * Math.sin(rad);
    const isMainTick = i % 4 === 0;
    return { x1, y1, x2, y2, isMainTick, value: i * 10 };
  });

  // Needle calculation
  const needleAngle = angle - 135;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleTipX = cx + (radius - 25) * Math.cos(needleRad);
  const needleTipY = cy + (radius - 25) * Math.sin(needleRad);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Outer glow effect */}
      <Animated.View style={[styles.glowRing, glowStyle]} />

      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00FF88" />
            <Stop offset="100%" stopColor="#00D4FF" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius + 8}
          fill="none"
          stroke="#1E2235"
          strokeWidth={1}
        />

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <Line
            key={`tick-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.isMainTick ? "#00B4FF" : "#8892A4"}
            strokeWidth={tick.isMainTick ? 2 : 1}
            opacity={tick.isMainTick ? 1 : 0.5}
          />
        ))}

        {/* Speed arc background */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#1E2235"
          strokeWidth={6}
          opacity={0.3}
        />

        {/* Speed arc fill */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#speedGrad)"
          strokeWidth={6}
          strokeDasharray={`${(angle / 270) * (radius * 2 * Math.PI)} ${radius * 2 * Math.PI}`}
          strokeLinecap="round"
          transform={`rotate(-135 ${cx} ${cy})`}
        />

        {/* Needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={needleTipX}
          y2={needleTipY}
          stroke="#00FF88"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />

        {/* Center dot */}
        <Circle cx={cx} cy={cy} r={8} fill="#00FF88" />
        <Circle cx={cx} cy={cy} r={4} fill="#0A0A0F" />
      </Svg>

      {/* Digital speed display */}
      <View style={styles.digitalDisplay}>
        <Text style={styles.speedNumber}>{Math.round(speed)}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>

      {/* Speed percentage indicator */}
      <View style={styles.percentageDisplay}>
        <Text style={styles.percentageText}>{Math.round(speedPercent * 100)}%</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glowRing: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 2,
    borderColor: "#00FF88",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  digitalDisplay: {
    position: "absolute",
    alignItems: "center",
    bottom: 50,
    gap: 2,
  },
  speedNumber: {
    fontSize: 56,
    fontWeight: "800",
    color: "#00FF88",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    textShadowColor: "#00FF88",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  speedUnit: {
    fontSize: 12,
    color: "#8892A4",
    letterSpacing: 2,
    fontWeight: "600",
  },
  percentageDisplay: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#00FF8822",
    borderWidth: 1,
    borderColor: "#00FF8844",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#00FF88",
    letterSpacing: 1,
  },
});
