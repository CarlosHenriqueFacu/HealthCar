import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/* ==========================================================
   MANUTENÇÃO FUTURA: BANCO DE DADOS DE MANUTENÇÃO
   Estes arrays (OIL_HISTORY e MAINTENANCE_HISTORY) são mocks (dados falsos).
   Na versão final, eles deverão ser substituídos por chamadas a um
   banco de dados (como SQLite local ou Firebase) para que o usuário 
   possa adicionar novas manutenções pelo aplicativo.
========================================================== */
const OIL_HISTORY = [
  { date: "12/09/2025", km: "45.820", type: "Sintético 5W-30", next: "48.320" },
  { date: "15/03/2025", km: "43.100", type: "Sintético 5W-30", next: "45.600" },
  { date: "20/09/2024", km: "40.350", type: "Sintético 5W-30", next: "42.850" },
];

const MAINTENANCE_HISTORY = [
  { date: "12/09/2025", service: "Troca de óleo e filtro", km: "45.820", cost: "R$ 280" },
  { date: "15/03/2025", service: "Revisão dos freios", km: "43.100", cost: "R$ 450" },
  { date: "10/01/2025", service: "Alinhamento e balanceamento", km: "41.800", cost: "R$ 120" },
  { date: "20/09/2024", service: "Troca de velas de ignição", km: "40.350", cost: "R$ 380" },
  { date: "05/06/2024", service: "Filtro de ar e cabine", km: "38.900", cost: "R$ 95" },
];

