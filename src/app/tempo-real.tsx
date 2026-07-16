import { ScreenContainer } from "@/components/screen-container";
import { SpeedometerMinimal } from "@/components/SpeedometerMinimal";
import { TelemetryCard } from "@/components/TelemetryCard";
import { MaterialIcons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ==========================================================
   MANUTENÇÃO FUTURA: DADOS DE TELEMETRIA AO VIVO
   Estes são os valores de "teste" (Mock) que alimentam a tela.
   Quando a conexão OBD-II estiver pronta, nós vamos apagar este
   objeto e criar um 'Estado' (useState) global ou usar ContextAPI
   para que os dados cheguem direto do adaptador ELM327.
========================================================== */
const REALTIME_DATA = {
  speed: 87,
  rpm: 3200,
  temp: 92,
  fuel: 0.72,
  kmTraveled: 142,
  fuelConsumption: 8.5, // km/l
};

export default function RealtimeScreen() {
  const [displaySpeed, setDisplaySpeed] = useState(REALTIME_DATA.speed);
  const [displayKm, setDisplayKm] = useState(REALTIME_DATA.kmTraveled);
  const speedRef = useRef(0);
  const kmRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headerGlow = useSharedValue(1);
  const speedometerScale = useSharedValue(1);

  useKeepAwake();

  useEffect(() => {
    /* ==========================================================
       MANUTENÇÃO FUTURA: SIMULADOR DE VELOCIDADE
       Este 'setInterval' existe apenas para a agulha do velocímetro 
       ficar balançando e simular o carro em movimento (±5 km/h).
       Ao conectar no carro real, toda essa lógica será DELETADA e
       substituída por: setDisplaySpeed(dadosOBD.velocidade);
    ========================================================== */
    intervalRef.current = setInterval(() => {
      // Variação randômica de velocidade
      const speedVariation = (Math.random() - 0.5) * 10;
      speedRef.current = Math.max(0, Math.min(240, REALTIME_DATA.speed + speedVariation));
      setDisplaySpeed(Math.round(speedRef.current));

      // Incrementa KM baseado na velocidade
      kmRef.current += displaySpeed / 3600;
      setDisplayKm(Math.round(kmRef.current * 10) / 10);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Calcula a autonomia disponível (Mágica matemática do TCC!)
  const availableRange = Math.round(REALTIME_DATA.fuel * 60 * REALTIME_DATA.fuelConsumption);
  const fuelConsumptionRate = (displaySpeed / REALTIME_DATA.fuelConsumption).toFixed(1);

  const headerGlowStyle = useAnimatedStyle(() => ({
    opacity: headerGlow.value,
  }));

  const speedometerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: speedometerScale.value }],
  }));

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
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>TRANSMISSÃO AO VIVO</Text>
        </Animated.View>

        {/* ================= VELOCÍMETRO PRINCIPAL ================= */}
        <Animated.View style={[styles.speedometerWrapper, speedometerStyle]}>
          {/* MANUTENÇÃO: Este componente recebe a prop 'speed' que fará o ponteiro mexer */}
          <SpeedometerMinimal speed={displaySpeed} isActive={true} />
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
              value={(REALTIME_DATA.rpm / 1000).toFixed(1)}
              unit="k"
              color="#00B4FF"
            />
          </View>

          <View style={styles.telemetryRow}>
            <TelemetryCard
              icon="thermostat"
              label="Temperatura"
              value={`${REALTIME_DATA.temp}`}
              unit="°C"
              color={REALTIME_DATA.temp > 100 ? "#FF3D57" : REALTIME_DATA.temp > 85 ? "#FFB300" : "#00E676"}
            />
            <TelemetryCard
              icon="local-gas-station"
              label="Combustível"
              value={`${Math.round(REALTIME_DATA.fuel * 100)}`}
              unit="%"
              color={REALTIME_DATA.fuel < 0.2 ? "#FF3D57" : REALTIME_DATA.fuel < 0.4 ? "#FFB300" : "#00E676"}
              progress={REALTIME_DATA.fuel}
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
              <Text style={styles.rangeInfo}>Baseado em {REALTIME_DATA.fuelConsumption} km/l</Text>
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
        {/* MANUTENÇÃO: A maioria destes dados não vem direto do OBD-II. Nós teremos 
            que calcular a média deles usando lógica JS baseada no tempo de conexão. */}
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
    backgroundColor: "#00B4FF",
    shadowColor: "#00B4FF",
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