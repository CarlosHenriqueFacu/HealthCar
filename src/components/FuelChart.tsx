import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from '../contexts/AppContext';

/**
 * @interface FuelChartProps
 * @description Propriedades aceites pelo componente de gráfico de consumo.
 */
interface FuelChartProps {
  /** Array numérico com o volume consumido (em litros) por período */
  data?: number[];
  /** 
   * Array de strings (Opcional). Se não fornecido, o componente utilizará 
   * os rótulos de dias da semana baseados no idioma atual do sistema (PT/EN).
   */
  labels?: string[];
  /** Callback executado ao interagir (tocar) na área do gráfico */
  onPress?: () => void;
}

const DEFAULT_DATA = [32, 45, 28, 55, 40, 62, 38];

/**
 * Componente FuelChart
 * @description Exibe um gráfico de barras vertical representando o consumo
 * diário de combustível. Suporta injeção dinâmica de temas e internacionalização.
 */
export function FuelChart({ 
  data = DEFAULT_DATA, 
  labels,
  onPress
}: FuelChartProps) {
  // Extração do estado global de tema e dicionário de traduções (t)
  const { theme, t } = useApp();
  
  // Resolução da paleta dinâmica baseada no tema ativo
  const isDark = theme === 'dark';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const trackColor = isDark ? '#1E2235' : '#CBD5E1';

  // Determina os rótulos do eixo X de forma inteligente
  // Usa o array fornecido por props OU pega do dicionário internacionalizado (Seg-Dom / Mon-Sun)
  const chartLabels = labels || [t('seg'), t('ter'), t('qua'), t('qui'), t('sex'), t('sab'), t('dom')];

  // Cálculo do valor máximo para normalização proporcional das barras
  const maxVal = Math.max(...data);

  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: cardColor, borderColor: borderColor },
        pressed && { opacity: 0.8 } // Feedback visual tátil
      ]}
    >
      <Text style={[styles.title, { color: textColor }]}>{t('consumoSemanal')}</Text>
      <Text style={[styles.subtitle, { color: subTextColor }]}>{t('litrosPorDia')}</Text>

      <View style={styles.chartArea}>
        {data.map((val, i) => {
          // Normaliza a altura da barra entre 0 e 100%
          const heightPct = (val / maxVal) * 100;
          const isMax = val === maxVal;
          
          return (
            <View key={i} style={styles.barWrapper}>
              <Text style={[styles.barValue, { color: subTextColor }, isMax && styles.barValueMax]}>
                {val}L
              </Text>
              <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${heightPct}%` as any },
                    isMax && styles.barFillMax,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: subTextColor }]}>{chartLabels[i]}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

// Estilos base de layout da interface
const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
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
    marginBottom: 4,
  },
  barValueMax: {
    color: "#00B4FF",
    fontWeight: "700",
  },
  barTrack: {
    width: "100%",
    height: 70,
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
    marginTop: 6,
  },
});