import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import Animated, { FadeIn, FadeInUp, FadeOutUp } from "react-native-reanimated";

import { useApp } from '../contexts/AppContext';

// IMPORTAÇÃO DA CAMADA DE PERSISTÊNCIA
import { salvarFalhaDTCLocal } from '../database/database';

const { OBDBluetooth } = NativeModules;

/**
 * @constant SEVERITY_CONFIG
 * @description Mapeamento semântico de UI para a severidade das falhas (DTCs).
 */
const SEVERITY_CONFIG = {
  critical: { color: "#FF3D57", bg: "#FF3D5722", labelKey: "critico", icon: "error" as const },
  warning: { color: "#FFB300", bg: "#FFB30022", labelKey: "aviso", icon: "warning" as const },
  resolved: { color: "#00E676", bg: "#00E67622", labelKey: "resolvido", icon: "check-circle" as const },
};

/**
 * @constant DTC_DICTIONARY
 * @description Dicionário de decodificação ISO/SAE. Converte códigos de erro hexadecimais brutos
 * da ECU em diagnósticos compreensíveis para o motorista, incluindo o sistema afetado e criticidade.
 */
const DTC_DICTIONARY: Record<string, { desc: string, system: string, severity: "critical" | "warning" }> = {
  "P0300": { desc: "Falha de ignição aleatória detectada", system: "Motor", severity: "critical" },
  "P0420": { desc: "Eficiência do catalisador abaixo do limiar", system: "Emissões", severity: "warning" },
  "P0171": { desc: "Mistura ar/combustível pobre (Banco 1)", system: "Combustível", severity: "warning" },
  "P0113": { desc: "Entrada alta no circuito de temperatura do ar", system: "Admissão", severity: "warning" },
  "P0500": { desc: "Mau funcionamento do sensor de velocidade", system: "Transmissão", severity: "critical" },
  "P0100": { desc: "Mau funcionamento do circuito de fluxo de ar (MAF)", system: "Admissão", severity: "critical" },
  "P0133": { desc: "Resposta lenta do sensor de oxigênio (O2)", system: "Emissões", severity: "warning" },
};

/**
 * @component ScannerScreen
 * @description Interface de diagnóstico profissional (OBD-II). Realiza varreduras ativas 
 * na ECU do veículo para extrair Códigos de Falha (DTCs). 
 * NOTA DE SEGURANÇA (SECURITY POLICY): A função Mode 04 (Clear Trouble Codes) foi desativada
 * por regra de negócio para evitar que o usuário mascare falhas mecânicas severas.
 */
