import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/* ==========================================================
   MANUTENÇÃO FUTURA: BANCO DE DADOS DE FALHAS (DTCs)
   Estes são dados "Mockados" (falsos) apenas para testar a interface.
   No futuro, quando o ELM327 enviar um código (ex: "03"), nós 
   vamos ler a resposta hexadecimal, traduzir para "P0300" e 
   substituir esta lista pela lista real que veio do carro.
========================================================== */
const FAULT_CODES = [
  {
    code: "P0300",
    desc: "Falha de ignição aleatória detectada",
    severity: "critical" as const,
    system: "Motor",
  },
  {
    code: "P0420",
    desc: "Eficiência do catalisador abaixo do limiar",
    severity: "warning" as const,
    system: "Emissões",
  },
  {
    code: "P0171",
    desc: "Mistura ar/combustível pobre (Banco 1)",
    severity: "warning" as const,
    system: "Combustível",
  },
];

/* ==========================================================
   DICIONÁRIO DE SEVERIDADE (DESIGN SYSTEM)
   Controla automaticamente as cores e ícones baseados no nível de perigo da falha.
   Isso evita o uso de vários "If/Else" no meio da tela.
========================================================== */
const SEVERITY_CONFIG = {
  critical: { color: "#FF3D57", bg: "#FF3D5722", label: "Crítico", icon: "error" as const },
  warning: { color: "#FFB300", bg: "#FFB30022", label: "Aviso", icon: "warning" as const },
  resolved: { color: "#00E676", bg: "#00E67622", label: "Resolvido", icon: "check-circle" as const },
};

export default function ScannerScreen() {
  // Variáveis de Estado (Memória da Tela)
  const [scanning, setScanning] = useState(false);
  
  // MANUTENÇÃO: Este valor (74) será calculado dinamicamente depois, 
  // baseado na quantidade de erros que o carro retornar.
  const healthScore = 74;

  // Função que simula o botão de "Escanear Novamente"
  function handleScan() {
    setScanning(true);
    // Finge que está lendo o carro por 2 segundos e depois para
    setTimeout(() => setScanning(false), 2000);
  }

  // Função para abrir o pop-up de agendamento de oficina
  function handleSchedule() {
    Alert.alert(
      "Agendar Revisão",
      "Deseja agendar uma revisão na oficina mais próxima?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Agendar", onPress: () => Alert.alert("Sucesso", "Revisão agendada para 20/03/2026!") },
      ]
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* ================= CABEÇALHO SUPERIOR ================= */}
      <View style={styles.header}>
        {/* Botão de voltar seguro do Expo Router */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scanner de Falhas</Text>
        
        {/* Ícone de recarregar no canto superior direito */}
        <Pressable onPress={handleScan} style={styles.scanBtn}>
          <MaterialIcons name="refresh" size={20} color="#00B4FF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE SAÚDE DO VEÍCULO ================= */}
        <View style={styles.healthCard}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthLabel}>Saúde do Veículo</Text>
            <Text style={styles.healthScore}>{healthScore}</Text>
            <Text style={styles.healthUnit}>/ 100</Text>
          </View>
          <View style={styles.healthRight}>
            <View style={styles.healthBar}>
              {/* MANUTENÇÃO: A largura desta barra amarela muda sozinha baseada no healthScore */}
              <View style={[styles.healthFill, { width: `${healthScore}%` as any }]} />
            </View>
            <Text style={styles.healthStatus}>Atenção necessária</Text>
            <Text style={styles.healthSub}>{FAULT_CODES.length} erros encontrados</Text>
          </View>
        </View>

        {/* ================= LISTA DINÂMICA DE ERROS (DTCs) ================= */}
        <Text style={styles.sectionTitle}>Códigos de Falha</Text>
        
        {/* O comando .map() percorre a nossa lista FAULT_CODES e desenha um card para cada erro */}
        {FAULT_CODES.map((fault) => {
          // Puxa as cores certas (vermelho para crítico, amarelo para aviso)
          const cfg = SEVERITY_CONFIG[fault.severity];
          
          return (
            <View key={fault.code} style={styles.faultCard}>
              <View style={[styles.faultIconWrap, { backgroundColor: cfg.bg }]}>
                <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
              </View>
              <View style={styles.faultInfo}>
                <View style={styles.faultHeader}>
                  <Text style={styles.faultCode}>{fault.code}</Text>
                  <View style={[styles.faultBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.faultBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <Text style={styles.faultDesc}>{fault.desc}</Text>
                <Text style={styles.faultSystem}>{fault.system}</Text>
              </View>
            </View>
          );
        })}

        {/* ================= BOTÕES DE AÇÃO INFERIORES ================= */}
        
        {/* Botão Azul de Agendar Oficina */}
        <Pressable
          onPress={handleSchedule}
          style={({ pressed }) => [styles.scheduleBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="event" size={20} color="#0A0A0F" />
          <Text style={styles.scheduleBtnText}>Agendar Revisão</Text>
        </Pressable>

        {/* Botão Secundário de Escanear de Novo */}
        <Pressable
          onPress={handleScan}
          style={({ pressed }) => [styles.rescanBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="wifi-tethering" size={18} color="#00B4FF" />
          {/* Se estiver escaneando, muda o texto automaticamente */}
          <Text style={styles.rescanBtnText}>
            {scanning ? "Escaneando..." : "Novo Escaneamento"}
          </Text>
        </Pressable>
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
  scanBtn: {
    padding: 4,
    backgroundColor: "#00B4FF22",
    borderRadius: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  healthCard: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  healthLeft: { alignItems: "center", justifyContent: "center", minWidth: 70 },
  healthLabel: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  healthScore: { fontSize: 42, fontWeight: "800", color: "#FFB300", fontVariant: ["tabular-nums"] },
  healthUnit: { fontSize: 12, color: "#8892A4" },
  healthRight: { flex: 1, justifyContent: "center", gap: 8 },
  healthBar: {
    height: 6,
    backgroundColor: "#1E2235",
    borderRadius: 3,
    overflow: "hidden",
  },
  healthFill: {
    height: "100%",
    backgroundColor: "#FFB300",
    borderRadius: 3,
  },
  healthStatus: { fontSize: 14, fontWeight: "600", color: "#FFB300" },
  healthSub: { fontSize: 12, color: "#8892A4" },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8892A4",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 4,
  },

  faultCard: {
    backgroundColor: "#12141A",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E2235",
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  faultIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  faultInfo: { flex: 1 },
  faultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  faultCode: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F0F2FF",
    fontVariant: ["tabular-nums"],
  },
  faultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  faultBadgeText: { fontSize: 10, fontWeight: "600" },
  faultDesc: { fontSize: 12, color: "#8892A4", lineHeight: 18, marginBottom: 2 },
  faultSystem: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5 },

  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00B4FF",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  scheduleBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A0A0F",
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#12141A",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#00B4FF44",
  },
  rescanBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00B4FF",
  },
});