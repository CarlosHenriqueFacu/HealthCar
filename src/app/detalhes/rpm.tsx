import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Importação do componente de container base (Caminho corrigido para a nova arquitetura)
import { ScreenContainer } from "../../components/screen-container";

// Ícones e roteamento nativo do Expo
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// Biblioteca para desenhar os gráficos vetoriais (SVG)
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";

// Captura a largura da tela para garantir que o gráfico não vaze pelas bordas
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ==========================================================
   DADOS SIMULADOS (MOCK)
   Representa o RPM máximo (Pico) e a Média em blocos de 4h.
   No futuro, o aplicativo vai calcular isso lendo o histórico 
   salvo no banco SQLite (offline-first).
========================================================== */
const RPM_DATA = [
  { period: "00-04h", peak: 2100, avg: 1200 },
  { period: "04-08h", peak: 3500, avg: 2100 },
  { period: "08-12h", peak: 4800, avg: 3200 },
  { period: "12-16h", peak: 5200, avg: 3800 },
  { period: "16-20h", peak: 4900, avg: 3500 },
  { period: "20-00h", peak: 3200, avg: 2000 },
];

export default function RPMDetailsScreen() {
  // Estado para controlar qual período o usuário selecionou na lista
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // ================= CÁLCULOS ESTATÍSTICOS =================
  const currentRPM = 3200; // RPM no momento exato em que a tela abriu
  const maxRPM = 6500; // O "redline" (faixa vermelha) do motor do Camaro
  
  // Encontra o maior pico de RPM registrado no dia para balizar a altura do gráfico SVG
  const peakRPM = Math.max(...RPM_DATA.map((d) => d.peak));
  // Calcula a média geral de RPM do dia
  const avgRPM = Math.round(RPM_DATA.reduce((sum, d) => sum + d.avg, 0) / RPM_DATA.length);

  // ================= DIMENSÕES DO GRÁFICO =================
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 200;
  const barWidth = (chartWidth - 40) / RPM_DATA.length;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= HEADER (CABEÇALHO) ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>RPM</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE STATUS ATUAL ================= */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="settings" size={32} color="#9C27B0" />
            <View>
              <Text style={styles.statusLabel}>RPM Atual</Text>
              {/* Divide por 1000 para mostrar "3.2k" em vez de "3200" */}
              <Text style={styles.statusValue}>{(currentRPM / 1000).toFixed(1)}k</Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            {/* Calcula quantos % do limite do motor o RPM atual representa */}
            <Text style={styles.statusPercent}>{Math.round((currentRPM / maxRPM) * 100)}%</Text>
            <Text style={styles.statusPercentLabel}>do máximo</Text>
          </View>
        </View>

        {/* ================= CARDS DE ESTATÍSTICAS RÁPIDAS ================= */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pico</Text>
            <Text style={styles.statValue}>{(peakRPM / 1000).toFixed(1)}k</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Média</Text>
            <Text style={styles.statValue}>{(avgRPM / 1000).toFixed(1)}k</Text>
          </View>
        </View>

        {/* ================= GRÁFICO DE BARRAS (SVG) ================= */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Picos por Período (24h)</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="rpmGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#9C27B0" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#9C27B0" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Linhas de grade horizontais no fundo */}
            {[0, 25, 50, 75, 100].map((percent) => (
              <Line
                key={`grid-${percent}`}
                x1={20}
                y1={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                x2={chartWidth - 20}
                y2={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                stroke="#1E2235"
                strokeWidth={1}
                opacity={0.3}
              />
            ))}

            {/* BARRAS ROXAS: Picos de RPM */}
            {RPM_DATA.map((data, i) => {
              // A altura é relativa ao maior pico registrado (peakRPM)
              const barHeight = (data.peak / peakRPM) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.05;
              return (
                <Rect
                  key={`peak-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.45}
                  height={barHeight}
                  fill={selectedPeriod === i ? "#9C27B0" : "#9C27B088"}
                  opacity={selectedPeriod === i ? 1 : 0.6}
                  rx={3}
                />
              );
            })}

            {/* BARRAS AZUIS: Média de RPM */}
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
                  fill={selectedPeriod === i ? "#00B4FF" : "#00B4FF88"}
                  opacity={selectedPeriod === i ? 1 : 0.6}
                  rx={3}
                />
              );
            })}
          </Svg>

          {/* Rótulos dos Períodos (Ex: "00", "04", "08"...) sob o gráfico */}
          <View style={styles.periodLabels}>
            {RPM_DATA.map((data, i) => (
              <Text key={`period-${i}`} style={styles.periodLabel}>
                {data.period.split("-")[0]}
              </Text>
            ))}
          </View>

          {/* Legenda de Cores */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#9C27B0" }]} />
              <Text style={styles.legendText}>Pico</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#00B4FF" }]} />
              <Text style={styles.legendText}>Média</Text>
            </View>
          </View>
        </View>

        {/* ================= LISTA DE DETALHES POR PERÍODO ================= */}
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>Detalhes por Período</Text>
          {RPM_DATA.map((data, i) => (
            <Pressable
              key={`breakdown-${i}`}
              onPress={() => setSelectedPeriod(i)} // Destaca a barra no gráfico ao clicar
              style={[styles.breakdownItem, selectedPeriod === i && styles.breakdownItemActive]}
            >
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownPeriod}>{data.period}</Text>
                <View style={styles.breakdownBars}>
                  <View style={styles.breakdownBarSmall}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        {
                          width: `${(data.peak / peakRPM) * 100}%`,
                          backgroundColor: "#9C27B0",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <View>
                  <Text style={styles.breakdownLabel}>Pico</Text>
                  <Text style={styles.breakdownValue}>{(data.peak / 1000).toFixed(1)}k</Text>
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Média</Text>
                  <Text style={styles.breakdownValue}>{(data.avg / 1000).toFixed(1)}k</Text>
                </View>
              </View>
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
    color: "#9C27B0",
  },
  statusRight: {
    alignItems: "flex-end",
  },
  statusPercent: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9C27B0",
  },
  statusPercentLabel: {
    fontSize: 10,
    color: "#8892A4",
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
    color: "#9C27B0",
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
  periodLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 9,
    color: "#8892A4",
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: "#8892A4",
  },

  breakdownContainer: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  breakdownItemActive: {
    backgroundColor: "#9C27B022",
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  breakdownLeft: {
    flex: 1,
    gap: 6,
  },
  breakdownPeriod: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  breakdownBars: {
    gap: 4,
  },
  breakdownBarSmall: {
    height: 4,
    backgroundColor: "#1E2235",
    borderRadius: 2,
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  breakdownRight: {
    flexDirection: "row",
    gap: 16,
  },
  breakdownLabel: {
    fontSize: 10,
    color: "#8892A4",
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9C27B0",
  },
});