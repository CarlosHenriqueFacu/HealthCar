import { ScreenContainer } from "@/components/screen-container";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  NativeModules,
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
import { useApp } from '../contexts/AppContext';

const { OBDBluetooth } = NativeModules;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @component RealtimeScreen
 * @description Dashboard dinâmico para leitura e exibição de dados OBD-II em tempo real.
 * Utiliza integração cinemática para cálculo de distância em metros e filtro de média móvel (SMA)
 * para estabilização da leitura da boia de combustível.
 */
export default function RealtimeScreen() {
  const { theme, t } = useApp();
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const debugBg = isDark ? '#1A0000' : '#FEF2F2';
  const debugBorder = isDark ? '#00E676' : '#F87171';

  // --- ESTADOS DO PAINEL ---
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [displayFuel, setDisplayFuel] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);

  const [isReading, setIsReading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");
  const [debugLog, setDebugLog] = useState("Aguardando comunicação com a ECU...");

  // --- REFERÊNCIAS MÚTAVEIS PARA CÁLCULOS DE PRECISÃO EM TEMPO REAL ---
  const tripAccumulatorRef = useRef<number>(0);
  const lastSpeedTimeRef = useRef<number | null>(null);
  const fuelHistoryRef = useRef<number[]>([]);

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  useEffect(() => {
    let isActive = true; 
    let timerId: ReturnType<typeof setTimeout>;
    let cicloLentoCounter = 0; 

    /**
     * @method perguntarAoCarro
     * @description Encapsula o envio de comandos hexadecimais ao adaptador ELM327.
     * @param {string} comando - Código PID OBD-II (ex: 010C para RPM).
     * @returns {Promise<string>} Resposta bruta da ECU ou string de erro tratada.
     */
    async function perguntarAoCarro(comando: string): Promise<string> {
      try {
        const resposta = await OBDBluetooth.sendCommand(comando);
        return String(resposta);
      } catch (err: any) {
        return `ERRO: ${err?.message}`;
      }
    }

    /**
     * @method loopDeLeitura
     * @description Função recursiva que orquestra as requisições OBD-II.
     * Divide as leituras em ciclos rápidos (RPM/Velocidade) e lentos (Temp/Fuel) 
     * para evitar buffer overflow no microcontrolador ELM327.
     */
    async function loopDeLeitura() {
      if (!isActive) return;
      cicloLentoCounter++;

      try {
        let currentSpeed = 0;

        // --- CICLO RÁPIDO: Pede os dados urgentes em cada iteração ---
        
        // 1. RPM (PID 010C)
        const rpmResp = await perguntarAoCarro("010C");
        const realRpm = parseOBD(rpmResp, "0C");
        if (realRpm >= 0 && !rpmResp.includes("ERRO")) {
          setDisplayRpm(realRpm);
        }

        // 2. Velocidade (PID 010D) + Cálculo de Distância em Metros (TRIP)
        if (!rpmResp.includes("ERRO")) {
          const speedResp = await perguntarAoCarro("010D");
          const realSpeed = parseOBD(speedResp, "0D");
          
          if (realSpeed >= 0 && !speedResp.includes("ERRO")) {
            currentSpeed = realSpeed;
            setDisplaySpeed(realSpeed);

            // Integração Cinemática: Distância (km) = Velocidade (km/h) * Tempo (horas)
            const now = Date.now();
            if (lastSpeedTimeRef.current !== null && realSpeed > 0) {
              const deltaHours = (now - lastSpeedTimeRef.current) / 3600000;
              tripAccumulatorRef.current += realSpeed * deltaHours;
              setTripDistance(tripAccumulatorRef.current);
            }
            lastSpeedTimeRef.current = now;
          }
        }

        // --- CICLO LENTO: A cada 3 iterações (aprox. 4.5 segundos) ---
        if (cicloLentoCounter >= 3) {
          cicloLentoCounter = 0; 

          // 3. Temperatura do Líquido de Arrefecimento (PID 0105)
          const tempResp = await perguntarAoCarro("0105");
          const realTemp = parseOBD(tempResp, "05");
          if (realTemp > 0) setDisplayTemp(realTemp);

          // 4. Nível de Combustível Estabilizado (PID 012F)
          // Só realiza a leitura se o veículo estiver parado/lento (< 10 km/h) OU se ainda não tiver nenhuma leitura inicial.
          // Isso impede que a movimentação física do líquido no tanque gere oscilações falsas na tela.
          if (currentSpeed < 10 || fuelHistoryRef.current.length === 0) {
            const fuelResp = await perguntarAoCarro("012F");
            const rawFuel = parseOBD(fuelResp, "2F");
            
            if (rawFuel > 0) {
              // Filtro de Média Móvel Simples (SMA) com janela de 5 amostras
              fuelHistoryRef.current.push(rawFuel);
              if (fuelHistoryRef.current.length > 5) {
                fuelHistoryRef.current.shift();
              }
              const sum = fuelHistoryRef.current.reduce((acc, val) => acc + val, 0);
              const stabilizedFuel = Math.round(sum / fuelHistoryRef.current.length);
              setDisplayFuel(stabilizedFuel);
            }
          }
        }

        setDebugLog(
          `Status: OK | Ciclo Lento: ${cicloLentoCounter}/3\n` +
          `Trip: ${(tripAccumulatorRef.current * 1000).toFixed(0)} metros percorridos`
        );

      } catch (err) {
        setDebugLog("Erro no ciclo de leitura.");
      }

      if (isActive) {
        timerId = setTimeout(() => loopDeLeitura(), 1200); 
      }
    }

    /**
     * @method startReading
     * @description Verifica se o socket Bluetooth já está aberto pela HomeScreen.
     * Caso positivo, inicia a leitura imediatamente; caso negativo, executa o handshake completo.
     */
    async function startReading() {
      try {
        // 1. Tenta reaproveitar a conexão ativa da HomeScreen para abertura instantânea
        try {
          const checkConn = await OBDBluetooth.sendCommand("010C");
          if (checkConn && !String(checkConn).includes("ERR") && !String(checkConn).includes("TIMEOUT")) {
            setIsReading(true);
            setStatusMsg("LENDO DADOS DO CARRO");
            setDebugLog("Conexão ativa reaproveitada com sucesso!");
            lastSpeedTimeRef.current = Date.now();
            loopDeLeitura();
            return;
          }
        } catch (e) {
          // Conexão não estava ativa, segue para o fluxo normal de reconexão abaixo
        }

        // 2. Fluxo completo de conexão do zero (Fallback)
        const devices = await RNBluetoothClassic.getBondedDevices();
        
        const obdDevice = devices.find((d: any) => 
          d.name && (
            d.name.toUpperCase().includes("OBD") || 
            d.name.toUpperCase().includes("ELM") ||
            d.name.toUpperCase().includes("V-LINK")
          )
        );
        
        if (obdDevice) {
          setIsReading(true);
          setStatusMsg(`ABRINDO PORTA: ${obdDevice.name.toUpperCase()}`);
          
          try {
            await OBDBluetooth.connect(obdDevice.address);
            setDebugLog("Ponte Nativa Conectada!");
          } catch (e: any) {
            setDebugLog(`Falha na Ponte Nativa: ${e?.message}`);
            setStatusMsg("FALHA NA CONEXÃO");
            return; 
          }

          setStatusMsg("REINICIANDO ADAPTADOR...");
          await perguntarAoCarro("ATZ");
          await new Promise(resolve => setTimeout(resolve, 1500));

          setStatusMsg("CONFIGURANDO CANAIS...");
          await perguntarAoCarro("ATE0"); 
          await perguntarAoCarro("ATL0"); 
          await perguntarAoCarro("ATS0"); 
          await perguntarAoCarro("ATH0"); 
          await perguntarAoCarro("ATSP0"); 

          setStatusMsg("SINCRONIZANDO COM A ECU...");
          await perguntarAoCarro("0100"); 
          await new Promise(resolve => setTimeout(resolve, 1000)); 

          if (!isActive) return;

          setStatusMsg("LENDO DADOS DO CARRO");
          lastSpeedTimeRef.current = Date.now();
          loopDeLeitura(); 
        } else {
          setStatusMsg("NENHUM SCANNER OBD PAREADO");
          setDebugLog("FALHA: Vá nas configs Bluetooth e pareie primeiro.");
        }
      } catch (error: any) {
        setStatusMsg("FALHA NA CONEXÃO");
        setDebugLog(`Falha Crítica: ${error?.message}`);
      }
    }

    startReading();

    // Cleanup ao desmontar a tela: encerra apenas o timer local e preserva o socket Bluetooth aberto
    return () => {
      isActive = false; 
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  /**
   * @method parseOBD
   * @description Analisador sintático (Parser) das respostas seriais do scanner OBD-II.
   * Transforma as respostas hexadecimais brutas (Mode 01) em valores decimais legíveis.
   * @param {any} response - Resposta bruta do socket serial.
   * @param {string} pid - Código do sensor consultado (ex: "0C" para RPM).
   * @returns {number} Valor matemático calculado ou -1 em caso de falha de leitura.
   */
  function parseOBD(response: any, pid: string): number {
    if (!response) return -1;
    
    const strResponse = String(response).replace(/[\s>]/g, "").toUpperCase();
    
    if (
      strResponse.includes("NODATA") || 
      strResponse.includes("SEARCHING") || 
      strResponse.includes("ERROR") || 
      strResponse.includes("TIMEOUT") ||
      strResponse.includes("QUASE")
    ) {
      return -1;
    }
    
    const target = "41" + pid;
    const index = strResponse.indexOf(target);
    
    if (index !== -1) {
      const dataHex = strResponse.substring(index + 4);
      try {
        if (pid === "0C" && dataHex.length >= 4) { // RPM: ((A * 256) + B) / 4
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D" && dataHex.length >= 2) { // Velocidade: A
          return parseInt(dataHex.substring(0, 2), 16);
        }
        else if (pid === "05" && dataHex.length >= 2) { // Temperatura: A - 40
          return parseInt(dataHex.substring(0, 2), 16) - 40;
        }
        else if (pid === "2F" && dataHex.length >= 2) { // Nível de Combustível: (A * 100) / 255
          const A = parseInt(dataHex.substring(0, 2), 16);
          return Math.round((A * 100) / 255);
        }
      } catch (e) {
        return -1; 
      }
    }
    return -1;
  }

  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));
  const speedometerStyle = useAnimatedStyle(() => ({ transform: [{ scale: speedometerScale.value }] }));

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('painelTempoReal')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status de Conexão */}
        <Animated.View style={[styles.liveBadge, headerGlowStyle, !isDark && { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
          <View style={[styles.liveDot, isReading && { backgroundColor: "#00E676", shadowColor: "#00E676" }]} />
          <Text style={styles.liveBadgeText}>{statusMsg}</Text>
        </Animated.View>

        {/* Velocímetro Real */}
        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          <SpeedometerMinimal speed={displaySpeed} isActive={isReading} />
        </Animated.View>

        {/* Cards de Telemetria */}
        <View style={styles.primaryTelemetry}>
          <View style={styles.telemetryRow}>
            <TelemetryCard icon="directions" label="TRIP (VIAGEM)" value={tripDistance.toFixed(1)} unit="km" color="#00B4FF" />
            <TelemetryCard icon="settings" label="RPM" value={displayRpm > 0 ? (displayRpm / 1000).toFixed(1) : "0.0"} unit="k" color="#00B4FF" />
          </View>
          <View style={styles.telemetryRow}>
            <TelemetryCard icon="thermostat" label={t('temperatura')} value={`${displayTemp}`} unit="°C" color={displayTemp > 100 ? "#FF3D57" : displayTemp > 85 ? "#FFB300" : "#00E676"} />
            <TelemetryCard icon="local-gas-station" label={t('combustivel')} value={`${displayFuel}`} unit="%" color={displayFuel < 20 ? "#FF3D57" : displayFuel < 40 ? "#FFB300" : "#00E676"} progress={displayFuel / 100} />
          </View>
        </View>

        {/* Log de Debug Visual */}
        <View style={[styles.debugSection, { backgroundColor: debugBg, borderColor: debugBorder }]}>
          <Text style={[styles.debugTitle, { color: debugBorder }]}>RAIO-X DO BLUETOOTH (DEBUG)</Text>
          <Text style={[styles.debugText, !isDark && { color: '#7F1D1D' }]}>{debugLog}</Text>
        </View>

        {/* Botão Voltar */}
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name="stop-circle" size={20} color="#FF3D57" />
          <Text style={styles.stopBtnText}>Voltar</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
  headerSpacer: { width: 30 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00B4FF22", borderWidth: 1, borderColor: "#00B4FF44", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "center", marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3D57", shadowColor: "#FF3D57", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  liveBadgeText: { fontSize: 11, fontWeight: "700", color: "#00B4FF", letterSpacing: 1 },
  speedometerWrapper: { alignItems: "center", paddingVertical: 16 },
  primaryTelemetry: { gap: 10 },
  telemetryRow: { flexDirection: "row", gap: 10 },
  debugSection: { borderRadius: 12, padding: 16, borderWidth: 1, marginTop: 10 },
  debugTitle: { fontSize: 11, fontWeight: "800", marginBottom: 8, letterSpacing: 1 },
  debugText: { fontSize: 13, color: "#FFF", fontFamily: "monospace", minHeight: 60 },
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5722", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 12 },
  stopBtnText: { fontSize: 14, fontWeight: "600", color: "#FF3D57" },
});