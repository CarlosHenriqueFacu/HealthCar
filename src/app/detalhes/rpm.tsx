import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ChartPeriodToggle } from "../../components/ChartPeriodToggle";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

import { obterTelemetriaPorPeriodo, obterUltimaLeituraVeiculo, obterVeiculoLocal } from "../../database/database";
import { buildChartBuckets, type ChartPeriod } from "../../utils/chart-period";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RpmAggregatedData {
  key: string;
  period: string;
  peak: number;
  avg: number;
  sampleCount: number;
}

export default function RPMDetailsScreen() {
  const { theme, t, language } = useApp();
  const { user } = useAuth();

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [aggregatedData, setAggregatedData] = useState<RpmAggregatedData[]>([]);
  const [currentRPM, setCurrentRPM] = useState(0);
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const peakColor = "#9C27B0";
  const avgColor = "#00B4FF";

  useEffect(() => {
    async function carregarTelemetriaRPM() {
      setIsLoading(true);
      setAggregatedData([]);
      setCurrentRPM(0);
      try {
        if (!user?.uid) return;
        const vehicle = await obterVeiculoLocal(user.uid);
        if (!vehicle) return;
        const [summary, latest] = await Promise.all([
          obterTelemetriaPorPeriodo(user.uid, vehicle.id, '010C', period),
          obterUltimaLeituraVeiculo(user.uid, vehicle.id, '010C'),
        ]);
        const locale = language === 'en' ? 'en-US' : 'pt-BR';
        const byPeriod = new Map(summary.map((row) => [row.periodKey, row]));
        const buckets = buildChartBuckets(period, locale);
        setAggregatedData(buckets.map((bucket) => {
          const row = byPeriod.get(bucket.key);
          return row ? {
            key: bucket.key,
            period: bucket.label,
            peak: Math.round(Number(row.maximum)),
            avg: Math.round(Number(row.average)),
            sampleCount: Number(row.sampleCount),
          } : {
            key: bucket.key,
            period: bucket.label,
            peak: 0,
            avg: 0,
            sampleCount: 0,
          };
        }));
        setCurrentRPM(latest ? Number(latest.valor) : 0);
      } catch (error) {
        console.log("[Data Layer Error] Falha ao agregar telemetria de RPM:", error);
      } finally {
        setIsLoading(false);
      }
    }

    carregarTelemetriaRPM();
  }, [language, period, user?.uid]);

  const dataToRender: RpmAggregatedData[] = aggregatedData.length > 0 ? aggregatedData : [{
    key: 'empty', period: 'N/A', peak: 0, avg: 0, sampleCount: 0,
  }];
  const maxRPM = 6500;
  const peakGlobalRPM = Math.max(...dataToRender.map((d) => d.peak));
  const sampleCount = aggregatedData.reduce((sum, row) => sum + row.sampleCount, 0);
  const avgGlobalRPM = sampleCount
    ? Math.round(aggregatedData.reduce((sum, row) => sum + row.avg * row.sampleCount, 0) / sampleCount)
    : 0;

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const numBars = dataToRender.length > 0 ? dataToRender.length : 1;
  const barWidth = (chartWidth - 40) / numBars;
  const safePeakGlobal = peakGlobalRPM > 0 ? peakGlobalRPM : 1;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>RPM</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="settings" size={32} color={peakColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('rpmAtual')}</Text>
              <Text style={[styles.statusValue, { color: peakColor }]}>
                {isLoading ? "--" : (currentRPM / 1000).toFixed(1)}k
              </Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusPercent, { color: peakColor }]}>
              {isLoading ? "--" : Math.min(100, Math.round((currentRPM / maxRPM) * 100))}%
            </Text>
            <Text style={[styles.statusPercentLabel, { color: subTextColor }]}>{t('doMaximo')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('pico')}</Text>
            <Text style={[styles.statValue, { color: peakColor }]}>{isLoading ? "-" : (peakGlobalRPM / 1000).toFixed(1)}k</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: peakColor }]}>{isLoading ? "-" : (avgGlobalRPM / 1000).toFixed(1)}k</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: textColor }]}>{t('picosPorPeriodo')}</Text>
            <ChartPeriodToggle
              value={period}
              onChange={setPeriod}
              cardColor={cardColor}
              borderColor={borderColor}
              mutedColor={subTextColor}
              activeColor={peakColor}
              dayLabel={t('dia')}
              monthLabel={t('mes')}
            />
          </View>

          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={peakColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>{t('carregandoTelemetria')}</Text>
            </View>
          ) : aggregatedData.every((row) => row.sampleCount === 0) ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="insights" size={48} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>{t('aguardandoDadosEcu')}</Text>
            </View>
          ) : (
            <>
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

                {dataToRender.map((data, i) => {
                  const barHeight = (data.peak / safePeakGlobal) * (chartHeight - 60);
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

                {dataToRender.map((data, i) => {
                  const barHeight = (data.avg / safePeakGlobal) * (chartHeight - 60);
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
                {dataToRender.map((data, i) => (
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
            </>
          )}
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('detalhesPorPeriodo')}</Text>

          {isLoading || aggregatedData.every((row) => row.sampleCount === 0) ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>{t('nenhumLogSessao')}</Text>
          ) : (
            aggregatedData.map((data, i) => (
              <Pressable
                key={data.key}
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
                      <View style={[styles.breakdownBarFill, { width: `${(data.peak / safePeakGlobal) * 100}%` as any, backgroundColor: peakColor }]} />
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
            ))
          )}
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
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  chartTitle: { flex: 1, fontSize: 13, fontWeight: "600" },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  emptyChartText: { fontSize: 13, fontWeight: "500" },
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