// Dados para o Gráfico de Consumo Mensal (Litros por Mês)
const MONTHLY_FUEL = [18, 22, 19, 25, 21, 28, 24, 20, 26, 23, 19, 22];
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function ReportsScreen() {
  // MANUTENÇÃO: Este cálculo deve subtrair a quilometragem atual do veículo (lida via OBD2)
  // da meta de quilometragem da próxima troca para dar um valor real ao usuário.
  const kmToNextOil = 2400;
  
  // Descobre automaticamente o mês com maior consumo para nivelar o gráfico
  const maxFuel = Math.max(...MONTHLY_FUEL);

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= CABEÇALHO SUPERIOR ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Relatórios e Óleo</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE ALERTA: PRÓXIMA TROCA DE ÓLEO ================= */}
        <View style={styles.oilAlert}>
          <View style={[styles.oilIconWrap, { backgroundColor: "#FFB30022" }]}>
            <MaterialIcons name="opacity" size={24} color="#FFB300" />
          </View>
          <View style={styles.oilInfo}>
            <Text style={styles.oilAlertTitle}>Próxima Troca de Óleo</Text>
            <Text style={styles.oilAlertSub}>Faltam {kmToNextOil.toLocaleString("pt-BR")} km</Text>
          </View>
          <View style={styles.oilProgress}>
            <View style={styles.oilProgressTrack}>
              {/* MANUTENÇÃO: A propriedade 'width' deve ser um cálculo: 
                  (Km Rodados desde a última troca / Intervalo Total de Troca) * 100 */}
              <View style={[styles.oilProgressFill, { width: "52%" }]} />
            </View>
            <Text style={styles.oilProgressLabel}>52% do intervalo</Text>
          </View>
        </View>

        {/* ================= GRÁFICO: CONSUMO MENSAL DE COMBUSTÍVEL ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consumo Mensal</Text>
          <Text style={styles.sectionSub}>Litros abastecidos por mês (2025)</Text>
          <View style={styles.monthlyChart}>
            {/* O .map() percorre os 12 meses e desenha as barras proporcionalmente */}
            {MONTHLY_FUEL.map((val, i) => {
              const h = (val / maxFuel) * 80;
              const isMax = val === maxFuel;
              return (
                <View key={i} style={styles.monthBar}>
                  <Text style={[styles.monthVal, isMax && { color: "#00B4FF" }]}>{val}</Text>
                  <View style={styles.monthTrack}>
                    <View
                      style={[
                        styles.monthFill,
                        { height: h },
                        isMax && styles.monthFillMax,
                      ]}
                    />
                  </View>
                  <Text style={styles.monthLabel}>{MONTHS[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ================= TIMELINE: HISTÓRICO DE ÓLEO ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico de Óleo</Text>
          {OIL_HISTORY.map((item, i) => (
            <View key={i} style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <View style={[styles.historyDot, { backgroundColor: "#FFB300" }]} />
                {/* Linha conectora entre os pontos (não renderiza no último item) */}
                {i < OIL_HISTORY.length - 1 && <View style={styles.historyLine} />}
              </View>
              <View style={styles.historyContent}>
                <Text style={styles.historyDate}>{item.date}</Text>
                <Text style={styles.historyTitle}>{item.type}</Text>
                <Text style={styles.historySub}>
                  KM: {item.km} · Próx.: {item.next} km
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ================= LISTA: HISTÓRICO GERAL DE MANUTENÇÃO ================= */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico de Manutenção</Text>
          {MAINTENANCE_HISTORY.map((item, i) => (
            <View key={i} style={styles.mainCard}>
              <View style={styles.mainLeft}>
                <Text style={styles.mainDate}>{item.date}</Text>
                <Text style={styles.mainKm}>{item.km} km</Text>
              </View>
              <View style={styles.mainCenter}>
                <Text style={styles.mainService}>{item.service}</Text>
              </View>
              <Text style={styles.mainCost}>{item.cost}</Text>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  oilAlert: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FFB30033",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  oilIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  oilInfo: { flex: 1 },
  oilAlertTitle: { fontSize: 14, fontWeight: "600", color: "#F0F2FF", marginBottom: 2 },
  oilAlertSub: { fontSize: 12, color: "#FFB300" },
  oilProgress: { alignItems: "flex-end", gap: 4 },
  oilProgressTrack: {
    width: 80,
    height: 4,
    backgroundColor: "#1E2235",
    borderRadius: 2,
    overflow: "hidden",
  },
  oilProgressFill: {
    height: "100%",
    backgroundColor: "#FFB300",
    borderRadius: 2,
  },
  oilProgressLabel: { fontSize: 9, color: "#8892A4" },

  section: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  sectionSub: {
    fontSize: 11,
    color: "#8892A4",
    marginTop: -8,
  },

  monthlyChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 110,
    gap: 4,
  },
  monthBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  monthVal: {
    fontSize: 8,
    color: "#8892A4",
    marginBottom: 3,
  },
  monthTrack: {
    width: "100%",
    height: 80,
    backgroundColor: "#1E2235",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  monthFill: {
    width: "100%",
    backgroundColor: "#0090D4",
    borderRadius: 3,
    minHeight: 3,
  },
  monthFillMax: {
    backgroundColor: "#00B4FF",
  },
  monthLabel: {
    fontSize: 8,
    color: "#8892A4",
    marginTop: 4,
  },

  historyCard: {
    flexDirection: "row",
    gap: 12,
  },
  historyLeft: {
    alignItems: "center",
    width: 16,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  historyLine: {
    flex: 1,
    width: 1,
    backgroundColor: "#1E2235",
    marginTop: 4,
    marginBottom: -8,
  },
  historyContent: { flex: 1, paddingBottom: 12 },
  historyDate: { fontSize: 10, color: "#8892A4", marginBottom: 2 },
  historyTitle: { fontSize: 13, fontWeight: "600", color: "#F0F2FF", marginBottom: 2 },
  historySub: { fontSize: 11, color: "#8892A4" },

  mainCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  mainLeft: { minWidth: 68, gap: 2 },
  mainDate: { fontSize: 10, color: "#8892A4" },
  mainKm: { fontSize: 10, color: "#00B4FF" },
  mainCenter: { flex: 1 },
  mainService: { fontSize: 12, color: "#F0F2FF" },
  mainCost: { fontSize: 12, fontWeight: "600", color: "#00E676" },
});