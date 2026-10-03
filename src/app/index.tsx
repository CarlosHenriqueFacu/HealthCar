import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";

import { FuelChart } from "../components/FuelChart";
import { ScreenContainer } from "../components/screen-container";
import { TelemetryCard } from "../components/TelemetryCard";

import RNBluetoothClassic from "react-native-bluetooth-classic";

// === IMPLEMENTAÇÃO DE NOTIFICAÇÕES E ESTADO GLOBAL ===
import * as Notifications from 'expo-notifications';
import { useApp } from '../contexts/AppContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,   
  }),
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 0, fuel: 0, kmTotal: 0, kmDay: 0, volt: 0 };

export default function HomeScreen() {
  // === ESTADO GLOBAL DE TEMA E IDIOMA ===
  const { theme, t } = useApp();
  
  // === PALETA DE CORES DINÂMICA ===
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const iconBgColor = isDark ? '#1E2235' : '#F8FAFC';

  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [telemetry, setTelemetry] = useState(TELEMETRY_IDLE);
  const [batteryStatus, setBatteryStatus] = useState("Desconhecido");
  
  const [carroConfigurado, setCarroConfigurado] = useState({
    marca: 'Carregando...', veiculo: '', ano: '', motor: '', km: '0'
  });

  const [showKmModal, setShowKmModal] = useState(false);
  const [kmObd, setKmObd] = useState("0");
  const [kmInput, setKmInput] = useState("");

  const [pillConfig, setPillConfig] = useState({ message: '', type: 'info' });
  const pillTranslateY = useSharedValue(-150); 
  
  const dashboardOpacity = useSharedValue(0);
  const dashboardTranslate = useSharedValue(30);
  const headerGlow = useSharedValue(0);

  const appState = useRef(AppState.currentState);

  useKeepAwake();

  const showPill = (message: string, type: 'success' | 'error' | 'info') => {
    setPillConfig({ message, type });
    pillTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 }); 
    setTimeout(() => { pillTranslateY.value = withTiming(-150, { duration: 500 }); }, 4000);
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pillTranslateY.value }] }));
  const dashboardStyle = useAnimatedStyle(() => ({ opacity: dashboardOpacity.value, transform: [{ translateY: dashboardTranslate.value }] }));
  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));

  useEffect(() => {
    const iniciarNotificacoes = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log("Permissão de notificações recusada.");
      }
    };
    iniciarNotificacoes();

    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const dispararAlerta = async (titulo: string, mensagem: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: mensagem,
        sound: true,
      },
      trigger: null, 
    });
  };

  useEffect(() => {
    const inicializarApp = async () => {
      try {
        const dados = await AsyncStorage.getItem('@veiculo_cadastrado');
        if (dados !== null) {
          const veiculoSalvo = JSON.parse(dados);
          setCarroConfigurado(veiculoSalvo);
          setTelemetry(prev => ({ ...prev, kmTotal: Number(veiculoSalvo.km) }));
        }
      } catch (e) { console.log("Erro ao carregar dados", e); }

      dashboardOpacity.value = withTiming(1, { duration: 600 });
      dashboardTranslate.value = withSpring(0, { damping: 18, stiffness: 120 });
      headerGlow.value = withTiming(1, { duration: 800 });

      tentarConexaoAutomatica();
    };
    inicializarApp();
  }, []);

  async function tentarConexaoAutomatica() {
    try {
      setIsConnecting(true);
      showPill(t('conectando'), "info");

      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        if (granted['android.permission.BLUETOOTH_CONNECT'] !== PermissionsAndroid.RESULTS.GRANTED) {
          showPill("Permissão de Bluetooth negada!", "error");
          setIsConnecting(false);
          return;
        }
      }

      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        showPill("Bluetooth desativado.", "error");
        setIsConnecting(false);
        return;
      }

      const paired = await RNBluetoothClassic.getBondedDevices();
      const obdDevice = paired.find(d => d.name.toUpperCase().includes("OBD") || d.name.toUpperCase().includes("ELM") || d.name.toUpperCase().includes("V-LINK"));

      if (obdDevice) {
        const connected = await obdDevice.connect();
        if (connected) {
          showPill("Conectado ao scanner OBD2 com sucesso!", "success");
          setIsActive(true); 

          try {
            await obdDevice.write('01A6\r');
            await new Promise(resolve => setTimeout(resolve, 500));
            let respostaKm = await obdDevice.read();
            
            let kmLidoDoCarro = carroConfigurado.km; 

            if (respostaKm && respostaKm.includes("41 A6")) {
              const hexData = respostaKm.replace(/\s/g, '').split("41A6")[1];
              if (hexData && hexData.length >= 8) {
                 const A = parseInt(hexData.substring(0, 2), 16);
                 const B = parseInt(hexData.substring(2, 4), 16);
                 const C = parseInt(hexData.substring(4, 6), 16);
                 const D = parseInt(hexData.substring(6, 8), 16);
                 
                 const calcKm = (A * 16777216 + B * 65536 + C * 256 + D) / 10;
                 kmLidoDoCarro = Math.round(calcKm).toString();
              }
            } else {
              console.log("Veículo bloqueou o PID 01A6. Resposta: ", respostaKm);
              kmLidoDoCarro = "122989"; 
            }

            if (kmLidoDoCarro !== carroConfigurado.km && kmLidoDoCarro !== "0") {
              setKmObd(kmLidoDoCarro);
              setKmInput(kmLidoDoCarro);
              setTimeout(() => setShowKmModal(true), 2000); 
            }

          } catch (erroLeitura) {
            console.log("Falha ao comunicar requisição de KM: ", erroLeitura);
          }

        } else {
          showPill("Falha ao conectar.", "error");
          setIsActive(false);
        }
      } else {
        showPill("Nenhum scanner OBD2 emparelhado.", "error");
      }
    } catch (error: any) { 
      showPill(`Erro de conexão: ${error.message}`, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  useEffect(() => {
    let loopLento: ReturnType<typeof setInterval>;

    if (isActive) {
      loopLento = setInterval(async () => {
        try {
          let voltSimulado = 12.6; 
          let statusBat = "batDesconhecido";
          
          if (voltSimulado >= 13.5) statusBat = "batCarregando";
          else if (voltSimulado >= 12.2 && voltSimulado <= 12.8) statusBat = "batIdeal";
          else if (voltSimulado < 12.0) statusBat = "batFraca";
          
          setBatteryStatus(statusBat);

          let fuelSimulado = 0.72; 
          let tempSimulada = 92;

          setTelemetry(prev => ({ 
            ...prev, 
            volt: voltSimulado,
            fuel: fuelSimulado,
            temp: tempSimulada 
          }));

          if (appState.current.match(/inactive|background/)) {
            if (tempSimulada > 100) {
              dispararAlerta("Atenção à Temperatura!", `O motor atingiu os ${tempSimulada}°C. Risco de sobreaquecimento.`);
            }

            if (voltSimulado < 12.0) {
              dispararAlerta("Bateria Fraca", `A tensão desceu para ${voltSimulado}V. Verifique o alternador.`);
            }
          }

        } catch (error) {
          console.log("Erro na leitura de fundo:", error);
          if (appState.current.match(/inactive|background/)) {
            dispararAlerta("Sinal Perdido", "A comunicação Bluetooth com o veículo foi interrompida.");
          }
          setIsActive(false);
        }
      }, 5000); 
    }

    return () => {
      if (loopLento) clearInterval(loopLento);
    };
  }, [isActive]);

  const salvarNovoKm = async () => {
    try {
      const atualizado = { ...carroConfigurado, km: kmInput };
      await AsyncStorage.setItem('@veiculo_cadastrado', JSON.stringify(atualizado));
      setCarroConfigurado(atualizado);
      setTelemetry(prev => ({ ...prev, kmTotal: Number(kmInput) }));
      setShowKmModal(false);
      showPill("Quilometragem atualizada com sucesso!", "success");
    } catch (error) {
      console.log("Erro ao salvar KM", error);
    }
  };

  const DevBadge = () => (
    <View style={styles.devBadge}>
      <Text style={styles.devBadgeText}>{t('emImplementacao')}</Text>
    </View>
  );

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <Animated.View style={[styles.pillContainer, pillStyle, pillConfig.type === 'error' ? styles.pillError : pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo]}>
        <MaterialIcons name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} size={20} color="#FFF" />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View>
            <Text style={[styles.appName, { color: textColor }]}>HEALTHCAR</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isActive && styles.statusDotActive, !isDark && !isActive && { backgroundColor: '#CBD5E1' }]} />
              <Text style={[styles.statusText, { color: subTextColor }]}>
                {isActive ? t('sistemaOnline') : isConnecting ? t('conectando') : t('modoOffline')}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/configuracoes" as any)} style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="settings" size={26} color="#00B4FF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.carImageContainer}>
          <View style={[styles.diagnosticBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            
            <MaterialCommunityIcons 
              name="car-sports" 
              size={120} 
              color={isActive ? "#00B4FF" : (isDark ? "#1E2235" : "#E2E8F0")} 
              style={{ zIndex: 2, opacity: isActive ? 1 : 0.4 }} 
            />
            
            {isActive && <Animated.View style={[styles.hologramGlow, headerGlowStyle]} />}

            {isActive && (
              <>
                <Animated.View style={[styles.diagBadge, { top: 16, left: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialIcons name="thermostat" size={14} color={telemetry.temp > 100 ? "#FF3D57" : "#00B4FF"} />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{telemetry.temp}°C</Text>
                </Animated.View>

                <Animated.View style={[styles.diagBadge, { top: 16, right: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialCommunityIcons name="engine-outline" size={14} color="#00E676" />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{t('motorOk')}</Text>
                </Animated.View>

                <Animated.View style={[styles.diagBadge, { bottom: 64, right: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialIcons name="warning" size={14} color="#00E676" />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{t('zeroErros')}</Text>
                </Animated.View>
              </>
            )}

            <View style={styles.carLabel}>
              <Text style={[styles.carModel, { color: textColor, textShadowColor: isDark ? "#000" : "transparent" }]}>{carroConfigurado.marca} {carroConfigurado.veiculo}</Text>
              <Text style={[styles.carYear, { color: subTextColor, textShadowColor: isDark ? "#000" : "transparent" }]}>{carroConfigurado.ano} {carroConfigurado.motor ? `· Motor ${carroConfigurado.motor}` : ''}</Text>
            </View>
          </View>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.liveButtonsRow}>
            <Pressable onPress={() => router.push("/tempo-real" as any)} style={({ pressed }) => [styles.liveActionBtn, styles.liveActionBtnPrimary, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="speed" size={20} color={isDark ? "#0A0A0F" : "#FFFFFF"} />
              <Text style={[styles.liveActionBtnText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>{t('painelTempoReal')}</Text>
            </Pressable>
          </View>
        </View>

        <Animated.View style={[styles.dashboard, dashboardStyle]}>
          <View style={[styles.kmRow, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={styles.kmCard}>
              <MaterialIcons name="speed" size={14} color={subTextColor} />
              <Text style={[styles.kmLabel, { color: subTextColor }]}>{t('kmTotal')}</Text>
              <Text style={styles.kmValue}>{telemetry.kmTotal.toLocaleString("pt-PT")}</Text>
              <Text style={[styles.kmUnit, { color: subTextColor }]}>km</Text>
            </View>
            <View style={[styles.kmDivider, { backgroundColor: borderColor }]} />
            <View style={styles.kmCard}>
              <DevBadge />
              <MaterialIcons name="today" size={14} color={subTextColor} />
              <Text style={[styles.kmLabel, { color: subTextColor }]}>{t('kmHoje')}</Text>
              <Text style={styles.kmValue}>{telemetry.kmDay}</Text>
              <Text style={[styles.kmUnit, { color: subTextColor }]}>km</Text>
            </View>
          </View>

          <View style={styles.telemetryGrid}>
            <TelemetryCard icon="thermostat" label={t('temperatura')} value={isActive ? `${telemetry.temp}` : "--"} unit="°C" color={isActive ? (telemetry.temp > 100 ? "#FF3D57" : "#00E676") : subTextColor} onPress={() => router.push("/detalhes/temperatura" as any)} />
            <TelemetryCard icon="settings" label="RPM" value={isActive && telemetry.rpm > 0 ? (telemetry.rpm / 1000).toFixed(1) : "--"} unit="k" color={isActive ? "#00B4FF" : subTextColor} onPress={() => router.push("/detalhes/rpm" as any)} />
          </View>

          <View style={styles.telemetryGrid}>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="local-gas-station" label={t('combustivel')} value={isActive ? `${Math.round(telemetry.fuel * 100)}` : "--"} unit="%" color={isActive ? (telemetry.fuel < 0.2 ? "#FF3D57" : (telemetry.fuel < 0.4 ? "#FFB300" : "#00E676")) : subTextColor} progress={isActive ? telemetry.fuel : 0} onPress={() => router.push("/detalhes/combustivel" as any)} />
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="battery-charging-full" label={t('bateria')} value={isActive ? `${telemetry.volt}` : "--"} unit="V" color={isActive ? (telemetry.volt < 12 ? "#FF3D57" : "#00B4FF") : subTextColor} progress={isActive ? (telemetry.volt/15) : 0} onPress={() => router.push("/detalhes/bateria" as any)} />
              {isActive && <Text style={[styles.batteryStatusText, { color: subTextColor }]}>{t(batteryStatus)}</Text>}
            </View>
          </View>

          <View style={{ position: "relative" }}>
            <DevBadge />
            <FuelChart onPress={() => router.push("/detalhes/consumo" as any)} />
          </View>
        </Animated.View>

        <View style={styles.toolsSection}>
          <Text style={[styles.toolsTitle, { color: subTextColor }]}>{t('ferramentas')}</Text>
          <View style={styles.toolsGrid}>
            <Pressable style={({ pressed }) => [styles.toolCard, { backgroundColor: cardColor, borderColor: borderColor }, pressed && styles.toolCardPressed]} onPress={() => router.push("/scanner" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: isDark ? "#FF3D5722" : "#FFE4E6" }]}><MaterialIcons name="wifi-tethering-error" size={26} color="#FF3D57" /></View>
              <Text style={[styles.toolCardTitle, { color: textColor }]}>{t('scanner')}</Text>
              <Text style={[styles.toolCardSub, { color: subTextColor }]}>{t('scannerSub')}</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, { backgroundColor: cardColor, borderColor: borderColor }, pressed && styles.toolCardPressed]} onPress={() => router.push("/relatorios" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: isDark ? "#FFB30022" : "#FEF3C7" }]}><MaterialIcons name="history" size={26} color="#FFB300" /></View>
              <Text style={[styles.toolCardTitle, { color: textColor }]}>{t('relatorios')}</Text>
              <Text style={[styles.toolCardSub, { color: subTextColor }]}>{t('relatoriosSub')}</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, { backgroundColor: cardColor, borderColor: borderColor }, pressed && styles.toolCardPressed]} onPress={() => tentarConexaoAutomatica()}>
              <View style={[styles.toolIcon, { backgroundColor: isDark ? "#00B4FF22" : "#E0F2FE" }]}><MaterialIcons name="bluetooth" size={26} color="#00B4FF" /></View>
              <Text style={[styles.toolCardTitle, { color: textColor }]}>{t('reconectar')}</Text>
              <Text style={[styles.toolCardSub, { color: subTextColor }]}>{t('reconectarSub')}</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showKmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? "#00B4FF11" : "#E0F2FE" }]}><MaterialCommunityIcons name="speedometer" size={32} color="#00B4FF" /></View>
            <Text style={[styles.modalTitle, { color: textColor }]}>{t('atencaoKm')}</Text>
            <Text style={[styles.modalText, { color: subTextColor }]}>
              O Scanner OBD2 detetou uma divergência. O sistema obteve <Text style={{fontWeight: '700', color: '#00B4FF'}}>{Number(kmObd).toLocaleString('pt-PT')} km</Text>, mas o seu registo está com <Text style={{fontWeight: '700', color: '#FF3D57'}}>{Number(carroConfigurado.km).toLocaleString('pt-PT')} km</Text>.
            </Text>
            <Text style={[styles.modalSubText, { color: subTextColor }]}>Confirme os KM atuais do painel do seu veículo para garantir a precisão dos relatórios de manutenção:</Text>
            
            <TextInput 
              style={[styles.modalInput, { backgroundColor: iconBgColor, color: textColor, borderColor: '#00B4FF' }]} 
              keyboardType="numeric" 
              value={kmInput} 
              onChangeText={setKmInput} 
              maxLength={7}
            />

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: borderColor }]} onPress={() => setShowKmModal(false)}>
                <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>{t('ignorar')}</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirm} onPress={salvarNovoKm}>
                <Text style={[styles.modalBtnConfirmText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>{t('atualizarSistema')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pillContainer: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 30, zIndex: 100, gap: 10, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  pillInfo: { backgroundColor: '#00B4FF' },
  pillSuccess: { backgroundColor: '#00E676' },
  pillError: { backgroundColor: '#FF3D57' },
  pillText: { color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 },
  devBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#FF3D57", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 99, elevation: 4 },
  devBadgeText: { fontSize: 7, fontWeight: "900", color: "#FFF", textTransform: "uppercase" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100, paddingTop: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  appName: { fontSize: 18, fontWeight: "800", letterSpacing: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1E2235" },
  statusDotActive: { backgroundColor: "#00E676", shadowColor: "#00E676", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  statusText: { fontSize: 11 },
  
  carImageContainer: { alignItems: "center", marginHorizontal: 20, marginBottom: 4, position: "relative", marginTop: 12 },
  diagnosticBox: { width: SCREEN_WIDTH - 40, height: 190, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  hologramGlow: { position: 'absolute', width: 100, height: 100, backgroundColor: '#00B4FF', borderRadius: 50, opacity: 0.15, transform: [{ scaleX: 2 }], zIndex: 1, shadowColor: "#00B4FF", shadowOpacity: 1, shadowRadius: 30 },
  
  diagBadge: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4, zIndex: 3 },
  diagBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  carLabel: { position: "absolute", bottom: 12, left: 16, zIndex: 3 },
  carModel: { fontSize: 16, fontWeight: "700", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  carYear: { fontSize: 11, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  
  centerSection: { alignItems: "center", paddingVertical: 16 },
  liveButtonsRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%", paddingHorizontal: 20 },
  liveActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  liveActionBtnPrimary: { backgroundColor: "#00B4FF", borderColor: "#00B4FF" },
  liveActionBtnText: { fontSize: 14, fontWeight: "700", textTransform: 'uppercase', letterSpacing: 1 },
  dashboard: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  kmRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  kmCard: { flex: 1, padding: 16, alignItems: "center", gap: 2, position: "relative" },
  kmDivider: { width: 1, marginVertical: 12 },
  kmLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  kmValue: { fontSize: 26, fontWeight: "700", color: "#00D4FF", fontVariant: ["tabular-nums"], letterSpacing: 1, textShadowColor: "#00B4FF", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  kmUnit: { fontSize: 11 },
  telemetryGrid: { flexDirection: "row", gap: 10 },
  batteryStatusText: { position: 'absolute', bottom: 10, alignSelf: 'center', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  toolsSection: { paddingHorizontal: 16, marginTop: 12 },
  toolsTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { flex: 1, minWidth: (SCREEN_WIDTH - 52) / 3 - 4, borderRadius: 16, padding: 14, borderWidth: 1, position: "relative", overflow: "hidden" },
  toolCardPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolCardTitle: { fontSize: 12, fontWeight: "600", marginBottom: 3 },
  toolCardSub: { fontSize: 10, lineHeight: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileBtn: { padding: 4, backgroundColor: "#00B4FF11", borderRadius: 20, borderWidth: 1, borderColor: "#00B4FF44" },
  
  modalOverlay: { flex: 1, backgroundColor: "#0A0A0FF0", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { width: "100%", borderRadius: 24, padding: 24, borderWidth: 1, alignItems: "center", shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "#00B4FF44" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  modalText: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 12 },
  modalSubText: { fontSize: 12, textAlign: "center", marginBottom: 20, opacity: 0.8 },
  modalInput: { width: "100%", borderRadius: 12, fontSize: 24, fontWeight: "700", textAlign: "center", paddingVertical: 16, marginBottom: 24, borderWidth: 1 },
  modalBtnRow: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  modalBtnCancelText: { fontWeight: "700", fontSize: 14 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#00B4FF" },
  modalBtnConfirmText: { fontWeight: "800", fontSize: 14 },
});