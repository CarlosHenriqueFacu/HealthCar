import { ScreenContainer } from "@/components/screen-container";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  NativeModules // [ALTERAÇÃO NATIVA]: Importação necessária para acessar a nossa ponte em Java
  ,

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

// [ALTERAÇÃO NATIVA]: Extraindo o nosso Módulo Nativo em Java (OBDBluetoothModule).
// A partir de agora, a comunicação serial pesada (leitura e escrita) passa por aqui, 
// e não mais pela biblioteca RNBluetoothClassic.
const { OBDBluetooth } = NativeModules;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Dados de exemplo para exibição enquanto o carro não envia dados reais
const MOCK_DATA = {
  fuel: 0.72,
  kmTraveled: 142,
};

export default function RealtimeScreen() {
  // Estados para controlar os valores que aparecem na tela
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [displayKm, setDisplayKm] = useState(MOCK_DATA.kmTraveled);
  const [statusMsg, setStatusMsg] = useState("INICIALIZANDO SCANNER...");
  
  // Log visual para ajudar no debug (raio-x da conexão)
  const [debugLog, setDebugLog] = useState("Aguardando comunicação com a ECU...");

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  // Mantém a tela do celular sempre ligada durante a leitura
  useKeepAwake();

  useEffect(() => {
    let isActive = true; // Controla se a tela ainda está aberta para não rodar loop em background
    let timerId: ReturnType<typeof setTimeout>;
    
    // [ALTERAÇÃO NATIVA]: A função perguntarAoCarro foi completamente reescrita.
    // Ela não usa mais o loop (Plano D) em JavaScript, pois isso gerava gargalo.
    // Agora, ela delega o envio e a espera pela resposta (com timeout de 2s) diretamente 
    // para a função 'sendCommand' do nosso módulo Java, que roda direto no processador.
    async function perguntarAoCarro(comando: string) {
      try {
        const resposta = await OBDBluetooth.sendCommand(comando);
        return resposta;
      } catch (err: any) {
        return `ERRO: ${err?.message}`;
      }
    }

    // Função recursiva que fica pedindo os dados para a ECU constantemente
    async function loopDeLeitura() {
      if (!isActive) return;

      try {
        // 1. Pede o RPM (01 0C)
        const rpmResp = await perguntarAoCarro("010C");
        setDebugLog(`Comando 010C (RPM):\n"${rpmResp}"`);
        
        const realRpm = parseOBD(rpmResp, "0C");
        if (realRpm > 0) setDisplayRpm(realRpm);

        // 2. Pede a Temperatura (01 05). Só faz isso se o RPM não deu erro de comunicação, 
        // para evitar acumular erros no buffer do adaptador.
        if (!String(rpmResp).includes("ERRO")) {
            const tempResp = await perguntarAoCarro("0105");
            const realTemp = parseOBD(tempResp, "05");
            if (realTemp > 0) setDisplayTemp(realTemp);
        }

      } catch (err) {
        setDebugLog("Erro no ciclo de leitura.");
      }

      // Agenda a próxima rodada de perguntas (1.5s de respiro para não travar o scanner)
      if (isActive) {
        timerId = setTimeout(() => loopDeLeitura(), 1500); 
      }
    }

    // Fluxo principal de inicialização da conexão
    async function startReading() {
      try {
        // [ALTERAÇÃO NATIVA]: Continuamos usando a biblioteca clássica APENAS para 
        // vasculhar a lista de dispositivos pareados no celular e pegar o Endereço MAC.
        const devices = await RNBluetoothClassic.getBondedDevices();
        
        // Procura por adaptadores comuns pelo nome
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
          
          try {
            // [ALTERAÇÃO NATIVA]: A conexão agora é feita passando o MAC Address para o Java.
            // O Java utiliza createInsecureRfcommSocketToServiceRecord, que é o grande 
            // truque para fazer os clones V2.1 conectarem sem o erro de timeout no Android.
            await OBDBluetooth.connect(obdDevice.address);
            setDebugLog("Ponte Nativa Conectada com Sucesso!");
          } catch (e: any) {
            setDebugLog(`Falha na Ponte Nativa: ${e?.message}`);
            setStatusMsg("FALHA NA CONEXÃO");
            return; // Se falhar aqui, aborta o resto da função
          }

          // Sequência de inicialização padrão do chip ELM327
          setStatusMsg("REINICIANDO ADAPTADOR...");
          await perguntarAoCarro("ATZ"); // Reseta o chip
          await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda o boot do chip

          setStatusMsg("CONFIGURANDO CANAIS...");
          await perguntarAoCarro("ATE0"); // Desliga o "Eco" (impede que ele repita nosso próprio comando)
          await perguntarAoCarro("ATL0"); // Desliga quebras de linha
          await perguntarAoCarro("ATS0"); // Desliga espaços 
          await perguntarAoCarro("ATH0"); // Desliga cabeçalhos da rede CAN
          await perguntarAoCarro("ATSP0"); // Procura o protocolo automaticamente

          setStatusMsg("SINCRONIZANDO COM A ECU...");
          await perguntarAoCarro("0100"); // Pede os PIDs suportados só para forçar a negociação com o carro
          await new Promise(resolve => setTimeout(resolve, 1500)); 

          if (!isActive) return; // Checagem de segurança caso o usuário feche a tela no meio do boot

          setStatusMsg("LENDO DADOS DO CARRO");
          loopDeLeitura(); // Inicia o loop infinito de coleta de dados
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

   // Cleanup: Executado quando o usuário sai da tela
    return () => {
      isActive = false; 
      if (timerId) clearTimeout(timerId);
      
      // Proteção adicionada: Só tenta desconectar se a ponte nativa existir
      if (OBDBluetooth) {
        OBDBluetooth.disconnect().catch(() => {});
      }
    };
  }, []);

  // Função responsável por converter o retorno sujo Hexadecimal em números decimais reais
  function parseOBD(response: any, pid: string): number {
    if (!response) return 0;
    
    // Limpa espaços em branco e o sinal de prompt (>)
    const strResponse = String(response).replace(/[\s>]/g, "").toUpperCase();
    
    // Ignora mensagens de erro comuns do ELM327
    if (
      strResponse.includes("NODATA") || 
      strResponse.includes("SEARCHING") || 
      strResponse.includes("ERROR") || 
      strResponse.includes("TIMEOUT") ||
      strResponse.includes("QUASE")
    ) {
      return 0;
    }
    
    // A resposta de sucesso sempre começa com "41" seguido do PID (ex: 410C para RPM)
    const target = "41" + pid;
    const index = strResponse.indexOf(target);
    
    if (index !== -1) {
      // Pega a parte dos dados hexadecimais após o cabeçalho 41XX
      const dataHex = strResponse.substring(index + 4);
      try {
        if (pid === "0C") { // Cálculo de RPM (A*256 + B) / 4
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D") { // Cálculo de Velocidade (A)
          return parseInt(dataHex.substring(0, 2), 16);
        }
        else if (pid === "05") { // Cálculo de Temperatura da Água (A - 40)
          return parseInt(dataHex.substring(0, 2), 16) - 40;
        }
      } catch (e) {
        return 0; // Prevenção de quebra caso o hexadecimal esteja malformado
      }
    }
    return 0;
  }

  // Estilos das animações visuais
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
        {/* Status de Conexão */}
        <Animated.View style={[styles.liveBadge, headerGlowStyle]}>
          <View style={[styles.liveDot, isReading && { backgroundColor: "#00E676", shadowColor: "#00E676" }]} />
          <Text style={styles.liveBadgeText}>{statusMsg}</Text>
        </Animated.View>

        {/* Velocímetro */}
        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          <SpeedometerMinimal speed={displaySpeed} isActive={isReading} />
        </Animated.View>

        {/* Cards de Telemetria */}
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

        {/* Log de Debug Visual */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>RAIO-X DO BLUETOOTH (DEBUG)</Text>
          <Text style={styles.debugText}>{debugLog}</Text>
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