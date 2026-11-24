import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import Animated, { FadeIn, FadeInUp, FadeOutUp } from "react-native-reanimated";

import { HealthCarHeader } from '@/components/HealthCarHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

import { iniciarSessaoLocal, obterResumoSessoes, obterVeiculoLocal, salvarFalhaDTCLocal } from '@/database/database';

const { OBDBluetooth } = NativeModules;

const SEVERITY_CONFIG = {
  critical: { color: "#FF3D57", bg: "#FF3D5722", labelKey: "critico", icon: "error" as const },
  warning: { color: "#FFB300", bg: "#FFB30022", labelKey: "aviso", icon: "warning" as const },
  resolved: { color: "#00E676", bg: "#00E67622", labelKey: "resolvido", icon: "check-circle" as const },
};

const DTC_DICTIONARY: Record<
  string,
  {
    pt: { desc: string; system: string };
    en: { desc: string; system: string };
    severity: "critical" | "warning";
  }
> = {
  "P0300": {
    pt: { desc: "Falha de ignição aleatória detectada", system: "Motor" },
    en: { desc: "Random/multiple cylinder misfire detected", system: "Engine" },
    severity: "critical",
  },
  "P0420": {
    pt: { desc: "Eficiência do catalisador abaixo do limiar", system: "Emissões" },
    en: { desc: "Catalyst system efficiency below threshold", system: "Emissions" },
    severity: "warning",
  },
  "P0171": {
    pt: { desc: "Mistura ar/combustível pobre (Banco 1)", system: "Combustível" },
    en: { desc: "System too lean (Bank 1)", system: "Fuel" },
    severity: "warning",
  },
  "P0113": {
    pt: { desc: "Entrada alta no circuito de temperatura do ar", system: "Admissão" },
    en: { desc: "Intake air temperature circuit high input", system: "Intake" },
    severity: "warning",
  },
  "P0500": {
    pt: { desc: "Mau funcionamento do sensor de velocidade", system: "Transmissão" },
    en: { desc: "Vehicle speed sensor malfunction", system: "Transmission" },
    severity: "critical",
  },
  "P0100": {
    pt: { desc: "Mau funcionamento do circuito de fluxo de ar (MAF)", system: "Admissão" },
    en: { desc: "Mass air flow (MAF) circuit malfunction", system: "Intake" },
    severity: "critical",
  },
  "P0133": {
    pt: { desc: "Resposta lenta do sensor de oxigênio (O2)", system: "Emissões" },
    en: { desc: "O2 sensor circuit slow response", system: "Emissions" },
    severity: "warning",
  },
};

const comTimeout = (promessa: Promise<any>, tempoMs: number, mensagemErro: string) => {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensagemErro)), tempoMs))
  ]);
};

