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
import RNBluetoothClassic from "react-native-bluetooth-classic";

/* ==========================================================
   DICIONÁRIO DE ERROS (DTCs) E SEVERIDADE
========================================================== */
const SEVERITY_CONFIG = {
  critical: { color: "#FF3D57", bg: "#FF3D5722", label: "Crítico", icon: "error" as const },
  warning: { color: "#FFB300", bg: "#FFB30022", label: "Aviso", icon: "warning" as const },
  resolved: { color: "#00E676", bg: "#00E67622", label: "Resolvido", icon: "check-circle" as const },
};

// Dicionário para traduzir o código seco (Ex: P0300) para texto humano
const DTC_DICTIONARY: Record<string, { desc: string, system: string, severity: "critical" | "warning" }> = {
  "P0300": { desc: "Falha de ignição aleatória detectada", system: "Motor", severity: "critical" },
  "P0420": { desc: "Eficiência do catalisador abaixo do limiar", system: "Emissões", severity: "warning" },
  "P0171": { desc: "Mistura ar/combustível pobre (Banco 1)", system: "Combustível", severity: "warning" },
  "P0113": { desc: "Entrada alta no circuito de temperatura do ar", system: "Admissão", severity: "warning" },
  "P0500": { desc: "Mau funcionamento do sensor de velocidade", system: "Transmissão", severity: "critical" },
};

// Dados simulados para apresentação caso o carro não esteja conectado
const MOCK_FAULTS = [
  { code: "P0300", desc: DTC_DICTIONARY["P0300"].desc, severity: "critical" as const, system: "Motor" },
  { code: "P0420", desc: DTC_DICTIONARY["P0420"].desc, severity: "warning" as const, system: "Emissões" },
];

