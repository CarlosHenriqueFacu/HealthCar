import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

// === ESTADO GLOBAL ===
import { useApp } from '../contexts/AppContext';

// Importacao da ponte nativa Java desenvolvida para o TCC
const { OBDBluetooth } = NativeModules;

/* ==========================================================
   DICIONARIO DE ERROS (DTCs) E SEVERIDADE
========================================================== */
const SEVERITY_CONFIG = {
  critical: { color: "#FF3D57", bg: "#FF3D5722", labelKey: "critico", icon: "error" as const },
  warning: { color: "#FFB300", bg: "#FFB30022", labelKey: "aviso", icon: "warning" as const },
  resolved: { color: "#00E676", bg: "#00E67622", labelKey: "resolvido", icon: "check-circle" as const },
};

const DTC_DICTIONARY: Record<string, { desc: string, system: string, severity: "critical" | "warning" }> = {
  "P0300": { desc: "Falha de ignição aleatória detectada", system: "Motor", severity: "critical" },
  "P0420": { desc: "Eficiência do catalisador abaixo do limiar", system: "Emissões", severity: "warning" },
  "P0171": { desc: "Mistura ar/combustível pobre (Banco 1)", system: "Combustível", severity: "warning" },
  "P0113": { desc: "Entrada alta no circuito de temperatura do ar", system: "Admissão", severity: "warning" },
  "P0500": { desc: "Mau funcionamento do sensor de velocidade", system: "Transmissão", severity: "critical" },
};

