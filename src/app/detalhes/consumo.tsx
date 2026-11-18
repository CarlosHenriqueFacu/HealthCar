import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Svg, { G, Line, Rect } from 'react-native-svg';
import { ChartPeriodToggle } from '../../components/ChartPeriodToggle';
import { ScreenContainer } from '../../components/screen-container';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { obterAbastecimentosPorPeriodo, obterVeiculoLocal } from '../../database/database';
import { buildChartBuckets, type ChartPeriod } from '../../utils/chart-period';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ConsumptionPeriodData {
  key: string;
  label: string;
  liters: number;
  cost: number;
}

export default function ConsumptionDetailsScreen() {
  const { theme, t, language } = useApp();
  const { user } = useAuth();
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [chartData, setChartData] = useState<ConsumptionPeriodData[]>(() =>
    buildChartBuckets('day').map((bucket) => ({ ...bucket, liters: 0, cost: 0 })),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const colorConsumption = '#FFC107';
  const colorCost = '#4CAF50';
  const locale = language === 'en' ? 'en-US' : 'pt-BR';

  const loadChart = useCallback(async () => {
    setIsLoading(true);
    setSelectedIndex(null);
    const buckets = buildChartBuckets(period, locale);
    try {
      if (!user?.uid) {
        setChartData(buckets.map((bucket) => ({ ...bucket, liters: 0, cost: 0 })));
        return;
      }
      const vehicle = await obterVeiculoLocal(user.uid);
      if (!vehicle) {
        setChartData(buckets.map((bucket) => ({ ...bucket, liters: 0, cost: 0 })));
        return;
      }
      const summary = await obterAbastecimentosPorPeriodo(user.uid, vehicle.id, period);
      const byPeriod = new Map(summary.map((row) => [row.periodKey, row]));
      setChartData(buckets.map((bucket) => {
        const row = byPeriod.get(bucket.key);
        return {
          ...bucket,
          liters: Number(row?.litros ?? 0),
          cost: Number(row?.custo ?? 0),
        };
      }));
    } catch (error) {
      console.error('[Consumo] Falha ao carregar abastecimentos por período:', error);
    } finally {
      setIsLoading(false);
    }
  }, [locale, period, user?.uid]);

  useFocusEffect(useCallback(() => {
    void loadChart();
  }, [loadChart]));

  const totalLiters = chartData.reduce((sum, row) => sum + row.liters, 0);
  const totalCost = chartData.reduce((sum, row) => sum + row.cost, 0);
  const averagePrice = totalLiters > 0 ? totalCost / totalLiters : 0;
  const maxLiters = Math.max(...chartData.map((row) => row.liters), 1);
  const maxCost = Math.max(...chartData.map((row) => row.cost), 1);
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 220;
  const barWidth = (chartWidth - 40) / Math.max(chartData.length, 1);

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {period === 'day' ? t('consumoDiario') : t('consumoMensal')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
            <MaterialIcons name="local-gas-station" size={24} color={colorConsumption} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>Litros</Text>
            <Text style={[styles.summaryValue, { color: colorConsumption }]}>{totalLiters.toFixed(1)} L</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
            <MaterialIcons name="payments" size={24} color={colorCost} />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>Gasto</Text>
            <Text style={[styles.summaryValue, { color: colorCost }]}>{totalCost.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
            <MaterialIcons name="price-check" size={24} color="#00B4FF" />
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>Preço médio</Text>
            <Text style={[styles.summaryValue, { color: '#00B4FF' }]}>{averagePrice.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}/L</Text>
          </View>
        </View>

        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeadingCopy}>
              <Text style={[styles.chartTitle, { color: textColor }]}>{period === 'day' ? t('litrosPorDia') : t('litrosPorMes')}</Text>
              <Text style={[styles.chartSubtitle, { color: subTextColor }]}>{period === 'day' ? 'Últimos 7 dias' : 'Últimos 12 meses'}</Text>
            </View>
            <ChartPeriodToggle
              value={period}
              onChange={setPeriod}
              cardColor={cardColor}
              borderColor={borderColor}
              mutedColor={subTextColor}
              dayLabel={t('dia')}
              monthLabel={t('mes')}
            />
          </View>

          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}><ActivityIndicator color="#00B4FF" /></View>
          ) : chartData.every((row) => row.liters === 0 && row.cost === 0) ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="insights" size={42} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor }]}>Nenhum abastecimento neste período.</Text>
            </View>
          ) : (
            <>
              <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
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
                {chartData.map((row, index) => {
                  const litersHeight = (row.liters / maxLiters) * (chartHeight - 60);
                  const costHeight = (row.cost / maxCost) * (chartHeight - 60);
                  const baseX = 20 + index * barWidth;
                  return (
                    <G key={row.key}>
                      <Rect
                        x={baseX + barWidth * 0.08}
                        y={chartHeight - 30 - litersHeight}
                        width={barWidth * 0.36}
                        height={litersHeight}
                        fill={colorConsumption}
                        opacity={selectedIndex === index ? 1 : 0.78}
                        rx={3}
                      />
                      <Rect
                        x={baseX + barWidth * 0.52}
                        y={chartHeight - 30 - costHeight}
                        width={barWidth * 0.36}
                        height={costHeight}
                        fill={colorCost}
                        opacity={selectedIndex === index ? 1 : 0.78}
                        rx={3}
                      />
                    </G>
                  );
                })}
              </Svg>
              <View style={styles.dayLabels}>
                {chartData.map((row) => <Text key={row.key} style={[styles.dayLabel, { color: subTextColor }]}>{row.label}</Text>)}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: colorConsumption }]} /><Text style={[styles.legendText, { color: subTextColor }]}>Litros</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: colorCost }]} /><Text style={[styles.legendText, { color: subTextColor }]}>Gasto</Text></View>
              </View>
            </>
          )}
        </View>

        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>Resumo por período</Text>
          {chartData.map((row, index) => (
            <Pressable
              key={row.key}
              onPress={() => setSelectedIndex(index)}
              style={({ pressed }) => [styles.breakdownItem, { borderBottomColor: borderColor }, selectedIndex === index && { backgroundColor: isDark ? '#FFC10722' : '#FEF3C7' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.breakdownDate, { color: textColor }]}>{row.label}</Text>
              <View style={styles.breakdownValues}>
                <Text style={[styles.breakdownValue, { color: colorConsumption }]}>{row.liters.toFixed(1)} L</Text>
                <Text style={[styles.breakdownValue, { color: colorCost }]}>{row.cost.toLocaleString(locale, { style: 'currency', currency: 'BRL' })}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, minWidth: 0, borderRadius: 12, padding: 10, borderWidth: 1, alignItems: 'center', gap: 5 },
  summaryLabel: { fontSize: 9 },
  summaryValue: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  chartHeadingCopy: { flex: 1 },
  chartTitle: { fontSize: 13, fontWeight: '600' },
  chartSubtitle: { fontSize: 10, marginTop: 3 },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyChartText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  dayLabels: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 14, marginBottom: 10 },
  dayLabel: { fontSize: 8, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendColor: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10 },
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  breakdownDate: { fontSize: 12, fontWeight: '600' },
  breakdownValues: { flexDirection: 'row', gap: 12 },
  breakdownValue: { fontSize: 11, fontWeight: '700' },
});
