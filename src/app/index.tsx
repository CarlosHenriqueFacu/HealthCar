import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";

// Componentes UI
import { ScreenContainer } from "../components/screen-container";
import { TelemetryCard } from "../components/TelemetryCard";

// Bluetooth
import RNBluetoothClassic from "react-native-bluetooth-classic";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 0, fuel: 0, kmTotal: 0, kmDay: 0 };

const DevBadge = () => (
  <View style={styles.devBadge}>
    <Text style={styles.devBadgeText}>EM IMPLEMENTAÇÃO</Text>
  </View>
);

export default function HomeScreen() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [telemetry, setTelemetry] = useState(TELEMETRY_IDLE);
  
  // Estado para guardar os dados do carro vindo do Cadastro
  const [carroConfigurado, setCarroConfigurado] = useState({
    marca: 'Carregando...', veiculo: '', ano: '', motor: '', km: '0'
  });

  // ================= ESTADOS DA PÍLULA DE AVISO =================
  const [pillConfig, setPillConfig] = useState({ message: '', type: 'info' });
  const pillTranslateY = useSharedValue(-150); // Começa escondida fora da tela
  
  const dashboardOpacity = useSharedValue(0);
  const dashboardTranslate = useSharedValue(30);
  const headerGlow = useSharedValue(0);

  useKeepAwake();

  // Função para exibir a pílula animada
  const showPill = (message: string, type: 'success' | 'error' | 'info') => {
    setPillConfig({ message, type });
    pillTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 }); // Desce a pílula

    // Esconde a pílula depois de 4 segundos
    setTimeout(() => {
      pillTranslateY.value = withTiming(-150, { duration: 500 });
    }, 4000);
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pillTranslateY.value }],
  }));

  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: dashboardOpacity.value,
    transform: [{ translateY: dashboardTranslate.value }],
  }));

  const headerGlowStyle = useAnimatedStyle(() => ({
    opacity: headerGlow.value,
  }));

  // ================= LÓGICA DE AUTO-CONEXÃO =================
  useEffect(() => {
    const inicializarApp = async () => {
      // 1. Carrega os dados do veículo
      try {
        const dados = await AsyncStorage.getItem('@veiculo_cadastrado');
        if (dados !== null) {
          const veiculoSalvo = JSON.parse(dados);
          setCarroConfigurado(veiculoSalvo);
          setTelemetry(prev => ({ ...prev, kmTotal: Number(veiculoSalvo.km) }));
        }
      } catch (e) {
        console.log("Erro ao carregar dados", e);
      }

      // 2. Anima o painel subindo
      dashboardOpacity.value = withTiming(1, { duration: 600 });
      dashboardTranslate.value = withSpring(0, { damping: 18, stiffness: 120 });
      headerGlow.value = withTiming(1, { duration: 800 });

      // 3. Tenta conectar no Bluetooth automaticamente
      tentarConexaoAutomatica();
    };

    inicializarApp();
  }, []);

  async function tentarConexaoAutomatica() {
    try {
      setIsConnecting(true);
      showPill("Buscando conexão com o veículo...", "info");

      // Permissões Android 12+
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
        showPill("Bluetooth desativado. Ligue para conectar.", "error");
        setIsConnecting(false);
        return;
      }

      const paired = await RNBluetoothClassic.getBondedDevices();
      const obdDevice = paired.find(d => 
        d.name.toUpperCase().includes("OBD") || d.name.toUpperCase().includes("ELM") || d.name.toUpperCase().includes("V-LINK")
      );

      if (obdDevice) {
        const connected = await obdDevice.connect();
        if (connected) {
          showPill("Conectado ao scanner OBD2 com sucesso!", "success");
          setIsActive(true); 
        } else {
          showPill("Falha ao conectar. Equipamento fora de alcance?", "error");
        }
      } else {
        showPill("Nenhum scanner OBD2 pareado encontrado.", "error");
      }

    } catch (error: any) { 
      showPill(`Erro de conexão: ${error.message}`, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  // ================= RENDERIZAÇÃO =================
  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      {/* PÍLULA FLUTUANTE ANIMADA */}
      <Animated.View style={[styles.pillContainer, pillStyle, 
        pillConfig.type === 'error' ? styles.pillError : 
        pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo
      ]}>
        <MaterialIcons 
          name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} 
          size={20} 
          color="#FFF" 
        />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>HEALTHCAR</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
              <Text style={styles.statusText}>
                {isActive ? "Sistema Online" : isConnecting ? "Conectando..." : "Modo Offline"}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push("/(auth)/login" as any)} style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="account-circle" size={26} color="#00B4FF" />
            </Pressable>
          </View>
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
            <Text style={styles.carModel}>{carroConfigurado.marca} {carroConfigurado.veiculo}</Text>
            <Text style={styles.carYear}>{carroConfigurado.ano} · Motor {carroConfigurado.motor}</Text>
          </View>
        </View>

        {/* Botão Principal */}
        <View style={styles.centerSection}>
          <View style={styles.liveButtonsRow}>
            <Pressable onPress={() => router.push("/tempo-real" as any)} style={({ pressed }) => [styles.liveActionBtn, styles.liveActionBtnPrimary, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="speed" size={20} color="#0A0A0F" />
              <Text style={styles.liveActionBtnText}>Painel em Tempo Real</Text>
            </Pressable>
          </View>
        </View>

        {/* Painel de Instrumentos */}
        <Animated.View style={[styles.dashboard, dashboardStyle]}>
          <View style={styles.kmRow}>
            <View style={styles.kmCard}>
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
            <TelemetryCard icon="thermostat" label="Temp" value="--" unit="°C" color="#8892A4" onPress={() => {}} />
            <TelemetryCard icon="settings" label="RPM" value="--" unit="k" color="#8892A4" onPress={() => {}} />
          </View>
        </Animated.View>

        {/* Ferramentas */}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ESTILOS DA PÍLULA
  pillContainer: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 30, zIndex: 100, gap: 10, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  pillInfo: { backgroundColor: '#00B4FF' },
  pillSuccess: { backgroundColor: '#00E676' },
  pillError: { backgroundColor: '#FF3D57' },
  pillText: { color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 },

  // RESTANTE DOS ESTILOS
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
  carImage: { width: SCREEN_WIDTH - 40, height: 190, borderRadius: 16 },
  carGlow: { position: "absolute", bottom: 30, left: 20, right: 20, height: 40, backgroundColor: "#00B4FF", borderRadius: 20, opacity: 0.15, shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  carStripe: { position: "absolute", top: 0, left: 20, right: 20, height: 6, backgroundColor: "#00B4FF", borderTopLeftRadius: 16, borderTopRightRadius: 16, shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  carLabel: { position: "absolute", bottom: 12, left: 16 },
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
});