import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Importação do componente de container base (Caminho corrigido para a nova arquitetura)
import { ScreenContainer } from "../../components/screen-container";

// Ícones e roteamento nativo do Expo
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

// Biblioteca para desenhar gráficos vetoriais complexos (O círculo da bateria)
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

/* ==========================================================
   DADOS SIMULADOS (MOCK)
   Estes dados servem para a demonstração visual.
   No futuro, podem ser substituídos por dados reais lidos
   do banco de dados SQLite/Firebase.
========================================================== */
const BATTERY_DATA = [
  { time: "08:00", charge: 100, health: 98 },
  { time: "10:00", charge: 95, health: 98 },
  { time: "12:00", charge: 88, health: 97 },
  { time: "14:00", charge: 82, health: 97 },
  { time: "16:00", charge: 75, health: 96 },
  { time: "18:00", charge: 68, health: 96 },
  { time: "20:00", charge: 62, health: 95 },
];

export default function BatteryDetailsScreen() {
  // Variáveis de estado atuais (Para exibição no topo da tela)
  const currentCharge = 62;
  const currentHealth = 95;

  // Lógica JS: Calcula a média de carga somando todos os valores do BATTERY_DATA e dividindo pela quantidade
  const avgCharge = Math.round(BATTERY_DATA.reduce((sum, d) => sum + d.charge, 0) / BATTERY_DATA.length);

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= HEADER (CABEÇALHO) ================= */}
      <View style={styles.header}>
        {/* Botão de Voltar: Usa o router.back() para retornar à tela anterior sem criar novas rotas */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Bateria</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= GRÁFICO CIRCULAR (SVG) ================= */}
        <View style={styles.circleContainer}>
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Defs>
              {/* Cria o efeito de gradiente verde para a linha da bateria */}
              <LinearGradient id="batteryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#4CAF50" />
                <Stop offset="100%" stopColor="#8BC34A" />
              </LinearGradient>
            </Defs>
            
            {/* Círculo de Fundo (A trilha cinza escura) */}
            <Circle cx={100} cy={100} r={90} fill="none" stroke="#1E2235" strokeWidth={8} />
            
            {/* Círculo de Progresso (A linha verde que acompanha a carga) */}
            <Circle
              cx={100}
              cy={100}
              r={90}
              fill="none"
              stroke="url(#batteryGrad)"
              strokeWidth={8}
              /* MATEMÁTICA DO SVG: 
                 Calcula o preenchimento da linha baseado na porcentagem (currentCharge).
                 180 * Math.PI é a circunferência total do círculo. */
              strokeDasharray={`${(currentCharge / 100) * (180 * Math.PI)} ${180 * Math.PI}`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)" // Gira o círculo para a linha começar de cima
            />
          </Svg>
          
          {/* Textos que ficam centralizados dentro do círculo */}
          <View style={styles.circleContent}>
            <Text style={styles.circleValue}>{currentCharge}%</Text>
            <Text style={styles.circleLabel}>Carga</Text>
          </View>
        </View>

        {/* ================= CARDS DE ESTATÍSTICAS ================= */}
        <View style={styles.statsRow}>
          {/* Card de Saúde da Bateria */}
          <View style={styles.statCard}>
            <MaterialIcons name="favorite" size={20} color="#4CAF50" />
            <Text style={styles.statLabel}>Saúde</Text>
            <Text style={styles.statValue}>{currentHealth}%</Text>
          </View>
          
          {/* Card de Média de Carga */}
          <View style={styles.statCard}>
            <MaterialIcons name="trending-down" size={20} color="#FF9800" />
            <Text style={styles.statLabel}>Média</Text>
            <Text style={styles.statValue}>{avgCharge}%</Text>
          </View>
        </View>

        {/* ================= TIMELINE (HISTÓRICO) ================= */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>Histórico de Carga</Text>
          
          {/* O método .map() percorre o array BATTERY_DATA e "desenha" uma linha na tela para cada item */}
          {BATTERY_DATA.map((data, i) => (
            <View key={`battery-${i}`} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>{data.time}</Text>
                
                {/* Barrinha horizontal de progresso de cada horário */}
                <View style={styles.timelineBar}>
                  <View
                    style={[
                      styles.timelineBarFill,
                      { width: `${data.charge}%` }, // O CSS width é dinâmico baseado na carga
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.timelineValue}>{data.charge}%</Text>
            </View>
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

  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  circleContent: {
    position: "absolute",
    alignItems: "center",
  },
  circleValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#4CAF50",
  },
  circleLabel: {
    fontSize: 12,
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
    gap: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#8892A4",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4CAF50",
  },

  timelineContainer: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F0F2FF",
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: "#8892A4",
    fontWeight: "600",
  },
  timelineBar: {
    height: 4,
    backgroundColor: "#1E2235",
    borderRadius: 2,
    overflow: "hidden",
  },
  timelineBarFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 2,
  },
  timelineValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4CAF50",
  },
});