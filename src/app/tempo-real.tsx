import { ScreenContainer } from "@/components/screen-container";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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

import * as Notifications from 'expo-notifications';
import RNBluetoothClassic from "react-native-bluetooth-classic";

import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { atualizarDistanciaSessaoLocal, iniciarSessaoLocal, obterResumoSessoes, obterVeiculoLocal, salvarLeituraTelemetria } from '@/database/database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,   
  }),
});

const { OBDBluetooth } = NativeModules;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RealtimeScreen() {
  const { theme, t } = useApp();
  const { user } = useAuth();
  const tripStorageKey = user?.uid ? `@viagem_atual:${user.uid}` : null;
  const faultCountStorageKey = user?.uid ? `@falhas_count:${user.uid}` : null;
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [displayFuel, setDisplayFuel] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);

  const [isReading, setIsReading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");

  const tripAccumulatorRef = useRef<number>(0);
  const lastSpeedTimeRef = useRef<number | null>(null);
  const fuelHistoryRef = useRef<number[]>([]);
  const currentSessionRef = useRef<string | null>(null);
  const currentTempRef = useRef<number>(0);
  const currentFuelRef = useRef<number>(0);
  
  const alertThrottlerRef = useRef({ temp: 0, volt: 0, dtc: 0 });
  const loopTimerRef = useRef<any>(null);

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  const dispararAlerta = async (titulo: string, mensagem: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: mensagem, sound: true }, trigger: null, 
    });
  };

  function contarErrosDTC(response: string): number {
    if (!response) return 0;
    const clean = String(response).replace(/[\s\r\n>]/g, "").toUpperCase();
    if (clean.includes("NODATA") || clean.includes("ERROR") || clean.includes("SEARCHING")) return 0;

    const idx = clean.indexOf("43");
    if (idx === -1) return 0;

    const hexData = clean.substring(idx + 2);
    if (hexData.length < 2) return 0;

    const count = parseInt(hexData.substring(0, 2), 16);
    return isNaN(count) ? 0 : count;
  }

  useFocusEffect(
    useCallback(() => {
      let isActive = true; 
      let cicloLentoCounter = 0; 
      let amostragemDbCounter = 0;
      currentSessionRef.current = null;
      tripAccumulatorRef.current = 0;
      setTripDistance(0);

      const syncViagemGlobal = async () => {
        try {
          const viagemSalva = tripStorageKey ? await AsyncStorage.getItem(tripStorageKey) : null;
          if (viagemSalva) {
            const val = parseFloat(viagemSalva);
            if (!isNaN(val)) {
              tripAccumulatorRef.current = val;
              setTripDistance(val);
            }
          }
        } catch (e) {}
      };
      syncViagemGlobal();

      async function perguntarAoCarro(comando: string): Promise<string> {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT_HW")), 2500)
          );
          
          const resposta = await Promise.race([
            OBDBluetooth.sendCommand(comando),
            timeoutPromise
          ]);
          
          return String(resposta);
        } catch (err: any) {
          return `ERRO: ${err?.message}`;
        }
      }

      async function loopDeLeitura() {
        if (!isActive) return;
        cicloLentoCounter++;
        amostragemDbCounter++;

        try {
          let currentSpeed = 0;
          let realRpm = 0;

          const rpmResp = await perguntarAoCarro("010C");
          realRpm = parseOBD(rpmResp, "0C");
          if (realRpm >= 0 && !rpmResp.includes("ERRO")) {
            setDisplayRpm(realRpm);
          }

          if (!rpmResp.includes("ERRO")) {
            const speedResp = await perguntarAoCarro("010D");
            const realSpeed = parseOBD(speedResp, "0D");
            
            if (realSpeed >= 0 && !speedResp.includes("ERRO")) {
              currentSpeed = realSpeed;
              setDisplaySpeed(realSpeed);

              const now = Date.now();
              if (lastSpeedTimeRef.current !== null && realSpeed > 0) {
                const deltaHours = (now - lastSpeedTimeRef.current) / 3600000;
                tripAccumulatorRef.current += realSpeed * deltaHours;
                setTripDistance(tripAccumulatorRef.current);
                
                if (tripStorageKey) AsyncStorage.setItem(tripStorageKey, tripAccumulatorRef.current.toString()).catch(() => {});
              }
              lastSpeedTimeRef.current = now;
            }
          }

          if (cicloLentoCounter >= 3) {
            cicloLentoCounter = 0; 
            const now = Date.now();

            const tempResp = await perguntarAoCarro("0105");
            const realTemp = parseOBD(tempResp, "05");
            if (realTemp > 0) {
              currentTempRef.current = realTemp;
              setDisplayTemp(realTemp);
              
              if (realTemp > 100 && (now - alertThrottlerRef.current.temp > 120000)) {
                dispararAlerta("Atenção à Temperatura!", `O motor atingiu os ${realTemp}°C.`);
                alertThrottlerRef.current.temp = now;
              }
            }

            if (currentSpeed < 10 || fuelHistoryRef.current.length === 0) {
              const fuelResp = await perguntarAoCarro("012F");
              const rawFuel = parseOBD(fuelResp, "2F");
              
              if (rawFuel > 0) {
                fuelHistoryRef.current.push(rawFuel);
                if (fuelHistoryRef.current.length > 5) {
                  fuelHistoryRef.current.shift();
                }
                const sum = fuelHistoryRef.current.reduce((acc, val) => acc + val, 0);
                const stabilizedFuel = Math.round(sum / fuelHistoryRef.current.length);
                
                currentFuelRef.current = stabilizedFuel;
                setDisplayFuel(stabilizedFuel);
              }
            }
            
            try {
              const respVolt = await perguntarAoCarro("ATRV");
              const match = String(respVolt).match(/[\d\.]+/);
              if (match) {
                 const volt = parseFloat(match[0]);
                 if (volt > 0 && volt < 12.0 && (now - alertThrottlerRef.current.volt > 120000)) {
                    dispararAlerta("Bateria Fraca", `A tensão no painel de Tempo Real desceu para ${volt}V.`);
                    alertThrottlerRef.current.volt = now;
                 }
              }
            } catch(e) {}
          }

          if (amostragemDbCounter >= 4) {
            amostragemDbCounter = 0; 
            const now = Date.now();
            
            try {
              const sID = currentSessionRef.current;
              if (sID) {
                if (user?.uid && realRpm > 0) await salvarLeituraTelemetria(user.uid, sID, "010C", realRpm, "RPM");
                if (user?.uid && currentSpeed > 0) await salvarLeituraTelemetria(user.uid, sID, "010D", currentSpeed, "km/h");
                if (user?.uid && currentTempRef.current > 0) await salvarLeituraTelemetria(user.uid, sID, "0105", currentTempRef.current, "°C");
                if (user?.uid && currentFuelRef.current > 0) await salvarLeituraTelemetria(user.uid, sID, "012F", currentFuelRef.current, "%");
                if (user?.uid) await atualizarDistanciaSessaoLocal(user.uid, sID, Math.round(tripAccumulatorRef.current * 1000));
              }
            } catch (e) {
              // Falha silenciosa no banco
            }

            try {
               const falhasResp = await perguntarAoCarro("03");
               const currentErrors = contarErrosDTC(falhasResp);
               const savedFaultsStr = faultCountStorageKey ? await AsyncStorage.getItem(faultCountStorageKey) : null;
               const savedFaults = savedFaultsStr ? parseInt(savedFaultsStr) : 0;

               if (currentErrors > savedFaults && (now - alertThrottlerRef.current.dtc > 120000)) {
                  dispararAlerta("⚠️ Nova Falha Detectada", "O sistema de injeção registrou um novo código de erro em tempo real.");
                  if (faultCountStorageKey) AsyncStorage.setItem(faultCountStorageKey, currentErrors.toString()).catch(()=>{});
                  alertThrottlerRef.current.dtc = now;
               } else if (currentErrors < savedFaults) {
                  if (faultCountStorageKey) AsyncStorage.setItem(faultCountStorageKey, currentErrors.toString()).catch(()=>{});
               }
            } catch(e) {}
          }

        } catch (err) {
          // Erro silencioso de leitura serial
        }

        if (isActive) {
          loopTimerRef.current = setTimeout(() => loopDeLeitura(), 1200); 
        }
      }

      async function startReading() {
        try {
          try { await OBDBluetooth.pauseBackgroundPolling(true); } catch (e) {}

          if (!currentSessionRef.current) {
            if (!user?.uid) throw new Error('A conta não está autenticada.');
            const vehicle = await obterVeiculoLocal(user.uid);
            if (!vehicle) throw new Error('Não há veículo local cadastrado para esta conta.');
            
            const sessoes: any = await obterResumoSessoes(user.uid, vehicle.id);
            if(sessoes && sessoes.length > 0) {
               currentSessionRef.current = sessoes[0].id;
            } else {
               currentSessionRef.current = await iniciarSessaoLocal(user.uid, vehicle.id, "ISO_15765-4");
            }
          }

          try {
            const checkConn = await perguntarAoCarro("010C");
            if (checkConn && !String(checkConn).includes("ERR") && !String(checkConn).includes("TIMEOUT")) {
              setIsReading(true);
              setStatusMsg("LENDO DADOS DO CARRO");
              lastSpeedTimeRef.current = Date.now();
              loopDeLeitura();
              return;
            }
          } catch (e) { }

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

            setStatusMsg("NEGOCIANDO PROTOCOLOS CAN...");
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
        }
      }

      startReading();

      return () => {
        isActive = false; 
        setIsReading(false);
        lastSpeedTimeRef.current = null;
        currentSessionRef.current = null; 
        
        if (loopTimerRef.current) {
            clearTimeout(loopTimerRef.current);
            loopTimerRef.current = null;
        }
      };
    }, [user?.uid, tripStorageKey, faultCountStorageKey])
  );

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
        if (pid === "0C" && dataHex.length >= 4) { 
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D" && dataHex.length >= 2) { 
          return parseInt(dataHex.substring(0, 2), 16);
        }
        else if (pid === "05" && dataHex.length >= 2) { 
          return parseInt(dataHex.substring(0, 2), 16) - 40;
        }
        else if (pid === "2F" && dataHex.length >= 2) { 
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
        
        <Animated.View style={[styles.liveBadge, headerGlowStyle, !isDark && { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
          <View style={[styles.liveDot, isReading && { backgroundColor: "#00E676", shadowColor: "#00E676" }]} />
          <Text style={styles.liveBadgeText}>{statusMsg}</Text>
        </Animated.View>

        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          <SpeedometerMinimal speed={displaySpeed} isActive={isReading} />
        </Animated.View>

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
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FF3D5722", borderWidth: 1, borderColor: "#FF3D5744", borderRadius: 14, paddingVertical: 12 },
  stopBtnText: { fontSize: 14, fontWeight: "600", color: "#FF3D57" },
});