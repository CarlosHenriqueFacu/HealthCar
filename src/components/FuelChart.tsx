import { Pressable, StyleSheet, Text, View } from "react-native";

interface FuelChartProps {
  data?: number[];
  labels?: string[];
  onPress?: () => void; // NOVO: Adicionado suporte nativo a cliques
}

const DEFAULT_DATA = [32, 45, 28, 55, 40, 62, 38];
const DEFAULT_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function FuelChart({ 
  data = DEFAULT_DATA, 
  labels = DEFAULT_LABELS,
  onPress // Extraindo a função de clique
}: FuelChartProps) {
  const maxVal = Math.max(...data);

  return (
    // Trocamos a View por Pressable para que a área inteira do gráfico seja clicável
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.8 } // Efeito visual sutil ao tocar
      ]}
    >
      <Text style={styles.title}>Consumo Semanal</Text>
      <Text style={styles.subtitle}>Litros por dia</Text>

      <View style={styles.chartArea}>
        {data.map((val, i) => {
          const heightPct = (val / maxVal) * 100;
          const isMax = val === maxVal;
          return (
            <View key={i} style={styles.barWrapper}>
              <Text style={[styles.barValue, isMax && styles.barValueMax]}>
                {val}L
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${heightPct}%` as any },
                    isMax && styles.barFillMax,
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{labels[i]}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: "#8892A4",
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barValue: {
    fontSize: 9,
    color: "#8892A4",
    marginBottom: 4,
  },
  barValueMax: {
    color: "#00B4FF",
  },
  barTrack: {
    width: "100%",
    height: 70,
    backgroundColor: "#1E2235",
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#0090D4",
    borderRadius: 4,
    minHeight: 4,
  },
  barFillMax: {
    backgroundColor: "#00B4FF",
    shadowColor: "#00B4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  barLabel: {
    fontSize: 10,
    color: "#8892A4",
    marginTop: 6,
  },
});