import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Importação do componente de container base (Caminho corrigido para a nova arquitetura)
import { ScreenContainer } from "../../components/screen-container";

// Ícones e roteamento nativo do Expo
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// Biblioteca para desenhar gráficos vetoriais de alta performance
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";

// Captura a largura da tela para adaptar o tamanho do gráfico
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ==========================================================
   DADOS SIMULADOS (MOCK)
   Representa o consumo em litros e a eficiência em km/l por dia.
   No futuro, esses dados serão calculados automaticamente 
   com base no histórico salvo no Firebase/SQLite.
========================================================== */
const CONSUMPTION_DATA = [
  { day: "Segunda", consumption: 8.2, efficiency: 9.5 },
  { day: "Terça", consumption: 7.5, efficiency: 10.2 },
  { day: "Quarta", consumption: 9.1, efficiency: 8.8 },
  { day: "Quinta", consumption: 6.8, efficiency: 10.8 },
  { day: "Sexta", consumption: 10.2, efficiency: 7.9 },
  { day: "Sábado", consumption: 12.5, efficiency: 6.5 },
  { day: "Domingo", consumption: 5.3, efficiency: 11.2 },
];

export default function ConsumptionDetailsScreen() {
  // Estado para controlar qual dia o usuário tocou na lista inferior
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // ================= CÁLCULOS ESTATÍSTICOS =================
  const totalConsumption = CONSUMPTION_DATA.reduce((sum, d) => sum + d.consumption, 0); // Soma total de litros
  const avgConsumption = (totalConsumption / CONSUMPTION_DATA.length).toFixed(1); // Média de litros por dia
  const maxConsumption = Math.max(...CONSUMPTION_DATA.map((d) => d.consumption)); // Maior pico de consumo para dimensionar o gráfico
  const avgEfficiency = (CONSUMPTION_DATA.reduce((sum, d) => sum + d.efficiency, 0) / CONSUMPTION_DATA.length).toFixed(1); // Média de km/l

  // ================= DIMENSÕES DO GRÁFICO SVG =================
  const chartWidth = SCREEN_WIDTH - 40; // Largura total menos as bordas da tela
  const chartHeight = 220; // Altura fixa do quadro do gráfico
  const barWidth = (chartWidth - 40) / CONSUMPTION_DATA.length; // Largura de cada "fatia" diária do gráfico

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= HEADER (CABEÇALHO) ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Consumo Semanal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARDS DE RESUMO ================= */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <MaterialIcons name="local-gas-station" size={28} color="#FFC107" />
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{totalConsumption.toFixed(1)}L</Text>
          </View>
          <View style={styles.summaryCard}>
            <MaterialIcons name="trending-up" size={28} color="#00B4FF" />
            <Text style={styles.summaryLabel}>Média</Text>
            <Text style={styles.summaryValue}>{avgConsumption}L</Text>
          </View>
          <View style={styles.summaryCard}>
            <MaterialIcons name="speed" size={28} color="#4CAF50" />
            <Text style={styles.summaryLabel}>Eficiência</Text>
            <Text style={styles.summaryValue}>{avgEfficiency} km/l</Text>
          </View>
        </View>

        {/* ================= GRÁFICO DUPLO (SVG) ================= */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Consumo vs Eficiência</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              <LinearGradient id="consumptionGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFC107" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Linhas horizontais de demarcação do fundo (Grid) */}
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

            {/* BARRAS AMARELAS: Consumo de Combustível */}
            {CONSUMPTION_DATA.map((data, i) => {
              // Calcula altura baseada no maior consumo da semana (maxConsumption)
              const barHeight = (data.consumption / maxConsumption) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.1;
              return (
                <Rect
                  key={`consumption-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.35}
                  height={barHeight}
                  fill={selectedDay === i ? "#FFC107" : "#FFC10788"}
                  opacity={selectedDay === i ? 1 : 0.6}
                  rx={4}
                />
              );
            })}

            {/* BARRAS VERDES: Eficiência em Km/l */}
            {CONSUMPTION_DATA.map((data, i) => {
              // Altura baseada em um teto fixo (12 km/l no máximo para esse exemplo)
              const barHeight = (data.efficiency / 12) * (chartHeight - 60);
              // Desloca o eixo X um pouquinho (0.5) para ficar ao lado da barra amarela
              const x = 20 + i * barWidth + barWidth * 0.5; 
              return (
                <Rect
                  key={`efficiency-${i}`}
                  x={x}
                  y={chartHeight - 30 - barHeight}
                  width={barWidth * 0.35}
                  height={barHeight}
                  fill={selectedDay === i ? "#4CAF50" : "#4CAF5088"}
                  opacity={selectedDay === i ? 1 : 0.6}
                  rx={4}
                />
              );
            })}
          </Svg>

          {/* Rótulos de dias da semana (Seg, Ter, Qua...) */}
          <View style={styles.dayLabels}>
            {CONSUMPTION_DATA.map((data, i) => (
              <Text key={`day-${i}`} style={styles.dayLabel}>
                {data.day.substring(0, 3)}
              </Text>
            ))}
          </View>

          {/* Legenda de cores do Gráfico */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#FFC107" }]} />
              <Text style={styles.legendText}>Consumo (L)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#4CAF50" }]} />
              <Text style={styles.legendText}>Eficiência (km/l)</Text>
            </View>
          </View>
        </View>

        {/* ================= LISTAGEM DETALHADA DIÁRIA ================= */}
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>Detalhes Diários</Text>
          {CONSUMPTION_DATA.map((data, i) => (
            <Pressable
              key={`breakdown-${i}`}
              onPress={() => setSelectedDay(i)} // Gatilho que muda a cor do gráfico SVG
              style={[styles.breakdownItem, selectedDay === i && styles.breakdownItemActive]}
            >
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownDay}>{data.day}</Text>
                <View style={styles.breakdownBars}>
                  <View style={styles.breakdownBarSmall}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        {
                          width: `${(data.consumption / maxConsumption) * 100}%`,
                          backgroundColor: "#FFC107",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <View>
                  <Text style={styles.breakdownLabel}>Consumo</Text>
                  <Text style={styles.breakdownValue}>{data.consumption}L</Text>
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Eficiência</Text>
                  <Text style={styles.breakdownValue}>{data.efficiency} km/l</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ================= INSIGHTS (ANÁLISES RÁPIDAS) ================= */}
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Insights</Text>
          
          {/* MANUTENÇÃO FUTURA: Estes dados estão fixos, futuramente 
              fazer a lógica de buscar o maior/menor km/l na variável CONSUMPTION_DATA */}
          <View style={styles.insightItem}>
            <MaterialIcons name="trending-down" size={20} color="#4CAF50" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Melhor Dia</Text>
              <Text style={styles.insightValue}>Domingo - 11.2 km/l</Text>
            </View>
          </View>
          <View style={styles.insightItem}>
            <MaterialIcons name="trending-up" size={20} color="#FF6B35" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Pior Dia</Text>
              <Text style={styles.insightValue}>Sábado - 6.5 km/l</Text>
            </View>
          </View>
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

  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#12141A",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2235",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#8892A4",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFC107",
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
  dayLabels: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dayLabel: {
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
    backgroundColor: "#FFC10722",
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  breakdownLeft: {
    flex: 1,
    gap: 6,
  },
  breakdownDay: {
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
    color: "#FFC107",
  },

  insightsContainer: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    gap: 12,
  },
  insightsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  insightContent: {
    flex: 1,
  },
  insightLabel: {
    fontSize: 11,
    color: "#8892A4",
  },
  insightValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFC107",
  },
});