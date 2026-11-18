import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Svg, { Circle, Defs, Line, LinearGradient, Polyline, Stop } from "react-native-svg";
import { ChartPeriodToggle } from "../../components/ChartPeriodToggle";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

// IMPORTAÇÃO DA CAMADA DE PERSISTÊNCIA (SQLite)
import { obterTelemetriaPorPeriodo, obterUltimaLeituraVeiculo, obterVeiculoLocal } from "../../database/database";
import { buildChartBuckets, type ChartPeriod } from "../../utils/chart-period";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @interface TemperatureData
 * @description Estrutura de dados para o pipeline de renderização do gráfico Time-Series.
 */
interface TemperatureData {
  key: string;
  label: string;
  temp: number;
  minimum: number;
  maximum: number;
  sampleCount: number;
  bucketIndex: number;
}

/**
 * @component TemperatureDetailsScreen
 * @description Módulo de visualização analítica para telemetria de arrefecimento (ECT - Engine Coolant Temperature).
 * Extrai a série temporal do motor SQLite local, calcula a volumetria estatística (Min/Max/Avg)
 * e plota as coordenadas de forma dinâmica em um gráfico vetorial (SVG).
 */
export default function TemperatureDetailsScreen() {
  const { theme, t, language } = useApp();
  const { user } = useAuth();
  
  // --- ESTADOS DA INTERFACE ---
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartData, setChartData] = useState<TemperatureData[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [latestTemp, setLatestTemp] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Paleta de cores reativa ao contexto global
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const primaryColor = "#FF6B35"; // Laranja térmico

  /**
   * @effect Pipeline de Extração de Dados (Data Fetching)
   * @description Agrega a telemetria do veículo por dia ou mês a partir dos timestamps locais.
   */
  useEffect(() => {
    async function carregarTelemetria() {
      setIsLoading(true);
      setChartData([]);
      setLatestTemp(0);
      try {
        if (!user?.uid) return;
        const vehicle = await obterVeiculoLocal(user.uid);
        if (!vehicle) return;
        const [summary, latest] = await Promise.all([
          obterTelemetriaPorPeriodo(user.uid, vehicle.id, '0105', period),
          obterUltimaLeituraVeiculo(user.uid, vehicle.id, '0105'),
        ]);
        const locale = language === 'en' ? 'en-US' : 'pt-BR';
        const byPeriod = new Map(summary.map((row) => [row.periodKey, row]));
        const buckets = buildChartBuckets(period, locale);
        setChartData(buckets.flatMap((bucket, bucketIndex) => {
          const row = byPeriod.get(bucket.key);
          return row ? [{
            key: bucket.key,
            label: bucket.label,
            temp: Number(row.average),
            minimum: Math.round(Number(row.minimum)),
            maximum: Math.round(Number(row.maximum)),
            sampleCount: Number(row.sampleCount),
            bucketIndex,
          }] : [];
        }));
        setLatestTemp(latest ? Math.round(Number(latest.valor)) : 0);
      } catch (error) {
        console.log("[Data Layer Error] Falha ao extrair plotagem térmica:", error);
      } finally {
        setIsLoading(false);
      }
    }

    carregarTelemetria();
  }, [language, period, user?.uid]);

  // --- CÁLCULOS ESTATÍSTICOS DE BORDAS ---
  const dataToRender: TemperatureData[] = chartData.length > 0 ? chartData : [{
    key: 'empty', label: '--', temp: 0, minimum: 0, maximum: 0, sampleCount: 0, bucketIndex: 0,
  }];
  const currentTemp = latestTemp;
  const minTemp = chartData.length ? Math.min(...chartData.map((d) => d.minimum)) : 0;
  const maxTemp = chartData.length ? Math.max(...chartData.map((d) => d.maximum)) : 0;
  const sampleCount = chartData.reduce((sum, row) => sum + row.sampleCount, 0);
  const avgTemp = sampleCount
    ? Math.round(chartData.reduce((sum, row) => sum + row.temp * row.sampleCount, 0) / sampleCount)
    : 0;
  const axisBuckets = buildChartBuckets(period, language === 'en' ? 'en-US' : 'pt-BR');

  // --- GEOMETRIA E ESCALA DO GRÁFICO (SVG) ---
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const padding = 40;

  // CORREÇÃO CRÍTICA: Proteção absoluta contra divisão por zero (impede o congelamento da UI)
  const tempRange = maxTemp === minTemp ? 1 : (maxTemp - minTemp);

  // Mapeamento de matriz de dados para coordenadas bidimensionais (X, Y)
  const points = dataToRender.map((data, i) => {
    const position = chartData.length > 0 && chartData[i]?.bucketIndex !== undefined ? data.bucketIndex : i;
    const x = padding + (position / (axisBuckets.length > 1 ? axisBuckets.length - 1 : 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((data.temp - minTemp) / tempRange) * (chartHeight - padding * 2);
    return { x, y, ...data };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('temperaturaMotor')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ================= INDICADOR DE TEMPO REAL ================= */}
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="thermostat" size={32} color={primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('temperaturaAtual')}</Text>
              <Text style={[styles.statusValue, { color: primaryColor }]}>
                {isLoading ? "--" : currentTemp}°C
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isDark ? "#FF6B3522" : "#FFEDD5" }]}>
            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "700" }}>
              {currentTemp > 100 ? "ALERTA" : currentTemp === 0 ? "DESCONHECIDO" : t('normal')}
            </Text>
          </View>
        </View>

        {/* ================= VOLUMETRIA ESTATÍSTICA ================= */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('minima')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{isLoading ? "-" : minTemp}°C</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{isLoading ? "-" : avgTemp}°C</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('maxima')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{isLoading ? "-" : maxTemp}°C</Text>
          </View>
        </View>

        {/* ================= MOTOR GRÁFICO (SVG) ================= */}
        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: textColor }]}>{t('oscilacaoTermica')}</Text>
            <ChartPeriodToggle
              value={period}
              onChange={setPeriod}
              cardColor={cardColor}
              borderColor={borderColor}
              mutedColor={subTextColor}
              activeColor={primaryColor}
              dayLabel={t('dia')}
              monthLabel={t('mes')}
            />
          </View>
          
          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>Carregando telemetria...</Text>
            </View>
          ) : chartData.length === 0 ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="insights" size={48} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>Aguardando dados da ECU.</Text>
            </View>
          ) : (
            <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
              <Defs>
                <LinearGradient id="tempGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Grid Lines Verticais (Eixo Y) */}
              {[0, 25, 50, 75, 100].map((percent) => (
                <Line
                  key={`grid-${percent}`}
                  x1={padding}
                  y1={chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)}
                  stroke={borderColor}
                  strokeWidth={1}
                  opacity={isDark ? 0.3 : 1}
                />
              ))}

              {/* Vetor de Oscilação */}
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={primaryColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Nodos Interativos */}
              {points.map((point, i) => (
                <Circle
                  key={`point-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r={selectedIndex === i ? 6 : 4}
                  fill={primaryColor}
                  opacity={selectedIndex === i ? 1 : 0.6}
                />
              ))}
            </Svg>
          )}

          {/* Eixo X (dias ou meses) */}
          {chartData.length > 0 && (
            <View style={styles.timeLabels}>
              {axisBuckets.map((bucket) => (
                <Text key={bucket.key} style={[styles.timeLabel, { color: subTextColor }, period === 'month' && { fontSize: 8 }]}>{bucket.label}</Text>
              ))}
            </View>
          )}
        </View>

        {/* ================= DATAGRID: RESUMO POR PERÍODO ================= */}
        <View style={[styles.dataSection, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.dataTitle, { color: textColor }]}>{t('dadosHorarios')}</Text>
          
          {isLoading || chartData.length === 0 ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>Nenhum log gravado nesta sessão.</Text>
          ) : (
            chartData.map((data, i) => (
              <Pressable
                key={`data-${i}`}
                onPress={() => setSelectedIndex(i)}
                style={({ pressed }) => [
                  styles.dataRow,
                  { borderBottomColor: borderColor },
                  selectedIndex === i && { backgroundColor: isDark ? "#1E223555" : "#E2E8F088", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8 },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Text style={[styles.dataTime, { color: subTextColor }]}>{data.label}</Text>
                
                <View style={[styles.dataBar, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                  <View
                    style={[
                      styles.dataBarFill,
                      {
                        // CORREÇÃO DA SINTAXE DO WIDTH AQUI
                        width: `${((data.temp - minTemp) / tempRange) * 100}%` as any,
                        backgroundColor: data.temp > 100 ? "#FF3D57" : data.temp > 85 ? primaryColor : "#00B4FF",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.dataTemp, { color: primaryColor }]}>{Math.round(data.temp)}°C · {data.minimum}–{data.maximum}°</Text>
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
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  
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
  
  timeLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40 },
  timeLabel: { fontSize: 10, fontWeight: "600" },
  
  dataSection: { borderRadius: 16, padding: 16, borderWidth: 1 },
  dataTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  dataTime: { width: 50, fontSize: 12, fontWeight: "600" },
  dataBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  dataBarFill: { height: "100%", borderRadius: 3 },
  dataTemp: { width: 82, fontSize: 11, fontWeight: "700", textAlign: "right" },
});
