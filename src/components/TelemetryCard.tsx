import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface TelemetryCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  progress?: number; // 0–1 for bar display
  onPress?: () => void; // NOVO: Propriedade para receber o clique
}

export function TelemetryCard({
  icon,
  label,
  value,
  unit,
  color = "#00B4FF",
  progress,
  onPress, // Extraindo a função de clique
}: TelemetryCardProps) {
  return (
    // Transformamos a View externa em um Pressable para garantir o clique
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.card, 
        pressed && { opacity: 0.7 } // Dá um efeito visual de clique escurecendo o card
      ]}
    >
      {/* Icon Section - Full Width */}
      <View style={styles.iconSection}>
        <MaterialIcons name={icon} size={56} color={color} />
      </View>

      {/* Label Section */}
      <Text style={styles.label}>{label}</Text>

      {/* Value Section */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {/* Progress Bar */}
      {progress !== undefined && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: color },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#12141A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    minWidth: 0,
    justifyContent: "flex-start",
    minHeight: 140,
  },
  iconSection: {
    width: "100%",
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    color: "#8892A4",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: "center",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    justifyContent: "center",
    marginBottom: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  unit: {
    fontSize: 10,
    color: "#8892A4",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#1E2235",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});