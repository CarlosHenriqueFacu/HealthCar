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

// Importando o motor do Bluetooth
import RNBluetoothClassic from "react-native-bluetooth-classic";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* Dados fixos temporários para o que ainda não lemos do OBD */
const MOCK_DATA = {
  fuel: 0.72,
  kmTraveled: 142,
  fuelConsumption: 8.5, // km/l
};

export default function RealtimeScreen() {
  // Estados Reais alimentados pelo OBD-II
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displayTemp, setDisplayTemp] = useState(0);
  const [isReading, setIsReading] = useState(false);
  
  // Estados Fixos
  const [displayKm, setDisplayKm] = useState(MOCK_DATA.kmTraveled);

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  /* ==========================================================
     CÉREBRO DO OBD-II: MOTOR DE LEITURA CONTÍNUA
  ========================================================== */
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function startReading() {
      try {
        const devices = await RNBluetoothClassic.getConnectedDevices();
        
        if (devices.length > 0) {
          const device = devices[0];
          setIsReading(true);

          // Loop de leitura: Repete a cada 1 segundo
          interval = setInterval(async () => {
            try {
              // 1. Ler Velocidade (Comando HEX: 010D)
              await device.write("010D\r");
              const speedResp = await device.read();
              const realSpeed = parseOBD(speedResp, "0D");
              if (realSpeed > 0) setDisplaySpeed(realSpeed);

              // 2. Ler RPM (Comando HEX: 010C)
              await device.write("010C\r");
              const rpmResp = await device.read();
              const realRpm = parseOBD(rpmResp, "0C");
              if (realRpm > 0) setDisplayRpm(realRpm);

              // 3. Ler Temperatura (Comando HEX: 0105)
              await device.write("0105\r");
              const tempResp = await device.read();
              const realTemp = parseOBD(tempResp, "05");
              if (realTemp > 0) setDisplayTemp(realTemp);

            } catch (err) {
              console.log("Erro na leitura de telemetria", err);
            }
          }, 1000);
        }
      } catch (error) {
        console.log("Nenhum dispositivo conectado encontrado", error);
      }
    }

    startReading();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  /* ==========================================================
     TRADUTOR HEXADECIMAL -> NÚMEROS REAIS
  ========================================================== */
  function parseOBD(response: any, pid: string): number {
    if (!response) return 0;
    
    // Força a conversão para texto puro para o TypeScript não reclamar
    const strResponse = String(response);
    if (strResponse.includes("NO DATA")) return 0;
    
    const cleanResp = strResponse.replace(/\s/g, "").toUpperCase();
    const target = "41" + pid;
    const index = cleanResp.indexOf(target);
    
    if (index !== -1) {
      const dataHex = cleanResp.substring(index + 4);
      try {
        if (pid === "0C") { // RPM
          const A = parseInt(dataHex.substring(0, 2), 16);
          const B = parseInt(dataHex.substring(2, 4), 16);
          return Math.round(((A * 256) + B) / 4);
        } 
        else if (pid === "0D") { // Velocidade
          const A = parseInt(dataHex.substring(0, 2), 16);
          return A;
        }
        else if (pid === "05") { // Temperatura
          const A = parseInt(dataHex.substring(0, 2), 16);
          return A - 40;
        }
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  // Calcula a autonomia
  const availableRange = Math.round(MOCK_DATA.fuel * 60 * MOCK_DATA.fuelConsumption);
  const fuelConsumptionRate = (displaySpeed / MOCK_DATA.fuelConsumption).toFixed(1);

  const headerGlowStyle = useAnimatedStyle(() => ({ opacity: headerGlow.value }));
  const speedometerStyle = useAnimatedStyle(() => ({ transform: [{ scale: speedometerScale.value }] }));

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      {/* ================= CABEÇALHO SUPERIOR ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Tempo Real</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ================= BADGE: TRANSMISSÃO AO VIVO ================= */}
        <Animated.View style={[styles.liveBadge, headerGlowStyle]}>
          <View style={[styles.liveDot, isReading && { backgroundColor: "#00E676", shadowColor: "#00E676" }]} />
          <Text style={styles.liveBadgeText}>
            {isReading ? "LENDO DADOS DO CARRO" : "AGUARDANDO CONEXÃO..."}
          </Text>
        </Animated.View>

        {/* ================= VELOCÍMETRO PRINCIPAL ================= */}
        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          <SpeedometerMinimal speed={displaySpeed} isActive={isReading} />
        </Animated.View>

        {/* ================= CARDS DE TELEMETRIA PRIMÁRIA ================= */}
        <View style={styles.primaryTelemetry}>
          <View style={styles.telemetryRow}>
            <TelemetryCard
              icon="directions"
              label="KM Percorrido"
              value={displayKm.toFixed(1)}
              unit="km"
              color="#00B4FF"
            />
            <TelemetryCard
              icon="settings"
              label="RPM"
              value={(displayRpm / 1000).toFixed(1)}
              unit="k"
              color="#00B4FF"
            />
          </View>

          <View style={styles.telemetryRow}>
            <TelemetryCard
              icon="thermostat"
              label="Temperatura"
              value={`${displayTemp}`}
              unit="°C"
              color={displayTemp > 100 ? "#FF3D57" : displayTemp > 85 ? "#FFB300" : "#00E676"}
            />
            <TelemetryCard
              icon="local-gas-station"
              label="Combustível"
              value={`${Math.round(MOCK_DATA.fuel * 100)}`}
              unit="%"
              color={MOCK_DATA.fuel < 0.2 ? "#FF3D57" : MOCK_DATA.fuel < 0.4 ? "#FFB300" : "#00E676"}
              progress={MOCK_DATA.fuel}
            />
          </View>
        </View>

        {/* ================= CARD DE AUTONOMIA E CONSUMO ================= */}
        <View style={styles.fuelRangeCard}>
          <View style={styles.fuelRangeHeader}>
            <MaterialIcons name="route" size={18} color="#00B4FF" />
            <Text style={styles.fuelRangeTitle}>Autonomia com Combustível</Text>
          </View>
          <View style={styles.fuelRangeContent}>
            <View style={styles.rangeValue}>
              <Text style={styles.rangeNumber}>{availableRange}</Text>
              <Text style={styles.rangeUnit}>km</Text>
            </View>
            <View style={styles.rangeDetails}>
              <Text style={styles.rangeLabel}>Consumo atual</Text>
              <Text style={styles.rangeConsumption}>{fuelConsumptionRate} L/h</Text>
              <Text style={styles.rangeInfo}>Baseado em {MOCK_DATA.fuelConsumption} km/l</Text>
            </View>
          </View>
          <View style={styles.rangeBar}>
            <View
              style={[
                styles.rangeFill,
                { width: `${(availableRange / 500) * 100}%` as any },
              ]}
            />
          </View>
        </View>

        {/* ================= MÉTRICAS AVANÇADAS ================= */}
        <View style={styles.advancedSection}>
          <Text style={styles.advancedTitle}>Métricas Avançadas</Text>

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <MaterialIcons name="speed" size={16} color="#8892A4" />
              <Text style={styles.metricLabel}>Velocidade Máxima</Text>
            </View>
            <Text style={styles.metricValue}>120 km/h</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <MaterialIcons name="trending-up" size={16} color="#8892A4" />
              <Text style={styles.metricLabel}>Aceleração Média</Text>
            </View>
            <Text style={styles.metricValue}>2.3 m/s²</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <MaterialIcons name="timer" size={16} color="#8892A4" />
              <Text style={styles.metricLabel}>Tempo de Viagem</Text>
            </View>
            <Text style={styles.metricValue}>45 min</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <MaterialIcons name="local-gas-station" size={16} color="#8892A4" />
              <Text style={styles.metricLabel}>Consumo Médio</Text>
            </View>
            <Text style={styles.metricValue}>8.5 km/l</Text>
          </View>
        </View>

        {/* ================= BOTÃO ENCERRAR ================= */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.stopBtn,
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialIcons name="stop-circle" size={20} color="#FF3D57" />
          <Text style={styles.stopBtnText}>Encerrar Transmissão</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

// ================= ESTILOS (CSS in JS) =================
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#F0F2FF",
  },
  headerSpacer: { width: 30 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00B4FF22",
    borderWidth: 1,
    borderColor: "#00B4FF44",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "center",
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3D57",
    shadowColor: "#FF3D57",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00B4FF",
    letterSpacing: 1,
  },

  speedometerWrapper: {
    alignItems: "center",
    paddingVertical: 16,
  },

  primaryTelemetry: {
    gap: 10,
  },
  telemetryRow: {
    flexDirection: "row",
    gap: 10,
  },

  fuelRangeCard: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    gap: 12,
  },
  fuelRangeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fuelRangeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  fuelRangeContent: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  rangeValue: {
    alignItems: "center",
    gap: 2,
  },
  rangeNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#00B4FF",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    textShadowColor: "#00B4FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  rangeUnit: {
    fontSize: 12,
    color: "#8892A4",
  },
  rangeDetails: {
    flex: 1,
    gap: 2,
  },
  rangeLabel: {
    fontSize: 10,
    color: "#8892A4",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rangeConsumption: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F0F2FF",
  },
  rangeInfo: {
    fontSize: 10,
    color: "#8892A4",
  },
  rangeBar: {
    height: 4,
    backgroundColor: "#1E2235",
    borderRadius: 2,
    overflow: "hidden",
  },
  rangeFill: {
    height: "100%",
    backgroundColor: "#00B4FF",
    borderRadius: 2,
  },

  advancedSection: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    gap: 10,
  },
  advancedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8892A4",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  metricLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#8892A4",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00B4FF",
  },

  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF3D5722",
    borderWidth: 1,
    borderColor: "#FF3D5744",
    borderRadius: 14,
    paddingVertical: 12,
  },
  stopBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3D57",
  },
});