export default function ScannerScreen() {
  const { theme, language, t } = useApp();
  const { user } = useAuth();

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  const [scanning, setScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [scanStage, setScanStage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [faults, setFaults] = useState<any[]>([]);
  const [showDbAlert, setShowDbAlert] = useState(false);

  const healthScore = Math.max(0, 100 - (faults.length * 13));
  const isHealthy = faults.length === 0 && !scanning;

  async function garantirPermissoesBluetooth() {
    if (Platform.OS !== "android" || Platform.Version < 31) return;
    const permissoes = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const autorizadas = Object.values(permissoes).every(
      permissao => permissao === PermissionsAndroid.RESULTS.GRANTED
    );
    if (!autorizadas) {
      throw new Error("ERR_BT_PERMISSION");
    }
  }

  useEffect(() => {
    handleScan();
  }, []);

  async function connectToScanner() {
    await garantirPermissoesBluetooth();
    const devices = await RNBluetoothClassic.getBondedDevices();
    const obdDevice = devices.find((d: any) =>
      d.name && (
        d.name.toUpperCase().includes("OBD") ||
        d.name.toUpperCase().includes("ELM") ||
        d.name.toUpperCase().includes("V-LINK")
      )
    );

    if (!obdDevice) throw new Error("ERR_NO_PAIRED_SCANNER");

    setScanStage(t('stageConectandoBt'));
    await comTimeout(OBDBluetooth.connect(obdDevice.address), 12000, "TIMEOUT_CONEXAO");

    setScanStage(t('stageConfigurandoProto'));
    await OBDBluetooth.sendCommand("ATZ");
    await new Promise(resolve => setTimeout(resolve, 1000));
    await OBDBluetooth.sendCommand("ATE0");
    await OBDBluetooth.sendCommand("ATSP0");
    await OBDBluetooth.sendCommand("0100");
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsConnected(true);
  }

  async function handleScan() {
    setScanning(true);
    setScanStage(t('stageNegociandoObd'));
    setFaults([]);
    setShowDbAlert(false);
    let backgroundPollingPaused = false;

    try {
      await garantirPermissoesBluetooth();
      await OBDBluetooth.pauseBackgroundPolling(true);
      backgroundPollingPaused = true;
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStage(t('stageConsultandoEcu'));

      let resp;
      try {
        resp = await comTimeout(OBDBluetooth.sendCommand("03"), 6000, "TIMEOUT_SCAN");
      } catch (err) {
        await connectToScanner();
        resp = await comTimeout(OBDBluetooth.sendCommand("03"), 8000, "TIMEOUT_SCAN");
      }

      if (!resp || String(resp).includes("TIMEOUT") || String(resp).includes("INCOMPLETO")) {
        throw new Error("TIMEOUT_ECU");
      }
      setIsConnected(true);

      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStage(t('stageDecodificando'));

      await new Promise(resolve => setTimeout(resolve, 800));

      const codes = parseDTC(String(resp));

      const newFaults = codes.map((code) => {
        const entry = DTC_DICTIONARY[code];
        return {
          code,
          desc: entry ? entry[language].desc : t('falhaGenericaDtc'),
          system: entry ? entry[language].system : t('sistemaInjecaoEcu'),
          severity: entry?.severity || "warning",
        };
      });

      setFaults(newFaults);

      if (newFaults.length > 0) {
        if (!user?.uid) throw new Error('ERR_NOT_AUTHENTICATED');
        const vehicle = await obterVeiculoLocal(user.uid);
        if (!vehicle) throw new Error('ERR_NO_VEHICLE');
        const sessions = await obterResumoSessoes(user.uid, vehicle.id);
        const sessionId = sessions[0]?.id ?? await iniciarSessaoLocal(user.uid, vehicle.id, 'ISO_15765-4');
        for (const fault of newFaults) {
          await salvarFalhaDTCLocal(
            user.uid,
            sessionId,
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
      setIsConnected(false);
      let mensagem = t('erroMatrizEcu');

      if (error instanceof Error) {
        if (error.message === "ERR_BT_PERMISSION") mensagem = t('erroPermissaoBtScanner');
        else if (error.message === "ERR_NO_PAIRED_SCANNER") mensagem = t('nenhumScannerPareado');
        else if (error.message === "ERR_NOT_AUTHENTICATED") mensagem = t('erroContaDiagnostico');
        else if (error.message === "ERR_NO_VEHICLE") mensagem = t('erroVeiculoDiagnostico');
        else if (error.message.includes("TIMEOUT")) mensagem = t('erroTimeoutScanner');
      }

      Alert.alert(t('avisoConexao'), mensagem);
      console.log("[Scanner Error]", error);
    } finally {
      if (backgroundPollingPaused) {
        await OBDBluetooth.pauseBackgroundPolling(false).catch(() => {});
      }
      setScanning(false);
      setScanStage("");
    }
  }

  async function handleClearErrors() {
    Alert.alert(t('acessoRestrito'), t('limparFalhasRestrito'));
  }

  function parseDTC(response: string): string[] {
    if (!response || response.includes("NO DATA") || response.includes("OK") || response.includes("SEARCHING") || response.includes("ERROR")) {
      return [];
    }

    const cleanResp = response.replace(/[\s\r\n>]/g, "").toUpperCase();

    const index = cleanResp.indexOf("43");
    if (index === -1) return [];

    const hexData = cleanResp.substring(index + 2);
    const codes: string[] = [];

    for (let i = 0; i < hexData.length; i += 4) {
      const dtcHex = hexData.substring(i, i + 4);

      if (
        dtcHex.length === 4 &&
        dtcHex !== "0000" &&
        !dtcHex.includes("55") &&
        dtcHex !== "AAAA"
      ) {
        const firstChar = dtcHex[0];
        let letter = "P";
        let secondDigit = "0";

        if (["0", "1", "2", "3"].includes(firstChar)) { letter = "P"; secondDigit = firstChar; }
        else if (["4", "5", "6", "7"].includes(firstChar)) { letter = "C"; secondDigit = (parseInt(firstChar, 16) - 4).toString(); }
        else if (["8", "9", "A", "B"].includes(firstChar)) { letter = "B"; secondDigit = (parseInt(firstChar, 16) - 8).toString(); }
        else if (["C", "D", "E", "F"].includes(firstChar)) { letter = "U"; secondDigit = (parseInt(firstChar, 16) - 12).toString(); }

        codes.push(`${letter}${secondDigit}${dtcHex.substring(1)}`);
      }
    }

    return Array.from(new Set(codes)).filter(c => c.length === 5);
  }

  function handleSchedule() {
    Alert.alert(
      t('agendarRevisao'),
      t('agendarRevisaoDesc'),
      [
        { text: t('cancelar'), style: "cancel" },
        { text: t('agendar'), onPress: () => Alert.alert(t('sucesso'), t('solicitacaoEnviada')) },
      ]
    );
  }

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      {showDbAlert && (
        <Animated.View entering={FadeInUp.duration(400)} exiting={FadeOutUp.duration(400)} style={styles.toastContainer}>
          <MaterialIcons name="save-alt" size={18} color="#20D9A0" />
          <Text style={styles.toastText}>{t('relatorioDtcGravado')}</Text>
        </Animated.View>
      )}

      <ScrollView style={styles.screenScroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <HealthCarHeader />

        <View style={styles.pageHeading}>
          <Text style={[styles.pageTitle, { color: textColor }]}>{t('tituloScanner')}</Text>
          <Text style={[styles.pageSubtitle, { color: subTextColor }]}>{t('scannerSubtitulo')}</Text>
        </View>

        <View style={[styles.connectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={[styles.connectionIcon, { backgroundColor: isConnected ? '#0B342B' : '#1A202A' }]}>
            <MaterialIcons name={isConnected ? 'bluetooth-connected' : 'bluetooth-disabled'} size={20} color={isConnected ? '#20D9A0' : '#9AA5B5'} />
          </View>
          <View style={styles.connectionInfo}>
            <Text style={[styles.connectionTitle, { color: textColor }]}>{isConnected ? t('scannerConectado') : t('scannerDesconectado')}</Text>
            <Text style={[styles.connectionSubtitle, { color: subTextColor }]}>
              {isConnected ? t('adaptadorPronto') : t('conecteAdaptadorPareado')}
            </Text>
          </View>
          <Text style={[styles.connectionBadge, { color: isConnected ? '#20D9A0' : subTextColor }]}>{isConnected ? t('online') : t('offline')}</Text>
        </View>

        <View style={[styles.diagnosticCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.diagnosticIcon}><MaterialIcons name="center-focus-weak" size={24} color="#00B4FF" /></View>
          <Text style={[styles.diagnosticTitle, { color: textColor }]}>
            {scanning ? t('analisandoEcu') : faults.length > 0 ? t('diagnosticoConcluido') : t('prontoParaVerificar')}
          </Text>
          <Text style={[styles.diagnosticDescription, { color: subTextColor }]}>
            {scanning ? scanStage : t('scannerInstrucao')}
          </Text>
          <Pressable
            onPress={handleScan}
            disabled={scanning}
            style={({ pressed }) => [styles.diagnosticButton, pressed && { opacity: 0.82 }, scanning && { opacity: 0.65 }]}
          >
            <MaterialIcons name={isConnected ? 'refresh' : 'bluetooth-searching'} size={18} color="#04131A" />
            <Text style={styles.diagnosticButtonText}>
              {scanning ? t('escaneandoEcu') : isConnected ? t('novoEscaneamento') : t('conectarIniciarDiag')}
            </Text>
          </Pressable>
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#191D26' : '#F1F5F9' }]}>
            <MaterialIcons name="info-outline" size={17} color={subTextColor} />
            <Text style={[styles.infoText, { color: subTextColor }]}>{t('scannerInfoBox')}</Text>
          </View>
        </View>

        {(isConnected || faults.length > 0) && (
          <View style={[styles.scoreCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.scoreCopy}>
              <Text style={[styles.scoreLabel, { color: subTextColor }]}>{t('saudeVeiculo')}</Text>
              <Text style={[styles.scoreValue, { color: isHealthy ? '#20D9A0' : '#FFB547' }]}>{healthScore}<Text style={[styles.scoreTotal, { color: subTextColor }]}> / 100</Text></Text>
              <Text style={[styles.scoreCaption, { color: subTextColor }]}>
                {isHealthy ? t('emPerfeitoEstado') : `${faults.length} ${t('errosEncontrados')}`}
              </Text>
            </View>
            <View style={[styles.scoreTrack, { backgroundColor: borderColor }]}>
              <View style={[styles.scoreFill, { width: `${healthScore}%` as any, backgroundColor: isHealthy ? '#20D9A0' : '#FFB547' }]} />
            </View>
          </View>
        )}

        <View style={styles.resultHeading}>
          <Text style={[styles.resultSectionTitle, { color: textColor }]}>{t('resultadoDiagnostico')}</Text>
          <Text style={[styles.resultCaption, { color: subTextColor }]}>
            {faults.length > 0 ? `${faults.length} ${t('errosEncontrados')}` : isConnected ? t('leituraConcluida') : t('nenhumaLeituraRealizada')}
          </Text>
        </View>

        {!scanning && faults.length === 0 && (
          <View style={[styles.emptyResult, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.resultIcon}><MaterialIcons name="assignment" size={20} color="#00B4FF" /></View>
            <View style={styles.emptyCopy}>
              <Text style={[styles.emptyTitle, { color: textColor }]}>{isConnected ? t('nenhumaFalha') : t('codigosApareceraoAqui')}</Text>
              <Text style={[styles.emptyDesc, { color: subTextColor }]}>
                {isConnected ? t('nenhumaFalhaDesc') : t('codigosApareceraoDesc')}
              </Text>
            </View>
          </View>
        )}

        {faults.map((fault, index) => {
          const cfg = SEVERITY_CONFIG[fault.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
          const dictEntry = DTC_DICTIONARY[fault.code];
          const displayDesc = dictEntry ? dictEntry[language].desc : fault.desc;
          const displaySystem = dictEntry ? dictEntry[language].system : fault.system;
          return (
            <View key={`${fault.code}-${index}`} style={[styles.faultCard, { backgroundColor: cardColor, borderColor }, { marginHorizontal: 20, marginBottom: 9 }]}>
              <View style={[styles.faultIconWrap, { backgroundColor: cfg.bg }]}><MaterialIcons name={cfg.icon} size={21} color={cfg.color} /></View>
              <View style={styles.faultInfo}>
                <View style={styles.faultHeader}>
                  <Text style={[styles.faultCode, { color: textColor }]}>{fault.code}</Text>
                  <View style={[styles.faultBadge, { backgroundColor: cfg.bg }]}><Text style={[styles.faultBadgeText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text></View>
                </View>
                <Text style={[styles.faultDesc, { color: subTextColor }]}>{displayDesc}</Text>
                <Text style={[styles.faultSystem, { color: subTextColor }]}>{displaySystem}</Text>
              </View>
            </View>
          );
        })}

        {faults.length > 0 && (
          <Pressable onPress={handleSchedule} style={({ pressed }) => [styles.scheduleBtn, { marginHorizontal: 20 }, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="event" size={19} color="#04131A" />
            <Text style={styles.scheduleBtnText}>{t('agendarRevisao')}</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(300)} style={[styles.loadingBox, { backgroundColor: cardColor, borderColor }]}>
            <ActivityIndicator size="large" color="#00B4FF" style={{ marginBottom: 16 }} />
            <Text style={[styles.loadingTitle, { color: textColor }]}>{t('diagnosticandoVeiculo')}</Text>
            <Text style={[styles.loadingStage, { color: subTextColor }]}>{scanStage}</Text>
          </Animated.View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

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
  screenScroll: { flex: 1 },
  screenContent: { paddingBottom: 26 },
  pageHeading: { marginHorizontal: 20, marginTop: -5, marginBottom: 16 },
  pageTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  pageSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  connectionCard: { marginHorizontal: 20, marginBottom: 14, minHeight: 68, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  connectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connectionInfo: { flex: 1 },
  connectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  connectionSubtitle: { fontSize: 10, lineHeight: 14 },
  connectionBadge: { fontSize: 10, fontWeight: '700' },
  diagnosticCard: { marginHorizontal: 20, marginBottom: 20, padding: 17, borderRadius: 19, borderWidth: 1, alignItems: 'center' },
  diagnosticIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginBottom: 14 },
  diagnosticTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  diagnosticDescription: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7, marginBottom: 14, paddingHorizontal: 5 },
  diagnosticButton: { width: '100%', minHeight: 46, borderRadius: 13, backgroundColor: '#00AEEF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  diagnosticButtonText: { color: '#04131A', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  infoBox: { width: '100%', minHeight: 43, marginTop: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { flex: 1, fontSize: 9, lineHeight: 14 },
  scoreCard: { marginHorizontal: 20, marginBottom: 19, padding: 13, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scoreCopy: { flex: 1 },
  scoreLabel: { fontSize: 10, marginBottom: 3 },
  scoreValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreTotal: { fontSize: 11, fontWeight: '500' },
  scoreCaption: { fontSize: 9, marginTop: 3 },
  scoreTrack: { width: 72, height: 5, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },
  resultHeading: { marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  resultCaption: { fontSize: 9 },
  resultSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 0, marginTop: 0, textTransform: 'none', letterSpacing: 0 },
  emptyResult: { marginHorizontal: 20, marginBottom: 10, minHeight: 64, padding: 12, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1 },
});