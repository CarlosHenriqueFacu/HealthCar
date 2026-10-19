import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { AppPalette } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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

/**
 * @component RealtimeScreen
 * @description Dashboard dinâmico para leitura e exibição de dados OBD-II em tempo real.
 * Utiliza integração cinemática para cálculo de distância em metros e filtro de média móvel (SMA)
 * para estabilização da leitura da boia de combustível.
 */
export default function RealtimeScreen() {
  const { theme, t } = useApp();
  
  const colors = AppPalette[theme];
  const bgColor = colors.background;
  const textColor = colors.text;

  // --- ESTADOS DO PAINEL ---
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [displayFuel, setDisplayFuel] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);

  const [isReading, setIsReading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");

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

      } catch (err) {
        console.warn("Falha ao atualizar a telemetria OBD-II:", err);
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
          } catch (e: any) {
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
        }
      } catch (error: any) {
        setStatusMsg("FALHA NA CONEXÃO");
        console.warn("Falha ao iniciar o monitoramento OBD-II:", error);
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
      <ScreenHeader title={t('painelTempoReal')} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status de Conexão */}
        <Animated.View style={[
          styles.liveBadge,
          headerGlowStyle,
          {
            backgroundColor: isReading ? `${colors.positive}18` : colors.surfaceMuted,
            borderColor: isReading ? `${colors.positive}44` : colors.border,
          },
        ]}>
          <View style={[styles.liveDot, { backgroundColor: isReading ? colors.positive : colors.warning }]} />
          <Text style={[styles.liveBadgeText, { color: isReading ? colors.positive : colors.textSecondary }]}>{statusMsg}</Text>
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

        {/* Botão Voltar */}
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name="arrow-back" size={20} color="#D94352" />
          <Text style={styles.stopBtnText}>{t('voltar')}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1685C518", borderWidth: 1, borderColor: "#1685C544", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "center", marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D94352" },
  liveBadgeText: { fontSize: 12, fontWeight: "700" },
  speedometerWrapper: { alignItems: "center", paddingVertical: 12 },
  primaryTelemetry: { gap: 12 },
  telemetryRow: { flexDirection: "row", gap: 12 },
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#D9435218", borderWidth: 1, borderColor: "#D9435244", borderRadius: 16, minHeight: 50, paddingVertical: 12 },
  stopBtnText: { fontSize: 14, fontWeight: "700", color: "#D94352" },
});