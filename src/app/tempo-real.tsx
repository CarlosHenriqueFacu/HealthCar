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
  View,
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
};

export default function RealtimeScreen() {
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [displayKm, setDisplayKm] = useState(MOCK_DATA.kmTraveled);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");
  
  const [debugLog, setDebugLog] = useState("Aguardando comunicação com a ECU...");

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  useEffect(() => {
    let isActive = true;
    let timerId: ReturnType<typeof setTimeout>;
    
    // === PLANO B: ESCUTA ATIVA (EVENT LISTENER) ===
    async function perguntarAoCarro(device: any, comando: string) {
      return new Promise(async (resolve) => {
        let tempBuffer = "";
        let espiaoDeDados: any = null;
        let cronometroTimeout: any = null;

        // Função interna para limpar o espião e devolver o resultado
        const finalizar = (resultado: string) => {
          if (cronometroTimeout) clearTimeout(cronometroTimeout);
          if (espiaoDeDados) {
            try { espiaoDeDados.remove(); } catch(e) {}
          }
          resolve(resultado);
        };

        try {
          // 1. Limpa qualquer lixo da memória antes de começar
          try { await device.clear(); } catch(e) {}

          // 2. Arma o espião ANTES de enviar o comando
          espiaoDeDados = device.onDataReceived((event: any) => {
            if (event && event.data) {
              tempBuffer += String(event.data);
              
              // Se o espião detectar o caractere de finalização do OBD2
              if (tempBuffer.includes(">")) {
                finalizar(tempBuffer);
              }
            }
          });

          // 3. Inicia a contagem regressiva de segurança (2.5 segundos)
          cronometroTimeout = setTimeout(() => {
            if (tempBuffer.trim().length > 0) {
              finalizar("QUASE LÁ: " + tempBuffer);
            } else {
              finalizar("TIMEOUT: O ouvinte não capturou nada");
            }
          }, 2500);

          // 4. Dispara o comando para o carro
          await device.write(comando + "\r");

        } catch (error: any) {
          finalizar(`ERRO NO COMANDO: ${error?.message || 'Falha'}`);
        }
      });
    }

    async function loopDeLeitura(device: any) {
      if (!isActive) return;

      try {
        const rpmResp = await perguntarAoCarro(device, "010C");
        setDebugLog(`Comando 010C (RPM):\n"${rpmResp}"`);
        
        const realRpm = parseOBD(rpmResp, "0C");
        if (realRpm > 0) setDisplayRpm(realRpm);

        const tempResp = await perguntarAoCarro(device, "0105");
        const realTemp = parseOBD(tempResp, "05");
        if (realTemp > 0) setDisplayTemp(realTemp);

      } catch (err) {
        setDebugLog("Erro no ciclo de leitura.");
      }

      if (isActive) {
        timerId = setTimeout(() => loopDeLeitura(device), 1000); 
      }
    }

    async function startReading() {
      try {
        const devices = await RNBluetoothClassic.getBondedDevices();
        
        const obdDevice = devices.find((d: any) => 
          d.name && (
            d.name.toUpperCase().includes("OBD") || 
            d.name.toUpperCase().includes("ELM") ||
            d.name.toUpperCase().includes("VLINK")
          )
        );
        
        if (obdDevice) {
          setIsReading(true);

          setStatusMsg(`ABRINDO PORTA: ${obdDevice.name.toUpperCase()}`);
          
          const socketAberto = await obdDevice.isConnected();
          if (!socketAberto) {
             try {
                await obdDevice.connect({ delimiter: '>' });
             } catch (e) {
                await obdDevice.connect();
             }
          }

          setStatusMsg("REINICIANDO ADAPTADOR...");
          await perguntarAoCarro(obdDevice, "ATZ"); 
          await new Promise(resolve => setTimeout(resolve, 1500)); 

          setStatusMsg("CONFIGURANDO CANAIS...");
          await perguntarAoCarro(obdDevice, "ATE0"); 
          await perguntarAoCarro(obdDevice, "ATL0"); 
          await perguntarAoCarro(obdDevice, "ATS0"); 
          await perguntarAoCarro(obdDevice, "ATH0"); 
          await perguntarAoCarro(obdDevice, "ATSP0"); 

          setStatusMsg("SINCRONIZANDO COM A ECU...");
          await perguntarAoCarro(obdDevice, "0100"); 
          await new Promise(resolve => setTimeout(resolve, 1000)); 

          if (!isActive) return;

          setStatusMsg("LENDO DADOS DO CARRO");
          loopDeLeitura(obdDevice);
        } else {
          setStatusMsg("NENHUM SCANNER OBD PAREADO");
          setDebugLog("FALHA: Vá nas configurações Bluetooth do celular e pareie o scanner OBD2 primeiro.");
        }
      } catch (error: any) {
        setStatusMsg("FALHA NA CONEXÃO");
        setDebugLog(`Falha Crítica: ${error?.message}`);
      }
    }

    startReading();

    return () => {
      isActive = false; 
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  function parseOBD(response: any, pid: string): number {
    if (!response) return 0;
    
    const strResponse = String(response).replace(/[\s>]/g, "").toUpperCase();
    
    if (
      strResponse.includes("NODATA") || 
      strResponse.includes("SEARCHING") || 
      strResponse.includes("ERROR") || 
      strResponse.includes("TIMEOUT") ||
      strResponse.includes("QUASE")
    ) {
      return 0;
    }
    
    const target = "41" + pid;
    const index = strResponse.indexOf(target);
    
    if (index !== -1) {
      const dataHex = strResponse.substring(index + 4);
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
  debugSection: { backgroundColor: "#1A0000", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#00E676", marginTop: 10 },
  debugTitle: { fontSize: 11, fontWeight: "800", color: "#00E676", marginBottom: 8, letterSpacing: 1 },
  debugText: { fontSize: 13, color: "#FFF", fontFamily: "monospace", minHeight: 60 },
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5722", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 12 },
  stopBtnText: { fontSize: 14, fontWeight: "600", color: "#FF3D57" },
});