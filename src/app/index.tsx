import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { EngineButton } from "../components/EngineButton";
import { FuelChart } from "../components/FuelChart";
import { ScreenContainer } from "../components/screen-container";
import { TelemetryCard } from "../components/TelemetryCard";

// Biblioteca oficial do Bluetooth
import RNBluetoothClassic from "react-native-bluetooth-classic";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 20, fuel: 0.72, kmTotal: 48320, kmDay: 0 };
const TELEMETRY_LIVE = { speed: 87, rpm: 3200, temp: 92, fuel: 0.72, kmTotal: 48320, kmDay: 142 };

// ================= COMPONENTE DA ETIQUETA VERMELHA =================
const DevBadge = () => (
  <View style={styles.devBadge}>
    <Text style={styles.devBadgeText}>EM IMPLEMENTAÇÃO</Text>
  </View>
);

export default function HomeScreen() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [telemetry, setTelemetry] = useState(TELEMETRY_IDLE);
  
  const dashboardOpacity = useSharedValue(0);
  const dashboardTranslate = useSharedValue(30);
  const headerGlow = useSharedValue(0);

  useKeepAwake();

 // Função para Conectar o Scanner (Controla Simulação vs Carro Real)
  async function conectarScanner() {
    try {
      setIsConnecting(true);

      // ==========================================================
      // MODO 1: SIMULAÇÃO (Desativado para o teste no carro)
      // ==========================================================
      /*
      ToastAndroid.show("Simulando busca pelo Scanner OBD2...", ToastAndroid.SHORT);
      await new Promise(resolve => setTimeout(resolve, 2000));
      ToastAndroid.show("Comunicação Estabelecida (Modo Teste)!", ToastAndroid.SHORT);
      setIsActive(true);
     */ 

      // ==========================================================
      // MODO 2: CARRO REAL (Ativado!)
      // ==========================================================
      ToastAndroid.show("Procurando Scanner OBD2...", ToastAndroid.SHORT);
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        ToastAndroid.show("Por favor, ative o Bluetooth!", ToastAndroid.LONG);
        setIsConnecting(false);
        return;
      }

      const paired = await RNBluetoothClassic.getBondedDevices();
      const obdDevice = paired.find(d => 
        d.name.toUpperCase().includes("OBD") || d.name.toUpperCase().includes("ELM")
      );

      if (obdDevice) {
        ToastAndroid.show(`Conectando ao ${obdDevice.name}...`, ToastAndroid.SHORT);
        const connected = await obdDevice.connect();
        
        if (connected) {
          ToastAndroid.show("Comunicação Estabelecida!", ToastAndroid.SHORT);
          setIsActive(true); 
        } else {
          ToastAndroid.show("Falha ao conectar no Scanner", ToastAndroid.SHORT);
        }
      } else {
        ToastAndroid.show("Nenhum scanner pareado encontrado.", ToastAndroid.LONG);
      }
      // ========================================================== 

    } catch (error: any) { 
      ToastAndroid.show("Erro: " + error.message, ToastAndroid.SHORT);
    } finally {
      setIsConnecting(false);
    }
  }

  async function desconectarScanner() {
    try {
      const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
      for (const device of connectedDevices) {
        await device.disconnect();
      }
      setIsActive(false);
      ToastAndroid.show("Scanner Desconectado", ToastAndroid.SHORT);
    } catch (error) {
      console.log("Erro ao desconectar:", error);
    }
  }

  useEffect(() => {
    if (isActive) {
      dashboardOpacity.value = withTiming(1, { duration: 600 });
      dashboardTranslate.value = withSpring(0, { damping: 18, stiffness: 120 });
      headerGlow.value = withTiming(1, { duration: 800 });
      setTelemetry(TELEMETRY_LIVE);
    } else {
      dashboardOpacity.value = withTiming(0, { duration: 400 });
      dashboardTranslate.value = withTiming(20, { duration: 400 });
      headerGlow.value = withTiming(0, { duration: 400 });
      setTelemetry(TELEMETRY_IDLE);
    }
  }, [isActive]);

  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: dashboardOpacity.value,
    transform: [{ translateY: dashboardTranslate.value }],
  }));

  const headerGlowStyle = useAnimatedStyle(() => ({
    opacity: headerGlow.value,
  }));

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>CAMARO MONITOR</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
              <Text style={styles.statusText}>
                {isActive ? "OBD2 Conectado" : isConnecting ? "Conectando..." : "Aguardando conexão"}
              </Text>
            </View>
          </View>
          <Animated.View style={[styles.headerBadge, headerGlowStyle]}>
            <MaterialIcons name="bluetooth-connected" size={16} color="#00B4FF" />
            <Text style={styles.headerBadgeText}>LIVE</Text>
          </Animated.View>
        </View>

        {/* Imagem do Carro */}
        <View style={styles.carImageContainer}>
          <Image
            source={{ uri: "https://d2xsxph8kpxj0f.cloudfront.net/310519663433452387/RkVtSRJXECQr55xo8iLC5Y/camaro-hero-KnANvQ4TSLfeLGSuFBr576.webp" }}
            style={styles.carImage}
            resizeMode="cover"
          />
          {isActive && (
            <>
              <Animated.View style={[styles.carGlow, headerGlowStyle]} />
              <View style={styles.carStripe} />
            </>
          )}
          <View style={styles.carLabel}>
            <Text style={styles.carModel}>Chevrolet Camaro SS</Text>
            <Text style={styles.carYear}>2023 · V8 6.2L</Text>
          </View>
        </View>

        {/* Botão de Conexão */}
        <View style={styles.centerSection}>
          {!isActive ? (
            <View style={styles.buttonSection}>
              <Text style={styles.startHint}>Pressione para conectar</Text>
              <EngineButton isActive={isActive} onPress={conectarScanner} disabled={isConnecting} />
              <Text style={styles.startSubHint}>Bluetooth ELM327</Text>
            </View>
          ) : (
            <View style={styles.liveSection}>
              <View style={styles.liveButtonsRow}>
                <Pressable onPress={() => router.push("/tempo-real" as any)} style={({ pressed }) => [styles.liveActionBtn, styles.liveActionBtnPrimary, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="speed" size={18} color="#0A0A0F" />
                  <Text style={styles.liveActionBtnText}>Tempo Real</Text>
                </Pressable>
                <Pressable onPress={desconectarScanner} style={({ pressed }) => [styles.liveActionBtn, pressed && { opacity: 0.7 }]}>
                  <MaterialIcons name="power-settings-new" size={18} color="#FF3D57" />
                  <Text style={styles.stopButtonText}>Desconectar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Painel de Instrumentos */}
        <Animated.View style={[styles.dashboard, dashboardStyle]} pointerEvents={isActive ? "auto" : "none"}>
          
          <View style={styles.kmRow}>
            <View style={styles.kmCard}>
              <DevBadge />
              <MaterialIcons name="speed" size={14} color="#8892A4" />
              <Text style={styles.kmLabel}>KM Total</Text>
              <Text style={styles.kmValue}>{telemetry.kmTotal.toLocaleString("pt-BR")}</Text>
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
            <TelemetryCard 
              icon="thermostat" 
              label="Temperatura" 
              value={`${telemetry.temp}`} 
              unit="°C" 
              color={telemetry.temp > 100 ? "#FF3D57" : telemetry.temp > 85 ? "#FFB300" : "#00E676"} 
              onPress={() => router.push("/detalhes/temperatura" as any)}
            />
            <TelemetryCard 
              icon="settings" 
              label="RPM" 
              value={telemetry.rpm > 0 ? (telemetry.rpm / 1000).toFixed(1) : "0.0"} 
              unit="k" 
              color="#00B4FF" 
              onPress={() => router.push("/detalhes/rpm" as any)}
            />
          </View>

          <View style={styles.telemetryGrid}>
            <View style={{ flex: 1, position: "relative" }}>
              <DevBadge />
              <TelemetryCard 
                icon="local-gas-station" 
                label="Combustível" 
                value={`${Math.round(telemetry.fuel * 100)}`} 
                unit="%" 
                color={telemetry.fuel < 0.2 ? "#FF3D57" : telemetry.fuel < 0.4 ? "#FFB300" : "#00E676"} 
                progress={telemetry.fuel} 
                onPress={() => router.push("/detalhes/combustivel" as any)}
              />
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <DevBadge />
              <TelemetryCard 
                icon="battery-charging-full" 
                label="Bateria" 
                value="12.6" 
                unit="V" 
                color="#00B4FF" 
                progress={0.85} 
                onPress={() => router.push("/detalhes/bateria" as any)}
              />
            </View>
          </View>

          <View style={{ position: "relative" }}>
            <DevBadge />
            <FuelChart onPress={() => router.push("/detalhes/consumo" as any)} />
          </View>

        </Animated.View>

        {/* Ferramentas */}
        <View style={styles.toolsSection}>
          <Text style={styles.toolsTitle}>Ferramentas</Text>
          <View style={styles.toolsGrid}>
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => router.push("/scanner" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: "#FF3D5722" }]}>
                <MaterialIcons name="wifi-tethering-error" size={26} color="#FF3D57" />
              </View>
              <Text style={styles.toolCardTitle}>Scanner de Falhas</Text>
              <Text style={styles.toolCardSub}>Módulo Real Ativo</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => router.push("/relatorios" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: "#FFB30022" }]}>
                <MaterialIcons name="history" size={26} color="#FFB300" />
              </View>
              <Text style={styles.toolCardTitle}>Relatórios e Óleo</Text>
              <Text style={styles.toolCardSub}>Próx. troca: 2.400 km</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]} onPress={() => router.push("/configuracoes" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: "#00B4FF22" }]}>
                <MaterialIcons name="settings" size={26} color="#00B4FF" />
              </View>
              <Text style={styles.toolCardTitle}>Configurar Veículo</Text>
              <Text style={styles.toolCardSub}>OBD2 · Bluetooth</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  devBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#FF3D57", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, zIndex: 99, elevation: 4 },
  devBadgeText: { fontSize: 7, fontWeight: "900", color: "#FFF", textTransform: "uppercase" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  appName: { fontSize: 18, fontWeight: "800", color: "#F0F2FF", letterSpacing: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1E2235" },
  statusDotActive: { backgroundColor: "#00E676", shadowColor: "#00E676", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  statusText: { fontSize: 11, color: "#8892A4" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#00B4FF22", borderWidth: 1, borderColor: "#00B4FF44", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { fontSize: 11, fontWeight: "700", color: "#00B4FF", letterSpacing: 1 },
  carImageContainer: { alignItems: "center", marginHorizontal: 20, marginBottom: 4, position: "relative" },
  carImage: { width: SCREEN_WIDTH - 40, height: 190, borderRadius: 16 },
  carGlow: { position: "absolute", bottom: 30, left: 20, right: 20, height: 40, backgroundColor: "#00B4FF", borderRadius: 20, opacity: 0.15, shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  carStripe: { position: "absolute", top: 0, left: 20, right: 20, height: 6, backgroundColor: "#00B4FF", borderTopLeftRadius: 16, borderTopRightRadius: 16, shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  carLabel: { position: "absolute", bottom: 12, left: 16 },
  carModel: { fontSize: 16, fontWeight: "700", color: "#F0F2FF", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  carYear: { fontSize: 11, color: "#8892A4", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  centerSection: { alignItems: "center", paddingVertical: 20 },
  buttonSection: { alignItems: "center", gap: 12 },
  startHint: { fontSize: 12, color: "#8892A4", letterSpacing: 1, textTransform: "uppercase" },
  startSubHint: { fontSize: 11, color: "#00B4FF", letterSpacing: 2, textTransform: "uppercase", opacity: 0.8 },
  liveSection: { alignItems: "center", gap: 12 },
  liveButtonsRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%" },
  liveActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#FF3D5744", backgroundColor: "#FF3D5711" },
  liveActionBtnPrimary: { backgroundColor: "#00B4FF", borderColor: "#00B4FF" },
  liveActionBtnText: { fontSize: 12, color: "#0A0A0F", fontWeight: "600" },
  stopButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#FF3D5744", backgroundColor: "#FF3D5711" },
  stopButtonText: { fontSize: 12, color: "#FF3D57", fontWeight: "600" },
  dashboard: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  kmRow: { flexDirection: "row", backgroundColor: "#12141A", borderRadius: 16, borderWidth: 1, borderColor: "#1E2235", overflow: "hidden" },
  kmCard: { flex: 1, padding: 16, alignItems: "center", gap: 2, position: "relative" },
  kmDivider: { width: 1, backgroundColor: "#1E2235", marginVertical: 12 },
  kmLabel: { fontSize: 10, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  kmValue: { fontSize: 26, fontWeight: "700", color: "#00D4FF", fontVariant: ["tabular-nums"], letterSpacing: 1, textShadowColor: "#00B4FF", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  kmUnit: { fontSize: 11, color: "#8892A4" },
  telemetryGrid: { flexDirection: "row", gap: 10 },
  toolsSection: { paddingHorizontal: 16, marginTop: 8 },
  toolsTitle: { fontSize: 13, fontWeight: "600", color: "#8892A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { flex: 1, minWidth: (SCREEN_WIDTH - 52) / 3 - 4, backgroundColor: "#12141A", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#1E2235", position: "relative", overflow: "hidden" },
  toolCardPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolCardTitle: { fontSize: 12, fontWeight: "600", color: "#F0F2FF", marginBottom: 3 },
  toolCardSub: { fontSize: 10, color: "#8892A4", lineHeight: 14 },
});