import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface EngineButtonProps {
  isActive: boolean;
  onPress: () => void;
  // MANUTENÇÃO FUTURA: A propriedade 'disabled' foi adicionada para evitar
  // cliques duplicados enquanto o sistema processa a conexão Bluetooth.
  disabled?: boolean;
}

export function EngineButton({ isActive, onPress, disabled = false }: EngineButtonProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(0.6, { duration: 300 }),
          withTiming(0, { duration: 1200 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0, { duration: 300 });
      ringScale.value = withTiming(1, { duration: 300 });
      ringOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  function handlePress() {
    // Se estiver desabilitado, não executa nada
    if (disabled) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    buttonScale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.back(2)) })
    );
    onPress();
  }

  return (
    <View style={styles.wrapper}>
      {/* Ripple ring */}
      <Animated.View style={[styles.ring, ringStyle]} />
      {/* Pulse glow */}
      <Animated.View
        style={[
          styles.pulse,
          pulseStyle,
          isActive && styles.pulseActive,
        ]}
      />

      <Animated.View style={buttonAnimStyle}>
        <Pressable
          onPress={handlePress}
          // Aplica o estilo visual de desabilitado (opacidade)
          style={[
            styles.button, 
            isActive && styles.buttonActive,
            disabled && styles.buttonDisabled
          ]}
          disabled={disabled}
        >
          {/* Inner gradient ring */}
          <View style={[styles.innerRing, isActive && styles.innerRingActive]}>
            <View style={[styles.innerCore, isActive && styles.innerCoreActive]}>
              <MaterialIcons
                name="power-settings-new"
                size={38}
                color={isActive ? "#00D4FF" : disabled ? "#555" : "#8892A4"}
              />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
  },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#00B4FF",
  },
  pulse: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#00B4FF22",
  },
  pulseActive: {
    backgroundColor: "#00B4FF33",
  },
  button: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#12141A",
    borderWidth: 2,
    borderColor: "#1E2235",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonActive: {
    borderColor: "#00B4FF",
    shadowColor: "#00B4FF",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  // Visual de desabilitado
  buttonDisabled: {
    opacity: 0.5,
    borderColor: "#333",
  },
  innerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#1E2235",
    alignItems: "center",
    justifyContent: "center",
  },
  innerRingActive: {
    borderColor: "#00B4FF44",
  },
  innerCore: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
  },
  innerCoreActive: {
    backgroundColor: "#0A1520",
  },
});