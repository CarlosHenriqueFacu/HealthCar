import { useState } from "react";
import {
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
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @constant TEMPERATURE_DATA
 * @description Conjunto de dados simulados representando a oscilação térmica do motor em um ciclo de 24 horas.
 * O escopo futuro prevê a substituição deste mock por dados extraídos do PID OBD-II 0105 persistidos em base SQLite.
 */
const TEMPERATURE_DATA = [
  { time: "00:00", temp: 45 },
  { time: "02:00", temp: 42 },
  { time: "04:00", temp: 40 },
  { time: "06:00", temp: 38 },
  { time: "08:00", temp: 55 },
  { time: "10:00", temp: 72 },
  { time: "12:00", temp: 85 },
  { time: "14:00", temp: 92 },
  { time: "16:00", temp: 95 },
  { time: "18:00", temp: 88 },
  { time: "20:00", temp: 72 },
  { time: "22:00", temp: 58 },
];

/**
 * Componente TemperatureDetailsScreen
 * @description Renderiza a visualização detalhada da telemetria de temperatura do sistema de arrefecimento.
 * O layout inclui indicadores de status atual, estatísticas agregadas e um gráfico histórico vetorial (Polyline).
 */
export default function TemperatureDetailsScreen() {
  const { theme, t } = useApp();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Paleta de cores reativa ao contexto global
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const primaryColor = "#FF6B35"; // Laranja térmico

  // Cálculos estatísticos
  const minTemp = Math.min(...TEMPERATURE_DATA.map((d) => d.temp));
  const maxTemp = Math.max(...TEMPERATURE_DATA.map((d) => d.temp));
  const avgTemp = Math.round(TEMPERATURE_DATA.reduce((sum, d) => sum + d.temp, 0) / TEMPERATURE_DATA.length);

  // Parâmetros geométricos do gráfico
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const padding = 40;

  // Cálculo das coordenadas SVG projetadas
  const points = TEMPERATURE_DATA.map((data, i) => {
    const x = padding + (i / (TEMPERATURE_DATA.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((data.temp - minTemp) / (maxTemp - minTemp)) * (chartHeight - padding * 2);
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
        
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="thermostat" size={32} color={primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('temperaturaAtual')}</Text>
              <Text style={[styles.statusValue, { color: primaryColor }]}>92°C</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isDark ? "#FF6B3522" : "#FFEDD5" }]}>
            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "700" }}>{t('normal')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('minima')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{minTemp}°C</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{avgTemp}°C</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('maxima')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{maxTemp}°C</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>{t('oscilacaoTermica')}</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="tempGrad" x1="0%" y1="0%" x2="0%" y2="100%">
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

          <View style={styles.timeLabels}>
            {[0, 6, 12].map((i) => (
              <Text key={`time-${i}`} style={[styles.timeLabel, { color: subTextColor }]}>
                {TEMPERATURE_DATA[i * 2]?.time}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.dataSection, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.dataTitle, { color: textColor }]}>{t('dadosHorarios')}</Text>
          {TEMPERATURE_DATA.map((data, i) => (
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
              <Text style={[styles.dataTime, { color: subTextColor }]}>{data.time}</Text>
              
              <View style={[styles.dataBar, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                <View
                  style={[
                    styles.dataBarFill,
                    {
                      width: `${((data.temp - minTemp) / (maxTemp - minTemp)) * 100}%` as any,
                      backgroundColor: data.temp > 85 ? primaryColor : "#00B4FF",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.dataTemp, { color: primaryColor }]}>{data.temp}°C</Text>
            </Pressable>
          ))}
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
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  timeLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40 },
  timeLabel: { fontSize: 10 },
  dataSection: { borderRadius: 16, padding: 16, borderWidth: 1 },
  dataTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  dataTime: { width: 50, fontSize: 12, fontWeight: "600" },
  dataBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  dataBarFill: { height: "100%", borderRadius: 3 },
  dataTemp: { width: 50, fontSize: 12, fontWeight: "700", textAlign: "right" },
});