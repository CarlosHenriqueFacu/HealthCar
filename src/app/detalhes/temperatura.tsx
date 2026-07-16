import { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Importação do componente de container base (Caminho corrigido para a nova arquitetura)
import { ScreenContainer } from "../../components/screen-container";

// Ícones e roteamento nativo do Expo
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// Biblioteca para desenhar o gráfico de linha contínua (Polyline)
import Svg, { Circle, Defs, Line, LinearGradient, Polyline, Stop } from "react-native-svg";

// Captura a largura da tela para adaptar o tamanho do gráfico
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ==========================================================
   DADOS SIMULADOS (MOCK)
   Representa a oscilação térmica do motor ao longo de 24h.
   No futuro, esses dados serão gerados pelo cruzamento do 
   PID 01 05 (Temperatura do Arrefecimento) gravado no SQLite.
========================================================== */
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

export default function TemperatureDetailsScreen() {
  // Estado para controlar qual bolinha do gráfico o usuário tocou
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ================= CÁLCULOS ESTATÍSTICOS =================
  const minTemp = Math.min(...TEMPERATURE_DATA.map((d) => d.temp));
  const maxTemp = Math.max(...TEMPERATURE_DATA.map((d) => d.temp));
  const avgTemp = Math.round(TEMPERATURE_DATA.reduce((sum, d) => sum + d.temp, 0) / TEMPERATURE_DATA.length);

  // ================= DIMENSÕES DO GRÁFICO =================
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const padding = 40; // Margem interna do SVG para o gráfico não cortar nas pontas

  /* ================= MATEMÁTICA DA LINHA DO GRÁFICO (POLYLINE) ================= 
     Este bloco transforma os graus Celsius em coordenadas (X, Y) na tela do celular.
  */
  const points = TEMPERATURE_DATA.map((data, i) => {
    // EIXO X: Avança proporcionalmente da esquerda para a direita
    const x = padding + (i / (TEMPERATURE_DATA.length - 1)) * (chartWidth - padding * 2);
    // EIXO Y: A tela do celular tem o 0 no topo. Então, invertemos o cálculo para que temperaturas altas fiquem em cima
    const y = chartHeight - padding - ((data.temp - minTemp) / (maxTemp - minTemp)) * (chartHeight - padding * 2);
    return { x, y, ...data };
  });

  // Une todas as coordenadas geradas acima em uma única string ("x1,y1 x2,y2 x3,y3") que o SVG entende
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= HEADER (CABEÇALHO) ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Temperatura do Motor</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE STATUS ATUAL ================= */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="thermostat" size={32} color="#FF6B35" />
            <View>
              <Text style={styles.statusLabel}>Temperatura Atual</Text>
              {/* MANUTENÇÃO: No app real, essa temperatura será a variável ao vivo recebida do Bluetooth */}
              <Text style={styles.statusValue}>92°C</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: "#FF6B3522" }]}>
            <Text style={{ color: "#FF6B35", fontSize: 12, fontWeight: "700" }}>Normal</Text>
          </View>
        </View>

        {/* ================= CARDS DE ESTATÍSTICAS RÁPIDAS ================= */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mínima</Text>
            <Text style={styles.statValue}>{minTemp}°C</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Média</Text>
            <Text style={styles.statValue}>{avgTemp}°C</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Máxima</Text>
            <Text style={styles.statValue}>{maxTemp}°C</Text>
          </View>
        </View>

        {/* ================= GRÁFICO DE LINHA (POLYLINE SVG) ================= */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Oscilação Térmica (24h)</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="tempGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FF6B35" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Linhas de Grade de Fundo */}
            {[0, 25, 50, 75, 100].map((percent) => (
              <Line
                key={`grid-${percent}`}
                x1={padding}
                y1={chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)}
                x2={chartWidth - padding}
                y2={chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)}
                stroke="#1E2235"
                strokeWidth={1}
                opacity={0.3}
              />
            ))}

            {/* A Linha Contínua do Gráfico */}
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke="#FF6B35"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* As Bolinhas (Pontos de Dados) em cima da Linha */}
            {points.map((point, i) => (
              <Circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r={selectedIndex === i ? 6 : 4} // Fica maior se o usuário clicou na lista
                fill={selectedIndex === i ? "#FF6B35" : "#FF6B35"}
                opacity={selectedIndex === i ? 1 : 0.6}
              />
            ))}
          </Svg>

          {/* Rótulos do Eixo X (Horários) */}
          <View style={styles.timeLabels}>
            {/* Mostra apenas alguns horários para não poluir a tela */}
            {[0, 6, 12].map((i) => (
              <Text key={`time-${i}`} style={styles.timeLabel}>
                {TEMPERATURE_DATA[i * 2]?.time}
              </Text>
            ))}
          </View>
        </View>

        {/* ================= LISTA HORÁRIA DE DADOS ================= */}
        <View style={styles.dataSection}>
          <Text style={styles.dataTitle}>Dados Horários</Text>
          {TEMPERATURE_DATA.map((data, i) => (
            <Pressable
              key={`data-${i}`}
              onPress={() => setSelectedIndex(i)} // Acende a bolinha correspondente no gráfico acima
              style={[styles.dataRow, selectedIndex === i && styles.dataRowActive]}
            >
              <Text style={styles.dataTime}>{data.time}</Text>
              
              {/* Barra de Progresso Horizontal para cada hora */}
              <View style={styles.dataBar}>
                <View
                  style={[
                    styles.dataBarFill,
                    {
                      width: `${((data.temp - minTemp) / (maxTemp - minTemp)) * 100}%`,
                      // Se passou de 85 graus fica Laranja, se não, fica Azul
                      backgroundColor: data.temp > 85 ? "#FF6B35" : "#00B4FF",
                    },
                  ]}
                />
              </View>
              <Text style={styles.dataTemp}>{data.temp}°C</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ================= ESTILOS (CSS in JS) =================
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#F0F2FF",
  },
  headerSpacer: { width: 30 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: "#8892A4",
  },
  statusValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FF6B35",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#12141A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2235",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#8892A4",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6B35",
  },

  chartContainer: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 12,
  },
  chart: {
    marginBottom: 8,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  timeLabel: {
    fontSize: 10,
    color: "#8892A4",
  },

  dataSection: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  dataTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  dataRowActive: {
    backgroundColor: "#1E223522",
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  dataTime: {
    width: 50,
    fontSize: 12,
    color: "#8892A4",
    fontWeight: "600",
  },
  dataBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#1E2235",
    borderRadius: 3,
    overflow: "hidden",
  },
  dataBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  dataTemp: {
    width: 50,
    fontSize: 12,
    fontWeight: "700",
    color: "#FF6B35",
    textAlign: "right",
  },
});