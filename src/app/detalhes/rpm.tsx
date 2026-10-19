import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppPalette } from "../../constants/theme";
import { useApp } from "../../contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @constant RPM_DATA
 * @description Mock de dados agregados de RPM (Pico e Média) particionados em blocos de 4 horas.
 */
const RPM_DATA = [
  { period: "00-04h", peak: 2100, avg: 1200 },
  { period: "04-08h", peak: 3500, avg: 2100 },
  { period: "08-12h", peak: 4800, avg: 3200 },
  { period: "12-16h", peak: 5200, avg: 3800 },
  { period: "16-20h", peak: 4900, avg: 3500 },
  { period: "20-00h", peak: 3200, avg: 2000 },
];

/**
 * Componente RPMDetailsScreen
 * @description Exibe a análise detalhada do regime do motor (RPM). Inclui gráfico de barras duplas (SVG)
 * comparando os valores médios e os limites operacionais (picos) atingidos.
 */
export default function RPMDetailsScreen() {
  const { theme, t } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // Tema dinâmico
  const isDark = theme === 'dark';
  const colors = AppPalette[theme];
  const { background: bgColor, surface: cardColor, text: textColor, textSecondary: subTextColor, border: borderColor } = colors;
  const peakColor = "#9C27B0"; // Roxo para pico
  const avgColor = "#00B4FF";  // Azul para média

  // Estatísticas
  const currentRPM = 3200; 
  const maxRPM = 6500; 
  const peakRPM = Math.max(...RPM_DATA.map((d) => d.peak));
  const avgRPM = Math.round(RPM_DATA.reduce((sum, d) => sum + d.avg, 0) / RPM_DATA.length);

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const barWidth = (chartWidth - 40) / RPM_DATA.length;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <ScreenHeader title="RPM" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="settings" size={32} color={peakColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('rpmAtual')}</Text>
              <Text style={[styles.statusValue, { color: peakColor }]}>{(currentRPM / 1000).toFixed(1)}k</Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusPercent, { color: peakColor }]}>{Math.round((currentRPM / maxRPM) * 100)}%</Text>
            <Text style={[styles.statusPercentLabel, { color: subTextColor }]}>{t('doMaximo')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('pico')}</Text>
            <Text style={[styles.statValue, { color: peakColor }]}>{(peakRPM / 1000).toFixed(1)}k</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: peakColor }]}>{(avgRPM / 1000).toFixed(1)}k</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>{t('picosPorPeriodo')}</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="rpmGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={peakColor} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={peakColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {[0, 25, 50, 75, 100].map((percent) => (
              <Line
                key={`grid-${percent}`}
                x1={20}
                y1={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                x2={chartWidth - 20}
                y2={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                stroke={borderColor}
                strokeWidth={1}
                opacity={isDark ? 0.3 : 1}
              />
            ))}

            {RPM_DATA.map((data, i) => {
              const barHeight = (data.peak / peakRPM) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.05;
              return (
                <Rect
                  key={`peak-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.45}
                  height={barHeight}
                  fill={peakColor}
                  opacity={selectedPeriod === i ? 1 : (isDark ? 0.6 : 0.8)}
                  rx={3}
                />
              );
            })}

            {RPM_DATA.map((data, i) => {
              const barHeight = (data.avg / peakRPM) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.5;
              return (
                <Rect
                  key={`avg-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.45}
                  height={barHeight}
                  fill={avgColor}
                  opacity={selectedPeriod === i ? 1 : (isDark ? 0.6 : 0.8)}
                  rx={3}
                />
              );
            })}
          </Svg>

          <View style={styles.periodLabels}>
            {RPM_DATA.map((data, i) => (
              <Text key={`period-${i}`} style={[styles.periodLabel, { color: subTextColor }]}>
                {data.period.split("-")[0]}
              </Text>
            ))}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: peakColor }]} />
              <Text style={[styles.legendText, { color: subTextColor }]}>{t('pico')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: avgColor }]} />
              <Text style={[styles.legendText, { color: subTextColor }]}>{t('media')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('detalhesPorPeriodo')}</Text>
          {RPM_DATA.map((data, i) => (
            <Pressable
              key={`breakdown-${i}`}
              onPress={() => setSelectedPeriod(i)}
              style={({ pressed }) => [
                styles.breakdownItem,
                { borderBottomColor: borderColor },
                selectedPeriod === i && { backgroundColor: isDark ? "#9C27B022" : "#F3E8F5", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8 },
                pressed && { opacity: 0.7 }
              ]}
            >
              <View style={styles.breakdownLeft}>
                <Text style={[styles.breakdownPeriod, { color: textColor }]}>{data.period}</Text>
                <View style={styles.breakdownBars}>
                  <View style={[styles.breakdownBarSmall, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                    <View style={[styles.breakdownBarFill, { width: `${(data.peak / peakRPM) * 100}%` as any, backgroundColor: peakColor }]} />
                  </View>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <View>
                  <Text style={[styles.breakdownLabel, { color: subTextColor }]}>{t('pico')}</Text>
                  <Text style={[styles.breakdownValue, { color: peakColor }]}>{(data.peak / 1000).toFixed(1)}k</Text>
                </View>
                <View>
                  <Text style={[styles.breakdownLabel, { color: subTextColor }]}>{t('media')}</Text>
                  <Text style={[styles.breakdownValue, { color: avgColor }]}>{(data.avg / 1000).toFixed(1)}k</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 16, borderWidth: 1 },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusLabel: { fontSize: 12 },
  statusValue: { fontSize: 24, fontWeight: "700", marginTop: 2 },
  statusRight: { alignItems: "flex-end" },
  statusPercent: { fontSize: 18, fontWeight: "700" },
  statusPercentLabel: { fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "700" },
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  periodLabels: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20, marginBottom: 8 },
  periodLabel: { fontSize: 9, fontWeight: "600" },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendColor: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 11 },
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  breakdownLeft: { flex: 1, gap: 8 },
  breakdownPeriod: { fontSize: 12, fontWeight: "600" },
  breakdownBars: { gap: 4 },
  breakdownBarSmall: { height: 4, borderRadius: 2, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 2 },
  breakdownRight: { flexDirection: "row", gap: 16 },
  breakdownLabel: { fontSize: 10, marginBottom: 2 },
  breakdownValue: { fontSize: 13, fontWeight: "700" },
});