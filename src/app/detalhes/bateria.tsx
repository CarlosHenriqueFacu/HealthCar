import { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle, Defs, G, Line, LinearGradient, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

import { obterDadosGrafico, obterResumoSessoes } from "../../database/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface VoltData {
  time: string;
  volt: number;
  timestampSort: number;
}

export default function BatteryDetailsScreen() {
  const { theme, t } = useApp();
  const { user } = useAuth();
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartData, setChartData] = useState<VoltData[]>([]);
  const [currentVolt, setCurrentVolt] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  const JANELA_24H_MS = 24 * 60 * 60 * 1000;

  const carregarTelemetria = useCallback(async () => {
    try {
      if (!user?.uid) return;
      const sessoes = await obterResumoSessoes(user.uid);
      
      if (sessoes && sessoes.length > 0) {
        const sessaoAtiva: any = sessoes[0];
        
        // PID de Voltagem no banco: "ATRV"
        const leiturasBrutas: any = await obterDadosGrafico(user.uid, sessaoAtiva.id, "ATRV");

        if (leiturasBrutas && leiturasBrutas.length > 0) {
          setCurrentVolt(leiturasBrutas[leiturasBrutas.length - 1].valor);

          const agora = Date.now();
          const limite24h = agora - JANELA_24H_MS;

          const leiturasValidas = leiturasBrutas.filter((l: any) => l.timestamp >= limite24h);

          const dadosProcessados: VoltData[] = leiturasValidas.map((l: any) => {
             const dataObj = new Date(l.timestamp);
             const horas = dataObj.getHours().toString().padStart(2, '0');
             const minutos = dataObj.getMinutes().toString().padStart(2, '0');
             return {
                time: `${horas}:${minutos}`,
                volt: parseFloat(l.valor.toFixed(1)),
                timestampSort: l.timestamp
             };
          });

          dadosProcessados.sort((a, b) => a.timestampSort - b.timestampSort);
          setChartData(dadosProcessados);
        }
      }
    } catch (error) {
      console.log("[Data Error]", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      carregarTelemetria(); 
      const interval = setInterval(() => { carregarTelemetria(); }, 5000); 
      return () => clearInterval(interval);
    }, [carregarTelemetria])
  );

  const dataToRender = chartData.length > 0 ? chartData : [{ time: "--:--", volt: 12.0, timestampSort: 0 }];
  
  const minVolt = Math.min(...dataToRender.map((d) => d.volt));
  const maxVolt = Math.max(...dataToRender.map((d) => d.volt));
  const avgVolt = (dataToRender.reduce((sum, d) => sum + d.volt, 0) / dataToRender.length).toFixed(1);

  // Classificação Dinâmica da Voltagem
  let statusBat = "Desconhecido";
  let primaryColor = "#00B4FF"; 
  
  if (currentVolt >= 13.5) {
      statusBat = "Carregando";
      primaryColor = "#00E676"; // Verde (Alternador ok)
  } else if (currentVolt >= 12.2 && currentVolt <= 13.4) {
      statusBat = "Ideal (Descanso)";
      primaryColor = "#00B4FF"; // Azul
  } else if (currentVolt > 0 && currentVolt < 12.2) {
      statusBat = "Fraca / Atenção";
      primaryColor = "#FF3D57"; // Vermelho
  }

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 220; 
  const padding = 40;
  const vRange = maxVolt === minVolt ? 1 : (maxVolt - minVolt);

  const points = dataToRender.map((data, i) => {
    const x = padding + (i / (dataToRender.length > 1 ? dataToRender.length - 1 : 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((data.volt - minVolt) / vRange) * (chartHeight - padding * 2);
    return { x, y, ...data };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>Bateria & Tensão</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="battery-charging-full" size={32} color={primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>Tensão Elétrica (ATRV)</Text>
              <Text style={[styles.statusValue, { color: primaryColor }]}>
                {isLoading ? "--" : currentVolt.toFixed(1)}<Text style={{fontSize: 14}} > V</Text>
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isDark ? `${primaryColor}22` : `${primaryColor}22` }]}>
            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700", textTransform: 'uppercase' }}>
              {statusBat}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>Descarga Min</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{isLoading ? "-" : minVolt.toFixed(1)}v</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>Tensão Média</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{isLoading ? "-" : avgVolt}v</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>Carga Max</Text>
            <Text style={[styles.statValue, { color: textColor }]}>{isLoading ? "-" : maxVolt.toFixed(1)}v</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>Oscilação de Voltagem (24h)</Text>
          
          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : chartData.length === 0 ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="insights" size={48} color={borderColor} />
            </View>
          ) : (
            <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
              <Defs>
                <LinearGradient id="voltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
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
                stroke={primaryColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {points.map((point, i) => {
                const isSelected = selectedIndex === i;
                return (
                  <G key={`point-group-${i}`} onPress={() => setSelectedIndex(isSelected ? null : i)}>
                    <Circle cx={point.x} cy={point.y} r={20} fill="transparent" />
                    <Circle cx={point.x} cy={point.y} r={isSelected ? 6 : 2} fill={primaryColor} opacity={isSelected ? 1 : 0.4} stroke={cardColor} strokeWidth={1} />

                    {isSelected && (
                      <G>
                        <Rect x={point.x - 30} y={point.y - 45} width={60} height={35} fill={cardColor} stroke={borderColor} strokeWidth={1} rx={4} />
                        <SvgText x={point.x} y={point.y - 30} fill={textColor} fontSize="11" fontWeight="bold" textAnchor="middle">{point.volt} V</SvgText>
                        <SvgText x={point.x} y={point.y - 18} fill={subTextColor} fontSize="9" textAnchor="middle">{point.time}</SvgText>
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
              <Text style={[styles.timeLabel, { color: subTextColor }]}>{chartData[Math.floor(chartData.length / 2)].time}</Text>
              <Text style={[styles.timeLabel, { color: subTextColor }]}>{chartData[chartData.length - 1].time}</Text>
            </View>
          )}
        </View>

        <View style={[styles.dataSection, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.dataTitle, { color: textColor }]}>Diagnóstico Histórico</Text>
          
          {isLoading || chartData.length === 0 ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>Nenhum log gravado.</Text>
          ) : (
            [...chartData].reverse().map((data, i) => {
              const originalIndex = chartData.length - 1 - i;
              
              let barColor = "#00B4FF";
              if (data.volt >= 13.5) barColor = "#00E676";
              else if (data.volt < 12.2) barColor = "#FF3D57";
              
              return (
                <Pressable
                  key={`data-${i}`}
                  onPress={() => setSelectedIndex(originalIndex)}
                  style={({ pressed }) => [
                    styles.dataRow,
                    { borderBottomColor: borderColor },
                    selectedIndex === originalIndex && { backgroundColor: isDark ? "#1E223555" : "#E2E8F088", paddingHorizontal: 8, borderRadius: 8, marginHorizontal: -8 },
                    pressed && { opacity: 0.7 }
                  ]}
                >
                  <Text style={[styles.dataTime, { color: subTextColor }]}>{data.time}</Text>
                  
                  <View style={[styles.dataBar, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                    <View style={[styles.dataBarFill, { width: `${((data.volt - minVolt) / vRange) * 100}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.dataValue, { color: barColor }]}>{data.volt} V</Text>
                </Pressable>
              );
            })
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
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center", gap: 8 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 17, fontWeight: "700" },
  
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  
  timeLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40 },
  timeLabel: { fontSize: 10, fontWeight: "600" },
  
  dataSection: { borderRadius: 16, padding: 16, borderWidth: 1 },
  dataTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  dataTime: { width: 50, fontSize: 12, fontWeight: "600" }, 
  dataBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  dataBarFill: { height: "100%", borderRadius: 3 },
  dataValue: { width: 50, fontSize: 12, fontWeight: "700", textAlign: "right" },
});