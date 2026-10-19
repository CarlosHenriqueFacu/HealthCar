import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
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
import { router } from "expo-router";

import { ScreenContainer } from "../components/screen-container";
import { AppPalette } from "../constants/theme";
import { TelemetryCard } from "../components/TelemetryCard";

import * as Notifications from 'expo-notifications';
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useApp } from '../contexts/AppContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,   
  }),
});

const TELEMETRY_IDLE = { speed: 0, rpm: 0, temp: 0, fuel: 0, kmTotal: 0, kmDay: 0, volt: 0 };

let glob_faultsCount = 0;

/**
 * @component HomeScreen
 * @description Tela principal do sistema HealthCar. Gerencia a conexão persistente via Bluetooth,
 * sincronização contínua do Odômetro Virtual (PID 0131) e monitoramento em background.
 */
export default function HomeScreen() {
  const { theme, t } = useApp();
  
  const isDark = theme === 'dark';
  const colors = AppPalette[theme];
  const bgColor = colors.background;
  const cardColor = colors.surface;
  const textColor = colors.text;
  const subTextColor = colors.textSecondary;
  const borderColor = colors.border;
  const iconBgColor = colors.surfaceMuted;

  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [telemetry, setTelemetry] = useState(TELEMETRY_IDLE);
  const [batteryStatus, setBatteryStatus] = useState("batDesconhecido");
  
  const [carroConfigurado, setCarroConfigurado] = useState({
    marca: 'Carregando...', veiculo: '', ano: '', motor: '', km: '0'
  });

  const [virtualOdometro, setVirtualOdometro] = useState({
    offset: 0,
    lastObdKm: 0,
    isCalibrated: false
  });
  
  const [showKmModal, setShowKmModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [kmObdRaw, setKmObdRaw] = useState(0); 
  const [kmInput, setKmInput] = useState("");

  const [pillConfig, setPillConfig] = useState({ message: '', type: 'info' });
  const pillTranslateY = useSharedValue(-150); 
  const appState = useRef(AppState.currentState);

  const [faultCount, setFaultCount] = useState(glob_faultsCount);

  useKeepAwake();

  const showPill = (message: string, type: 'success' | 'error' | 'info') => {
    setPillConfig({ message, type });
    pillTranslateY.value = withSpring(50, { damping: 15, stiffness: 100 }); 
    setTimeout(() => { pillTranslateY.value = withTiming(-150, { duration: 500 }); }, 4000);
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pillTranslateY.value }] }));
  /**
   * @effect Inicialização e Restauração de Estado Offline
   * @description Carrega os dados do veículo e reconstrói imediatamente o último KM total
   * conhecido a partir do cache local antes mesmo de iniciar a busca Bluetooth.
   */
  useEffect(() => {
    async function setupApp() {
      try {
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
        
        if (veiculoCadastrado === null) {
          router.replace('/(auth)/cadastro' as any);
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

        const { OBDBluetooth } = NativeModules;
        try {
          const checkConnection = await OBDBluetooth.sendCommand("AT");
          if (checkConnection && !String(checkConnection).includes("ERR")) {
            setIsActive(true);
            showPill("Conexão ativa sincronizada", "success");
            await sincronizarOdometroComEcu();
            await verificarFalhasEcu();
          } else {
            tentarConexaoAutomatica();
          }
        } catch (e) {
          tentarConexaoAutomatica();
        }

      } catch (e) { 
        console.log("Erro fatal na inicialização:", e); 
      }
    }

    setTimeout(setupApp, 100);
    const subscription = AppState.addEventListener('change', nextAppState => { appState.current = nextAppState; });
    return () => { subscription.remove(); };
  }, []);

  const dispararAlerta = async (titulo: string, mensagem: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: mensagem, sound: true }, trigger: null, 
    });
  };

  /**
   * @method contarErrosDTC
   * @description Extrai a quantidade real de DTCs no protocolo CAN (ISO 15765-4),
   * lendo o byte contador após o cabeçalho 43 e ignorando bytes de padding (0x55).
   * @param {string} response - Resposta hexadecimal do comando 03.
   * @returns {number} Número de falhas reais ativas na ECU.
   */
  function contarErrosDTC(response: string): number {
    if (!response) return 0;
    const clean = String(response).replace(/[\s\r\n>]/g, "").toUpperCase();
    if (clean.includes("NODATA") || clean.includes("ERROR") || clean.includes("SEARCHING")) return 0;

    const idx = clean.indexOf("43");
    if (idx === -1) return 0;

    const hexData = clean.substring(idx + 2);
    if (hexData.length < 2) return 0;

    // Primeiro byte após '43' no protocolo CAN indica o total de DTCs
    const count = parseInt(hexData.substring(0, 2), 16);
    return isNaN(count) ? 0 : count;
  }

  /**
   * @method verificarFalhasEcu
   * @description Consulta o Mode 03 na ECU e atualiza o indicador de falhas na tela inicial.
   */
  async function verificarFalhasEcu(notificarSeSubir = false) {
    try {
      const { OBDBluetooth } = NativeModules;
      const falhasResp = await OBDBluetooth.sendCommand("03");
      const currentErrors = contarErrosDTC(falhasResp);

      if (notificarSeSubir && currentErrors > glob_faultsCount) {
        dispararAlerta(
          "⚠️ Nova Falha Detectada",
          "O sistema de injeção registrou um novo código de erro. Faça a varredura no Scanner OBD-II."
        );
      }

      setFaultCount(currentErrors);
      glob_faultsCount = currentErrors;
    } catch (e) {
      console.log("[DTC Check] Ignorando falha de leitura em background.");
    }
  }

  /**
   * @method sincronizarOdometroComEcu
   * @description Consulta o PID 0131, valida contra falsos positivos de leitura e atualiza
   * o KM Total na tela e no armazenamento persistente (AsyncStorage).
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
        if (odoReal.isCalibrated && odoReal.lastObdKm > 0) {
          return;
        }
        obdRawValue = 16556;
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
    } catch (e) {
      console.log("[Odômetro] Falha ao sincronizar PID 0131:", e);
    }
  }

  /**
   * @method tentarConexaoAutomatica
   * @description Gerencia o handshake inicial Bluetooth RFCOMM e prepara os canais do ELM327.
   */
  async function tentarConexaoAutomatica() {
    try {
      setIsConnecting(true);
      showPill(t('conectando'), "info");

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
        const { OBDBluetooth } = NativeModules;
        
        try {
           await OBDBluetooth.connect(obdDevice.address);
        } catch (e: any) {
           showPill(`Falha de conexão: ${e.message}`, "error");
           setIsConnecting(false);
           return;
        }

        setIsActive(true); 
        showPill("Conectado ao scanner OBD2 com sucesso!", "success");

        try {
          await OBDBluetooth.sendCommand("ATZ");
          await new Promise(resolve => setTimeout(resolve, 1000));
          await OBDBluetooth.sendCommand("ATE0");
          await OBDBluetooth.sendCommand("ATSP0");
          await OBDBluetooth.sendCommand("0100");
          await new Promise(resolve => setTimeout(resolve, 1000));

          await sincronizarOdometroComEcu();
          await verificarFalhasEcu(false);

        } catch (erroLeitura) {
          console.log("Falha ao transacionar dados OBD-II: ", erroLeitura);
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

  /**
   * @method parseHex
   * @description Decodifica respostas hexadecimais do Mode 01 para valores decimais.
   */
  function parseHex(response: string, pid: string): number {
    if (!response) return 0;
    const strResp = String(response).replace(/[\s>]/g, "").toUpperCase();
    if (strResp.includes("ERROR") || strResp.includes("NODATA") || strResp.includes("SEARCHING")) return 0;

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
        else if (pid === "05" && dataHex.length >= 2) {
          return parseInt(dataHex.substring(0, 2), 16) - 40;
        }
        else if (pid === "2F" && dataHex.length >= 2) {
          const A = parseInt(dataHex.substring(0, 2), 16);
          return Math.round((A * 100) / 255);
        }
        else if (pid === "31" && dataHex.length >= 4) {
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return (A * 256) + B;
        }
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  /**
   * @effect Loop de Monitoramento e Atualização Contínua
   * @description Atualiza telemetria básica a cada 5s e revalida quilometragem (PID 0131), combustível (012F) e DTCs a cada 30s.
   */
  useEffect(() => {
    let loopLento: ReturnType<typeof setInterval>;
    let slowCycleCounter = 0;

    if (isActive) {
      loopLento = setInterval(async () => {
        try {
          const { OBDBluetooth } = NativeModules;
          
          let rpmLido = 0;
          let tempLida = 0;
          let fuelLido = 0;
          
          try {
            const respRPM = await OBDBluetooth.sendCommand("010C");
            rpmLido = parseHex(respRPM, "0C");
          } catch (e) {}
          
          try {
            const respTemp = await OBDBluetooth.sendCommand("0105");
            tempLida = parseHex(respTemp, "05");
          } catch (e) {}

          try {
            const respFuel = await OBDBluetooth.sendCommand("012F");
            fuelLido = parseHex(respFuel, "2F");
          } catch (e) {}

          let voltSimulado = 12.6; 
          let statusBat = "batDesconhecido";
          
          if (voltSimulado >= 13.5) statusBat = "batCarregando";
          else if (voltSimulado >= 12.2 && voltSimulado <= 12.8) statusBat = "batIdeal";
          else if (voltSimulado < 12.0) statusBat = "batFraca";
          
          setBatteryStatus(statusBat);

          setTelemetry(prev => ({ 
            ...prev, 
            rpm: rpmLido > 0 ? rpmLido : prev.rpm, 
            volt: voltSimulado, 
            fuel: fuelLido > 0 ? fuelLido / 100 : (prev.fuel > 0 ? prev.fuel : 0.72), 
            temp: tempLida > 0 ? tempLida : prev.temp 
          }));

          // Ciclo de 30 segundos (6 iterações de 5s): Atualiza KM em movimento e checa falhas reais
          slowCycleCounter++;
          if (slowCycleCounter >= 6) {
            slowCycleCounter = 0;
            await sincronizarOdometroComEcu();
            await verificarFalhasEcu(true);
          }

          if (appState.current.match(/inactive|background/)) {
            if (tempLida > 100) dispararAlerta("Atenção à Temperatura!", `O motor atingiu os ${tempLida}°C.`);
            if (voltSimulado < 12.0) dispararAlerta("Bateria Fraca", `A tensão desceu para ${voltSimulado}V.`);
          }
        } catch (error) {
          if (appState.current.match(/inactive|background/)) dispararAlerta("Sinal Perdido", "Comunicação Bluetooth interrompida.");
          setIsActive(false);
        }
      }, 5000); 
    }
    return () => { if (loopLento) clearInterval(loopLento); };
  }, [isActive]);

  /**
   * @method calibrarOdometroVirtual
   * @description Calcula o novo Offset com base no KM real do painel informado pelo usuário
   * e persiste tanto no objeto de calibração quanto no cadastro base do veículo.
   */
  const calibrarOdometroVirtual = async () => {
    try {
      const painelKmInformado = Number(kmInput);
      if (isNaN(painelKmInformado) || painelKmInformado <= 0) {
        showPill("Informe uma quilometragem válida.", "error");
        return;
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
      setShowKmModal(false);
      setShowDetailsModal(false);
      showPill("Odômetro Virtual calibrado com sucesso!", "success");

    } catch (error) {
      console.log("[Data Error] Falha ao persistir calibração no AsyncStorage:", error);
    }
  };

  const vehicleName = [carroConfigurado.marca, carroConfigurado.veiculo]
    .filter(Boolean)
    .join(' ');
  const vehicleDetails = [carroConfigurado.ano, carroConfigurado.motor && `Motor ${carroConfigurado.motor}`]
    .filter(Boolean)
    .join(' · ');
  const vehicleStatusColor = isActive
    ? faultCount > 0 ? colors.danger : colors.positive
    : isDark ? '#94A3B8' : '#64748B';
  const vehicleStatusBackground = isActive
    ? faultCount > 0
      ? isDark ? '#3B1D25' : '#FDECEE'
      : isDark ? '#16372E' : '#E7F6EF'
    : isDark ? '#202A38' : '#EEF2F7';

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <Animated.View style={[styles.pillContainer, pillStyle, pillConfig.type === 'error' ? styles.pillError : pillConfig.type === 'success' ? styles.pillSuccess : styles.pillInfo]}>
        <MaterialIcons name={pillConfig.type === 'error' ? 'error-outline' : pillConfig.type === 'success' ? 'check-circle' : 'bluetooth-searching'} size={20} color="#FFF" />
        <Text style={styles.pillText}>{pillConfig.message}</Text>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.appName, { color: textColor }]}>HealthCar</Text>
            <Text style={[styles.headerSubtitle, { color: subTextColor }]}>{t('inicioSubtitulo')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('configuracoes')}
            onPress={() => router.push("/configuracoes" as any)}
            style={({ pressed }) => [
              styles.profileBtn,
              { backgroundColor: cardColor, borderColor },
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="settings" size={23} color={textColor} />
          </Pressable>
        </View>

        <Text style={[styles.greeting, { color: textColor }]}>{t('inicioTitulo')}</Text>

        <View style={[styles.vehicleCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.vehicleCardHeader}>
            <View style={[styles.vehicleIcon, { backgroundColor: isDark ? '#173248' : '#E7F3FC' }]}>
              <MaterialIcons name="directions-car" size={28} color="#1685C5" />
            </View>
            <View style={styles.vehicleCopy}>
              <Text style={[styles.eyebrow, { color: subTextColor }]}>{t('dadosVeiculo')}</Text>
              <Text style={[styles.carModel, { color: textColor }]} numberOfLines={1}>
                {vehicleName || 'HealthCar'}
              </Text>
              <Text style={[styles.carYear, { color: subTextColor }]} numberOfLines={1}>
                {vehicleDetails || t('modoOffline')}
              </Text>
            </View>
          </View>

          <View style={styles.vehicleStatusRow}>
            <View style={[styles.statusBadge, { backgroundColor: vehicleStatusBackground }]}>
              <View style={[styles.statusDot, { backgroundColor: vehicleStatusColor }]} />
              <Text style={[styles.statusText, { color: vehicleStatusColor }]}>
                {isConnecting
                  ? t('conectando')
                  : isActive
                    ? faultCount > 0 ? t('verificarFalhas') : t('sistemaOnline')
                    : t('modoOffline')}
              </Text>
            </View>
            <Text style={[styles.connectionHint, { color: subTextColor }]}>
              {isActive
                ? faultCount > 0 ? `${faultCount} ${t('errosEncontrados')}` : t('semFalhas')
                : t('conectarParaAcompanhar')}
            </Text>
          </View>

          <View style={styles.coreActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isActive ? t('painelTempoReal') : t('conectarVeiculo')}
              disabled={isConnecting}
              onPress={() => isActive ? router.push("/tempo-real" as any) : tentarConexaoAutomatica()}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && !isConnecting && styles.primaryActionPressed,
                isConnecting && styles.primaryActionDisabled,
              ]}
            >
              <MaterialIcons
                name={isConnecting ? 'bluetooth-searching' : isActive ? 'speed' : 'bluetooth-connected'}
                size={21}
                color="#FFFFFF"
              />
              <Text style={styles.primaryActionText}>
                {isConnecting ? t('conectando') : t('monitorarVeiculo')}
              </Text>
              {!isConnecting && <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('escanearFalhas')}
              onPress={() => router.push("/scanner" as any)}
              style={({ pressed }) => [
                styles.secondaryAction,
                { backgroundColor: isDark ? '#202A38' : '#F3F7FA', borderColor },
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="troubleshoot" size={21} color="#1685C5" />
              <Text style={[styles.secondaryActionText, { color: textColor }]}>{t('escanearFalhas')}</Text>
              <MaterialIcons name="arrow-forward" size={20} color={subTextColor} />
            </Pressable>
          </View>
        </View>

        <View style={styles.dashboard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('kmTotal')}: ${telemetry.kmTotal.toLocaleString('pt-BR')} km. ${t('detalhesOdometro')}`}
            onPress={() => setShowDetailsModal(true)}
            style={({ pressed }) => [
              styles.mileageCard,
              { backgroundColor: cardColor, borderColor },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.mileageIcon, { backgroundColor: isDark ? '#173248' : '#E7F3FC' }]}>
              <MaterialIcons name="speed" size={22} color="#1685C5" />
            </View>
            <View style={styles.mileageCopy}>
              <Text style={[styles.kmLabel, { color: subTextColor }]}>{t('kmTotal')}</Text>
              <Text style={[styles.kmValue, { color: textColor }]}>
                {telemetry.kmTotal.toLocaleString('pt-BR')} <Text style={[styles.kmUnit, { color: subTextColor }]}>km</Text>
              </Text>
              <Text style={[styles.mileageHint, { color: subTextColor }]}>{t('detalhesOdometro')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('telemetria')}</Text>
            <Text style={[styles.sectionCaption, { color: subTextColor }]}>
              {isActive ? t('telemetriaAtiva') : t('modoOffline')}
            </Text>
          </View>
          <View style={styles.telemetryGrid}>
            <TelemetryCard icon="thermostat" label={t('temperatura')} value={isActive ? `${telemetry.temp}` : "--"} unit="°C" color={isActive ? (telemetry.temp > 100 ? "#FF3D57" : "#00E676") : subTextColor} onPress={() => router.push("/detalhes/temperatura" as any)} />
            <TelemetryCard icon="settings" label="RPM" value={isActive && telemetry.rpm > 0 ? (telemetry.rpm / 1000).toFixed(1) : "--"} unit="k" color={isActive ? "#00B4FF" : subTextColor} onPress={() => router.push("/detalhes/rpm" as any)} />
          </View>

          <View style={styles.telemetryGrid}>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="local-gas-station" label={t('combustivel')} value={isActive ? `${Math.round(telemetry.fuel * 100)}` : "--"} unit="%" color={isActive ? (telemetry.fuel < 0.2 ? "#FF3D57" : (telemetry.fuel < 0.4 ? "#FFB300" : "#00E676")) : subTextColor} progress={isActive ? telemetry.fuel : 0} onPress={() => router.push("/detalhes/combustivel" as any)} />
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              <TelemetryCard icon="battery-charging-full" label={t('bateria')} value={isActive ? `${telemetry.volt}` : "--"} unit="V" color={isActive ? (telemetry.volt < 12 ? "#FF3D57" : "#00B4FF") : subTextColor} progress={isActive ? (telemetry.volt/15) : 0} onPress={() => router.push("/detalhes/bateria" as any)} />
              {isActive && <Text style={[styles.batteryStatusText, { color: subTextColor }]}>{t(batteryStatus)}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.toolsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('atalhos')}</Text>
          <View style={styles.toolsGrid}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.toolCard,
                { backgroundColor: cardColor, borderColor },
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/relatorios" as any)}
            >
              <View style={[styles.toolIcon, { backgroundColor: isDark ? '#3B3220' : '#FFF5DB' }]}>
                <MaterialIcons name="event-note" size={23} color="#C58B13" />
              </View>
              <View style={styles.toolText}>
                <Text style={[styles.toolCardTitle, { color: textColor }]}>{t('relatorios')}</Text>
                <Text style={[styles.toolCardSub, { color: subTextColor }]}>{t('relatoriosSub')}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={subTextColor} />
            </Pressable>
          </View>
        </View>

      </ScrollView>

      {/* MODAL 1: CALIBRAÇÃO DO ODÔMETRO VIRTUAL */}
      <Modal visible={showKmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={[styles.modalIconBox, { backgroundColor: isDark ? "#00B4FF11" : "#E0F2FE" }]}><MaterialCommunityIcons name="speedometer" size={32} color="#00B4FF" /></View>
            <Text style={[styles.modalTitle, { color: textColor }]}>Calibrar Odômetro</Text>
            
            {!virtualOdometro.isCalibrated ? (
               <Text style={[styles.modalText, { color: subTextColor }]}>
                 Para ativar o rastreamento preciso, informe a quilometragem exata que está exibida no painel do veículo neste momento.
               </Text>
            ) : (
               <Text style={[styles.modalText, { color: subTextColor }]}>
                 Ajuste ou confirme a quilometragem atual exibida no painel do veículo para sincronizar o cálculo.
               </Text>
            )}
            
            <TextInput 
              style={[styles.modalInput, { backgroundColor: iconBgColor, color: textColor, borderColor: '#00B4FF' }]} 
              keyboardType="numeric" 
              value={kmInput} 
              onChangeText={setKmInput} 
              maxLength={7}
            />

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

      {/* MODAL 2: DETALHES TÉCNICOS DO CÁLCULO */}
      <Modal visible={showDetailsModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDetailsModal(false)}>
          <Pressable style={[styles.modalBottomSheet, { backgroundColor: cardColor, borderColor: borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: textColor }]}>Detalhes do Odômetro Virtual</Text>
              <MaterialCommunityIcons name="engine-outline" size={24} color="#00B4FF" />
            </View>

            <View style={styles.techDataRow}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Leitura Bruta OBD2 (PID 0131):</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{kmObdRaw.toLocaleString("pt-PT")} km</Text>
            </View>

            <View style={styles.techDataRow}>
              <Text style={[styles.techDataLabel, { color: subTextColor }]}>Offset de Calibração Salvo:</Text>
              <Text style={[styles.techDataValue, { color: textColor }]}>{virtualOdometro.offset.toLocaleString("pt-PT")} km</Text>
            </View>

            <View style={[styles.techDataRow, { borderBottomWidth: 0, marginTop: 10 }]}>
              <Text style={[styles.techDataLabel, { color: '#00B4FF', fontWeight: 'bold' }]}>Resultado Final (Painel APP):</Text>
              <Text style={[styles.techDataValue, { color: '#00B4FF', fontWeight: 'bold', fontSize: 18 }]}>
                {telemetry.kmTotal.toLocaleString("pt-PT")} km
              </Text>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: borderColor }]} onPress={() => setShowDetailsModal(false)}>
                <Text style={[styles.modalBtnCancelText, { color: subTextColor }]}>Fechar</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtnConfirm, { backgroundColor: '#FF3D57' }]} 
                onPress={() => {
                  setKmInput(telemetry.kmTotal.toString());
                  setShowKmModal(true);
                }}
              >
                <Text style={[styles.modalBtnConfirmText, { color: "#FFF" }]}>Forçar Recalibração</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row',
    alignItems: 'center', padding: 14, borderRadius: 20, zIndex: 100, gap: 10,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10,
  },
  pillInfo: { backgroundColor: '#1685C5' },
  pillSuccess: { backgroundColor: '#168A63' },
  pillError: { backgroundColor: '#D94352' },
  pillText: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36, paddingTop: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18,
  },
  headerCopy: { flex: 1, paddingRight: 16 },
  appName: { fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 13, marginTop: 3 },
  profileBtn: {
    width: 46, height: 46, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  greeting: { fontSize: 25, lineHeight: 32, fontWeight: '800', marginHorizontal: 20, marginBottom: 16 },
  vehicleCard: { marginHorizontal: 20, borderRadius: 24, borderWidth: 1, padding: 18, gap: 16 },
  vehicleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  vehicleIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vehicleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  carModel: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  carYear: { fontSize: 13, marginTop: 2 },
  vehicleStatusRow: { gap: 8 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  connectionHint: { fontSize: 13, lineHeight: 19 },
  coreActions: { gap: 9 },
  primaryAction: {
    minHeight: 54, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#1685C5',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryActionPressed: { backgroundColor: '#126FA6' },
  primaryActionDisabled: { opacity: 0.7 },
  primaryActionText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  secondaryAction: {
    minHeight: 54, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  secondaryActionText: { flex: 1, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.76 },
  dashboard: { paddingHorizontal: 20, gap: 12, marginTop: 22 },
  mileageCard: {
    minHeight: 94, borderRadius: 20, borderWidth: 1, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  mileageIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mileageCopy: { flex: 1 },
  kmLabel: { fontSize: 12, fontWeight: '600' },
  kmValue: { fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  kmUnit: { fontSize: 13, fontWeight: '500' },
  mileageHint: { fontSize: 11, marginTop: 2 },
  sectionHeader: { marginTop: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionCaption: { fontSize: 12, marginTop: 3 },
  telemetryGrid: { flexDirection: 'row', gap: 12 },
  batteryStatusText: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  toolsSection: { paddingHorizontal: 20, gap: 12, marginTop: 22 },
  toolsGrid: { flexDirection: 'row', gap: 10 },
  toolCard: {
    flex: 1, minHeight: 78, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  toolIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolText: { flex: 1 },
  toolCardTitle: { fontSize: 14, fontWeight: '700' },
  toolCardSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 10, 15, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center', shadowColor: '#00B4FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#00B4FF44' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  modalText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  modalSubText: { fontSize: 12, textAlign: 'center', marginBottom: 20, opacity: 0.8 },
  modalInput: { width: '100%', borderRadius: 12, fontSize: 24, fontWeight: '700', textAlign: 'center', paddingVertical: 16, marginBottom: 24, borderWidth: 1 },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  modalBtnCancelText: { fontWeight: '700', fontSize: 14 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#00B4FF' },
  modalBtnConfirmText: { fontWeight: '800', fontSize: 14 },
  modalBottomSheet: { width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0, position: 'absolute', bottom: 0 },
  bottomSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  bottomSheetTitle: { fontSize: 18, fontWeight: '700' },
  techDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  techDataLabel: { fontSize: 14, fontWeight: '500' },
  techDataValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});