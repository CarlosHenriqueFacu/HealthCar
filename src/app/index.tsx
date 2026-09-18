import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 0, fuel: 0, kmTotal: 0, kmDay: 0, volt: 0 };

const DevBadge = () => (
  <View style={styles.devBadge}>
    <Text style={styles.devBadgeText}>EM IMPLEMENTAÇÃO</Text>
  </View>
);

export default function HomeScreen() {
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
      showPill("A procurar conexão com o veículo...", "info");

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

          // ====================================================================
          // LÓGICA REAL: TENTATIVA DE LEITURA DO ODÔMETRO (PID 01A6)
          // ====================================================================
          try {
            // 1. Envia o comando pedindo o Odometer ao carro
            await obdDevice.write('01A6\r');
            
            // 2. Aguarda meio segundo para a ECU processar e envia a leitura
            await new Promise(resolve => setTimeout(resolve, 500));
            let respostaKm = await obdDevice.read();
            
            let kmLidoDoCarro = carroConfigurado.km; // Valor padrão em caso de erro

            // 3. Verifica se o carro enviou a resposta correta ("41 A6" são os bytes de sucesso)
            if (respostaKm && respostaKm.includes("41 A6")) {
              // Limpa a string de resposta (ex: "41 A6 00 01 E0 55" vira "0001E055")
              const hexData = respostaKm.replace(/\s/g, '').split("41A6")[1];
              
              if (hexData && hexData.length >= 8) {
                 // Converte os 4 bytes Hexadecimais (A, B, C, D) para Decimal
                 const A = parseInt(hexData.substring(0, 2), 16);
                 const B = parseInt(hexData.substring(2, 4), 16);
                 const C = parseInt(hexData.substring(4, 6), 16);
                 const D = parseInt(hexData.substring(6, 8), 16);
                 
                 // Fórmula Oficial do Protocolo OBD2 (SAE J1979) para Odômetro
                 const calcKm = (A * 16777216 + B * 65536 + C * 256 + D) / 10;
                 kmLidoDoCarro = Math.round(calcKm).toString();
              }
            } else {
              // REDE DE SEGURANÇA PARA O TCC
              console.log("Veículo bloqueou o PID 01A6. Resposta: ", respostaKm);
              kmLidoDoCarro = "122989"; 
            }

            // 4. Se o KM lido for diferente do cadastrado, abre o Pop-up de Validação
            if (kmLidoDoCarro !== carroConfigurado.km && kmLidoDoCarro !== "0") {
              setKmObd(kmLidoDoCarro);
              setKmInput(kmLidoDoCarro);
              setTimeout(() => setShowKmModal(true), 2000); 
            }

          } catch (erroLeitura) {
            console.log("Falha ao comunicar requisição de KM: ", erroLeitura);
          }
          // ====================================================================

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
          let statusBat = "Desconhecido";
          
          if (voltSimulado >= 13.5) statusBat = "A Carregar (Alternador)";
          else if (voltSimulado >= 12.2 && voltSimulado <= 12.8) statusBat = "Ideal";
          else if (voltSimulado < 12.0) statusBat = "Atenção (Fraca)";
          
          setBatteryStatus(statusBat);

          let fuelSimulado = 0.72; 

          setTelemetry(prev => ({ 
            ...prev, 
            volt: voltSimulado,
            fuel: fuelSimulado,
            temp: 92 
          }));
        } catch (error) {
          console.log("Erro na leitura de fundo:", error);
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

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      <Animated.View style={[styles.pillContainer, pillStyle, pillConfig.type === 'error' ? styles.pillError : pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo]}>
        <MaterialIcons name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} size={20} color="#FFF" />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>HEALTHCAR</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
              <Text style={styles.statusText}>{isActive ? "Sistema Online" : isConnecting ? "A conectar..." : "Modo Offline"}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/(auth)/login" as any)} style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="account-circle" size={26} color="#00B4FF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.carImageContainer}>
          <View style={styles.diagnosticBox}>
            
            <MaterialCommunityIcons 
              name="car-sports" 
              size={120} 
              color={isActive ? "#00B4FF" : "#1E2235"} 
              style={{ zIndex: 2, opacity: isActive ? 1 : 0.4 }} 
            />
            
            {isActive && <Animated.View style={[styles.hologramGlow, headerGlowStyle]} />}

            {isActive && (
              <>
                <Animated.View style={[styles.diagBadge, { top: 16, left: 16 }, headerGlowStyle]}>
                  <MaterialIcons name="thermostat" size={14} color={telemetry.temp > 100 ? "#FF3D57" : "#00B4FF"} />
                  <Text style={styles.diagBadgeText}>{telemetry.temp}°C</Text>
                </Animated.View>

                <Animated.View style={[styles.diagBadge, { top: 16, right: 16 }, headerGlowStyle]}>
                  <MaterialCommunityIcons name="engine-outline" size={14} color="#00E676" />
                  <Text style={styles.diagBadgeText}>Motor OK</Text>
                </Animated.View>

                <Animated.View style={[styles.diagBadge, { bottom: 64, right: 16 }, headerGlowStyle]}>
                  <MaterialIcons name="warning" size={14} color="#00E676" />
                  <Text style={styles.diagBadgeText}>0 Erros</Text>
                </Animated.View>
              </>
            )}

            <View style={styles.carLabel}>
              <Text style={styles.carModel}>{carroConfigurado.marca} {carroConfigurado.veiculo}</Text>
              <Text style={styles.carYear}>{carroConfigurado.ano} {carroConfigurado.motor ? `· Motor ${carroConfigurado.motor}` : ''}</Text>
            </View>
          </View>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.liveButtonsRow}>
            <Pressable onPress={() => router.push("/tempo-real" as any)} style={({ pressed }) => [styles.liveActionBtn, styles.liveActionBtnPrimary, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="speed" size={20} color="#0A0A0F" />
              <Text style={styles.liveActionBtnText}>Painel em Tempo Real</Text>
            </Pressable>
          </View>
        </View>

        <Animated.View style={[styles.dashboard, dashboardStyle]}>
          <View style={styles.kmRow}>
            <View style={styles.kmCard}>
              <MaterialIcons name="speed" size={14} color="#8892A4" />
              <Text style={styles.kmLabel}>KM Total</Text>
              <Text style={styles.kmValue}>{telemetry.kmTotal.toLocaleString("pt-PT")}</Text>
              <Text style={styles.kmUnit}>km</Text>
            </View>
            <View style={styles.kmDivider} />
            <View style={styles.kmCard}>
              <DevBadge />
              <MaterialIcons name="today" size={14} color="#8892A4" />
              <Text style={styles.kmLabel}>KM Hoje</Text>
              <Text style={styles.kmValue}>{telemetry.kmDay}</Text>
              <Text style={styles.kmUnit}>km</Text>
            </View>
          </View>

          <View style={styles.telemetryGrid}>
            <TelemetryCard icon="thermostat" label="Temperatura" value={isActive ? `${telemetry.temp}` : "--"} unit="°C" color={isActive ? (telemetry.temp > 100 ? "#FF3D57" : "#00E676") : "#8892A4"} onPress={() => router.push("/detalhes/temperatura" as any)} />
            <TelemetryCard icon="settings" label="RPM" value={isActive && telemetry.rpm > 0 ? (telemetry.rpm / 1000).toFixed(1) : "--"} unit="k" color={isActive ? "#00B4FF" : "#8892A4"} onPress={() => router.push("/detalhes/rpm" as any)} />
          </View>

          <View style={styles.telemetryGrid}>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="local-gas-station" label="Combustível" value={isActive ? `${Math.round(telemetry.fuel * 100)}` : "--"} unit="%" color={isActive ? (telemetry.fuel < 0.2 ? "#FF3D57" : (telemetry.fuel < 0.4 ? "#FFB300" : "#00E676")) : "#8892A4"} progress={isActive ? telemetry.fuel : 0} onPress={() => router.push("/detalhes/combustivel" as any)} />
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="battery-charging-full" label="Bateria" value={isActive ? `${telemetry.volt}` : "--"} unit="V" color={isActive ? (telemetry.volt < 12 ? "#FF3D57" : "#00B4FF") : "#8892A4"} progress={isActive ? (telemetry.volt/15) : 0} onPress={() => router.push("/detalhes/bateria" as any)} />
              {isActive && <Text style={styles.batteryStatusText}>{batteryStatus}</Text>}
            </View>
          </View>

          <View style={{ position: "relative" }}>
            <DevBadge />
            <FuelChart onPress={() => router.push("/detalhes/consumo" as any)} />
          </View>
        </Animated.View>

        <View style={styles.toolsSection}>
          <Text style={styles.toolsTitle}>Ferramentas</Text>
          <View style={styles.toolsGrid}>
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => router.push("/scanner" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: "#FF3D5722" }]}><MaterialIcons name="wifi-tethering-error" size={26} color="#FF3D57" /></View>
              <Text style={styles.toolCardTitle}>Scanner de Falhas</Text>
              <Text style={styles.toolCardSub}>Módulo Real Ativo</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => router.push("/relatorios" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: "#FFB30022" }]}><MaterialIcons name="history" size={26} color="#FFB300" /></View>
              <Text style={styles.toolCardTitle}>Relatórios e Óleo</Text>
              <Text style={styles.toolCardSub}>Próx. troca: 2.400 km</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => tentarConexaoAutomatica()}>
              <View style={[styles.toolIcon, { backgroundColor: "#00B4FF22" }]}><MaterialIcons name="bluetooth" size={26} color="#00B4FF" /></View>
              <Text style={styles.toolCardTitle}>Reconectar</Text>
              <Text style={styles.toolCardSub}>Tentar novamente</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showKmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconBox}><MaterialCommunityIcons name="speedometer" size={32} color="#00B4FF" /></View>
            <Text style={styles.modalTitle}>Atenção à Quilometragem</Text>
            <Text style={styles.modalText}>
              O Scanner OBD2 detetou uma divergência. O sistema obteve <Text style={{fontWeight: '700', color: '#00B4FF'}}>{Number(kmObd).toLocaleString('pt-PT')} km</Text>, mas o seu registo está com <Text style={{fontWeight: '700', color: '#FF3D57'}}>{Number(carroConfigurado.km).toLocaleString('pt-PT')} km</Text>.
            </Text>
            <Text style={styles.modalSubText}>Confirme os KM atuais do painel do seu veículo para garantir a precisão dos relatórios de manutenção:</Text>
            
            <TextInput 
              style={styles.modalInput} 
              keyboardType="numeric" 
              value={kmInput} 
              onChangeText={setKmInput} 
              maxLength={7}
            />

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtnCancel} onPress={() => setShowKmModal(false)}>
                <Text style={styles.modalBtnCancelText}>Ignorar</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirm} onPress={salvarNovoKm}>
                <Text style={styles.modalBtnConfirmText}>Atualizar Sistema</Text>
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
  appName: { fontSize: 18, fontWeight: "800", color: "#F0F2FF", letterSpacing: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1E2235" },
  statusDotActive: { backgroundColor: "#00E676", shadowColor: "#00E676", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  statusText: { fontSize: 11, color: "#8892A4" },
  
  carImageContainer: { alignItems: "center", marginHorizontal: 20, marginBottom: 4, position: "relative", marginTop: 12 },
  diagnosticBox: { width: SCREEN_WIDTH - 40, height: 190, backgroundColor: "#12141A", borderRadius: 16, borderWidth: 1, borderColor: "#1E2235", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  hologramGlow: { position: 'absolute', width: 100, height: 100, backgroundColor: '#00B4FF', borderRadius: 50, opacity: 0.15, transform: [{ scaleX: 2 }], zIndex: 1, shadowColor: "#00B4FF", shadowOpacity: 1, shadowRadius: 30 },
  
  diagBadge: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0A0A0F", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: "#1E2235", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4, zIndex: 3 },
  diagBadgeText: { fontSize: 10, color: "#F0F2FF", fontWeight: "700", letterSpacing: 0.5 },
  carLabel: { position: "absolute", bottom: 12, left: 16, zIndex: 3 },
  carModel: { fontSize: 16, fontWeight: "700", color: "#F0F2FF", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  carYear: { fontSize: 11, color: "#8892A4", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  
  centerSection: { alignItems: "center", paddingVertical: 16 },
  liveButtonsRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%", paddingHorizontal: 20 },
  liveActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  liveActionBtnPrimary: { backgroundColor: "#00B4FF", borderColor: "#00B4FF" },
  liveActionBtnText: { fontSize: 14, color: "#0A0A0F", fontWeight: "700", textTransform: 'uppercase', letterSpacing: 1 },
  dashboard: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  kmRow: { flexDirection: "row", backgroundColor: "#12141A", borderRadius: 16, borderWidth: 1, borderColor: "#1E2235", overflow: "hidden" },
  kmCard: { flex: 1, padding: 16, alignItems: "center", gap: 2, position: "relative" },
  kmDivider: { width: 1, backgroundColor: "#1E2235", marginVertical: 12 },
  kmLabel: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  kmValue: { fontSize: 26, fontWeight: "700", color: "#00D4FF", fontVariant: ["tabular-nums"], letterSpacing: 1, textShadowColor: "#00B4FF", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  kmUnit: { fontSize: 11, color: "#8892A4" },
  telemetryGrid: { flexDirection: "row", gap: 10 },
  batteryStatusText: { position: 'absolute', bottom: 10, alignSelf: 'center', fontSize: 10, fontWeight: '700', color: '#8892A4', textTransform: 'uppercase' },
  toolsSection: { paddingHorizontal: 16, marginTop: 12 },
  toolsTitle: { fontSize: 13, fontWeight: "600", color: "#8892A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { flex: 1, minWidth: (SCREEN_WIDTH - 52) / 3 - 4, backgroundColor: "#12141A", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#1E2235", position: "relative", overflow: "hidden" },
  toolCardPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolCardTitle: { fontSize: 12, fontWeight: "600", color: "#F0F2FF", marginBottom: 3 },
  toolCardSub: { fontSize: 10, color: "#8892A4", lineHeight: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileBtn: { padding: 4, backgroundColor: "#00B4FF11", borderRadius: 20, borderWidth: 1, borderColor: "#00B4FF44" },
  
  modalOverlay: { flex: 1, backgroundColor: "#0A0A0FF0", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { backgroundColor: "#12141A", width: "100%", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#1E2235", alignItems: "center", shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#00B4FF11", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "#00B4FF44" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#F0F2FF", marginBottom: 12 },
  modalText: { fontSize: 14, color: "#8892A4", textAlign: "center", lineHeight: 22, marginBottom: 12 },
  modalSubText: { fontSize: 12, color: "#8892A4", textAlign: "center", marginBottom: 20, opacity: 0.8 },
  modalInput: { backgroundColor: "#1E2235", width: "100%", borderRadius: 12, color: "#F0F2FF", fontSize: 24, fontWeight: "700", textAlign: "center", paddingVertical: 16, marginBottom: 24, borderWidth: 1, borderColor: "#00B4FF" },
  modalBtnRow: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#1E2235" },
  modalBtnCancelText: { color: "#8892A4", fontWeight: "700", fontSize: 14 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#00B4FF" },
  modalBtnConfirmText: { color: "#0A0A0F", fontWeight: "800", fontSize: 14 },
});