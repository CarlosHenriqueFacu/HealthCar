import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ChartPeriodToggle } from "../../components/ChartPeriodToggle";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";

import {
  obterAbastecimentosPorPeriodo,
  obterDadosGrafico,
  obterHistoricoAbastecimento,
  obterResumoSessoes,
  obterVeiculoLocal,
  salvarAbastecimentoLocal,
} from "../../database/database";
import { buildChartBuckets, type ChartPeriod } from "../../utils/chart-period";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface RefillData {
  key: string;
  dataString: string;
  litros: number;
  custo: number;
  kmOcasiao: number;
}

interface FuelChartData {
  key: string;
  label: string;
  litros: number;
  custo: number;
}

export default function FuelDetailsScreen() {
  const { theme, t, language } = useApp();
  const { user, syncNow } = useAuth();
  const locale = language === 'en' ? 'en-US' : 'pt-BR';

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [abastecimentos, setAbastecimentos] = useState<RefillData[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [fuelChartData, setFuelChartData] = useState<FuelChartData[]>(() =>
    buildChartBuckets('day', locale).map((bucket) => ({ ...bucket, litros: 0, custo: 0 })),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any>(null);
  const [showRefuelForm, setShowRefuelForm] = useState(false);
  const [litersInput, setLitersInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [mileageInput, setMileageInput] = useState('');

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const primaryColor = "#FFC107";
  const dangerColor = "#FF3D57";

  const carregarDadosCombustivel = useCallback(async () => {
    setIsLoading(true);
    setCurrentLevel(0);
    setAbastecimentos([]);
    try {
      if (!user?.uid) return;
      const buckets = buildChartBuckets(period, locale);
      const currentVehicle = await obterVeiculoLocal(user.uid);
      setVehicle(currentVehicle);
      setFuelChartData(buckets.map((bucket) => ({ ...bucket, litros: 0, custo: 0 })));
      const sessoes = currentVehicle ? await obterResumoSessoes(user.uid, currentVehicle.id) : [];
      if (sessoes && sessoes.length > 0) {
        const sessaoAtiva: any = sessoes[0];
        const leiturasCombustivel: any = await obterDadosGrafico(user.uid, sessaoAtiva.id, "012F");
        if (leiturasCombustivel && leiturasCombustivel.length > 0) {
          setCurrentLevel(leiturasCombustivel[leiturasCombustivel.length - 1].valor);
        }
      }

      if (currentVehicle) {
        const [historico, resumoPorPeriodo] = await Promise.all([
          obterHistoricoAbastecimento(user.uid, currentVehicle.id),
          obterAbastecimentosPorPeriodo(user.uid, currentVehicle.id, period),
        ]);

        if (historico && historico.length > 0) {
          const processado = historico.map((h: any) => {
            const dataObj = new Date(h.dataAbastecimento);
            return {
              key: String(h.id),
              dataString: dataObj.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
              litros: h.litros,
              custo: h.custoTotal,
              kmOcasiao: h.kmNaOcasiao
            };
          });
          setAbastecimentos(processado.reverse());
        } else {
          setAbastecimentos([]);
        }
        const byPeriod = new Map(resumoPorPeriodo.map((item) => [item.periodKey, item]));
        setFuelChartData(buckets.map((bucket) => {
          const summary = byPeriod.get(bucket.key);
          return {
            ...bucket,
            litros: Number(summary?.litros ?? 0),
            custo: Number(summary?.custo ?? 0),
          };
        }));
      } else {
        setFuelChartData(buckets.map((bucket) => ({ ...bucket, litros: 0, custo: 0 })));
      }
    } catch (error) {
      console.log("[Data Error] Falha ao extrair analítica de combustível:", error);
    } finally {
      setIsLoading(false);
    }
  }, [locale, period, user?.uid]);

  useFocusEffect(useCallback(() => {
    void carregarDadosCombustivel();
  }, [carregarDadosCombustivel]));

  async function saveRefuel() {
    const liters = Number(litersInput.replace(',', '.'));
    const cost = Number(costInput.replace(',', '.'));
    const mileage = Number(mileageInput.replace(/\D/g, ''));
    if (!user?.uid || !vehicle) {
      Alert.alert(t('veiculoNaoEncontrado'), t('cadastreVeiculoAbast'));
      return;
    }
    if (!Number.isFinite(liters) || liters <= 0 || !Number.isFinite(mileage) || mileage <= 0) {
      Alert.alert(t('confiraOsDados'), t('confiraDadosAbast'));
      return;
    }
    try {
      await salvarAbastecimentoLocal(user.uid, vehicle.id, liters, Number.isFinite(cost) ? cost : 0, mileage);
      setShowRefuelForm(false);
      setLitersInput('');
      setCostInput('');
      setMileageInput('');
      await carregarDadosCombustivel();
      void syncNow().catch(() => {});
    } catch (error) {
      Alert.alert(t('naoFoiPossivelSalvar'), t('erroSalvarAbast'));
      console.error('[Abastecimento] Falha ao gravar no SQLite:', error);
    }
  }

  const autonomiaEstimada = Math.round((currentLevel / 100) * 600);
  const dataToRender = fuelChartData;
  const maxLitros = Math.max(...dataToRender.map((d) => d.litros), 1);
  const safeMax = maxLitros > 0 ? maxLitros : 1;
  const totalLitrosPeriodo = fuelChartData.reduce((sum, d) => sum + d.litros, 0);
  const totalCustoPeriodo = fuelChartData.reduce((sum, d) => sum + d.custo, 0);

  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 180;
  const numBars = dataToRender.length > 0 ? dataToRender.length : 1;
  const barWidth = (chartWidth - 40) / numBars;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('combustivel')}</Text>

        <Pressable onPress={() => { setMileageInput(String(vehicle?.km ?? '')); setShowRefuelForm(true); }} style={styles.testBtn}>
          <MaterialIcons name="add" size={20} color="#00B4FF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="local-gas-station" size={32} color={currentLevel < 15 ? dangerColor : primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('nivelAtual')}</Text>
              <Text style={[styles.statusValue, { color: currentLevel < 15 ? dangerColor : primaryColor }]}>
                {isLoading ? "--" : currentLevel}%
              </Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusRange, { color: currentLevel < 15 ? dangerColor : primaryColor }]}>
              ~{isLoading ? "--" : autonomiaEstimada} km
            </Text>
            <Text style={[styles.statusRangeLabel, { color: subTextColor }]}>{t('deAutonomia')}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('abastecido')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{isLoading ? "-" : totalLitrosPeriodo.toFixed(1)}L</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>{t('gastoNoPeriodo')}</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>
              {isLoading ? "-" : totalCustoPeriodo.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}
            </Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeadingCopy}>
              <Text style={[styles.chartTitle, { color: textColor }]}>{t('volumeAbastecido')}</Text>
              <Text style={[styles.chartSubtitle, { color: subTextColor }]}>{period === 'day' ? t('ultimos7Dias') : t('ultimos12Meses')}</Text>
            </View>
            <ChartPeriodToggle
              value={period}
              onChange={setPeriod}
              cardColor={cardColor}
              borderColor={borderColor}
              mutedColor={subTextColor}
              activeColor={primaryColor}
              dayLabel={t('dia')}
              monthLabel={t('mes')}
            />
          </View>

          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : fuelChartData.every((entry) => entry.litros === 0) ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="local-gas-station" size={48} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>{t('nenhumRegistroAbast')}</Text>
            </View>
          ) : (
            <>
              <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
                <Defs>
                  <LinearGradient id="fuelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {[0, 25, 50, 75, 100].map((percent) => (
                  <Line
                    key={`grid-${percent}`}
                    x1={20}
                    y1={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                    x2={chartWidth - 20}
                    y2={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                    stroke={borderColor}
                    strokeWidth={1}
                    opacity={isDark ? 0.3 : 1}
                  />
                ))}

                {dataToRender.map((data, i) => {
                  const barHeight = (data.litros / safeMax) * (chartHeight - 60);
                  const x = 20 + i * barWidth + barWidth * 0.1;
                  const y = chartHeight - 30 - barHeight;

                  return (
                    <Rect
                      key={data.key}
                      x={x}
                      y={y}
                      width={barWidth * 0.8}
                      height={barHeight}
                      fill={primaryColor}
                      opacity={selectedDay === i ? 1 : (isDark ? 0.6 : 0.8)}
                      rx={4}
                    />
                  );
                })}
              </Svg>

              <View style={styles.dayLabels}>
                {dataToRender.map((data) => (
                  <Text key={data.key} style={[styles.dayLabel, { color: subTextColor }]}>
                    {data.label}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>{t('logsAbastecimento')}</Text>

          {isLoading || abastecimentos.length === 0 ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>{t('registreAbastHistorico')}</Text>
          ) : (
            abastecimentos.slice().reverse().map((data) => (
              <View key={data.key} style={[styles.refillItem, { borderBottomColor: borderColor }]}>
                <MaterialIcons name="local-gas-station" size={24} color="#4CAF50" />
                <View style={styles.refillContent}>
                  <Text style={[styles.refillDay, { color: textColor }]}>{data.dataString}</Text>
                  <Text style={[styles.refillTime, { color: subTextColor }]}>{t('kmDoPainel')} {data.kmOcasiao.toLocaleString(locale)} km</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: primaryColor, fontWeight: "700" }}>{data.litros.toFixed(1)} L</Text>
                  <Text style={{ color: subTextColor, fontSize: 10 }}>{data.custo.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showRefuelForm} transparent animationType="slide" onRequestClose={() => setShowRefuelForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.modalTitleRow}>
              <Text style={[styles.chartTitle, { color: textColor }]}>{t('registrarAbastecimento')}</Text>
              <Pressable onPress={() => setShowRefuelForm(false)}><MaterialIcons name="close" size={22} color={subTextColor} /></Pressable>
            </View>
            <TextInput value={litersInput} onChangeText={setLitersInput} placeholder={t('litros')} placeholderTextColor={subTextColor} keyboardType="decimal-pad" style={[styles.formInput, { color: textColor, borderColor, backgroundColor: bgColor }]} />
            <TextInput value={costInput} onChangeText={setCostInput} placeholder={t('valorTotalPlaceholder')} placeholderTextColor={subTextColor} keyboardType="decimal-pad" style={[styles.formInput, { color: textColor, borderColor, backgroundColor: bgColor }]} />
            <TextInput value={mileageInput} onChangeText={setMileageInput} placeholder={t('quilometragem')} placeholderTextColor={subTextColor} keyboardType="numeric" style={[styles.formInput, { color: textColor, borderColor, backgroundColor: bgColor }]} />
            <Pressable onPress={() => void saveRefuel()} style={styles.saveButton}><Text style={styles.saveButtonText}>{t('salvarNoAparelho')}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 40 },
  testBtn: { padding: 8, backgroundColor: '#00B4FF22', borderRadius: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 20, paddingBottom: 34 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  formInput: { borderWidth: 1, borderRadius: 12, minHeight: 48, marginBottom: 10, paddingHorizontal: 13 },
  saveButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#00B4FF', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveButtonText: { color: '#04131A', fontSize: 14, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 16, borderWidth: 1 },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusLabel: { fontSize: 12 },
  statusValue: { fontSize: 24, fontWeight: "700", marginTop: 2 },
  statusRight: { alignItems: "flex-end" },
  statusRange: { fontSize: 16, fontWeight: "700" },
  statusRangeLabel: { fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "700" },
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  chartHeadingCopy: { flex: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600" },
  chartSubtitle: { fontSize: 10, marginTop: 3 },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  emptyChartText: { fontSize: 13, fontWeight: "500" },
  dayLabels: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20 },
  dayLabel: { fontSize: 10, fontWeight: "600" },
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  refillItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  refillContent: { flex: 1 },
  refillDay: { fontSize: 14, fontWeight: "700" },
  refillTime: { fontSize: 11, marginTop: 2 },
});