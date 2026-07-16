import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Importação do componente de container base (Caminho corrigido para a nova arquitetura)
import { ScreenContainer } from "../../components/screen-container";

// Ícones e roteamento nativo do Expo
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// Biblioteca para desenhar o gráfico de barras vetorial
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";

// Captura a largura da tela do celular para o gráfico se adaptar automaticamente
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ==========================================================
   DADOS SIMULADOS (MOCK)
   Representa o consumo em litros (consumed) e se houve 
   abastecimento naquele dia (refilled).
   No futuro, virá do banco de dados (SQLite/Firebase).
========================================================== */
const FUEL_DATA = [
  { day: "Seg", consumed: 8.2, refilled: false },
  { day: "Ter", consumed: 7.5, refilled: false },
  { day: "Qua", consumed: 9.1, refilled: false },
  { day: "Qui", consumed: 6.8, refilled: false },
  { day: "Sex", consumed: 10.2, refilled: false },
  { day: "Sab", consumed: 12.5, refilled: true }, // Dia que foi ao posto
  { day: "Dom", consumed: 5.3, refilled: false },
];

export default function FuelDetailsScreen() {
  // Estado para controlar qual dia da semana o usuário clicou na lista inferior
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Lógica JS: Cálculos automáticos para as estatísticas
  const totalConsumed = FUEL_DATA.reduce((sum, d) => sum + d.consumed, 0); // Soma tudo
  const avgConsumption = (totalConsumed / FUEL_DATA.length).toFixed(1); // Média diária
  const maxConsumption = Math.max(...FUEL_DATA.map((d) => d.consumed)); // Acha o maior consumo para a altura máxima do gráfico

  // Variáveis de dimensionamento do gráfico SVG
  const chartWidth = SCREEN_WIDTH - 40; // Largura da tela menos as margens
  const chartHeight = 180;
  const barWidth = (chartWidth - 40) / FUEL_DATA.length; // Calcula a largura de cada barra para caber na tela

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= HEADER (CABEÇALHO) ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Combustível</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= STATUS ATUAL (CARD SUPERIOR) ================= */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="local-gas-station" size={32} color="#FFC107" />
            <View>
              <Text style={styles.statusLabel}>Nível Atual</Text>
              <Text style={styles.statusValue}>62%</Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={styles.statusRange}>~372 km</Text>
            <Text style={styles.statusRangeLabel}>de autonomia</Text>
          </View>
        </View>

        {/* ================= ESTATÍSTICAS RÁPIDAS ================= */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Semana</Text>
            <Text style={styles.statValue}>{totalConsumed.toFixed(1)}L</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Média Diária</Text>
            <Text style={styles.statValue}>{avgConsumption}L</Text>
          </View>
        </View>

        {/* ================= GRÁFICO DE BARRAS (SEMANAL) ================= */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Consumo Semanal</Text>
          <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
            <Defs>
              {/* Efeito de degradê nas barras */}
              <LinearGradient id="fuelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFC107" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Linhas horizontais de fundo do gráfico (0 a 100%) */}
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

            {/* Desenha as Barras de Consumo */}
            {FUEL_DATA.map((data, i) => {
              // Matemática para calcular a altura da barra proporcional ao maior consumo
              const barHeight = (data.consumed / maxConsumption) * (chartHeight - 60);
              const x = 20 + i * barWidth + barWidth * 0.1;
              const y = chartHeight - 30 - barHeight;
              
              return (
                <Rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barWidth * 0.8}
                  height={barHeight}
                  // Muda a cor da barra se o usuário tiver tocado no dia correspondente lá embaixo
                  fill={selectedDay === i ? "#FFC107" : "#FFC10788"}
                  opacity={selectedDay === i ? 1 : 0.7}
                  rx={4} // Arredonda as pontas da barra
                />
              );
            })}
          </Svg>

          {/* Rótulos dos Dias da Semana (Seg, Ter, Qua...) embaixo do gráfico */}
          <View style={styles.dayLabels}>
            {FUEL_DATA.map((data, i) => (
              <Text key={`day-${i}`} style={styles.dayLabel}>
                {data.day}
              </Text>
            ))}
          </View>
        </View>

        {/* ================= HISTÓRICO DE ABASTECIMENTOS ================= */}
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Histórico de Abastecimentos</Text>
          
          {/* Verifica se existe algum dia com 'refilled: true' */}
          {FUEL_DATA.filter((d) => d.refilled).length > 0 ? (
            FUEL_DATA.map((data, i) => (
              data.refilled && (
                <View key={`refill-${i}`} style={styles.refillItem}>
                  <MaterialIcons name="local-gas-station" size={20} color="#4CAF50" />
                  <View style={styles.refillContent}>
                    <Text style={styles.refillDay}>{data.day}</Text>
                    <Text style={styles.refillTime}>Abastecimento completo</Text>
                  </View>
                  <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                </View>
              )
            ))
          ) : (
            <Text style={styles.noRefillText}>Nenhum abastecimento registrado</Text>
          )}
        </View>

        {/* ================= LISTA DIÁRIA DETALHADA ================= */}
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownTitle}>Consumo Diário</Text>
          {FUEL_DATA.map((data, i) => (
            <Pressable
              key={`breakdown-${i}`}
              // Quando o usuário clica na linha, atualiza o gráfico lá em cima
              onPress={() => setSelectedDay(i)}
              style={[styles.breakdownItem, selectedDay === i && styles.breakdownItemActive]}
            >
              <Text style={styles.breakdownDay}>{data.day}</Text>
              
              {/* Barrinha horizontal de proporção de consumo */}
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownBarFill,
                    { width: `${(data.consumed / maxConsumption) * 100}%` }, // Largura dinâmica via CSS
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{data.consumed}L</Text>
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
    color: "#FFC107",
  },
  statusRight: {
    alignItems: "flex-end",
  },
  statusRange: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFC107",
  },
  statusRangeLabel: {
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
  },
  dayLabel: {
    fontSize: 10,
    color: "#8892A4",
    fontWeight: "600",
  },

  historyContainer: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 12,
  },
  refillItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  refillContent: {
    flex: 1,
  },
  refillDay: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  refillTime: {
    fontSize: 11,
    color: "#8892A4",
  },
  noRefillText: {
    fontSize: 12,
    color: "#8892A4",
    fontStyle: "italic",
    paddingVertical: 8,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  breakdownItemActive: {
    backgroundColor: "#FFC10722",
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  breakdownDay: {
    width: 40,
    fontSize: 12,
    color: "#8892A4",
    fontWeight: "600",
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#1E2235",
    borderRadius: 3,
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    backgroundColor: "#FFC107",
    borderRadius: 3,
  },
  breakdownValue: {
    width: 40,
    fontSize: 12,
    fontWeight: "700",
    color: "#FFC107",
    textAlign: "right",
  },
});