export default function ScannerScreen() {
  const [scanning, setScanning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [faults, setFaults] = useState<any[]>(MOCK_FAULTS); // Começa com os dados falsos para a tela não ficar vazia

  // Lógica Matemática da Saúde do Carro
  const healthScore = Math.max(0, 100 - (faults.length * 13)); // Cada erro tira 13 pontos
  const isHealthy = faults.length === 0;

  /* ==========================================================
     CÉREBRO DO OBD-II: LEITURA E TRADUÇÃO DE DTCs
  ========================================================== */
  async function handleScan() {
    setScanning(true);
    setFaults([]); // Limpa a tela para dar efeito visual de busca

    try {
      const devices = await RNBluetoothClassic.getConnectedDevices();
      
      if (devices.length > 0) {
        const device = devices[0];
        
        // Manda o comando de leitura de erros (Modo 03)
        await device.write("03\r");
        const resp = await device.read();
        
        // Traduz a resposta hexadecimal para códigos como "P0420"
        const codes = parseDTC(String(resp));
        
        // Monta os cards de erro baseados no dicionário
        const newFaults = codes.map((code) => ({
          code: code,
          desc: DTC_DICTIONARY[code]?.desc || "Erro desconhecido ou específico da montadora",
          system: DTC_DICTIONARY[code]?.system || "Sistema Elétrico",
          severity: DTC_DICTIONARY[code]?.severity || "warning",
        }));
        
        setFaults(newFaults);
      } else {
        throw new Error("Não conectado");
      }
    } catch (error) {
      // MODO SIMULAÇÃO: Se falhar (sem carro), finge que achou os erros do mock após 2 segundos
      setTimeout(() => {
        setFaults(MOCK_FAULTS);
      }, 1800);
    } finally {
      setTimeout(() => setScanning(false), 1800);
    }
  }

  /* ==========================================================
     CÉREBRO DO OBD-II: LIMPEZA DE ERROS DA ECU
  ========================================================== */
  async function handleClearErrors() {
    Alert.alert(
      "Atenção!",
      "Isso enviará um comando para a ECU apagar a memória de falhas e desligar a luz de injeção. Deseja prosseguir?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Apagar", 
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              const devices = await RNBluetoothClassic.getConnectedDevices();
              if (devices.length > 0) {
                // Comando 04 apaga os erros
                await devices[0].write("04\r");
                await devices[0].read(); // Lê o "OK"
                setFaults([]);
                Alert.alert("Sucesso", "A memória de falhas foi apagada com sucesso.");
              } else {
                throw new Error("Não conectado");
              }
            } catch (e) {
              // Simulação
              setTimeout(() => {
                setFaults([]);
                Alert.alert("Sucesso (Modo Simulação)", "Erros apagados virtualmente.");
              }, 1000);
            } finally {
              setClearing(false);
            }
          }
        },
      ]
    );
  }

  /* ==========================================================
     TRADUTOR HEXADECIMAL -> DTC (P0000)
  ========================================================== */
  function parseDTC(response: string): string[] {
    if (!response || response.includes("NO DATA") || response.includes("OK")) return [];
    
    const cleanResp = response.replace(/\s/g, "").toUpperCase();
    const index = cleanResp.indexOf("43"); // 43 é a resposta de sucesso do comando 03
    if (index === -1) return [];

    const hexData = cleanResp.substring(index + 2);
    const codes = [];

    // O OBD retorna os erros em blocos de 4 caracteres (Ex: 0133 0420)
    for (let i = 0; i < hexData.length; i += 4) {
      const dtcHex = hexData.substring(i, i + 4);
      if (dtcHex.length === 4 && dtcHex !== "0000") {
        const firstChar = dtcHex[0];
        let letter = "P";
        let secondDigit = "0";

        // Matemática universal de chassi OBD2
        if (["0","1","2","3"].includes(firstChar)) { letter = "P"; secondDigit = firstChar; }
        else if (["4","5","6","7"].includes(firstChar)) { letter = "C"; secondDigit = (parseInt(firstChar) - 4).toString(); }
        else if (["8","9","A","B"].includes(firstChar)) { letter = "B"; secondDigit = (parseInt(firstChar, 16) - 8).toString(); }
        else if (["C","D","E","F"].includes(firstChar)) { letter = "U"; secondDigit = (parseInt(firstChar, 16) - 12).toString(); }

        codes.push(`${letter}${secondDigit}${dtcHex.substring(1)}`);
      }
    }
    return codes;
  }

  function handleSchedule() {
    Alert.alert(
      "Agendar Revisão",
      "Deseja agendar uma revisão na oficina mais próxima?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Agendar", onPress: () => Alert.alert("Sucesso", "Revisão agendada!") },
      ]
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Scanner OBD-II</Text>
        <Pressable onPress={handleScan} style={styles.scanBtn}>
          <MaterialIcons name="refresh" size={20} color="#00B4FF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE SAÚDE DINÂMICO ================= */}
        <View style={styles.healthCard}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthLabel}>Saúde do Veículo</Text>
            <Text style={[styles.healthScore, isHealthy && { color: "#00E676" }]}>{healthScore}</Text>
            <Text style={styles.healthUnit}>/ 100</Text>
          </View>
          <View style={styles.healthRight}>
            <View style={styles.healthBar}>
              <View style={[
                styles.healthFill, 
                { width: `${healthScore}%` as any, backgroundColor: isHealthy ? "#00E676" : "#FFB300" }
              ]} />
            </View>
            <Text style={[styles.healthStatus, isHealthy && { color: "#00E676" }]}>
              {isHealthy ? "Em perfeito estado" : "Atenção necessária"}
            </Text>
            <Text style={styles.healthSub}>
              {scanning ? "Analisando ECU..." : `${faults.length} erro(s) encontrado(s)`}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Códigos de Falha</Text>
        
        {/* ================= MENSAGEM SE NÃO TIVER ERROS ================= */}
        {!scanning && faults.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={48} color="#00E676" style={{ opacity: 0.8 }} />
            <Text style={styles.emptyTitle}>Nenhuma falha detectada!</Text>
            <Text style={styles.emptyDesc}>A injeção eletrônica não reportou nenhum código de erro ativo ou pendente.</Text>
          </View>
        )}

        {/* ================= LISTA DE ERROS ================= */}
        {faults.map((fault, index) => {
          const cfg = SEVERITY_CONFIG[fault.severity as keyof typeof SEVERITY_CONFIG];
          return (
            <View key={index} style={styles.faultCard}>
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

        {/* ================= BOTÕES DE AÇÃO ================= */}
        {faults.length > 0 && (
          <>
            <Pressable onPress={handleClearErrors} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="delete-sweep" size={20} color="#FF3D57" />
              <Text style={styles.clearBtnText}>{clearing ? "Apagando..." : "Apagar Memória de Falhas"}</Text>
            </Pressable>

            <Pressable onPress={handleSchedule} style={({ pressed }) => [styles.scheduleBtn, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="event" size={20} color="#0A0A0F" />
              <Text style={styles.scheduleBtnText}>Agendar Revisão</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={handleScan} style={({ pressed }) => [styles.rescanBtn, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="wifi-tethering" size={18} color="#00B4FF" />
          <Text style={styles.rescanBtnText}>{scanning ? "Escaneando a ECU..." : "Novo Escaneamento"}</Text>
        </Pressable>

      </ScrollView>
    </ScreenContainer>
  );
}

// ================= ESTILOS (CSS in JS) =================
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1E2235" },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#F0F2FF" },
  scanBtn: { padding: 6, backgroundColor: "#00B4FF22", borderRadius: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  healthCard: { backgroundColor: "#12141A", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1E2235", flexDirection: "row", gap: 16, marginBottom: 4 },
  healthLeft: { alignItems: "center", justifyContent: "center", minWidth: 70 },
  healthLabel: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  healthScore: { fontSize: 42, fontWeight: "800", color: "#FFB300", fontVariant: ["tabular-nums"] },
  healthUnit: { fontSize: 12, color: "#8892A4" },
  healthRight: { flex: 1, justifyContent: "center", gap: 8 },
  healthBar: { height: 6, backgroundColor: "#1E2235", borderRadius: 3, overflow: "hidden" },
  healthFill: { height: "100%", backgroundColor: "#FFB300", borderRadius: 3 },
  healthStatus: { fontSize: 14, fontWeight: "600", color: "#FFB300" },
  healthSub: { fontSize: 12, color: "#8892A4" },

  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#8892A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, marginTop: 4 },

  emptyState: { alignItems: "center", paddingVertical: 30, backgroundColor: "#12141A", borderRadius: 16, borderWidth: 1, borderColor: "#1E2235", borderStyle: "dashed", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#F0F2FF", marginTop: 8 },
  emptyDesc: { fontSize: 12, color: "#8892A4", textAlign: "center", paddingHorizontal: 20 },

  faultCard: { backgroundColor: "#12141A", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1E2235", flexDirection: "row", gap: 12, alignItems: "flex-start" },
  faultIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  faultInfo: { flex: 1 },
  faultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  faultCode: { fontSize: 15, fontWeight: "700", color: "#F0F2FF", fontVariant: ["tabular-nums"] },
  faultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  faultBadgeText: { fontSize: 10, fontWeight: "600" },
  faultDesc: { fontSize: 12, color: "#8892A4", lineHeight: 18, marginBottom: 2 },
  faultSystem: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5 },

  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5711", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: "700", color: "#FF3D57" },
  scheduleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00B4FF", borderRadius: 14, paddingVertical: 14 },
  scheduleBtnText: { fontSize: 15, fontWeight: "700", color: "#0A0A0F" },
  rescanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#12141A", borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#00B4FF44", marginTop: 8 },
  rescanBtnText: { fontSize: 14, fontWeight: "600", color: "#00B4FF" },
});