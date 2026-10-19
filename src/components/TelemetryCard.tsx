import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppPalette } from '../constants/theme';
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
  const colors = AppPalette[theme];
  const cardBg = colors.surface;
  const cardBorder = colors.border;
  const labelColor = colors.textSecondary;
  const trackColor = theme === 'dark' ? '#26364A' : '#E7EDF3';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      accessibilityHint="Toque para ver mais detalhes"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor: cardBorder },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}18` }]}>
          <MaterialIcons name={icon} size={21} color={color} />
        </View>
        <MaterialIcons name="chevron-right" size={20} color={labelColor} />
      </View>

      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]} numberOfLines={1}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: labelColor }]}>{unit}</Text>}
      </View>

      {progress !== undefined && (
        <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(progress * 100, 100))}%`, backgroundColor: color },
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
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    minWidth: 0,
    minHeight: 138,
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.76,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 10,
  },
  value: {
    fontSize: 25,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  unit: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});