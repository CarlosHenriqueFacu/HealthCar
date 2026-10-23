import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  Modal,
  NativeModules,
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
import { router, useFocusEffect } from "expo-router";

import { FuelChart } from "../../components/FuelChart";
import { ScreenContainer } from "../../components/screen-container";
import { HealthCarHeader } from "@/components/HealthCarHeader";

import * as Notifications from 'expo-notifications';
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useApp } from '../../contexts/AppContext';

import { iniciarSessaoLocal, obterResumoSessoes, salvarFalhaDTCLocal, salvarLeituraTelemetria } from '../../database/database';

/**
 * Configuração global do tratador de notificações Push (Foreground).
 */
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

/**
 * Estado inicial de telemetria para evitar valores nulos (NullSafety).
 */
const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 0, fuel: 0, kmTotal: 0, kmDay: 0, volt: 0 };
let glob_faultsCount = 0;

/**
 * @component HomeScreen
 * @description Ponto de entrada principal (Dashboard) do aplicativo HealthCar.
 * Responsável por gerenciar a conexão Bluetooth, orquestrar o loop de telemetria
 * e gerenciar a persistência local (SQLite) da sessão atual.
 */
export default function HomeScreen() {
  const { theme, t } = useApp();
  
  // --- DESIGN SYSTEM & THEME CONFIGURATION ---
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const iconBgColor = isDark ? '#1E2235' : '#F8FAFC';

  // --- COMPONENT STATE ---
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [telemetry, setTelemetry] = useState(TELEMETRY_IDLE);
  const [batteryStatus, setBatteryStatus] = useState("batDesconhecido");
  
  // Ref para manter a sessão transacional ativa sem engatilhar re-renders desnecessários
  const ref_sessaoId = useRef<string | null>(null);
  const fuelHistoryRef = useRef<number[]>([]);

  const [carroConfigurado, setCarroConfigurado] = useState({
    id: '', marca: 'Carregando...', veiculo: '', ano: '', motor: '', km: '0'
  });

  const [virtualOdometro, setVirtualOdometro] = useState({
    offset: 0, lastObdKm: 0, isCalibrated: false
  });
  
  const [showKmModal, setShowKmModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [kmObdRaw, setKmObdRaw] = useState(0); 
  const [kmInput, setKmInput] = useState("");

  // --- UI FEEDBACK (TOAST/PILL) ---
  const [pillConfig, setPillConfig] = useState({ message: '', type: 'info' });
  const pillTranslateY = useSharedValue(-150); 
  const headerGlow = useSharedValue(0);
  const appState = useRef(AppState.currentState);
  const [faultCount, setFaultCount] = useState(glob_faultsCount);

  // Impede que a tela durma enquanto o Dashboard estiver ativo
  useKeepAwake();

  /**
   * Dispara um feedback visual temporário (Toast/Pill) na interface.
   * @param message Mensagem a ser exibida.
   * @param type Tipo de notificação (success, error, info).
   */
  const showPill = (message: string, type: 'success' | 'error' | 'info') => {
    setPillConfig({ message, type });
    pillTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 }); 
    setTimeout(() => { pillTranslateY.value = withTiming(-150, { duration: 500 }); }, 4000);
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pillTranslateY.value }] }));
  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));

  /**
   * @effect Inicialização e Hidratação (Bootstrap)
   * Carrega preferências locais e tenta restabelecer comunicação Bluetooth pré-existente.
   */
  useEffect(() => {
    async function setupApp() {
      try {
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
        //Redireciona para /login 
        if (veiculoCadastrado === null) {
          router.replace('/(auth)/login' as any);
          return; 
        } 
        const veiculoSalvo = JSON.parse(veiculoCadastrado);
        setCarroConfigurado(veiculoSalvo);
        
        let kmInicialOffline = Number(veiculoSalvo.km);
        const savedOdo = await AsyncStorage.getItem('@virtual_odometro');
        if (savedOdo !== null) {
          const odoParsed = JSON.parse(savedOdo);
          setVirtualOdometro(odoParsed);
          if (odoParsed.isCalibrated && odoParsed.lastObdKm > 0) {
            kmInicialOffline = odoParsed.offset + odoParsed.lastObdKm;
            setKmObdRaw(odoParsed.lastObdKm);
          }
        }

        setTelemetry(prev => ({ ...prev, kmTotal: kmInicialOffline }));

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') console.log("[Permissões] Notificações Push recusadas.");

        headerGlow.value = withTiming(1, { duration: 800 });
        
        // Verifica status da conexão Bluetooth via Módulo Nativo
        const { OBDBluetooth } = NativeModules;
        let deveReconectar = false;
        try {
          // Evita leituras concorrentes enquanto a tela confirma a conexão existente.
          await OBDBluetooth.pauseBackgroundPolling(true);
          const checkConnection = await OBDBluetooth.sendCommand("AT");
          if (checkConnection && !String(checkConnection).includes("ERR")) {
            if(veiculoSalvo.id){
                const sessoes: any = await obterResumoSessoes();
                if(sessoes && sessoes.length > 0) {
                   ref_sessaoId.current = sessoes[0].id;
                } else {
                   ref_sessaoId.current = await iniciarSessaoLocal(veiculoSalvo.id, "ISO_15765-4");
                }
            }
            showPill("Conexão ativa sincronizada", "success");
            await sincronizarOdometroComEcu();
            await verificarFalhasEcu();
          } else {
            deveReconectar = true;
          }
        } catch (e) {
          deveReconectar = true;
        } finally {
          await OBDBluetooth.pauseBackgroundPolling(false).catch(() => {});
        }

        if (deveReconectar) {
          tentarConexaoAutomatica(veiculoSalvo.id);
        } else {
          setIsActive(true);
        }
      } catch (e) { }
    }
    setTimeout(setupApp, 100);
    
    // Listener de estado do App (Background/Foreground)
    const subscription = AppState.addEventListener('change', nextAppState => { appState.current = nextAppState; });
    return () => { subscription.remove(); };
  }, []);

  /**
   * Aciona uma notificação Push local para alertas do veículo.
   */
  const dispararAlerta = async (titulo: string, mensagem: string) => {
    await Notifications.scheduleNotificationAsync({ content: { title: titulo, body: mensagem, sound: true }, trigger: null });
  };

  /**
   * Transforma a resposta hexadecimal de falhas (03) em um valor inteiro.
   */
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

  /**
   * Verifica a Central Eletrônica em busca de códigos de falha (DTC).
   */
  async function verificarFalhasEcu(notificarSeSubir = false) {
    try {
      const { OBDBluetooth } = NativeModules;
      const falhasResp = await OBDBluetooth.sendCommand("03");
      const currentErrors = contarErrosDTC(falhasResp);

      if (notificarSeSubir && currentErrors > glob_faultsCount) {
        dispararAlerta("⚠️ Nova Falha Detectada", "O sistema de injeção registrou um novo código de erro. Faça a varredura no Scanner OBD-II.");
        if(ref_sessaoId.current){
           await salvarFalhaDTCLocal(ref_sessaoId.current, "UNSCANNED_DTC", "Falha genérica identificada pelo monitoramento passivo em background.", "Injeção Eletrônica", "warning");
        }
      }
      setFaultCount(currentErrors);
      glob_faultsCount = currentErrors;
    } catch (e) {}
  }

  /**
   * Sincroniza o Odômetro Virtual com a leitura bruta da ECU (PID 0131).
   */
  async function sincronizarOdometroComEcu() {
    try {
      const { OBDBluetooth } = NativeModules;
      const odoCache = await AsyncStorage.getItem('@virtual_odometro');
      const odoReal = odoCache ? JSON.parse(odoCache) : virtualOdometro;
      const veiculoCache = await AsyncStorage.getItem('@veiculo_cadastrado');
      const veiculoReal = veiculoCache ? JSON.parse(veiculoCache) : carroConfigurado;

      const respostaObd = await OBDBluetooth.sendCommand('0131');
      let obdRawValue = parseHex(respostaObd, "31");

      if (obdRawValue <= 0) {
        if (odoReal.isCalibrated && odoReal.lastObdKm > 0) return; 
        obdRawValue = 16556; // Fallback mock se a ECU não suportar PID 0131
      }
      setKmObdRaw(obdRawValue);

      if (!odoReal.isCalibrated) {
        setKmInput(veiculoReal.km);
        setShowKmModal(true);
      } else if (obdRawValue < odoReal.lastObdKm) {
        const kmAtualSalvo = odoReal.offset + odoReal.lastObdKm;
        setKmInput(kmAtualSalvo.toString());
        setShowKmModal(true);
        dispararAlerta("Recalibração Necessária", "Detectamos um reset na central do veículo. Por favor, confirme o KM do painel.");
      } else {
        const kmRealCalculado = odoReal.offset + obdRawValue;
        setTelemetry(prev => ({ ...prev, kmTotal: kmRealCalculado }));
        const odoDataAtualizado = { ...odoReal, lastObdKm: obdRawValue };
        await AsyncStorage.setItem('@virtual_odometro', JSON.stringify(odoDataAtualizado));
        setVirtualOdometro(odoDataAtualizado);
      }
    } catch (e) {}
  }

  /**
   * Estabelece conexão serial RFCOMM com dispositivos emparelhados compatíveis.
   */
  async function tentarConexaoAutomatica(veiculoParamId?: string) {
    let obdBluetooth: any = null;
    let backgroundPollingPaused = false;
    try {
      const targetVehicleId = veiculoParamId || carroConfigurado.id;
      setIsConnecting(true);
      showPill(t('conectando'), "info");

      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
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

      // Procura por adaptadores ELM327 na lista de emparelhados
      const paired = await RNBluetoothClassic.getBondedDevices();
      const obdDevice = paired.find(d => d.name.toUpperCase().includes("OBD") || d.name.toUpperCase().includes("ELM") || d.name.toUpperCase().includes("V-LINK"));

      if (obdDevice) {
        const { OBDBluetooth } = NativeModules;
        obdBluetooth = OBDBluetooth;
        // Mantém o adaptador livre para o handshake e as primeiras leituras da tela.
        await OBDBluetooth.pauseBackgroundPolling(true);
        backgroundPollingPaused = true;
        try { await OBDBluetooth.connect(obdDevice.address); }
        catch (e: any) { showPill(`Falha de conexão: ${e.message}`, "error"); setIsConnecting(false); return; }

        if(targetVehicleId){
            const sessoes: any = await obterResumoSessoes();
            if(sessoes && sessoes.length > 0) ref_sessaoId.current = sessoes[0].id;
            else ref_sessaoId.current = await iniciarSessaoLocal(targetVehicleId, "ISO_15765-4");
        }

        showPill("Conectado ao scanner OBD2 com sucesso!", "success");

        // Inicialização de hardware ELM327 (Comandos AT)
        try {
          await OBDBluetooth.sendCommand("ATZ");
          await new Promise(resolve => setTimeout(resolve, 1000));
          await OBDBluetooth.sendCommand("ATE0");
          await OBDBluetooth.sendCommand("ATSP0");
          await OBDBluetooth.sendCommand("0100");
          await new Promise(resolve => setTimeout(resolve, 1000));

          await sincronizarOdometroComEcu();
          await verificarFalhasEcu(false);
          setIsActive(true);
        } catch (erroLeitura) {
          setIsActive(false);
          ref_sessaoId.current = null;
          showPill("Sinal OBD2 perdido. Tentando restabelecer...", "error");
        }
      } else { showPill("Nenhum scanner OBD2 emparelhado.", "error"); }
    } catch (error: any) { showPill(`Erro de conexão: ${error.message}`, "error"); }
    finally {
      if (backgroundPollingPaused && obdBluetooth) {
        await obdBluetooth.pauseBackgroundPolling(false).catch(() => {});
      }
      setIsConnecting(false);
    }
  }

  /**
   * Decodificador de Payload OBD-II Hexadecimal.
   */
  function parseHex(response: string, pid: string): number {
    if (!response) return 0;
    const strResp = String(response).replace(/[\s>]/g, "").toUpperCase();
    if (strResp.includes("ERROR") || strResp.includes("NODATA") || strResp.includes("SEARCHING") || strResp.includes("TIMEOUT")) return 0;

    const target = "41" + pid;
    const index = strResp.indexOf(target);
    if (index !== -1) {
      const dataHex = strResp.substring(index + 4);
      try {
        if (pid === "0C" && dataHex.length >= 4) {
          // PID 0C (RPM): ((A * 256) + B) / 4
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D" && dataHex.length >= 2) return parseInt(dataHex.substring(0, 2), 16); // PID 0D (Velocidade)
        else if (pid === "05" && dataHex.length >= 2) return parseInt(dataHex.substring(0, 2), 16) - 40; // PID 05 (Temp Motor)
        else if (pid === "2F" && dataHex.length >= 2) {
          // PID 2F (Combustível): (A * 100) / 255
          const A = parseInt(dataHex.substring(0, 2), 16);
          return Math.round((A * 100) / 255);
        }
        else if (pid === "31" && dataHex.length >= 4) {
          // PID 31 (Odômetro)
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return (A * 256) + B;
        }
      } catch (e) { return 0; }
    }
    return 0;
  }

  /**
   * @effect Orchestrator de Telemetria (Background Loop)
   * Loop principal de monitoramento: Lê os sensores e salva no SQLite a cada 5 segundos.
   */
  useFocusEffect(
    useCallback(() => {
      let loopLento: ReturnType<typeof setTimeout>;
      let isFocused = true;
      let slowCycleCounter = 0;
      let transitionDelay: ReturnType<typeof setTimeout>;

      // Função estabilizadora de sessão transacional
      const resgatarSessao = async () => {
        try {
          let vId = carroConfigurado.id;
          if (!vId) {
            const vCache = await AsyncStorage.getItem('@veiculo_cadastrado');
            if (vCache) vId = JSON.parse(vCache).id;
          }
          if (!vId) vId = "veiculo_tcc_padrao";

          const sessoes: any = await obterResumoSessoes();
          if (sessoes && sessoes.length > 0) {
              ref_sessaoId.current = sessoes[0].id;
          } else {
              const novaSessao = await iniciarSessaoLocal(vId, "ISO_15765-4");
              ref_sessaoId.current = novaSessao || `sessao_auto_${Date.now()}`;
          }
        } catch (error) {
          if (!ref_sessaoId.current) {
             ref_sessaoId.current = `sessao_emergencia_${Date.now()}`;
          }
        }
      };

      resgatarSessao();

      transitionDelay = setTimeout(() => {
        if (isActive && isFocused) {
          const executarCiclo = async () => {
            if (!isFocused) return;
            
            if (!ref_sessaoId.current) {
                await resgatarSessao();
            }

            const sID = ref_sessaoId.current;

            try {
              const { OBDBluetooth } = NativeModules;
              
              let rpmLido = 0;
              let tempLida = 0;
              let fuelLido = 0;
              let speedLido = 0;
              
              // Gerenciamento de Odometria Dinâmica (Trip KM)
              let currentKmDay = telemetry.kmDay; 
              try {
                const viagemSalva = await AsyncStorage.getItem('@viagem_atual');
                if (viagemSalva) {
                  const val = parseFloat(viagemSalva);
                  if (!isNaN(val)) currentKmDay = val;
                }
              } catch(e){}

              // Extração: Rotação (RPM)
              try {
                const respRPM = await OBDBluetooth.sendCommand("010C");
                rpmLido = parseHex(respRPM, "0C");
                if (rpmLido > 0 && sID) {
                   await salvarLeituraTelemetria(sID, "010C", rpmLido, "RPM");
                }
              } catch (e: any) { }
              
              // Extração: Temperatura (ECT)
              try {
                const respTemp = await OBDBluetooth.sendCommand("0105");
                tempLida = parseHex(respTemp, "05");
                if (tempLida > 0 && sID) {
                   await salvarLeituraTelemetria(sID, "0105", tempLida, "°C");
                }
              } catch (e: any) { }

              // Extração: Velocidade (VSS) para cálculo de integração vetorial do Trip KM
              try {
                const respSpeed = await OBDBluetooth.sendCommand("010D");
                speedLido = parseHex(respSpeed, "0D");
                
                if (speedLido >= 0 && !String(respSpeed).includes("ERROR") && !String(respSpeed).includes("TIMEOUT") && !String(respSpeed).includes("NODATA")) {
                  const deltaHours = 5000 / 3600000; // Constante de tempo do loop
                  currentKmDay += speedLido * deltaHours;
                  AsyncStorage.setItem('@viagem_atual', currentKmDay.toString()).catch(() => {});
                  
                  if (speedLido > 0 && sID) await salvarLeituraTelemetria(sID, "010D", speedLido, "km/h");
                }
              } catch (e) {}

              // Extração: Combustível (Apenas em baixas velocidades para mitigar flutuação da boia)
              try {
                if (speedLido < 10 || fuelHistoryRef.current.length === 0) {
                  const respFuel = await OBDBluetooth.sendCommand("012F");
                  const rawFuel = parseHex(respFuel, "2F");
                  if (rawFuel > 0) {
                    fuelLido = rawFuel;
                    if (sID) await salvarLeituraTelemetria(sID, "012F", fuelLido, "%");
                  }
                }
              } catch (e) {}

              // Simulador de Tensão Bateria (Mock placeholder)
              let voltSimulado = 12.6; 
              let statusBat = "batDesconhecido";
              if (voltSimulado >= 13.5) statusBat = "batCarregando";
              else if (voltSimulado >= 12.2 && voltSimulado <= 12.8) statusBat = "batIdeal";
              else if (voltSimulado < 12.0) statusBat = "batFraca";
              
              if(sID) await salvarLeituraTelemetria(sID, "ATRV", voltSimulado, "V");
              setBatteryStatus(statusBat);

              // Atualiza o estado consolidado da View
              setTelemetry(prev => ({ 
                ...prev, 
                rpm: rpmLido > 0 ? rpmLido : prev.rpm, 
                volt: voltSimulado, 
                fuel: fuelLido > 0 ? fuelLido / 100 : (prev.fuel > 0 ? prev.fuel : 0.72), 
                temp: tempLida > 0 ? tempLida : prev.temp,
                kmDay: parseFloat(currentKmDay.toFixed(1)) 
              }));

              // Tarefas de manutenção (Ciclo Lento) a cada 6 execuções (~30 segundos)
              slowCycleCounter++;
              if (slowCycleCounter >= 6) { 
                slowCycleCounter = 0;
                await sincronizarOdometroComEcu();
                await verificarFalhasEcu(true);
              }

            } catch (error: any) {
              // Handler de Exceção: Desconexão abrupta do adaptador ELM327
              setIsActive(false);
              ref_sessaoId.current = null; 
              showPill("Falha de Comunicação! Conexão Interrompida.", "error");
            }

            if (isFocused && isActive) {
               loopLento = setTimeout(executarCiclo, 5000); // 5000ms Polling Rate
            }
          };

          executarCiclo();
        }
      }, 600); // Delay de transição para mitigar race condition com a UI de Navegação

      return () => { 
        isFocused = false;
        if (transitionDelay) clearTimeout(transitionDelay);
        if (loopLento) clearTimeout(loopLento); 
      };
    }, [isActive])
  );

  /**
   * Grava o Offset de ajuste manual do usuário para sincronizar com o painel físico.
   */
  const calibrarOdometroVirtual = async () => {
    try {
      const painelKmInformado = Number(kmInput);
      if (isNaN(painelKmInformado) || painelKmInformado <= 0) {
        showPill("Informe uma quilometragem válida.", "error"); return;
      }
      const baseObd = kmObdRaw > 0 ? kmObdRaw : virtualOdometro.lastObdKm;
      const novoOffset = painelKmInformado - baseObd;
      const dadosOdometro = { offset: novoOffset, lastObdKm: baseObd, isCalibrated: true };
      
      await AsyncStorage.setItem('@virtual_odometro', JSON.stringify(dadosOdometro));
      const veiculoAtualizado = { ...carroConfigurado, km: painelKmInformado.toString() };
      await AsyncStorage.setItem('@veiculo_cadastrado', JSON.stringify(veiculoAtualizado));
      
      setCarroConfigurado(veiculoAtualizado);
      setVirtualOdometro(dadosOdometro);
      setTelemetry(prev => ({ ...prev, kmTotal: painelKmInformado }));
      setShowKmModal(false); setShowDetailsModal(false);
      showPill("Odômetro Virtual calibrado com sucesso!", "success");
    } catch (error) {}
  };

  const metricTile = (
    label: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    value: string,
    unit: string,
    color: string,
    route: string,
  ) => (
    <Pressable
      key={label}
      onPress={() => router.push(route as any)}
      style={({ pressed }) => [styles.metricCard, { backgroundColor: cardColor, borderColor }, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.metricTopRow}>
        <MaterialIcons name={icon} size={17} color={isActive ? color : subTextColor} />
        <Text style={[styles.metricLabel, { color: subTextColor }]}>{label}</Text>
      </View>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.metricUnit, { color: subTextColor }]}>{unit}</Text>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <Animated.View style={[styles.pillContainer, pillStyle, pillConfig.type === 'error' ? styles.pillError : pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo]}>
        <MaterialIcons name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} size={20} color="#FFF" />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HealthCarHeader />

        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: textColor }]}>Seu carro, de olho em tudo.</Text>
          <Text style={[styles.heroSubtitle, { color: subTextColor }]}>Acompanhe a saúde do veículo em um só lugar.</Text>
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/cadastro' as any)}
          style={({ pressed }) => [styles.vehicleCard, { backgroundColor: cardColor, borderColor }, pressed && { opacity: 0.78 }]}
        >
          <View style={styles.vehicleIcon}>
            <MaterialIcons name="directions-car" size={20} color="#00B4FF" />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.eyebrow}>DADOS DO VEÍCULO</Text>
            <Text style={[styles.vehicleTitle, { color: textColor }]} numberOfLines={1}>
              {carroConfigurado.marca && carroConfigurado.marca !== 'Carregando...'
                ? `${carroConfigurado.marca} ${carroConfigurado.veiculo}`.trim()
                : 'Veículo cadastrado'}
            </Text>
            <Text style={[styles.vehicleSubtitle, { color: subTextColor }]}>Toque para conferir suas informações</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
        </Pressable>

        <View style={[styles.connectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.connectionHeading}>
            <View style={[styles.statusDot, isActive ? styles.statusDotActive : { backgroundColor: isDark ? '#667085' : '#94A3B8' }]} />
            <Text style={[styles.connectionStatus, { color: textColor }]}>
              {isActive ? t('sistemaOnline') : isConnecting ? t('conectando') : t('modoOffline')}
            </Text>
            {isActive && <Text style={styles.connectionLive}>AO VIVO</Text>}
          </View>
          <Text style={[styles.connectionDescription, { color: subTextColor }]}>
            {isActive ? 'Dados do motor recebidos pelo adaptador OBD-II.' : 'Conecte o adaptador OBD2 para acompanhar os dados ao vivo.'}
          </Text>
          <Pressable
            onPress={() => isActive ? router.push('/tempo-real' as any) : tentarConexaoAutomatica()}
            disabled={isConnecting}
            style={({ pressed }) => [styles.primaryAction, pressed && { opacity: 0.82 }, isConnecting && { opacity: 0.65 }]}
          >
            <MaterialIcons name={isActive ? 'speed' : 'bluetooth'} size={18} color="#04131A" />
            <Text style={styles.primaryActionText}>
              {isConnecting ? t('conectando') : isActive ? 'Abrir painel em tempo real' : 'Conectar ao veículo'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Dados do veículo</Text>
          <Text style={[styles.sectionHint, { color: subTextColor }]}>{isActive ? 'Atualizados pelo OBD-II' : 'Disponíveis após conexão'}</Text>
        </View>
        <View style={styles.metricGrid}>
          {metricTile(t('temperatura'), 'thermostat', isActive && telemetry.temp > 0 ? `${telemetry.temp}` : '--', '°C', telemetry.temp > 100 ? '#FF6677' : '#00B4FF', '/detalhes/temperatura')}
          {metricTile('RPM', 'speed', isActive && telemetry.rpm > 0 ? `${Math.round(telemetry.rpm)}` : '--', 'rpm', '#00B4FF', '/detalhes/rpm')}
          {metricTile(t('combustivel'), 'local-gas-station', isActive ? `${Math.round(telemetry.fuel * 100)}` : '--', '%', '#00B4FF', '/detalhes/combustivel')}
          {metricTile(t('bateria'), 'battery-charging-full', isActive ? `${telemetry.volt}` : '--', 'V', '#00B4FF', '/detalhes/bateria')}
        </View>

        <Pressable
          onPress={() => setShowDetailsModal(true)}
          style={({ pressed }) => [styles.mileageCard, { backgroundColor: cardColor, borderColor }, pressed && { opacity: 0.78 }]}
        >
          <View style={styles.mileageIcon}><MaterialIcons name="speed" size={19} color="#00B4FF" /></View>
          <View style={styles.mileageInfo}>
            <Text style={[styles.mileageTitle, { color: textColor }]}>Quilometragem</Text>
            <View style={styles.mileageNumbers}>
              <Text style={[styles.mileageValue, { color: textColor }]}>{telemetry.kmTotal.toLocaleString('pt-BR')} <Text style={styles.mileageUnit}>km</Text></Text>
              <Text style={[styles.mileageToday, { color: subTextColor }]}>Hoje: {telemetry.kmDay.toFixed(1)} km</Text>
            </View>
            <Text style={[styles.mileageHint, { color: subTextColor }]}>Toque para ver ou calibrar o odômetro</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
        </Pressable>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Acesso rápido</Text>
        </View>
        <Pressable
          onPress={() => router.push('/scanner' as any)}
          style={({ pressed }) => [styles.quickCard, { backgroundColor: cardColor, borderColor }, pressed && { opacity: 0.78 }]}
        >
          <View style={styles.quickIcon}><MaterialIcons name="center-focus-weak" size={20} color="#00B4FF" /></View>
          <View style={styles.quickInfo}>
            <Text style={[styles.quickTitle, { color: textColor }]}>Scanner de falhas</Text>
            <Text style={[styles.quickSubtitle, { color: subTextColor }]}>Leia os códigos reportados pelo veículo</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/manutencao' as any)}
          style={({ pressed }) => [styles.quickCard, { backgroundColor: cardColor, borderColor }, pressed && { opacity: 0.78 }]}
        >
          <View style={styles.quickIcon}><MaterialIcons name="build" size={20} color="#00B4FF" /></View>
          <View style={styles.quickInfo}>
            <Text style={[styles.quickTitle, { color: textColor }]}>Manutenção</Text>
            <Text style={[styles.quickSubtitle, { color: subTextColor }]}>Consulte serviços e recibos do veículo</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
        </Pressable>

        <View style={styles.chartSection}>
          <FuelChart onPress={() => router.push('/detalhes/consumo' as any)} />
        </View>
      </ScrollView>

      <Modal visible={showKmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardColor, borderColor }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? '#00B4FF11' : '#E0F2FE' }]}><MaterialCommunityIcons name="speedometer" size={32} color="#00B4FF" /></View>
            <Text style={[styles.modalTitle, { color: textColor }]}>Calibrar Odômetro</Text>
            {!virtualOdometro.isCalibrated ? (
              <Text style={[styles.modalText, { color: subTextColor }]}>Para ativar o rastreamento preciso, informe a quilometragem exata.</Text>
            ) : (
              <Text style={[styles.modalText, { color: subTextColor }]}>Ajuste ou confirme a quilometragem atual para sincronizar o cálculo.</Text>
            )}
            <TextInput style={[styles.modalInput, { backgroundColor: iconBgColor, color: textColor, borderColor: '#00B4FF' }]} keyboardType="numeric" value={kmInput} onChangeText={setKmInput} maxLength={7} />
            <View style={styles.modalBtnRow}>
              {virtualOdometro.isCalibrated && (
                <Pressable style={[styles.modalBtnCancel, { borderColor }]} onPress={() => setShowKmModal(false)}>
                  <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>{t('ignorar')}</Text>
                </Pressable>
              )}
              <Pressable style={styles.modalBtnConfirm} onPress={calibrarOdometroVirtual}>
                <Text style={[styles.modalBtnConfirmText, { color: isDark ? '#0A0A0F' : '#FFFFFF' }]}>Sincronizar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailsModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetailsModal(false)}>
          <Pressable style={[styles.modalBottomSheet, { backgroundColor: cardColor, borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: textColor }]}>Detalhes do Odômetro Virtual</Text>
              <MaterialCommunityIcons name="engine-outline" size={24} color="#00B4FF" />
            </View>
            <View style={[styles.techDataRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Leitura Bruta OBD2:</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{kmObdRaw.toLocaleString('pt-BR')} km</Text>
            </View>
            <View style={[styles.techDataRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Offset de Calibração Salvo:</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{virtualOdometro.offset.toLocaleString('pt-BR')} km</Text>
            </View>
            <View style={[styles.techDataRow, { borderBottomWidth: 0, marginTop: 10 }]}>
              <Text style={[styles.techDataLabel, { color: '#00B4FF', fontWeight: 'bold' }]}>Resultado Final:</Text>
              <Text style={[styles.techDataValue, { color: '#00B4FF', fontWeight: 'bold', fontSize: 18 }]}>{telemetry.kmTotal.toLocaleString('pt-BR')} km</Text>
            </View>
            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor }]} onPress={() => setShowDetailsModal(false)}>
                <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>Fechar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtnConfirm, { backgroundColor: '#FF3D57' }]} onPress={() => { setKmInput(telemetry.kmTotal.toString()); setShowKmModal(true); }}>
                <Text style={[styles.modalBtnConfirmText, { color: '#FFF' }]}>Forçar Recalibração</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
