import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppPalette } from "../../constants/theme";
import { useApp } from "../../contexts/AppContext";

/**
 * @constant BATTERY_DATA
 * @description Mock de dados agregados do sistema elétrico, particionados em períodos.
 */
const BATTERY_DATA = [
  { time: "08:00", charge: 100, health: 98 },
  { time: "10:00", charge: 95, health: 98 },
  { time: "12:00", charge: 88, health: 97 },
  { time: "14:00", charge: 82, health: 97 },
  { time: "16:00", charge: 75, health: 96 },
  { time: "18:00", charge: 68, health: 96 },
  { time: "20:00", charge: 62, health: 95 },
];

/**
 * Componente BatteryDetailsScreen
 * @description Apresenta análise do estado e saúde da bateria.
 * Utiliza geometria de círculos SVG (strokeDasharray) para representação visual da carga em tempo real.
 */
export default function BatteryDetailsScreen() {
  const { theme, t } = useApp();

  const isDark = theme === 'dark';
  const colors = AppPalette[theme];
  const { background: bgColor, surface: cardColor, text: textColor, textSecondary: subTextColor, border: borderColor } = colors;
  const primaryColor = "#4CAF50"; // Verde (Saúde/Carga)
  const secondaryColor = "#FF9800"; // Laranja (Média)

  const currentCharge = 62;
  const currentHealth = 95;
  const avgCharge = Math.round(BATTERY_DATA.reduce((sum, d) => sum + d.charge, 0) / BATTERY_DATA.length);

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <ScreenHeader title={t('bateria')} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.circleContainer}>
          <Svg width={200} height={200} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="batteryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={primaryColor} />
                <Stop offset="100%" stopColor="#8BC34A" />
              </LinearGradient>
            </Defs>
            
            <Circle cx={100} cy={100} r={90} fill="none" stroke={borderColor} strokeWidth={8} opacity={isDark ? 1 : 0.5} />
            
            <Circle
              cx={100}
              cy={100}
              r={90}
              fill="none"
              stroke="url(#batteryGrad)"
              strokeWidth={8}
              strokeDasharray={`${(currentCharge / 100) * (180 * Math.PI)} ${180 * Math.PI}`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
          </Svg>
          
          <View style={styles.circleContent}>
            <Text style={[styles.circleValue, { color: primaryColor }]}>{currentCharge}%</Text>
            <Text style={[styles.circleLabel, { color: subTextColor }]}>{t('carga')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="favorite" size={20} color={primaryColor} />
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('saude')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{currentHealth}%</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <MaterialIcons name="trending-down" size={20} color={secondaryColor} />
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('media')}</Text>
            <Text style={[styles.statValue, { color: secondaryColor }]}>{avgCharge}%</Text>
          </View>
        </View>

        <View style={[styles.timelineContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.timelineTitle, { color: textColor }]}>{t('historicoCarga')}</Text>
          
          {BATTERY_DATA.map((data, i) => (
            <View key={`battery-${i}`} style={[styles.timelineItem, { borderBottomColor: borderColor }]}>
              <View style={[styles.timelineDot, { backgroundColor: primaryColor }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTime, { color: textColor }]}>{data.time}</Text>
                
                <View style={[styles.timelineBar, { backgroundColor: isDark ? "#1E2235" : "#CBD5E1" }]}>
                  <View style={[styles.timelineBarFill, { width: `${data.charge}%` as any, backgroundColor: primaryColor }]} />
                </View>
              </View>
              <Text style={[styles.timelineValue, { color: primaryColor }]}>{data.charge}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  circleContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  circleContent: { position: "absolute", alignItems: "center" },
  circleValue: { fontSize: 48, fontWeight: "800" },
  circleLabel: { fontSize: 12, marginTop: -4 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center", gap: 8 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 18, fontWeight: "700" },
  timelineContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  timelineTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  timelineItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineContent: { flex: 1, gap: 6 },
  timelineTime: { fontSize: 12, fontWeight: "600" },
  timelineBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  timelineBarFill: { height: "100%", borderRadius: 2 },
  timelineValue: { fontSize: 12, fontWeight: "700" },
});