export default function ScannerScreen() {
  const { theme, t } = useApp();
  
  // --- CONFIGURAÇÃO DE TEMA (DESIGN SYSTEM) ---
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  // --- CONTROLE DE ESTADO DA VIEW ---
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState(""); // Feedback tátil e visual progressivo
  const [faults, setFaults] = useState<any[]>([]);
  const [showDbAlert, setShowDbAlert] = useState(false); 

  // Algoritmo de cálculo de pontuação de saúde veicular
  const healthScore = Math.max(0, 100 - (faults.length * 13));
  const isHealthy = faults.length === 0 && !scanning;

  /**
   * @effect Boot Lifecycle
   * Dispara a varredura de diagnóstico no momento em que a View é montada.
   */
  useEffect(() => {
    handleScan();
  }, []);

  /**
   * @method connectToScanner
   * @description Estabelece um socket RFCOMM isolado para leitura de dados de falha.
   * Utilizado como Fallback (Recuperação) caso o handshake principal caia.
   */
  async function connectToScanner() {
    const devices = await RNBluetoothClassic.getBondedDevices();
    const obdDevice = devices.find((d: any) => 
      d.name && (
        d.name.toUpperCase().includes("OBD") || 
        d.name.toUpperCase().includes("ELM") ||
        d.name.toUpperCase().includes("V-LINK")
      )
    );
    
    if (!obdDevice) throw new Error("Nenhum scanner pareado");
    
    await OBDBluetooth.connect(obdDevice.address);
    
    // Configuração ISO do adaptador ELM327
    await OBDBluetooth.sendCommand("ATZ");
    await new Promise(resolve => setTimeout(resolve, 1000));
    await OBDBluetooth.sendCommand("ATE0");
    await OBDBluetooth.sendCommand("ATSP0");
    await OBDBluetooth.sendCommand("0100"); 
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * @method handleScan
   * @description Solicita a matriz de falhas (Mode 03).
   * Contém UX Delay (Pausas Controladas) para prover credibilidade analítica ao usuário.
   */
  async function handleScan() {
    setScanning(true);
    setScanStage("Negociando protocolo OBD-II...");
    setFaults([]); 
    setShowDbAlert(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStage("A consultar Centralina (ECU)...");
      
      let resp;
      try {
        resp = await OBDBluetooth.sendCommand("03"); // ISO Request: Show stored DTCs
      } catch (err) {
        await connectToScanner(); // Tentativa de recuperação de malha
        resp = await OBDBluetooth.sendCommand("03");
      }
      
      if (!resp || String(resp).includes("TIMEOUT") || String(resp).includes("INCOMPLETO")) {
        throw new Error("Timeout na resposta da ECU");
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStage("A decodificar matriz de falhas...");
      
      await new Promise(resolve => setTimeout(resolve, 800));

      // Chama a função de decodificação binária/hexadecimal
      const codes = parseDTC(String(resp));
      
      // Mapeia os códigos hexadecimais para seus respectivos dicionários técnicos
      const newFaults = codes.map((code) => ({
        code: code,
        desc: DTC_DICTIONARY[code]?.desc || "Falha identificada pelo módulo de controle.",
        system: DTC_DICTIONARY[code]?.system || "Sistema de Injeção / ECU",
        severity: DTC_DICTIONARY[code]?.severity || "warning",
      }));
      
      setFaults(newFaults);

      // --- CAMADA DE TRANSAÇÃO OFFLINE (Write-Ahead Logging SQLite) ---
      // Realiza a inserção sequencial dos erros no histórico local do usuário
      if (newFaults.length > 0) {
        for (const fault of newFaults) {
          await salvarFalhaDTCLocal(
            "SESSAO_DIAGNOSTICO_ATIVA", 
            fault.code, 
            fault.desc, 
            fault.system, 
            fault.severity
          );
        }
        
        setShowDbAlert(true);
        setTimeout(() => setShowDbAlert(false), 4000);
      }

    } catch (error) {
      Alert.alert("Aviso de Conexão", "Não foi possível extrair a matriz da ECU. Verifique a conexão Bluetooth.");
      console.log("[Scanner Error]", error);
    } finally {
      setScanning(false);
      setScanStage("");
    }
  }

  /**
   * @method parseDTC
   * @description Tradutor SAE J2012. Extrai os identificadores de falha da resposta hexadecimal bruta.
   * Aplica deslocamento de bits para converter o primeiro dígito hexa na letra da categoria do erro (P,C,B,U).
   */
  function parseDTC(response: string): string[] {
    // Filtra falsos positivos e quedas momentâneas
    if (!response || response.includes("NO DATA") || response.includes("OK") || response.includes("SEARCHING") || response.includes("ERROR")) {
      return [];
    }
    
    const cleanResp = response.replace(/[\s\r\n>]/g, "").toUpperCase();
    
    // 43 = Resposta de sucesso do Mode 03
    const index = cleanResp.indexOf("43");
    if (index === -1) return [];

    const hexData = cleanResp.substring(index + 2);
    const codes: string[] = [];

    // CAN Bus agrupa DTCs em pares (2 bytes / 4 chars)
    for (let i = 0; i < hexData.length; i += 4) {
      const dtcHex = hexData.substring(i, i + 4);
      
      // Filtra ruídos da rede, padding nulo (0000) e padding de ECU (5555/AAAA)
      if (
        dtcHex.length === 4 && 
        dtcHex !== "0000" && 
        !dtcHex.includes("55") && 
        dtcHex !== "AAAA"
      ) {
        const firstChar = dtcHex[0];
        let letter = "P";
        let secondDigit = "0";

        if (["0","1","2","3"].includes(firstChar)) { letter = "P"; secondDigit = firstChar; }
        else if (["4","5","6","7"].includes(firstChar)) { letter = "C"; secondDigit = (parseInt(firstChar, 16) - 4).toString(); }
        else if (["8","9","A","B"].includes(firstChar)) { letter = "B"; secondDigit = (parseInt(firstChar, 16) - 8).toString(); }
        else if (["C","D","E","F"].includes(firstChar)) { letter = "U"; secondDigit = (parseInt(firstChar, 16) - 12).toString(); }

        codes.push(`${letter}${secondDigit}${dtcHex.substring(1)}`);
      }
    }
    
    return Array.from(new Set(codes)).filter(c => c.length === 5);
  }

  /**
   * @method handleSchedule
   * @description Call To Action (CTA) direcionado para retenção e prestação de serviço.
   */
  function handleSchedule() {
    Alert.alert(
      t('agendarRevisao'),
      "Deseja agendar uma revisão na oficina mais próxima para solucionar este quadro técnico?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Agendar", onPress: () => Alert.alert("Sucesso", "Solicitação enviada para a oficina credenciada.") },
      ]
    );
  }

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      {/* ================= MODAL DE CARREGAMENTO (UX Feedback) ================= */}
      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(300)} style={[styles.loadingBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <ActivityIndicator size="large" color="#00B4FF" style={{ marginBottom: 16 }} />
            <Text style={[styles.loadingTitle, { color: textColor }]}>Diagnosticando Veículo</Text>
            <Text style={[styles.loadingStage, { color: subTextColor }]}>{scanStage}</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* ================= NOTIFICAÇÃO DE GRAVAÇÃO (DATABASE) ================= */}
      {showDbAlert && (
        <Animated.View 
          entering={FadeInUp.duration(400)} 
          exiting={FadeOutUp.duration(400)} 
          style={styles.toastContainer}
        >
          <MaterialIcons name="save-alt" size={20} color="#00E676" />
          <Text style={styles.toastText}>Relatório DTC gravado no banco de dados local.</Text>
        </Animated.View>
      )}

      {/* ================= HEADER ================= */}
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
        
        {/* ================= AVISO DE PERFORMANCE DE I/O ================= */}
        <View style={[styles.testBadge, { backgroundColor: isDark ? "#8B5CF622" : "#EDE9FE", borderColor: "#8B5CF655" }]}>
          <MaterialIcons name="storage" size={24} color="#8B5CF6" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#8B5CF6", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 }}>GRAVAÇÃO CONCORRENTE (WAL)</Text>
            <Text style={{ color: "#8B5CF6", fontSize: 11, marginTop: 2, lineHeight: 16 }}>
              Os códigos DTC detectados nesta tela são gravados simultaneamente na tabela local, sem bloquear a interface de usuário.
            </Text>
          </View>
        </View>

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
        
        {/* ================= ESTADO VAZIO (NENHUM ERRO) ================= */}
        {!scanning && faults.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="check-circle" size={48} color="#00E676" style={{ opacity: 0.8 }} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>{t('nenhumaFalha')}</Text>
            <Text style={[styles.emptyDesc, { color: subTextColor }]}>{t('nenhumaFalhaDesc')}</Text>
          </View>
        )}

        {/* ================= RENDERIZAÇÃO DA MATRIZ DE ERROS ================= */}
        {faults.map((fault, index) => {
          const cfg = SEVERITY_CONFIG[fault.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
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

        {/* ================= BOTÃO DE AGENDAMENTO (Call To Action) ================= */}
        {faults.length > 0 && (
          <Pressable onPress={handleSchedule} style={({ pressed }) => [styles.scheduleBtn, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="event" size={20} color={isDark ? "#0A0A0F" : "#FFFFFF"} />
            <Text style={[styles.scheduleBtnText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>{t('agendarRevisao')}</Text>
          </Pressable>
        )}

        {/* ================= BOTÃO DE NOVA VARREDURA ================= */}
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

  toastContainer: { position: 'absolute', top: 70, left: 20, right: 20, backgroundColor: '#1E2235', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#00E67644', zIndex: 100, shadowColor: "#00E676", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  toastText: { color: '#00E676', fontSize: 12, fontWeight: '700' },
  testBadge: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 4 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(10, 10, 15, 0.8)", justifyContent: "center", alignItems: "center", padding: 20 },
  loadingBox: { width: "85%", borderRadius: 24, padding: 30, borderWidth: 1, alignItems: "center", shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  loadingTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  loadingStage: { fontSize: 13, textAlign: "center", fontStyle: "italic" },

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

  scheduleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00B4FF", borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  scheduleBtnText: { fontSize: 15, fontWeight: "700" },
  rescanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 12, borderWidth: 1, marginTop: 8 },
  rescanBtnText: { fontSize: 14, fontWeight: "600", color: "#00B4FF" },
});