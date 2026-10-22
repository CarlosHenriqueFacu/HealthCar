import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from '../contexts/AppContext';

/**
 * @interface TelemetryCardProps
 * @description Contrato de propriedades para o componente de exibição de telemetria.
 */
interface TelemetryCardProps {
  /** Rótulo identificador do ícone vetorial da biblioteca MaterialIcons */
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Descrição textual da métrica monitorada */
  label: string;
  /** Valor quantitativo ou qualitativo a ser renderizado */
  value: string;
  /** Unidade de medida (opcional) associada ao valor numérico */
  unit?: string;
  /** Cor hexadecimal dinâmica para destaque visual (ícone, valor e barra de progresso) */
  color?: string;
  /** Representação percentual (0.0 a 1.0) do preenchimento da barra de progresso */
  progress?: number;
  /** Callback acionado em resposta ao evento de interação (toque) do utilizador */
  onPress?: () => void;
}

/**
 * Componente TelemetryCard
 * @description Renderiza um cartão modular para exibição de métricas de telemetria OBD2.
 * O componente suporta alternância dinâmica de tema e barra de progresso opcional.
 */
export function TelemetryCard({
  icon,
  label,
  value,
  unit,
  color = "#00B4FF",
  progress,
  onPress,
}: TelemetryCardProps) {
  // Extração do estado de tema global para injeção de cores dinâmicas
  const { theme } = useApp();
  
  // Resolução da paleta de cores baseada no tema (Light/Dark Mode)
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#12141A' : '#FFFFFF';
  const cardBorder = isDark ? '#1E2235' : '#E2E8F0';
  const labelColor = isDark ? '#8892A4' : '#64748B';
  const trackColor = isDark ? '#1E2235' : '#CBD5E1';

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.card, 
        { backgroundColor: cardBg, borderColor: cardBorder },
        pressed && { opacity: 0.7 } // Feedback visual de interação tátil
      ]}
    >
      {/* Container de representação gráfica (Ícone) */}
      <View style={styles.iconSection}>
        <MaterialIcons name={icon} size={56} color={color} />
      </View>

      {/* Rótulo identificador da métrica */}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>

      {/* Exibição do valor acompanhado de sua unidade estrutural */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: labelColor }]}>{unit}</Text>}
      </View>

      {/* Indicador linear de progresso (Renderização Condicional) */}
      {progress !== undefined && (
        <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
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

// Estilos estruturais de interface (agnósticos ao tema)
const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
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
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});