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

import { FuelChart } from "../components/FuelChart";
import { ScreenContainer } from "../components/screen-container";
import { TelemetryCard } from "../components/TelemetryCard";

import * as Notifications from 'expo-notifications';
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useApp } from '../contexts/AppContext';

import { iniciarSessaoLocal, obterResumoSessoes, salvarFalhaDTCLocal, salvarLeituraTelemetria } from '../database/database';

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

let glob_faultsCount = 0;
let glob_lastDtcAlertTime = 0;
const COOLDOWN_MESMO_ERRO = 86400000;

export default function HomeScreen() {
  const { theme, t } = useApp();
  
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
  const [batteryStatus, setBatteryStatus] = useState("batDesconhecido");
  
  // --- MODO DESENVOLVEDOR & RAIO-X ---
  const [devMode, setDevMode] = useState(false);
  const [dbStatus, setDbStatus] = useState<'ok' | 'error'>('ok');
  const [xrayLogs, setXrayLogs] = useState<{time: string, msg: string, type: 'info'|'success'|'error'|'warn'}[]>([]);
  
  const tapCount = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbErrorNotified = useRef(false); 
  
  const ref_sessaoId = useRef<string | null>(null);
  const fuelHistoryRef = useRef<number[]>([]);
  const appState = useRef(AppState.currentState);
  const [faultCount, setFaultCount] = useState(glob_faultsCount);

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

  const [pillConfig, setPillConfig] = useState({ message: '', type: 'info' });
  const pillTranslateY = useSharedValue(-150); 
  const headerGlow = useSharedValue(0);

  useKeepAwake();

  const showPill = (message: string, type: 'success' | 'error' | 'info') => {
    setPillConfig({ message, type });
    pillTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 }); 
    setTimeout(() => { pillTranslateY.value = withTiming(-150, { duration: 500 }); }, 4000);
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pillTranslateY.value }] }));
  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));

  // Função central do Raio-X
  const logXRay = useCallback((msg: string, type: 'info'|'success'|'error'|'warn' = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setXrayLogs(prev => {
      const newLogs = [{ time, msg, type }, ...prev];
      return newLogs.slice(0, 50); // Mantém as últimas 50 ações
    });
  }, []);

  // Gatilho do Easter Egg: 7 Toques
  const handleSecretTap = () => {
    tapCount.current += 1;
    if (tapTimeout.current) clearTimeout(tapTimeout.current);

    tapTimeout.current = setTimeout(() => { tapCount.current = 0; }, 1500);

    if (tapCount.current === 7) {
      setDevMode(prev => {
        const nextState = !prev;
        showPill(nextState ? "Modo Desenvolvedor: Ativado" : "Modo Desenvolvedor: Desativado", "info");
        if (nextState) logXRay("🔧 Raio-X do Sistema Iniciado.", "warn");
        return nextState;
      });
      tapCount.current = 0;
    }
  };

  useEffect(() => {
    async function setupApp() {
      try {
        logXRay("Verificando credenciais e cache local...", "info");
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
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
        await Notifications.requestPermissionsAsync();
        headerGlow.value = withTiming(1, { duration: 800 });
        
        const { OBDBluetooth } = NativeModules;
        try {
          const checkConnection = await OBDBluetooth.sendCommand("AT");
          if (checkConnection && !String(checkConnection).includes("ERR")) {
            if(veiculoSalvo.id){
                logXRay("Restaurando sessão de telemetria no banco...", "info");
                const sessoes: any = await obterResumoSessoes();
                if(sessoes && sessoes.length > 0) ref_sessaoId.current = sessoes[0].id;
                else ref_sessaoId.current = await iniciarSessaoLocal(veiculoSalvo.id, "ISO_15765-4");
            }
            setIsActive(true);
            logXRay("✅ Conexão nativa pré-existente sincronizada com sucesso.", "success");
            showPill("Conexão ativa sincronizada", "success");
            await sincronizarOdometroComEcu();
            await verificarFalhasEcu();
          } else {
            tentarConexaoAutomatica(veiculoSalvo.id);
          }
        } catch (e) { tentarConexaoAutomatica(veiculoSalvo.id); }
      } catch (e) { }
    }
    setTimeout(setupApp, 100);
    
    const subscription = AppState.addEventListener('change', nextAppState => { appState.current = nextAppState; });
    return () => { subscription.remove(); };
  }, []);

  const dispararAlerta = async (titulo: string, mensagem: string) => {
    await Notifications.scheduleNotificationAsync({ content: { title: titulo, body: mensagem, sound: true }, trigger: null });
  };

  function contarErrosDTC(response: string): number {
    if (!response) return glob_faultsCount;
    const clean = String(response).replace(/[\s\r\n>]/g, "").toUpperCase();
    if (clean.includes("NODATA") || clean.includes("ERROR") || clean.includes("SEARCHING") || clean.includes("TIMEOUT")) return glob_faultsCount; 
    
    const idx = clean.indexOf("43");
    if (idx === -1) return glob_faultsCount;
    
    const hexData = clean.substring(idx + 2);
    if (hexData.length < 2) return glob_faultsCount;
    
    const count = parseInt(hexData.substring(0, 2), 16);
    return isNaN(count) ? glob_faultsCount : count;
  }

  async function verificarFalhasEcu(notificarSeSubir = false) {
    try {
      const { OBDBluetooth } = NativeModules;
      if (devMode) logXRay("🔍 Escaneando Central (ECU) por falhas pendentes...", "info");
      const falhasResp = await OBDBluetooth.sendCommand("03");
      const currentErrors = contarErrosDTC(falhasResp);

      if (notificarSeSubir && currentErrors > 0) {
        const agora = Date.now();
        const ehNovoErro = currentErrors > glob_faultsCount;
        const cooldownExpirou = (agora - glob_lastDtcAlertTime) > COOLDOWN_MESMO_ERRO;

        if (ehNovoErro || cooldownExpirou) {
          dispararAlerta("⚠️ Atenção: Falha no Motor", `O sistema identificou ${currentErrors} código(s) de erro. Acesse o Scanner OBD-II para detalhes.`);
          logXRay(`⚠️ DTC Detectado! A ECU reportou ${currentErrors} falha(s).`, "warn");
          if (ehNovoErro && ref_sessaoId.current) await salvarFalhaDTCLocal(ref_sessaoId.current, "UNSCANNED_DTC", "Falha genérica identificada pelo monitoramento passivo do painel.", "Injeção Eletrônica", "warning");
          glob_lastDtcAlertTime = agora;
        }
      }
      
      setFaultCount(currentErrors);
      glob_faultsCount = currentErrors;
    } catch (e) {}
  }

  async function sincronizarOdometroComEcu() {
    try {
      const { OBDBluetooth } = NativeModules;
      const odoCache = await AsyncStorage.getItem('@virtual_odometro');
      const odoReal = odoCache ? JSON.parse(odoCache) : virtualOdometro;
      const veiculoCache = await AsyncStorage.getItem('@veiculo_cadastrado');
      const veiculoReal = veiculoCache ? JSON.parse(veiculoCache) : carroConfigurado;

      if (devMode) logXRay("📊 Sincronizando Odômetro Virtual com VSS da ECU...", "info");
      const respostaObd = await OBDBluetooth.sendCommand('0131');
      let obdRawValue = parseHex(respostaObd, "31");

      if (obdRawValue <= 0) {
        if (odoReal.isCalibrated && odoReal.lastObdKm > 0) return; 
        obdRawValue = 16556; // Mock
      }
      setKmObdRaw(obdRawValue);

      if (!odoReal.isCalibrated) {
        setKmInput(veiculoReal.km);
        setShowKmModal(true);
      } else if (obdRawValue < odoReal.lastObdKm) {
        return; 
      } else {
        const kmRealCalculado = odoReal.offset + obdRawValue;
        setTelemetry(prev => ({ ...prev, kmTotal: kmRealCalculado }));
        const odoDataAtualizado = { ...odoReal, lastObdKm: obdRawValue };
        await AsyncStorage.setItem('@virtual_odometro', JSON.stringify(odoDataAtualizado));
        setVirtualOdometro(odoDataAtualizado);
        if (devMode) logXRay(`✅ Odômetro calibrado e gravado localmente: ${kmRealCalculado}km`, "success");
      }
    } catch (e) {}
  }

  async function tentarConexaoAutomatica(veiculoParamId?: string) {
    try {
      const targetVehicleId = veiculoParamId || carroConfigurado.id;
      setIsConnecting(true);
      showPill(t('conectando'), "info");
      logXRay("🔄 Escaneando dispositivos Bluetooth pareados (Procurando ELM327)...", "info");

      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        if (granted['android.permission.BLUETOOTH_CONNECT'] !== PermissionsAndroid.RESULTS.GRANTED) {
          showPill("Permissão de Bluetooth negada!", "error");
          logXRay("❌ Permissões Bluetooth não concedidas pelo sistema Android.", "error");
          setIsConnecting(false);
          return;
        }
      }

      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled) {
        showPill("Bluetooth desativado.", "error");
        logXRay("❌ Hardware Bluetooth do smartphone está desligado.", "error");
        setIsConnecting(false);
        return;
      }

      const paired = await RNBluetoothClassic.getBondedDevices();
      const obdDevice = paired.find(d => d.name.toUpperCase().includes("OBD") || d.name.toUpperCase().includes("ELM") || d.name.toUpperCase().includes("V-LINK"));

      if (obdDevice) {
        logXRay(`Adaptador compatível encontrado: ${obdDevice.name} [${obdDevice.address}]`, "info");
        logXRay("Abrindo socket de comunicação RFCOMM...", "info");
        const { OBDBluetooth } = NativeModules;
        
        try { 
          await OBDBluetooth.connect(obdDevice.address); 
        } 
        catch (e: any) { 
          showPill("Buscando sinal do veículo...", "info"); 
          logXRay("⚠️ Falha ao abrir socket. Adaptador pode estar fora de alcance ou desligado.", "warn");
          setIsConnecting(false); 
          const delayRec = appState.current === 'active' ? 5000 : 60000;
          setTimeout(() => tentarConexaoAutomatica(targetVehicleId), delayRec);
          return; 
        }

        if(targetVehicleId){
            logXRay("Preparando ambiente transacional SQLite...", "info");
            const sessoes: any = await obterResumoSessoes();
            if(sessoes && sessoes.length > 0) ref_sessaoId.current = sessoes[0].id;
            else ref_sessaoId.current = await iniciarSessaoLocal(targetVehicleId, "ISO_15765-4");
        }

        setIsActive(true); 
        showPill("Conectado ao scanner OBD2 com sucesso!", "success");
        logXRay("✅ Handshake serial estabelecido com o veículo.", "success");

        try {
          logXRay("Injetando comandos de inicialização (ATZ, ATE0, ATSP0)...", "info");
          await OBDBluetooth.sendCommand("ATZ");
          await new Promise(resolve => setTimeout(resolve, 1000));
          await OBDBluetooth.sendCommand("ATE0");
          await OBDBluetooth.sendCommand("ATSP0");
          await OBDBluetooth.sendCommand("0100");
          await new Promise(resolve => setTimeout(resolve, 1000));
          logXRay("✅ Protocolos de telemetria configurados.", "success");

          await sincronizarOdometroComEcu();
          await verificarFalhasEcu(false);
        } catch (erroLeitura) {
          setIsActive(false);
          ref_sessaoId.current = null;
          showPill("Falha ao inicializar comunicação com a ECU.", "error");
          logXRay("❌ Erro nos comandos AT. A injeção eletrônica recusou a conexão.", "error");
          
          const delayRec = appState.current === 'active' ? 5000 : 60000;
          setTimeout(() => tentarConexaoAutomatica(targetVehicleId), delayRec);
        }
      } else { 
        showPill("Nenhum scanner OBD2 emparelhado.", "error"); 
        logXRay("❌ Adaptador ELM327 não consta na lista de pareados do celular.", "error");
        setIsConnecting(false);
      }
    } catch (error: any) { showPill(`Erro de conexão: ${error.message}`, "error"); } 
    finally { setIsConnecting(false); }
  }

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
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D" && dataHex.length >= 2) return parseInt(dataHex.substring(0, 2), 16); 
        else if (pid === "05" && dataHex.length >= 2) return parseInt(dataHex.substring(0, 2), 16) - 40; 
        else if (pid === "2F" && dataHex.length >= 2) {
          const A = parseInt(dataHex.substring(0, 2), 16);
          return Math.round((A * 100) / 255);
        }
        else if (pid === "31" && dataHex.length >= 4) {
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return (A * 256) + B;
        }
      } catch (e) { return 0; }
    }
    return 0;
  }

  useFocusEffect(
    useCallback(() => {
      let loopLento: ReturnType<typeof setTimeout>;
      let isFocused = true;
      let slowCycleCounter = 0;
      let falhasDeComunicacao = 0; // Contador de Queda Silenciosa (Simulador/Carro Desligado)
      let transitionDelay: ReturnType<typeof setTimeout>;

      // Isolamento de falhas do SQLite (Sem incomodar o usuário)
      const safeSave = async (sid: string, pid: string, val: number, unit: string) => {
        try {
          await salvarLeituraTelemetria(sid, pid, val, unit);
          if (dbErrorNotified.current) {
             dbErrorNotified.current = false;
             setDbStatus('ok');
             logXRay("✅ I/O Recuperado. Gravação no SQLite restabelecida.", "success");
          }
          if (devMode && dbStatus === 'ok' && pid === "010C") {
            logXRay(`📥 PID [${pid}] lido com sucesso. 📤 Gravado localmente.`, "success");
          }
        } catch (e) {
          if (!dbErrorNotified.current) {
             dbErrorNotified.current = true;
             setDbStatus('error');
             logXRay("❌ Falha de I/O no SQLite. Dados não salvos neste ciclo, mantendo conexão serial ativa.", "error");
          }
        }
      };

      const resgatarSessao = async () => {
        try {
          let vId = carroConfigurado.id || "veiculo_tcc_padrao";
          const sessoes: any = await obterResumoSessoes();
          if (sessoes && sessoes.length > 0) ref_sessaoId.current = sessoes[0].id;
          else ref_sessaoId.current = await iniciarSessaoLocal(vId, "ISO_15765-4") || `sessao_auto_${Date.now()}`;
        } catch (error) {
          if (!ref_sessaoId.current) ref_sessaoId.current = `sessao_emergencia_${Date.now()}`;
        }
      };

      resgatarSessao();

      transitionDelay = setTimeout(() => {
        if (isActive && isFocused) {
          const executarCiclo = async () => {
            if (!isFocused) return;
            if (!ref_sessaoId.current) await resgatarSessao();

            const sID = ref_sessaoId.current;

            try {
              const { OBDBluetooth } = NativeModules;
              
              let rpmLido = 0; let tempLida = 0; let fuelLido = 0; let speedLido = 0;
              let currentKmDay = telemetry.kmDay; 
              try {
                const viagemSalva = await AsyncStorage.getItem('@viagem_atual');
                if (viagemSalva) {
                  const val = parseFloat(viagemSalva);
                  if (!isNaN(val)) currentKmDay = val;
                }
              } catch(e){}

              if (devMode) logXRay("📡 Iniciando pool de leitura de sensores...", "info");

              // --- TESTE DE QUEDA SILENCIOSA (BLINDADO CONTRA SIMULADORES) ---
              const respRPM = await OBDBluetooth.sendCommand("010C");
              const strRpm = String(respRPM).replace(/\s/g, "").toUpperCase();
              
              // Se a resposta vier vazia, apenas com o prompt ">", com erros, OU sem o cabeçalho oficial "410C"
              if (!strRpm || strRpm === ">" || strRpm.includes("ERROR") || strRpm.includes("NODATA") || strRpm.includes("TIMEOUT") || !strRpm.includes("410C")) {
                falhasDeComunicacao++;
                if (devMode) logXRay(`⚠️ Sinal vazio ou corrompido recebido. Tentativa falha #${falhasDeComunicacao}`, "warn");
              } else {
                falhasDeComunicacao = 0; // A ECU respondeu perfeitamente
                rpmLido = parseHex(respRPM, "0C");
                if (rpmLido >= 0 && sID) await safeSave(sID, "010C", rpmLido, "RPM");
              }

              // Se falhar 3 vezes seguidas, declara queda e exibe notificação
              if (falhasDeComunicacao >= 3) {
                 throw new Error("ECU_SLEEP");
              }
              
              // TEMP
              try {
                const respTemp = await OBDBluetooth.sendCommand("0105");
                tempLida = parseHex(respTemp, "05");
                if (tempLida > 0 && sID) await safeSave(sID, "0105", tempLida, "°C");
              } catch (e: any) { }

              // VELOCIDADE
              try {
                const respSpeed = await OBDBluetooth.sendCommand("010D");
                speedLido = parseHex(respSpeed, "0D");
                if (speedLido >= 0 && !String(respSpeed).includes("ERROR") && !String(respSpeed).includes("TIMEOUT") && !String(respSpeed).includes("NODATA")) {
                  const deltaHours = 5000 / 3600000; 
                  currentKmDay += speedLido * deltaHours;
                  AsyncStorage.setItem('@viagem_atual', currentKmDay.toString()).catch(() => {});
                  if (speedLido > 0 && sID) await safeSave(sID, "010D", speedLido, "km/h");
                }
              } catch (e) {}

              // COMBUSTIVEL
              try {
                if (speedLido < 10 || fuelHistoryRef.current.length === 0) {
                  const respFuel = await OBDBluetooth.sendCommand("012F");
                  const rawFuel = parseHex(respFuel, "2F");
                  if (rawFuel > 0) {
                    fuelLido = rawFuel;
                    if (sID) await safeSave(sID, "012F", fuelLido, "%");
                  }
                }
              } catch (e) {}

              let voltSimulado = 12.6; 
              let statusBat = "batDesconhecido";
              if (voltSimulado >= 13.5) statusBat = "batCarregando";
              else if (voltSimulado >= 12.2 && voltSimulado <= 12.8) statusBat = "batIdeal";
              else if (voltSimulado < 12.0) statusBat = "batFraca";
              
              if(sID) await safeSave(sID, "ATRV", voltSimulado, "V");
              setBatteryStatus(statusBat);

              setTelemetry(prev => ({ 
                ...prev, 
                rpm: rpmLido > 0 ? rpmLido : prev.rpm, 
                volt: voltSimulado, 
                fuel: fuelLido > 0 ? fuelLido / 100 : prev.fuel, 
                temp: tempLida > 0 ? tempLida : prev.temp,
                kmDay: parseFloat(currentKmDay.toFixed(1)) 
              }));

              slowCycleCounter++;
              // Acelerado: Agora busca falhas DTC a cada 2 execuções (10 segundos) em vez de 30s.
              if (slowCycleCounter >= 2) { 
                slowCycleCounter = 0;
                await sincronizarOdometroComEcu();
                await verificarFalhasEcu(true);
              }

            } catch (error: any) {
              setIsActive(false);
              ref_sessaoId.current = null; 
              falhasDeComunicacao = 0;
              
              if (error.message === "ECU_SLEEP") {
                 showPill("Comunicação com o veículo perdida. Verifique a ignição.", "error");
                 logXRay("❌ A ECU parou de enviar dados. Adaptador ligado, mas injeção desligada (Sleep Mode).", "error");
              } else {
                 showPill("Conexão Bluetooth interrompida. Reconectando...", "error");
                 logXRay("❌ Desconexão crítica de hardware. RFCOMM Socket destruído.", "error");
              }
              
              const delayRec = appState.current === 'active' ? 5000 : 60000;
              setTimeout(() => tentarConexaoAutomatica(), delayRec);
            }

            if (isFocused && isActive) {
               loopLento = setTimeout(executarCiclo, 5000); 
            }
          };

          executarCiclo();
        }
      }, 600); 

      return () => { 
        isFocused = false;
        if (transitionDelay) clearTimeout(transitionDelay);
        if (loopLento) clearTimeout(loopLento); 
      };
    }, [isActive, devMode, dbStatus])
  );

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

  const DevBadge = () => (
    <View style={styles.devBadge}><Text style={styles.devBadgeText}>{t('emImplementacao')}</Text></View>
  );

  const hubAccentColor = !isActive ? (isDark ? "#475569" : "#94A3B8") : (faultCount === 0 ? "#00B4FF" : "#FF3D57");
  const hubOuterBg = !isActive ? (isDark ? "#1E223566" : "#F1F5F9") : (faultCount === 0 ? (isDark ? "#00B4FF14" : "#E0F2FE") : (isDark ? "#FF3D5714" : "#FFE4E6"));
  const hubInnerBg = isDark ? "#161924" : "#FFFFFF";

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      {/* Componente Toast Notification */}
      <Animated.View style={[styles.pillContainer, pillStyle, pillConfig.type === 'error' ? styles.pillError : pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo]}>
        <MaterialIcons name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} size={20} color="#FFF" />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- HEADER COM EASTER EGG (7 TOQUES) --- */}
        <View style={styles.header}>
          <View>
            <Pressable onPress={handleSecretTap}>
               <Text style={[styles.appName, { color: textColor }]}>HEALTHCAR</Text>
            </Pressable>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isActive && styles.statusDotActive, !isDark && !isActive && { backgroundColor: '#CBD5E1' }]} />
              <Text style={[styles.statusText, { color: subTextColor }]}>{isActive ? t('sistemaOnline') : isConnecting ? t('conectando') : t('modoOffline')}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            {/* Ícone Secreto do Banco de Dados (Exclusivo Modo Dev) */}
            {devMode && (
              <View style={[styles.profileBtn, { borderColor: dbStatus === 'error' ? '#FF3D5744' : '#00E67644', backgroundColor: dbStatus === 'error' ? '#FF3D5722' : '#00E67622' }]}>
                <MaterialIcons name="storage" size={22} color={dbStatus === 'error' ? '#FF3D57' : '#00E676'} />
              </View>
            )}
            
            <Pressable onPress={() => router.push("/configuracoes" as any)} style={({ pressed }) => [styles.profileBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="settings" size={26} color="#00B4FF" />
            </Pressable>
          </View>
        </View>

        {/* --- VISÃO GERAL DO VEÍCULO --- */}
        <View style={styles.carImageContainer}>
          <View style={[styles.diagnosticBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={[styles.centralHubOuter, { backgroundColor: hubOuterBg, borderColor: `${hubAccentColor}33` }]}>
              <View style={[styles.centralHubInner, { backgroundColor: hubInnerBg, borderColor: `${hubAccentColor}55` }]}>
                <MaterialIcons name="directions-car" size={36} color={hubAccentColor} />
                <Text style={[styles.centralHubStatus, { color: hubAccentColor }]}>{isActive ? (faultCount === 0 ? "TELEMETRIA ATIVA" : "VERIFICAR ECU") : "AGUARDANDO OBD"}</Text>
              </View>
            </View>
            
            {!isActive && (
              <View style={[styles.diagBadge, { top: 16, right: 16, backgroundColor: cardColor, borderColor: borderColor }]}>
                <MaterialIcons name="bluetooth-disabled" size={14} color={subTextColor} />
                <Text style={[styles.diagBadgeText, { color: subTextColor }]}>{t('modoOffline')}</Text>
              </View>
            )}
            {isActive && (
              <>
                <Animated.View style={[styles.diagBadge, { top: 16, left: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialIcons name="thermostat" size={14} color={telemetry.temp > 100 ? "#FF3D57" : "#00B4FF"} />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{telemetry.temp}°C</Text>
                </Animated.View>
                <Animated.View style={[styles.diagBadge, { top: 16, right: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialCommunityIcons name="engine-outline" size={14} color={faultCount === 0 ? "#00E676" : "#FF3D57"} />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{faultCount === 0 ? t('motorOk') : 'Atenção'}</Text>
                </Animated.View>
                <Animated.View style={[styles.diagBadge, { bottom: 16, right: 16, backgroundColor: cardColor, borderColor: borderColor }, headerGlowStyle]}>
                  <MaterialIcons name={faultCount === 0 ? "check-circle" : "warning"} size={14} color={faultCount === 0 ? "#00E676" : "#FF3D57"} />
                  <Text style={[styles.diagBadgeText, { color: textColor }]}>{faultCount === 0 ? t('zeroErros') : `${faultCount} Erro(s)`}</Text>
                </Animated.View>
              </>
            )}
            <View style={styles.carLabel}>
              <Text style={[styles.carModel, { color: textColor }]}>{carroConfigurado.marca} {carroConfigurado.veiculo}</Text>
              <Text style={[styles.carYear, { color: subTextColor }]}>{carroConfigurado.ano} {carroConfigurado.motor ? `· Motor ${carroConfigurado.motor}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* --- ACESSO RÁPIDO: MODO TEMPO REAL --- */}
        <View style={styles.centerSection}>
          <View style={styles.liveButtonsRow}>
            <Pressable onPress={() => router.push("/tempo-real" as any)} style={({ pressed }) => [styles.liveActionBtn, styles.liveActionBtnPrimary, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="speed" size={20} color={isDark ? "#0A0A0F" : "#FFFFFF"} />
              <Text style={[styles.liveActionBtnText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>{t('painelTempoReal')}</Text>
            </Pressable>
          </View>
        </View>

        {/* --- FERRAMENTAS DE SERVIÇO --- */}
        <View style={styles.toolsSection}>
          <Text style={[styles.toolsTitle, { color: subTextColor }]}>{t('ferramentas')}</Text>
          <View style={styles.toolsGrid}>
            <Pressable style={({ pressed }) => [styles.toolCard, { backgroundColor: cardColor, borderColor: borderColor }, pressed && styles.toolCardPressed]} onPress={() => router.push("/scanner" as any)}>
              <View style={[styles.toolIcon, { backgroundColor: isDark ? "#FF3D5722" : "#FFE4E6" }]}><MaterialIcons name="wifi-tethering-error" size={26} color="#FF3D57" /></View>
              <Text style={[styles.toolCardTitle, { color: textColor }]}>{t('scanner')}</Text>
              <Text style={[styles.toolCardSub, { color: subTextColor }]}>{t('scannerSub')}</Text>
            </Pressable>
            
            <Pressable style={({ pressed }) => [styles.toolCard, { backgroundColor: cardColor, borderColor: borderColor }, pressed && styles.toolCardPressed]} onPress={() => router.push("/relatorios" as any)}>
              <DevBadge />
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

        {/* --- DASHBOARD TELEMÉTRICO --- */}
        <View style={styles.dashboard}>
          
          <Pressable onPress={() => setShowDetailsModal(true)} style={({ pressed }) => [styles.kmRow, { backgroundColor: cardColor, borderColor: borderColor }, pressed && { opacity: 0.8 }]}>
            <View style={styles.kmCard}>
              <MaterialIcons name="speed" size={14} color={subTextColor} />
              <Text style={[styles.kmLabel, { color: subTextColor }]}>{t('kmTotal')}</Text>
              <Text style={styles.kmValue}>{telemetry.kmTotal.toLocaleString("pt-PT")}</Text>
              <Text style={[styles.kmUnit, { color: subTextColor }]}>km</Text>
            </View>
            <View style={[styles.kmDivider, { backgroundColor: borderColor }]} />
            
            <View style={styles.kmCard}>
              <MaterialIcons name="today" size={14} color={subTextColor} />
              <Text style={[styles.kmLabel, { color: subTextColor }]}>{t('kmHoje')}</Text>
              <Text style={styles.kmValue}>{telemetry.kmDay.toFixed(1)}</Text>
              <Text style={[styles.kmUnit, { color: subTextColor }]}>km</Text>
            </View>
          </Pressable>

          <View style={styles.telemetryGrid}>
            <TelemetryCard icon="thermostat" label={t('temperatura')} value={isActive && telemetry.temp > 0 ? `${telemetry.temp}` : "--"} unit="°C" color={isActive ? (telemetry.temp > 100 ? "#FF3D57" : "#00E676") : subTextColor} onPress={() => router.push("/detalhes/temperatura" as any)} />
            <TelemetryCard icon="settings" label="RPM" value={isActive && telemetry.rpm > 0 ? (telemetry.rpm / 1000).toFixed(1) : "--"} unit="k" color={isActive ? "#00B4FF" : subTextColor} onPress={() => router.push("/detalhes/rpm" as any)} />
          </View>

          <View style={styles.telemetryGrid}>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard 
                icon="local-gas-station" 
                label={t('combustivel')} 
                value={isActive && telemetry.fuel > 0 ? `${Math.round(telemetry.fuel * 100)}` : "--"} 
                unit="%" 
                color={isActive && telemetry.fuel > 0 ? (telemetry.fuel < 0.2 ? "#FF3D57" : (telemetry.fuel < 0.4 ? "#FFB300" : "#00E676")) : subTextColor} 
                progress={isActive ? telemetry.fuel : 0} 
                onPress={() => router.push("/detalhes/combustivel" as any)} 
              />
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <DevBadge />
              <TelemetryCard icon="battery-charging-full" label={t('bateria')} value={isActive ? `${telemetry.volt}` : "--"} unit="V" color={isActive ? (telemetry.volt < 12 ? "#FF3D57" : "#00B4FF") : subTextColor} progress={isActive ? (telemetry.volt/15) : 0} onPress={() => router.push("/detalhes/bateria" as any)} />
              {isActive && <Text style={[styles.batteryStatusText, { color: subTextColor }]}>{t(batteryStatus)}</Text>}
            </View>
          </View>

          <View style={{ position: "relative", marginTop: 10 }}>
            <DevBadge />
            <FuelChart onPress={() => router.push("/detalhes/consumo" as any)} />
          </View>
        </View>

        {/* --- RAIO-X DO SISTEMA (Console de Desenvolvedor) --- */}
        {devMode && (
          <View style={[styles.xrayContainer, { backgroundColor: isDark ? '#161924' : '#1E293B', borderColor: '#00B4FF44' }]}>
            <View style={styles.xrayHeader}>
               <MaterialCommunityIcons name="monitor-dashboard" size={16} color="#00B4FF" />
               <Text style={styles.xrayTitle}>RAIO-X DO SISTEMA</Text>
            </View>
            <ScrollView style={styles.xrayScroll} nestedScrollEnabled={true}>
               {xrayLogs.map((log, i) => (
                  <Text key={i} style={[styles.xrayText, log.type === 'error' ? {color: '#FF3D57'} : log.type === 'success' ? {color: '#00E676'} : log.type === 'warn' ? {color: '#FFB300'} : {color: '#94A3B8'}]}>
                     <Text style={{color: '#475569'}}>[{log.time}]</Text> {log.msg}
                  </Text>
               ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* --- OVERLAYS: MODAIS DE INTERAÇÃO DO ODÔMETRO --- */}
      <Modal visible={showKmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? "#00B4FF11" : "#E0F2FE" }]}><MaterialCommunityIcons name="speedometer" size={32} color="#00B4FF" /></View>
            <Text style={[styles.modalTitle, { color: textColor }]}>Calibrar Odômetro</Text>
            {!virtualOdometro.isCalibrated ? (
               <Text style={[styles.modalText, { color: subTextColor }]}>Para ativar o rastreamento preciso, informe a quilometragem exata.</Text>
            ) : (
               <Text style={[styles.modalText, { color: subTextColor }]}>Ajuste ou confirme a quilometragem atual para sincronizar o cálculo.</Text>
            )}
            <TextInput style={[styles.modalInput, { backgroundColor: iconBgColor, color: textColor, borderColor: '#00B4FF' }]} keyboardType="numeric" value={kmInput} onChangeText={setKmInput} maxLength={7} />
            <View style={styles.modalBtnRow}>
              {virtualOdometro.isCalibrated && (
                <Pressable style={[styles.modalBtnCancel, { borderColor: borderColor }]} onPress={() => setShowKmModal(false)}>
                  <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>{t('ignorar')}</Text>
                </Pressable>
              )}
              <Pressable style={styles.modalBtnConfirm} onPress={calibrarOdometroVirtual}>
                <Text style={[styles.modalBtnConfirmText, { color: isDark ? "#0A0A0F" : "#FFFFFF" }]}>Sincronizar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailsModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetailsModal(false)}>
          <Pressable style={[styles.modalBottomSheet, { backgroundColor: cardColor, borderColor: borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: textColor }]}>Detalhes do Odômetro Virtual</Text>
              <MaterialCommunityIcons name="engine-outline" size={24} color="#00B4FF" />
            </View>
            <View style={styles.techDataRow}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Leitura Bruta OBD2:</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{kmObdRaw.toLocaleString("pt-PT")} km</Text>
            </View>
            <View style={styles.techDataRow}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Offset de Calibração Salvo:</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{virtualOdometro.offset.toLocaleString("pt-PT")} km</Text>
            </View>
            <View style={[styles.techDataRow, { borderBottomWidth: 0, marginTop: 10 }]}>
              <Text style={[styles.techDataLabel, { color: '#00B4FF', fontWeight: 'bold' }]}>Resultado Final:</Text>
              <Text style={[styles.techDataValue, { color: '#00B4FF', fontWeight: 'bold', fontSize: 18 }]}>
                {telemetry.kmTotal.toLocaleString("pt-PT")} km
              </Text>
            </View>
            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: borderColor }]} onPress={() => setShowDetailsModal(false)}>
                <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>Fechar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtnConfirm, { backgroundColor: '#FF3D57' }]} onPress={() => { setKmInput(telemetry.kmTotal.toString()); setShowKmModal(true); }}>
                <Text style={[styles.modalBtnConfirmText, { color: "#FFF" }]}>Forçar Recalibração</Text>
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
  profileBtn: { padding: 4, borderRadius: 20, borderWidth: 1, borderColor: "#00B4FF44", backgroundColor: "#00B4FF11" },
  
  // --- ESTILOS DO RAIO-X (Console) ---
  xrayContainer: { marginHorizontal: 16, marginTop: 24, borderRadius: 12, borderWidth: 1, height: 220, overflow: 'hidden' },
  xrayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#00B4FF22', backgroundColor: '#0F172A' },
  xrayTitle: { fontSize: 11, fontWeight: '800', color: '#00B4FF', letterSpacing: 1 },
  xrayScroll: { padding: 12 },
  xrayText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4, lineHeight: 16 },

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
  techDataValue: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] }
});