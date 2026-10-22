import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @constant CONSUMPTION_DATA
 * @description Mock de dados agregados do consumo e eficiência energética.
 * O campo 'dayKey' é utilizado para a tradução dinâmica (pt/en).
 */
const CONSUMPTION_DATA = [
  { dayKey: "seg", consumption: 8.2, efficiency: 9.5 },
  { dayKey: "ter", consumption: 7.5, efficiency: 10.2 },
  { dayKey: "qua", consumption: 9.1, efficiency: 8.8 },
  { dayKey: "qui", consumption: 6.8, efficiency: 10.8 },
  { dayKey: "sex", consumption: 10.2, efficiency: 7.9 },
  { dayKey: "sab", consumption: 12.5, efficiency: 6.5 },
  { dayKey: "dom", consumption: 5.3, efficiency: 11.2 },
];

/**
 * Componente ConsumptionDetailsScreen
 * @description Exibe a análise detalhada da relação entre o consumo de combustível e a eficiência (km/l).
 * Inclui um gráfico vetorial (SVG) de barras duplas para comparação direta e painéis de insights calculados.
 */
export default function ConsumptionDetailsScreen() {
  const { theme, t } = useApp();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Paleta reativa ao tema
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  
  const colorConsumption = "#FFC107"; // Amarelo (Consumo absoluto)
  const colorEfficiency = "#4CAF50"; // Verde (Eficiência km/l)
  const colorAverage = "#00B4FF"; // Azul (Média)

  // Cálculos estatísticos globais
  const totalConsumption = CONSUMPTION_DATA.reduce((sum, d) => sum + d.consumption, 0);
  const avgConsumption = (totalConsumption / CONSUMPTION_DATA.length).toFixed(1);
  const maxConsumption = Math.max(...CONSUMPTION_DATA.map((d) => d.consumption));
  const avgEfficiency = (CONSUMPTION_DATA.reduce((sum, d) => sum + d.efficiency, 0) / CONSUMPTION_DATA.length).toFixed(1);

  // Cálculos para Insights (Melhor e Pior eficiência)
  const bestDay = CONSUMPTION_DATA.reduce((prev, current) => (prev.efficiency > current.efficiency) ? prev : current);
  const worstDay = CONSUMPTION_DATA.reduce((prev, current) => (prev.efficiency < current.efficiency) ? prev : current);

  // Parâmetros do SVG
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 220;
  const barWidth = (chartWidth - 40) / CONSUMPTION_DATA.length;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('consumoSemanal')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="local-gas-station" size={28} color={colorConsumption} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>{t('total')}</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{totalConsumption.toFixed(1)}L</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="trending-up" size={28} color={colorAverage} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{avgConsumption}L</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="speed" size={28} color={colorEfficiency} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>{t('eficiencia')}</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{avgEfficiency} km/l</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>{t('consumoVsEficiencia')}</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="consumptionGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={colorConsumption} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={colorConsumption} stopOpacity="0" />
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

            {/* Barras de Consumo */}
            {CONSUMPTION_DATA.map((data, i) => {
              const barHeight = (data.consumption / maxConsumption) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.1;
              return (
                <Rect
                  key={`consumption-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.35}
                  height={barHeight}
                  fill={colorConsumption}
                  opacity={selectedDay === i ? 1 : (isDark ? 0.6 : 0.8)}
                  rx={4}
                />
              );
            })}

            {/* Barras de Eficiência */}
            {CONSUMPTION_DATA.map((data, i) => {
              const barHeight = (data.efficiency / 12) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.5; 
              return (
                <Rect
                  key={`efficiency-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.35}
                  height={barHeight}
                  fill={colorEfficiency}
                  opacity={selectedDay === i ? 1 : (isDark ? 0.6 : 0.8)}
                  rx={4}
                />
              );
            })}
          </Svg>

          <View style={styles.dayLabels}>
            {CONSUMPTION_DATA.map((data, i) => (
              <Text key={`day-${i}`} style={[styles.dayLabel, { color: subTextColor }]}>
                {/* Mostra apenas as 3 primeiras letras traduzidas (ex: Seg / Mon) */}
                {t(data.dayKey).substring(0, 3)}
              </Text>
            ))}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: colorConsumption }]} />
              <Text style={[styles.legendText, { color: subTextColor }]}>{t('consumoL')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: colorEfficiency }]} />
              <Text style={[styles.legendText, { color: subTextColor }]}>{t('eficienciaKml')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('detalhesDiarios')}</Text>
          {CONSUMPTION_DATA.map((data, i) => (
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
              <View style={styles.breakdownLeft}>
                <Text style={[styles.breakdownDay, { color: textColor }]}>{t(data.dayKey)}</Text>
                <View style={styles.breakdownBars}>
                  <View style={[styles.breakdownBarSmall, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                    <View style={[styles.breakdownBarFill, { width: `${(data.consumption / maxConsumption) * 100}%` as any, backgroundColor: colorConsumption }]} />
                  </View>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <View>
                  <Text style={[styles.breakdownLabel, { color: subTextColor }]}>{t('consumo')}</Text>
                  <Text style={[styles.breakdownValue, { color: colorConsumption }]}>{data.consumption}L</Text>
                </View>
                <View>
                  <Text style={[styles.breakdownLabel, { color: subTextColor }]}>{t('eficiencia')}</Text>
                  <Text style={[styles.breakdownValue, { color: colorConsumption }]}>{data.efficiency} km/l</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={[styles.insightsContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.insightsTitle, { color: textColor }]}>Insights</Text>
          
          <View style={[styles.insightItem, { borderBottomColor: borderColor }]}>
            <MaterialIcons name="trending-up" size={20} color={colorEfficiency} />
            <View style={styles.insightContent}>
              <Text style={[styles.insightLabel, { color: subTextColor }]}>{t('melhorDia')}</Text>
              <Text style={[styles.insightValue, { color: colorConsumption }]}>{t(bestDay.dayKey)} - {bestDay.efficiency} km/l</Text>
            </View>
          </View>
          
          <View style={[styles.insightItem, { borderBottomColor: borderColor, borderBottomWidth: 0 }]}>
            <MaterialIcons name="trending-down" size={20} color="#FF3D57" />
            <View style={styles.insightContent}>
              <Text style={[styles.insightLabel, { color: subTextColor }]}>{t('piorDia')}</Text>
              <Text style={[styles.insightValue, { color: colorConsumption }]}>{t(worstDay.dayKey)} - {worstDay.efficiency} km/l</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center", gap: 6 },
  summaryLabel: { fontSize: 10 },
  summaryValue: { fontSize: 16, fontWeight: "700" },
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  dayLabels: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20, marginBottom: 8 },
  dayLabel: { fontSize: 9, fontWeight: "600" },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendColor: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 11 },
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  breakdownLeft: { flex: 1, gap: 6 },
  breakdownDay: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  breakdownBars: { gap: 4 },
  breakdownBarSmall: { height: 4, borderRadius: 2, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 2 },
  breakdownRight: { flexDirection: "row", gap: 16 },
  breakdownLabel: { fontSize: 10, marginBottom: 2 },
  breakdownValue: { fontSize: 12, fontWeight: "700" },
  insightsContainer: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  insightsTitle: { fontSize: 13, fontWeight: "600" },
  insightItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  insightContent: { flex: 1 },
  insightLabel: { fontSize: 11 },
  insightValue: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
});