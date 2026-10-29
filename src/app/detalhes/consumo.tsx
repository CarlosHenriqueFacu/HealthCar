import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

import { obterDadosGrafico, obterResumoSessoes } from "../../database/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ConsumptionData {
  dayKey: string;     
  consumption: number; 
  efficiency: number;  
  timestamp: number;   
}

const CAPACIDADE_TANQUE_LITROS = 50; 

export default function ConsumptionDetailsScreen() {
  const { theme, t } = useApp();
  const { user } = useAuth();

  const [consumptionData, setConsumptionData] = useState<ConsumptionData[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  
  const colorConsumption = "#FFC107"; 
  const colorEfficiency = "#4CAF50"; 
  const colorAverage = "#00B4FF"; 

  const processarConsumoReal = async () => {
    try {
      if (!user?.uid) return;
      const sessoes = await obterResumoSessoes(user.uid);
      if (!sessoes || sessoes.length === 0) {
        setIsLoading(false);
        return;
      }

      const agora = Date.now();
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      const limiteSeteDias = agora - seteDiasMs;
      
      const sessoesValidas = sessoes.filter((s: any) => s.inicio >= limiteSeteDias);
      
      const mapaDias: { [key: string]: { distMeters: number, fuelDroppedPerc: number, ts: number } } = {};
      const diasSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

      for (const sessao of sessoesValidas) {
        const diaData = new Date(sessao.inicio);
        const diaKey = diasSemana[diaData.getDay()];

        const leiturasCombustivel: any = await obterDadosGrafico(user.uid, sessao.id, "012F");
        
        let variacaoCombustivel = 0;
        if (leiturasCombustivel && leiturasCombustivel.length >= 2) {
          const combustivelInicio = leiturasCombustivel[0].valor;
          const combustivelFim = leiturasCombustivel[leiturasCombustivel.length - 1].valor;
          if (combustivelInicio > combustivelFim) {
              variacaoCombustivel = combustivelInicio - combustivelFim;
          }
        }

        const distanciaSessaoMeters = sessao.distanciaPercorrida || 0;

        if (!mapaDias[diaKey]) {
            mapaDias[diaKey] = { distMeters: 0, fuelDroppedPerc: 0, ts: diaData.setHours(0,0,0,0) };
        }
        
        mapaDias[diaKey].distMeters += distanciaSessaoMeters;
        mapaDias[diaKey].fuelDroppedPerc += variacaoCombustivel;
      }

      const compiledData: ConsumptionData[] = [];
      for (const [dayKey, metrics] of Object.entries(mapaDias)) {
          if (metrics.distMeters > 0 && metrics.fuelDroppedPerc > 0) {
              const kmRodados = metrics.distMeters / 1000;
              const litrosConsumidos = (metrics.fuelDroppedPerc / 100) * CAPACIDADE_TANQUE_LITROS;
              const eficienciaKml = litrosConsumidos > 0 ? (kmRodados / litrosConsumidos) : 0;

              compiledData.push({
                  dayKey,
                  consumption: parseFloat(litrosConsumidos.toFixed(1)),
                  efficiency: parseFloat(eficienciaKml.toFixed(1)),
                  timestamp: metrics.ts
              });
          }
      }

      compiledData.sort((a, b) => a.timestamp - b.timestamp);
      setConsumptionData(compiledData);
      
    } catch (error) {
      console.log("[Data Error - Consumo]", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      processarConsumoReal();
    }, [user?.uid])
  );

  const dataToRender = consumptionData.length > 0 ? consumptionData : [{ dayKey: "N/A", consumption: 0, efficiency: 0, timestamp: 0 }];
  
  const totalConsumption = dataToRender.reduce((sum, d) => sum + d.consumption, 0);
  const avgConsumption = (totalConsumption / dataToRender.length).toFixed(1);
  const maxConsumption = Math.max(...dataToRender.map((d) => d.consumption));
  const maxEfficiencyDisplay = Math.max(...dataToRender.map((d) => d.efficiency)) > 20 ? Math.max(...dataToRender.map((d) => d.efficiency)) : 20; 
  const avgEfficiency = (dataToRender.reduce((sum, d) => sum + d.efficiency, 0) / dataToRender.length).toFixed(1);

  const bestDay = consumptionData.length > 0 ? consumptionData.reduce((prev, current) => (prev.efficiency > current.efficiency) ? prev : current) : null;
  const worstDay = consumptionData.length > 0 ? consumptionData.reduce((prev, current) => (prev.efficiency < current.efficiency) ? prev : current) : null;

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 220;
  const barWidth = (chartWidth - 40) / (dataToRender.length > 0 ? dataToRender.length : 1);
  const safeMaxConsumption = maxConsumption > 0 ? maxConsumption : 1;

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
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{isLoading ? "-" : totalConsumption.toFixed(1)}L</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="trending-up" size={28} color={colorAverage} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{isLoading ? "-" : avgConsumption}L</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="speed" size={28} color={colorEfficiency} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>{t('eficiencia')}</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{isLoading ? "-" : avgEfficiency} km/l</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>{t('consumoVsEficiencia')}</Text>
          
          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={colorEfficiency} />
            </View>
          ) : consumptionData.length === 0 ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="local-gas-station" size={48} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>Reúna dados andando com o carro.</Text>
            </View>
          ) : (
            <>
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

                {consumptionData.map((data, i) => {
                  const barHeight = (data.consumption / safeMaxConsumption) * (chartHeight - 60);
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

                {consumptionData.map((data, i) => {
                  const barHeight = (data.efficiency / maxEfficiencyDisplay) * (chartHeight - 60);
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
                {consumptionData.map((data, i) => (
                  <Text key={`day-${i}`} style={[styles.dayLabel, { color: subTextColor }]}>
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
            </>
          )}
        </View>

        {consumptionData.length > 0 && (
          <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('detalhesDiarios')}</Text>
            {consumptionData.map((data, i) => (
              <Pressable
                key={`breakdown-${i}`}
                onPress={() => setSelectedDay(i)}
                style={({ pressed }) => [
                  styles.breakdownItem,
                  { borderBottomColor: borderColor },
                  selectedDay === i && { backgroundColor: isDark ? "#FFC10722" : "#FEF3C7", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8, borderBottomColor: 'transparent' },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <View style={styles.breakdownLeft}>
                  <Text style={[styles.breakdownDay, { color: textColor }]}>{t(data.dayKey)}</Text>
                  <View style={styles.breakdownBars}>
                    <View style={[styles.breakdownBarSmall, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                      <View style={[styles.breakdownBarFill, { width: `${(data.consumption / safeMaxConsumption) * 100}%` as any, backgroundColor: colorConsumption }]} />
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
                    <Text style={[styles.breakdownValue, { color: colorEfficiency }]}>{data.efficiency} km/l</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {bestDay && worstDay && (
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
        )}
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
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  emptyChartText: { fontSize: 13, fontWeight: "500" },
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