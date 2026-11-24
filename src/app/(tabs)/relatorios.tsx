import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ChartPeriodToggle } from '@/components/ChartPeriodToggle';
import { ScreenContainer } from '@/components/screen-container';
import { HealthCarHeader } from '@/components/HealthCarHeader';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  obterAbastecimentosPorPeriodo,
  obterHistoricoAbastecimento,
  obterHistoricoManutencao,
  obterVeiculoLocal,
} from '@/database/database';
import { buildChartBuckets, type ChartPeriod } from '@/utils/chart-period';

export default function ReportsScreen() {
  const { theme, t, language } = useApp();
  const { user } = useAuth();
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [refuelHistory, setRefuelHistory] = useState<any[]>([]);
  const [currentVehicle, setCurrentVehicle] = useState<any>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('day');
  const [fuelChartData, setFuelChartData] = useState(() => buildChartBuckets('day').map((bucket) => ({ ...bucket, liters: 0 })));
  const isDark = theme === 'dark';
  const background = isDark ? '#0A0A0F' : '#F1F5F9';
  const card = isDark ? '#12141A' : '#FFFFFF';
  const text = isDark ? '#F0F2FF' : '#0F172A';
  const muted = isDark ? '#8892A4' : '#64748B';
  const border = isDark ? '#252B37' : '#E2E8F0';
  const track = isDark ? '#252B37' : '#CBD5E1';
  const maxFuel = Math.max(...fuelChartData.map((entry) => entry.liters), 1);
  const totalFuel = refuelHistory.reduce((sum, item) => sum + Number(item.litros ?? 0), 0);
  const totalMaintenance = maintenanceHistory.reduce((sum, item) => sum + Number(item.custo ?? 0), 0);
  const formattedMaintenance = totalMaintenance.toLocaleString('pt-BR');
  const oilHistory = maintenanceHistory
    .filter((item) => /óleo|oleo/i.test(String(item.tipo)))
    .slice(0, 3)
    .map((item) => ({
      date: new Date(item.dataRealizada).toLocaleDateString('pt-BR'),
      km: Number(item.kmNaOcasiao).toLocaleString('pt-BR'),
      kmValue: Number(item.kmNaOcasiao),
      type: String(item.tipo),
      next: item.proximoKm ? Number(item.proximoKm).toLocaleString('pt-BR') : '—',
      nextKm: Number(item.proximoKm ?? 0),
    }));
  const currentKm = Number(currentVehicle?.km ?? 0);
  const nextOilKm = oilHistory[0]?.nextKm ?? 0;
  const oilRemaining = nextOilKm ? Math.max(0, nextOilKm - currentKm) : 0;
  const oilInterval = nextOilKm ? Math.max(1, nextOilKm - oilHistory[0].kmValue) : 1;
  const oilProgress = nextOilKm ? Math.max(0, Math.min(100, (oilRemaining / oilInterval) * 100)) : 0;

  const loadReports = useCallback(async () => {
    if (!user?.uid) return;
    const locale = language === 'en' ? 'en-US' : 'pt-BR';
    const buckets = buildChartBuckets(chartPeriod, locale);
    const vehicle = await obterVeiculoLocal(user.uid);
    setCurrentVehicle(vehicle);
    if (!vehicle) {
      setMaintenanceHistory([]);
      setRefuelHistory([]);
      setFuelChartData(buckets.map((bucket) => ({ ...bucket, liters: 0 })));
      return;
    }
    setMaintenanceHistory(await obterHistoricoManutencao(user.uid, vehicle.id));
    setRefuelHistory(await obterHistoricoAbastecimento(user.uid, vehicle.id));
    const summary = await obterAbastecimentosPorPeriodo(user.uid, vehicle.id, chartPeriod);
    const byPeriod = new Map(summary.map((item) => [item.periodKey, Number(item.litros ?? 0)]));
    setFuelChartData(buckets.map((bucket) => ({ ...bucket, liters: byPeriod.get(bucket.key) ?? 0 })));
  }, [chartPeriod, language, user?.uid]);

  useFocusEffect(useCallback(() => {
    void loadReports();
  }, [loadReports]));

  return (
    <ScreenContainer style={{ backgroundColor: background }} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HealthCarHeader />

        <View style={styles.heading}>
          <Text style={[styles.pageTitle, { color: text }]}>{t('tituloRelatorios')}</Text>
          <Text style={[styles.pageSubtitle, { color: muted }]}>Acompanhe custos e dados do seu veículo.</Text>
        </View>

        <View style={styles.periodRow}>
          <MaterialIcons name="calendar-today" size={15} color={muted} />
          <Text style={[styles.periodLabel, { color: muted }]}>Período:</Text>
          <Text style={[styles.periodValue, { color: text }]}>Histórico disponível</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.metricLabelRow}>
              <MaterialIcons name="account-balance-wallet" size={15} color={muted} />
              <Text style={[styles.metricLabel, { color: muted }]}>Gastos com manutenção</Text>
            </View>
            <Text style={[styles.metricValue, { color: text }]}>R$ {formattedMaintenance}</Text>
            <Text style={[styles.metricCaption, { color: muted }]}>Histórico registrado</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.metricLabelRow}>
              <MaterialIcons name="local-gas-station" size={15} color={muted} />
              <Text style={[styles.metricLabel, { color: muted }]}>Abastecimentos</Text>
            </View>
            <Text style={[styles.metricValue, { color: text }]}>{totalFuel} L</Text>
            <Text style={[styles.metricCaption, { color: muted }]}>Histórico registrado</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>Despesas de manutenção</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Custos por período</Text>
          <Text style={[styles.cardSubtitle, { color: muted }]}>Resumo do histórico de serviços registrados.</Text>
          <View style={styles.maintenanceSummary}>
            <View style={[styles.summaryIcon, { backgroundColor: '#082A3A' }]}>
              <MaterialIcons name="bar-chart" size={19} color="#00B4FF" />
            </View>
            <Text style={[styles.summaryValue, { color: text }]}>R$ {formattedMaintenance}</Text>
            <Text style={[styles.summaryCaption, { color: muted }]}>
              {maintenanceHistory.length} serviços no histórico de manutenção.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{chartPeriod === 'day' ? t('consumoDiario') : t('consumoMensal')}</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeadingCopy}>
              <Text style={[styles.cardTitle, { color: text }]}>{chartPeriod === 'day' ? t('litrosPorDia') : t('litrosPorMes')}</Text>
              <Text style={[styles.cardSubtitle, { color: muted }]}>{chartPeriod === 'day' ? 'Últimos 7 dias' : 'Últimos 12 meses'}</Text>
            </View>
            <ChartPeriodToggle
              value={chartPeriod}
              onChange={setChartPeriod}
              cardColor={card}
              borderColor={border}
              mutedColor={muted}
              dayLabel={t('dia')}
              monthLabel={t('mes')}
            />
          </View>
          <View style={styles.chart}>
            {fuelChartData.map((entry) => {
              const value = entry.liters;
              const height = (value / maxFuel) * 78;
              const isMax = value > 0 && value === maxFuel;
              return (
                <View key={entry.key} style={styles.monthColumn}>
                  <Text style={[styles.monthValue, { color: isMax ? '#00B4FF' : muted }]}>{value > 0 ? value.toFixed(1) : '—'}</Text>
                  <View style={[styles.barTrack, { backgroundColor: track }]}>
                    {value > 0 && <View style={[styles.barFill, { height, backgroundColor: isMax ? '#00B4FF' : '#087EAE' }]} />}
                  </View>
                  <Text style={[styles.monthLabel, { color: muted }]}>{entry.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('proximaTrocaOleo')}</Text>
        </View>
        <View style={[styles.oilCard, { backgroundColor: card, borderColor: isDark ? '#664D12' : '#FDE68A' }]}>
          <View style={styles.oilTopRow}>
            <View style={[styles.oilIcon, { backgroundColor: isDark ? '#392D0D' : '#FEF3C7' }]}>
              <MaterialIcons name="opacity" size={20} color="#FFB300" />
            </View>
            <View style={styles.oilCopy}>
              <Text style={[styles.cardTitle, { color: text }]}>{nextOilKm ? `${t('faltamKm')} ${oilRemaining.toLocaleString('pt-BR')} km` : 'Sem próxima troca registrada'}</Text>
              <Text style={[styles.cardSubtitle, { color: muted }]}>{nextOilKm ? `Atual: ${currentKm.toLocaleString('pt-BR')} km · próxima: ${nextOilKm.toLocaleString('pt-BR')} km` : 'Registre a próxima troca na manutenção.'}</Text>
            </View>
            {nextOilKm > 0 && <Text style={styles.oilPercent}>{Math.round(oilProgress)}%</Text>}
          </View>
          <View style={[styles.oilTrack, { backgroundColor: track }]}>
            <View style={[styles.oilFill, { width: `${oilProgress}%` }]} />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('historicoOleo')}</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          {oilHistory.length === 0 && <Text style={[styles.historySubtitle, { color: muted }]}>Nenhuma troca de óleo registrada.</Text>}
          {oilHistory.map((item, index) => (
            <View key={`${item.date}-${item.km}`} style={styles.oilHistoryRow}>
              <View style={styles.timelineColumn}>
                <View style={styles.timelineDot} />
                {index < oilHistory.length - 1 && <View style={[styles.timelineLine, { backgroundColor: track }]} />}
              </View>
              <View style={styles.historyCopy}>
                <Text style={[styles.historyDate, { color: muted }]}>{item.date}</Text>
                <Text style={[styles.historyTitle, { color: text }]}>{item.type}</Text>
                <Text style={[styles.historySubtitle, { color: muted }]}>KM: {item.km} · {t('prox')}: {item.next} km</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('historicoManutencao')}</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          {maintenanceHistory.length === 0 && <Text style={[styles.historySubtitle, { color: muted }]}>Nenhuma manutenção registrada.</Text>}
          {maintenanceHistory.map((item, index) => (
            <View key={item.id} style={[styles.maintenanceRow, index > 0 && { borderTopColor: border, borderTopWidth: 1 }]}>
              <View style={styles.maintenanceRowCopy}>
                <Text style={[styles.historyDate, { color: muted }]}>{new Date(item.dataRealizada).toLocaleDateString('pt-BR')} · {Number(item.kmNaOcasiao).toLocaleString('pt-BR')} km</Text>
                <Text style={[styles.historyTitle, { color: text }]}>{item.tipo}</Text>
              </View>
              <Text style={styles.cost}>{Number(item.custo ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  heading: { marginHorizontal: 20, marginTop: -5, marginBottom: 14 },
  pageTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  pageSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  periodRow: { marginHorizontal: 20, marginBottom: 15, flexDirection: 'row', alignItems: 'center', gap: 6 },
  periodLabel: { fontSize: 10 },
  periodValue: { fontSize: 10, fontWeight: '700' },
  metricsRow: { marginHorizontal: 20, marginBottom: 20, flexDirection: 'row', gap: 9 },
  metricCard: { flex: 1, minHeight: 92, padding: 12, borderRadius: 16, borderWidth: 1 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  metricLabel: { fontSize: 9, flexShrink: 1 },
  metricValue: { fontSize: 17, fontWeight: '800', marginBottom: 3 },
  metricCaption: { fontSize: 9 },
  sectionHeading: { marginHorizontal: 20, marginBottom: 9, marginTop: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCard: { marginHorizontal: 20, marginBottom: 18, padding: 14, borderRadius: 17, borderWidth: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700' },
  cardSubtitle: { fontSize: 9, lineHeight: 14, marginTop: 4 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chartHeadingCopy: { flex: 1 },
  maintenanceSummary: { alignItems: 'center', paddingTop: 15, paddingBottom: 4 },
  summaryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryCaption: { fontSize: 9, textAlign: 'center', marginTop: 4 },
  chart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 15 },
  monthColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  monthValue: { fontSize: 8, marginBottom: 3 },
  barTrack: { width: '100%', height: 78, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', minHeight: 3, borderRadius: 3 },
  monthLabel: { fontSize: 7, marginTop: 4 },
  oilCard: { marginHorizontal: 20, marginBottom: 18, padding: 14, borderWidth: 1, borderRadius: 17 },
  oilTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  oilIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  oilCopy: { flex: 1 },
  oilPercent: { color: '#FFB300', fontSize: 12, fontWeight: '800' },
  oilTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 13 },
  oilFill: { width: '52%', height: '100%', borderRadius: 3, backgroundColor: '#FFB300' },
  oilHistoryRow: { flexDirection: 'row', minHeight: 54 },
  timelineColumn: { width: 16, alignItems: 'center' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFB300', marginTop: 4 },
  timelineLine: { flex: 1, width: 1, marginTop: 4 },
  historyCopy: { flex: 1, paddingBottom: 13 },
  historyDate: { fontSize: 9, marginBottom: 3 },
  historyTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  historySubtitle: { fontSize: 9 },
  maintenanceRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  maintenanceRowCopy: { flex: 1 },
  cost: { color: '#00B4FF', fontSize: 11, fontWeight: '800' },
});