export default function ScannerScreen() {
  // === ESTADO GLOBAL DE TEMA E IDIOMA ===
  const { theme, t } = useApp();
  
  // === PALETA DE CORES DINÂMICA ===
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  const [scanning, setScanning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [faults, setFaults] = useState<any[]>([]);

  const healthScore = Math.max(0, 100 - (faults.length * 13));
  const isHealthy = faults.length === 0 && !scanning;

  // Cleanup garantido ao sair da tela do scanner
  useEffect(() => {
    return () => {
      if (OBDBluetooth) {
        OBDBluetooth.disconnect().catch(() => {});
      }
    };
  }, []);

  /* ==========================================================
     HELPER: CONECTAR AO SCANNER
  ========================================================== */
  async function connectToScanner() {
    const devices = await RNBluetoothClassic.getBondedDevices();
    const obdDevice = devices.find((d: any) => 
      d.name && (
        d.name.toUpperCase().includes("OBD") || 
        d.name.toUpperCase().includes("ELM") ||
        d.name.toUpperCase().includes("VLINK")
      )
    );
    
    if (!obdDevice) throw new Error("Nenhum scanner pareado");
    
    await OBDBluetooth.connect(obdDevice.address);
    
    // Acorda o scanner antes de ler
    await OBDBluetooth.sendCommand("ATZ");
    await new Promise(resolve => setTimeout(resolve, 1500));
    await OBDBluetooth.sendCommand("ATE0");
    await OBDBluetooth.sendCommand("ATSP0");
    await OBDBluetooth.sendCommand("0100"); // Sincroniza a rede CAN
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /* ==========================================================
     CEREBRO DO OBD-II: LEITURA E TRADUCAO DE DTCs
  ========================================================== */
  async function handleScan() {
    setScanning(true);
    setFaults([]); 

    try {
      await connectToScanner(); // Abre a porta e inicializa

      const resp = await OBDBluetooth.sendCommand("03");
      
      if (!resp || String(resp).includes("TIMEOUT") || String(resp).includes("INCOMPLETO")) {
        throw new Error("Sem resposta do scanner");
      }

      const codes = parseDTC(String(resp));
      
      const newFaults = codes.map((code) => ({
        code: code,
        desc: DTC_DICTIONARY[code]?.desc || "Erro desconhecido ou específico da montadora",
        system: DTC_DICTIONARY[code]?.system || "Sistema Elétrico",
        severity: DTC_DICTIONARY[code]?.severity || "warning",
      }));
      
      setFaults(newFaults);
    } catch (error) {
      Alert.alert("Erro de Leitura", "Não foi possível ler a ECU. Verifique se o scanner está conectado e a ignição ligada.");
    } finally {
      // Libera o Bluetooth para outros usos
      await OBDBluetooth.disconnect().catch(() => {});
      setScanning(false);
    }
  }

  /* ==========================================================
     CEREBRO DO OBD-II: LIMPEZA DE ERROS
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
              await connectToScanner(); // Precisa conectar para apagar também!
              await OBDBluetooth.sendCommand("04");
              setFaults([]);
              Alert.alert("Sucesso", "A memória de falhas foi apagada com sucesso.");
            } catch (e) {
              Alert.alert("Erro de Comunicação", "Falha ao enviar comando de limpeza para a ECU.");
            } finally {
              await OBDBluetooth.disconnect().catch(() => {});
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
    const index = cleanResp.indexOf("43");
    if (index === -1) return [];

    const hexData = cleanResp.substring(index + 2);
    const codes = [];

    for (let i = 0; i < hexData.length; i += 4) {
      const dtcHex = hexData.substring(i, i + 4);
      if (dtcHex.length === 4 && dtcHex !== "0000") {
        const firstChar = dtcHex[0];
        let letter = "P";
        let secondDigit = "0";

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
      t('agendarRevisao'),
      "Deseja agendar uma revisão na oficina mais próxima?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Agendar", onPress: () => Alert.alert("Sucesso", "Revisão agendada!") },
      ]
    );
  }

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('tituloScanner')}</Text>
        <Pressable onPress={handleScan} style={[styles.scanBtn, !isDark && { backgroundColor: '#E0F2FE' }]} disabled={scanning}>
          <MaterialIcons name="refresh" size={20} color={scanning ? subTextColor : "#00B4FF"} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= CARD DE SAUDE DINAMICO ================= */}
        <View style={[styles.healthCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.healthLeft}>
            <Text style={[styles.healthLabel, { color: subTextColor }]}>{t('saudeVeiculo')}</Text>
            <Text style={[styles.healthScore, isHealthy && { color: "#00E676" }]}>{healthScore}</Text>
            <Text style={[styles.healthUnit, { color: subTextColor }]}>/ 100</Text>
          </View>
          <View style={styles.healthRight}>
            <View style={[styles.healthBar, { backgroundColor: borderColor }]}>
              <View style={[
                styles.healthFill, 
                { width: `${healthScore}%` as any, backgroundColor: isHealthy ? "#00E676" : "#FFB300" }
              ]} />
            </View>
            <Text style={[styles.healthStatus, isHealthy && { color: "#00E676" }]}>
              {isHealthy ? t('emPerfeitoEstado') : t('atencaoNecessaria')}
            </Text>
            <Text style={[styles.healthSub, { color: subTextColor }]}>
              {scanning ? t('analisandoEcu') : `${faults.length} ${t('errosEncontrados')}`}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>{t('codigosFalha')}</Text>
        
        {/* ================= MENSAGEM SE NAO TIVER ERROS ================= */}
        {!scanning && faults.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="check-circle" size={48} color="#00E676" style={{ opacity: 0.8 }} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>{t('nenhumaFalha')}</Text>
            <Text style={[styles.emptyDesc, { color: subTextColor }]}>{t('nenhumaFalhaDesc')}</Text>
          </View>
        )}

        {/* ================= LISTA DE ERROS ================= */}
        {faults.map((fault, index) => {
          const cfg = SEVERITY_CONFIG[fault.severity as keyof typeof SEVERITY_CONFIG];
          return (
            <View key={index} style={[styles.faultCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={[styles.faultIconWrap, { backgroundColor: cfg.bg }]}>
                <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
              </View>
              <View style={styles.faultInfo}>
                <View style={styles.faultHeader}>
                  <Text style={[styles.faultCode, { color: textColor }]}>{fault.code}</Text>
                  <View style={[styles.faultBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.faultBadgeText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                  </View>
                </View>
                <Text style={[styles.faultDesc, { color: subTextColor }]}>{fault.desc}</Text>
                <Text style={[styles.faultSystem, { color: subTextColor }]}>{fault.system}</Text>
              </View>
            </View>
          );
        })}

        {/* ================= BOTOES DE ACAO ================= */}
        {faults.length > 0 && (
          <>
            <Pressable onPress={handleClearErrors} disabled={clearing} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="delete-sweep" size={20} color="#FF3D57" />
              <Text style={styles.clearBtnText}>{clearing ? t('apagando') : t('apagarMemoria')}</Text>
            </Pressable>

            <Pressable onPress={handleSchedule} style={({ pressed }) => [styles.scheduleBtn, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="event" size={20} color={isDark ? "#0A0A0F" : "#FFFFFF"} />
              <Text style={[styles.scheduleBtnText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>{t('agendarRevisao')}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={handleScan} disabled={scanning} style={({ pressed }) => [styles.rescanBtn, { backgroundColor: cardColor, borderColor: isDark ? "#00B4FF44" : "#BAE6FD" }, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="wifi-tethering" size={18} color="#00B4FF" />
          <Text style={styles.rescanBtnText}>{scanning ? t('escaneandoEcu') : t('novoEscaneamento')}</Text>
        </Pressable>

      </ScrollView>
    </ScreenContainer>
  );
}

// ================= ESTILOS (CSS in JS) =================
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
  scanBtn: { padding: 6, backgroundColor: "#00B4FF22", borderRadius: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  healthCard: { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: "row", gap: 16, marginBottom: 4 },
  healthLeft: { alignItems: "center", justifyContent: "center", minWidth: 70 },
  healthLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  healthScore: { fontSize: 42, fontWeight: "800", color: "#FFB300", fontVariant: ["tabular-nums"] },
  healthUnit: { fontSize: 12 },
  healthRight: { flex: 1, justifyContent: "center", gap: 8 },
  healthBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  healthFill: { height: "100%", borderRadius: 3 },
  healthStatus: { fontSize: 14, fontWeight: "600", color: "#FFB300" },
  healthSub: { fontSize: 12 },

  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, marginTop: 4 },

  emptyState: { alignItems: "center", paddingVertical: 30, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 12, textAlign: "center", paddingHorizontal: 20 },

  faultCard: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  faultIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  faultInfo: { flex: 1 },
  faultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  faultCode: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  faultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  faultBadgeText: { fontSize: 10, fontWeight: "600" },
  faultDesc: { fontSize: 12, lineHeight: 18, marginBottom: 2 },
  faultSystem: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },

  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5711", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: "700", color: "#FF3D57" },
  scheduleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00B4FF", borderRadius: 14, paddingVertical: 14 },
  scheduleBtnText: { fontSize: 15, fontWeight: "700" },
  rescanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 12, borderWidth: 1, marginTop: 8 },
  rescanBtnText: { fontSize: 14, fontWeight: "600", color: "#00B4FF" },
});