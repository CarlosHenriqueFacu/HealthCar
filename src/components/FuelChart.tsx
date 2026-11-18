import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ChartPeriodToggle } from './ChartPeriodToggle';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { obterAbastecimentosPorPeriodo, obterVeiculoLocal } from '../database/database';
import { buildChartBuckets, type ChartPeriod } from '../utils/chart-period';

interface FuelChartProps {
  onPress?: () => void;
}

interface FuelChartPoint {
  key: string;
  label: string;
  liters: number;
}

export function FuelChart({ onPress }: FuelChartProps) {
  const { theme, t, language } = useApp();
  const { user } = useAuth();
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [data, setData] = useState<FuelChartPoint[]>(() =>
    buildChartBuckets('day').map((bucket) => ({ ...bucket, liters: 0 })),
  );

  const isDark = theme === 'dark';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const trackColor = isDark ? '#1E2235' : '#CBD5E1';
  const locale = language === 'en' ? 'en-US' : 'pt-BR';

  const loadData = useCallback(async () => {
    const buckets = buildChartBuckets(period, locale);
    if (!user?.uid) {
      setData(buckets.map((bucket) => ({ ...bucket, liters: 0 })));
      return;
    }
    const vehicle = await obterVeiculoLocal(user.uid);
    if (!vehicle) {
      setData(buckets.map((bucket) => ({ ...bucket, liters: 0 })));
      return;
    }
    const summary = await obterAbastecimentosPorPeriodo(user.uid, vehicle.id, period);
    const byPeriod = new Map(summary.map((item) => [item.periodKey, Number(item.litros ?? 0)]));
    setData(buckets.map((bucket) => ({ ...bucket, liters: byPeriod.get(bucket.key) ?? 0 })));
  }, [locale, period, user?.uid]);

  useFocusEffect(useCallback(() => {
    void loadData().catch((error) => console.error('[Gráfico] Falha ao carregar abastecimentos:', error));
  }, [loadData]));

  const maxVal = Math.max(...data.map((point) => point.liters), 1);

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: textColor }]}>{period === 'day' ? t('consumoDiario') : t('consumoMensal')}</Text>
          <Text style={[styles.subtitle, { color: subTextColor }]}>
            {period === 'day' ? t('litrosPorDia') : t('litrosPorMes')}
          </Text>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir detalhes de consumo"
        onPress={onPress}
        style={({ pressed }) => [styles.chartArea, pressed && { opacity: 0.8 }]}
      >
        {data.map((point) => {
          const heightPct = (point.liters / maxVal) * 100;
          const isMax = point.liters > 0 && point.liters === maxVal;
          return (
            <View key={point.key} style={styles.barWrapper}>
              <Text style={[styles.barValue, { color: isMax ? '#00B4FF' : subTextColor }]}>
                {point.liters > 0 ? `${point.liters.toFixed(1)}L` : '—'}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
                {point.liters > 0 && (
                  <View style={[styles.barFill, { height: `${heightPct}%` }, isMax && styles.barFillMax]} />
                )}
              </View>
              <Text style={[styles.barLabel, { color: subTextColor }]}>{point.label}</Text>
            </View>
          );
        })}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 16, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  headingCopy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  subtitle: { fontSize: 11 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 5 },
  barWrapper: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 8, marginBottom: 4 },
  barTrack: { width: '100%', height: 66, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: '#087EAE', borderRadius: 4, minHeight: 3 },
  barFillMax: { backgroundColor: '#00B4FF' },
  barLabel: { fontSize: 9, marginTop: 6 },
});