// --- STYLE DEFINITIONS ---
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
  diagnosticBox: { width: SCREEN_WIDTH - 40, height: 195, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  centralHubOuter: { width: 118, height: 118, borderRadius: 59, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  centralHubInner: { width: 94, height: 94, borderRadius: 47, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  centralHubStatus: { fontSize: 7, fontWeight: "800", letterSpacing: 0.6, textAlign: "center" },
  diagBadge: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3, zIndex: 3 },
  diagBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  carLabel: { position: "absolute", bottom: 12, left: 16, zIndex: 3 },
  carModel: { fontSize: 16, fontWeight: "700" },
  carYear: { fontSize: 11 },
  centerSection: { alignItems: "center", paddingVertical: 16 },
  liveButtonsRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%", paddingHorizontal: 20 },
  liveActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  liveActionBtnPrimary: { backgroundColor: "#00B4FF", borderColor: "#00B4FF" },
  liveActionBtnText: { fontSize: 14, fontWeight: "700", textTransform: 'uppercase', letterSpacing: 1 },
  dashboard: { paddingHorizontal: 16, gap: 12, marginBottom: 8, marginTop: 12 },
  kmRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  kmCard: { flex: 1, padding: 16, alignItems: "center", gap: 2, position: "relative" },
  kmDivider: { width: 1, marginVertical: 12 },
  kmLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  kmValue: { fontSize: 26, fontWeight: "700", color: "#00D4FF", fontVariant: ["tabular-nums"], letterSpacing: 1 },
  kmUnit: { fontSize: 11 },
  telemetryGrid: { flexDirection: "row", gap: 10 },
  batteryStatusText: { position: 'absolute', bottom: 10, alignSelf: 'center', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  toolsSection: { paddingHorizontal: 16, marginTop: 0 },
  toolsTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { flex: 1, minWidth: (SCREEN_WIDTH - 52) / 3 - 4, borderRadius: 16, padding: 14, borderWidth: 1, position: "relative", overflow: "hidden" },
  toolCardPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolCardTitle: { fontSize: 12, fontWeight: "600", marginBottom: 3 },
  toolCardSub: { fontSize: 10, lineHeight: 14 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileBtn: { padding: 4, backgroundColor: "#00B4FF11", borderRadius: 20, borderWidth: 1, borderColor: "#00B4FF44" },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(10, 10, 15, 0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalBox: { width: "100%", borderRadius: 24, padding: 24, borderWidth: 1, alignItems: "center", shadowColor: "#00B4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "#00B4FF44" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  modalText: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 12 },
  modalInput: { width: "100%", borderRadius: 12, fontSize: 24, fontWeight: "700", textAlign: "center", paddingVertical: 16, marginBottom: 24, borderWidth: 1 },
  modalBtnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  modalBtnCancelText: { fontWeight: "700", fontSize: 14 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#00B4FF" },
  modalBtnConfirmText: { fontWeight: "800", fontSize: 14 },
  modalBottomSheet: { width: "100%", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0, position: 'absolute', bottom: 0 },
  bottomSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  bottomSheetTitle: { fontSize: 18, fontWeight: "700" },
  techDataRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  techDataLabel: { fontSize: 14, fontWeight: "500" },
  techDataValue: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  content: { paddingBottom: 28 },
  hero: { marginHorizontal: 20, marginBottom: 18 },
  heroTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  vehicleCard: { minHeight: 92, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center' },
  vehicleInfo: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#83A9C5', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
  vehicleTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  vehicleSubtitle: { fontSize: 11, lineHeight: 16 },
  connectionCard: { marginHorizontal: 20, marginBottom: 20, padding: 15, borderRadius: 18, borderWidth: 1 },
  connectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectionStatus: { fontSize: 14, fontWeight: '700', flex: 1 },
  connectionLive: { color: '#00E6A2', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  connectionDescription: { fontSize: 11, lineHeight: 17, marginTop: 10, marginBottom: 12 },
  primaryAction: { minHeight: 44, borderRadius: 13, backgroundColor: '#00AEEF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  primaryActionText: { color: '#04131A', fontSize: 13, fontWeight: '800' },
  sectionHeading: { marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionHint: { fontSize: 10 },
  metricGrid: { marginHorizontal: 20, marginBottom: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 82, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 15, borderWidth: 1, justifyContent: 'space-between' },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { fontSize: 11, fontWeight: '500' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 9 },
  metricValue: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 11 },
  mileageCard: { marginHorizontal: 20, marginBottom: 22, padding: 13, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  mileageIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center' },
  mileageInfo: { flex: 1 },
  mileageTitle: { fontSize: 13, fontWeight: '700' },
  mileageNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 4 },
  mileageValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  mileageUnit: { color: '#00B4FF', fontSize: 10, fontWeight: '600' },
  mileageToday: { fontSize: 10 },
  mileageHint: { fontSize: 10, marginTop: 3 },
  quickCard: { marginHorizontal: 20, marginBottom: 8, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center' },
  quickInfo: { flex: 1 },
  quickTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  quickSubtitle: { fontSize: 10, lineHeight: 15 },
  chartSection: { marginHorizontal: 20, marginTop: 14 }
});
