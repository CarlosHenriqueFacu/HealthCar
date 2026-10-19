import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppPalette } from "../../constants/theme";
import { useApp } from "../../contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @constant FUEL_DATA
 * @description Mock de dados estruturados representando o histórico de consumo e reabastecimento.
 * Projetado para integração futura com banco de dados local/remoto.
 */
const FUEL_DATA = [
  { dayKey: "seg", consumed: 8.2, refilled: false },
  { dayKey: "ter", consumed: 7.5, refilled: false },
  { dayKey: "qua", consumed: 9.1, refilled: false },
  { dayKey: "qui", consumed: 6.8, refilled: false },
  { dayKey: "sex", consumed: 10.2, refilled: false },
  { dayKey: "sab", consumed: 12.5, refilled: true },
  { dayKey: "dom", consumed: 5.3, refilled: false },
];

/**
 * Componente FuelDetailsScreen
 * @description Apresenta a análise detalhada do consumo de combustível. 
 * Inclui representação gráfica em barras (SVG) e timeline de reabastecimentos.
 */
export default function FuelDetailsScreen() {
  const { theme, t } = useApp();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Paleta reativa ao tema
  const isDark = theme === 'dark';
  const colors = AppPalette[theme];
  const { background: bgColor, surface: cardColor, text: textColor, textSecondary: subTextColor, border: borderColor } = colors;
  const primaryColor = colors.warning;

  // Cálculos estatísticos
  const totalConsumed = FUEL_DATA.reduce((sum, d) => sum + d.consumed, 0);
  const avgConsumption = (totalConsumed / FUEL_DATA.length).toFixed(1);
  const maxConsumption = Math.max(...FUEL_DATA.map((d) => d.consumed));

  // Geometria do gráfico
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 180;
  const barWidth = (chartWidth - 40) / FUEL_DATA.length;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <ScreenHeader title={t('combustivel')} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="local-gas-station" size={32} color={primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('nivelAtual')}</Text>
              <Text style={[styles.statusValue, { color: primaryColor }]}>62%</Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusRange, { color: primaryColor }]}>~372 km</Text>
            <Text style={[styles.statusRangeLabel, { color: subTextColor }]}>{t('deAutonomia')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('totalSemana')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{totalConsumed.toFixed(1)}L</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('mediaDiaria')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{avgConsumption}L</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>{t('consumoSemanal')}</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="fuelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
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

            {FUEL_DATA.map((data, i) => {
              const barHeight = (data.consumed / maxConsumption) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.1;
              const y = chartHeight - 30 - barHeight;
              
              return (
                <Rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barWidth * 0.8}
                  height={barHeight}
                  fill={primaryColor}
                  opacity={selectedDay === i ? 1 : (isDark ? 0.6 : 0.8)}
                  rx={4}
                />
              );
            })}
          </Svg>

          <View style={styles.dayLabels}>
            {FUEL_DATA.map((data, i) => (
              <Text key={`day-${i}`} style={[styles.dayLabel, { color: subTextColor }]}>
                {t(data.dayKey)}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.historyContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.historyTitle, { color: textColor }]}>{t('historicoAbastecimentos')}</Text>
          
          {FUEL_DATA.filter((d) => d.refilled).length > 0 ? (
            FUEL_DATA.map((data, i) => (
              data.refilled && (
                <View key={`refill-${i}`} style={[styles.refillItem, { borderBottomColor: borderColor }]}>
                  <MaterialIcons name="local-gas-station" size={20} color="#4CAF50" />
                  <View style={styles.refillContent}>
                    <Text style={[styles.refillDay, { color: textColor }]}>{t(data.dayKey)}</Text>
                    <Text style={[styles.refillTime, { color: subTextColor }]}>{t('abastecimentoCompleto')}</Text>
                  </View>
                  <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                </View>
              )
            ))
          ) : (
            <Text style={[styles.noRefillText, { color: subTextColor }]}>{t('nenhumAbastecimento')}</Text>
          )}
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('consumoDiario')}</Text>
          {FUEL_DATA.map((data, i) => (
            <Pressable
              key={`breakdown-${i}`}
              onPress={() => setSelectedDay(i)}
              style={({ pressed }) => [
                styles.breakdownItem,
                { borderBottomColor: borderColor },
                selectedDay === i && { backgroundColor: isDark ? "#FFC10722" : "#FEF3C7", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8 },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Text style={[styles.breakdownDay, { color: subTextColor }]}>{t(data.dayKey)}</Text>
              
              <View style={[styles.breakdownBar, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                <View style={[styles.breakdownBarFill, { width: `${(data.consumed / maxConsumption) * 100}%` as any, backgroundColor: primaryColor }]} />
              </View>
              <Text style={[styles.breakdownValue, { color: primaryColor }]}>{data.consumed}L</Text>
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
  statusRange: { fontSize: 16, fontWeight: "700" },
  statusRangeLabel: { fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "700" },
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  dayLabels: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20 },
  dayLabel: { fontSize: 10, fontWeight: "600" },
  historyContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  historyTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  refillItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  refillContent: { flex: 1 },
  refillDay: { fontSize: 12, fontWeight: "600" },
  refillTime: { fontSize: 11, marginTop: 2 },
  noRefillText: { fontSize: 12, fontStyle: "italic", paddingVertical: 8 },
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1 },
  breakdownDay: { width: 40, fontSize: 12, fontWeight: "600" },
  breakdownBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 3 },
  breakdownValue: { width: 40, fontSize: 12, fontWeight: "700", textAlign: "right" },
});