import { ScreenContainer } from "@/components/screen-container";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

import RNBluetoothClassic from "react-native-bluetooth-classic";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MOCK_DATA = {
  fuel: 0.72,
  kmTraveled: 142,
  fuelConsumption: 8.5,
};

export default function RealtimeScreen() {
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [displayKm, setDisplayKm] = useState(MOCK_DATA.kmTraveled);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");
  
  // ESTADO PARA O MODO RAIO-X (DEBUG)
  const [debugLog, setDebugLog] = useState("Aguardando dados brutos do Bluetooth...");

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let isActive = true;

    async function perguntarAoCarro(device: any, comando: string) {
      try {
        // Limpa qualquer lixo que tenha ficado no buffer antes de perguntar
        const lixo = await device.read(); 
        
        await device.write(comando + "\r");
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const resposta = await device.read();
        return resposta || "";
      } catch (err) {
        return "";
      }
    }

    async function startReading() {
      try {
        const devices = await RNBluetoothClassic.getConnectedDevices();
        
        if (devices.length > 0) {
          const device = devices[0];
          setIsReading(true);

          setStatusMsg("CONFIGURANDO ADAPTADOR...");
          await perguntarAoCarro(device, "ATZ"); 
          await new Promise(resolve => setTimeout(resolve, 500));
          await perguntarAoCarro(device, "ATE0"); 
          await perguntarAoCarro(device, "ATL0"); 
          await perguntarAoCarro(device, "ATSP0"); 

          setStatusMsg("NEGOCIANDO PROTOCOLO COM O CARRO...");
          await device.write("010C\r"); 
          await new Promise(resolve => setTimeout(resolve, 4000)); 
          await device.read(); 

          if (!isActive) return;

          setStatusMsg("LENDO DADOS DO CARRO");

          interval = setInterval(async () => {
            try {
              // Lendo o RPM e jogando o texto bruto na tela para visualizarmos
              const rpmResp = await perguntarAoCarro(device, "010C");
              
              // ATUALIZA A TELA COM O TEXTO EXATO QUE O BLUETOOTH DEVOLVEU
              setDebugLog(`Comando 010C retornou:\n"${rpmResp}"`);

              const realRpm = parseOBD(rpmResp, "0C");
              if (realRpm > 0) setDisplayRpm(realRpm);

              const tempResp = await perguntarAoCarro(device, "0105");
              const realTemp = parseOBD(tempResp, "05");
              if (realTemp > 0) setDisplayTemp(realTemp);

            } catch (err) {
              setDebugLog("Erro no loop: " + JSON.stringify(err));
            }
          }, 1500); 
        }
      } catch (error) {
        setStatusMsg("FALHA NA CONEXÃO");
      }
    }

    startReading();

    return () => {
      isActive = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  function parseOBD(response: any, pid: string): number {
    if (!response) return 0;
    const strResponse = String(response);
    
    if (strResponse.includes("NO DATA") || strResponse.includes("SEARCHING") || strResponse.includes("ERROR")) {
      return 0;
    }
    
    const cleanResp = strResponse.replace(/\s/g, "").toUpperCase();
    const target = "41" + pid;
    const index = cleanResp.indexOf(target);
    
    if (index !== -1) {
      const dataHex = cleanResp.substring(index + 4);
      try {
        if (pid === "0C") { 
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D") { 
          return parseInt(dataHex.substring(0, 2), 16);
        }
        else if (pid === "05") { 
          return parseInt(dataHex.substring(0, 2), 16) - 40;
        }
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));
  const speedometerStyle = useAnimatedStyle(() => ({ transform: [{ scale: speedometerScale.value }] }));

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Tempo Real</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.liveBadge, headerGlowStyle]}>
          <View style={[styles.liveDot, isReading && { backgroundColor: "#00E676", shadowColor: "#00E676" }]} />
          <Text style={styles.liveBadgeText}>{statusMsg}</Text>
        </Animated.View>

        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          <SpeedometerMinimal speed={displaySpeed} isActive={isReading} />
        </Animated.View>

        <View style={styles.primaryTelemetry}>
          <View style={styles.telemetryRow}>
            <TelemetryCard icon="directions" label="KM Percorrido" value={displayKm.toFixed(1)} unit="km" color="#00B4FF" />
            <TelemetryCard icon="settings" label="RPM" value={displayRpm > 0 ? (displayRpm / 1000).toFixed(1) : "0.0"} unit="k" color="#00B4FF" />
          </View>
          <View style={styles.telemetryRow}>
            <TelemetryCard icon="thermostat" label="Temperatura" value={`${displayTemp}`} unit="°C" color={displayTemp > 100 ? "#FF3D57" : displayTemp > 85 ? "#FFB300" : "#00E676"} />
            <TelemetryCard icon="local-gas-station" label="Combustível" value={`${Math.round(MOCK_DATA.fuel * 100)}`} unit="%" color={MOCK_DATA.fuel < 0.2 ? "#FF3D57" : MOCK_DATA.fuel < 0.4 ? "#FFB300" : "#00E676"} progress={MOCK_DATA.fuel} />
          </View>
        </View>

        {/* =========================================================
            PAINEL DE MODO RAIO-X (DEBUG LOG)
        ========================================================= */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>RAIO-X DO BLUETOOTH (DEBUG)</Text>
          <Text style={styles.debugText}>{debugLog}</Text>
        </View>

        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name="stop-circle" size={20} color="#FF3D57" />
          <Text style={styles.stopBtnText}>Voltar</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1E2235" },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#F0F2FF" },
  headerSpacer: { width: 30 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00B4FF22", borderWidth: 1, borderColor: "#00B4FF44", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "center", marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3D57", shadowColor: "#FF3D57", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  liveBadgeText: { fontSize: 11, fontWeight: "700", color: "#00B4FF", letterSpacing: 1 },
  speedometerWrapper: { alignItems: "center", paddingVertical: 16 },
  primaryTelemetry: { gap: 10 },
  telemetryRow: { flexDirection: "row", gap: 10 },
  
  // Estilos do painel de Debug
  debugSection: { backgroundColor: "#1A0000", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#FF3D57", marginTop: 10 },
  debugTitle: { fontSize: 11, fontWeight: "800", color: "#FF3D57", marginBottom: 8, letterSpacing: 1 },
  debugText: { fontSize: 12, color: "#FFF", fontFamily: "monospace", minHeight: 60 },

  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5722", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 12 },
  stopBtnText: { fontSize: 14, fontWeight: "600", color: "#FF3D57" },
});