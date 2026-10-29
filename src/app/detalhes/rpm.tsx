import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle, Defs, G, Line, LinearGradient, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

import { obterDadosGrafico, obterResumoSessoes } from "../../database/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RpmAggregatedData {
  period: string;
  peak: number;
  avg: number;
  startTs: number;
  endTs: number;
}

interface RawData {
  timestamp: number;
  valor: number;
}

export default function RPMDetailsScreen() {
  const { theme, t } = useApp();
  const { user } = useAuth();
  
  const [rawTelemetry, setRawTelemetry] = useState<RawData[]>([]);
  const [aggregatedData, setAggregatedData] = useState<RpmAggregatedData[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  
  const [currentRPM, setCurrentRPM] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const peakColor = "#9C27B0"; 
  const avgColor = "#00B4FF";  

  const JANELA_24H_MS = 24 * 60 * 60 * 1000;

  const carregarTelemetriaRPM = async () => {
    try {
      if (!user?.uid) return;
      const sessoes = await obterResumoSessoes(user.uid);
      
      if (sessoes && sessoes.length > 0) {
        const sessaoAtiva: any = sessoes[0];
        const leiturasBrutas: any = await obterDadosGrafico(user.uid, sessaoAtiva.id, "010C");

        if (leiturasBrutas && leiturasBrutas.length > 0) {
          setCurrentRPM(leiturasBrutas[leiturasBrutas.length - 1].valor);

          const agora = Date.now();
          const leiturasValidas = leiturasBrutas.filter((l: any) => l.timestamp >= (agora - JANELA_24H_MS));
          
          // Garante ordem cronológica
          leiturasValidas.sort((a: any, b: any) => a.timestamp - b.timestamp);

          if (leiturasValidas.length > 0) {
            setRawTelemetry(leiturasValidas);

            const numChunks = Math.min(6, leiturasValidas.length);
            const chunkSize = Math.ceil(leiturasValidas.length / numChunks);
            const processedChunks: RpmAggregatedData[] = [];

            for (let i = 0; i < numChunks; i++) {
              const chunk = leiturasValidas.slice(i * chunkSize, (i + 1) * chunkSize);
              if (chunk.length > 0) {
                const peak = Math.max(...chunk.map((c: any) => c.valor));
                const avg = Math.round(chunk.reduce((acc: number, val: any) => acc + val.valor, 0) / chunk.length);
                
                const timeStart = new Date(chunk[0].timestamp);
                const timeEnd = new Date(chunk[chunk.length - 1].timestamp);
                
                const fmtTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                
                processedChunks.push({
                  period: `${fmtTime(timeStart)} - ${fmtTime(timeEnd)}`,
                  peak,
                  avg,
                  startTs: chunk[0].timestamp,
                  endTs: chunk[chunk.length - 1].timestamp
                });
              }
            }
            
            setAggregatedData(processedChunks);
            
            // Se for o primeiro load, seleciona o bloco mais recente automaticamente
            if (aggregatedData.length === 0) {
                setSelectedPeriodIndex(processedChunks.length - 1);
            }
          }
        }
      }
    } catch (error) {
      console.log("[Data Layer Error]", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(() => {
    carregarTelemetriaRPM();
    const interval = setInterval(carregarTelemetriaRPM, 3000);
    return () => clearInterval(interval);
  });

  // --- PREPARAÇÃO DOS DADOS DO GRÁFICO (Filtrado pelo bloco selecionado) ---
  const activeChunk = aggregatedData[selectedPeriodIndex] || { startTs: 0, endTs: 0 };
  
  const chartData = rawTelemetry
    .filter(d => d.timestamp >= activeChunk.startTs && d.timestamp <= activeChunk.endTs)
    .map(d => {
        const dt = new Date(d.timestamp);
        return {
            time: `${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}:${dt.getSeconds().toString().padStart(2,'0')}`,
            rpm: Math.round(d.valor)
        };
    });

  const maxRPM = 6500;
  const peakGlobalRPM = aggregatedData.length > 0 ? Math.max(...aggregatedData.map(d => d.peak)) : 0;
  const avgGlobalRPM = aggregatedData.length > 0 ? Math.round(aggregatedData.reduce((sum, d) => sum + d.avg, 0) / aggregatedData.length) : 0;
  const safePeakGlobal = peakGlobalRPM > 0 ? peakGlobalRPM : 1; 

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 220;
  const padding = 35;

  const minChartRpm = chartData.length > 0 ? Math.min(...chartData.map(d => d.rpm)) : 0;
  const maxChartRpm = chartData.length > 0 ? Math.max(...chartData.map(d => d.rpm)) : 100;
  const chartRange = maxChartRpm === minChartRpm ? 1 : (maxChartRpm - minChartRpm);

  const points = chartData.map((data, i) => {
    const x = padding + (i / (chartData.length > 1 ? chartData.length - 1 : 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((data.rpm - minChartRpm) / chartRange) * (chartHeight - padding * 2);
    return { x, y, ...data };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>Rotação do Motor</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ================= INDICADOR DE TEMPO REAL ================= */}
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="settings" size={32} color={peakColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('rpmAtual')}</Text>
              <Text style={[styles.statusValue, { color: peakColor }]}>
                {isLoading ? "--" : currentRPM} <Text style={{fontSize: 12, fontWeight: '500'}}>RPM</Text>
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

        {/* ================= VOLUMETRIA ESTATÍSTICA DA VIAGEM ================= */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('pico')}</Text>
            <Text style={[styles.statValue, { color: peakColor }]}>{isLoading ? "-" : peakGlobalRPM}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: avgColor }]}>{isLoading ? "-" : avgGlobalRPM}</Text>
          </View>
        </View>

        {/* ================= MOTOR GRÁFICO (RAW DATA DO BLOCO SELECIONADO) ================= */}
        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <Text style={[styles.chartTitle, { color: textColor, marginBottom: 0 }]}>Detalhe do Período</Text>
            <Text style={{ fontSize: 11, color: peakColor, fontWeight: 'bold' }}>{activeChunk.period || '--'}</Text>
          </View>
          
          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={avgColor} />
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
                <LinearGradient id="rpmGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={avgColor} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={avgColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>

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

              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={avgColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {points.map((point, i) => {
                const isSelected = selectedPointIndex === i;
                return (
                  <G key={`point-group-${i}`} onPress={() => setSelectedPointIndex(isSelected ? null : i)}>
                    <Circle cx={point.x} cy={point.y} r={18} fill="transparent" />
                    
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={isSelected ? 6 : 2}
                      fill={avgColor}
                      opacity={isSelected ? 1 : 0.4}
                      stroke={cardColor}
                      strokeWidth={1}
                    />

                    {/* CAIXA DE HORA E MEDIDA FLUTUANTE */}
                    {isSelected && (
                      <G>
                        <Rect x={point.x - 35} y={point.y - 45} width={70} height={35} fill={cardColor} stroke={borderColor} strokeWidth={1} rx={6} />
                        <SvgText x={point.x} y={point.y - 30} fill={textColor} fontSize="11" fontWeight="bold" textAnchor="middle">
                          {point.rpm} RPM
                        </SvgText>
                        <SvgText x={point.x} y={point.y - 16} fill={subTextColor} fontSize="9" textAnchor="middle">
                          {point.time}
                        </SvgText>
                      </G>
                    )}
                  </G>
                );
              })}
            </Svg>
          )}

          {chartData.length > 0 && (
            <View style={styles.timeLabels}>
              <Text style={[styles.timeLabel, { color: subTextColor }]}>{chartData[0].time}</Text>
              <Text style={[styles.timeLabel, { color: subTextColor }]}>
                {chartData[Math.floor(chartData.length / 2)].time}
              </Text>
              <Text style={[styles.timeLabel, { color: subTextColor }]}>{chartData[chartData.length - 1].time}</Text>
            </View>
          )}
        </View>

        {/* ================= DATAGRID: LOG HORÁRIO POR BLOCO ================= */}
        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>Selecione o Bloco de Tempo para Filtrar</Text>
          
          {isLoading || aggregatedData.length === 0 ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>Nenhum log gravado nesta sessão.</Text>
          ) : (
            [...aggregatedData].reverse().map((data, i) => {
              const originalIndex = aggregatedData.length - 1 - i;
              return (
              <Pressable
                key={`breakdown-${i}`}
                onPress={() => {
                    setSelectedPeriodIndex(originalIndex);
                    setSelectedPointIndex(null); // Reseta a tooltip ao mudar de bloco
                }}
                style={({ pressed }) => [
                  styles.breakdownItem,
                  { borderBottomColor: borderColor },
                  selectedPeriodIndex === originalIndex && { backgroundColor: isDark ? "#9C27B022" : "#F3E8F5", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8, borderBottomColor: 'transparent' },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <View style={styles.breakdownLeft}>
                  <Text style={[styles.breakdownPeriod, { color: textColor }]}>{data.period}</Text>
                  
                  <View style={styles.breakdownBars}>
                    <View style={styles.barWrapper}>
                      <View style={[styles.breakdownBarSmall, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1", width: '70%' }]}>
                        <View style={[styles.breakdownBarFill, { width: `${(data.peak / safePeakGlobal) * 100}%` as any, backgroundColor: peakColor }]} />
                      </View>
                      <Text style={[styles.barValueText, { color: peakColor }]}>{data.peak}</Text>
                    </View>
                    
                    <View style={styles.barWrapper}>
                      <View style={[styles.breakdownBarSmall, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1", width: '70%' }]}>
                        <View style={[styles.breakdownBarFill, { width: `${(data.avg / safePeakGlobal) * 100}%` as any, backgroundColor: avgColor }]} />
                      </View>
                      <Text style={[styles.barValueText, { color: avgColor }]}>{data.avg}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            )})
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
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  emptyChartText: { fontSize: 13, fontWeight: "500" },
  
  timeLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40 },
  timeLabel: { fontSize: 10, fontWeight: "600" },
  
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  breakdownLeft: { flex: 1, gap: 10 },
  breakdownPeriod: { fontSize: 12, fontWeight: "600" },
  breakdownBars: { gap: 8 },
  barWrapper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  breakdownBarSmall: { height: 6, borderRadius: 3, overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 3 },
  barValueText: { fontSize: 13, fontWeight: "700" },
});