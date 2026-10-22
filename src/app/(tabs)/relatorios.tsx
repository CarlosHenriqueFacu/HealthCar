import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/screen-container';
import { HealthCarHeader } from '@/components/HealthCarHeader';
import { useApp } from '@/contexts/AppContext';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// As séries abaixo preservam os dados demonstrativos já apresentados em Relatórios.
const OIL_HISTORY = [
  { date: '12/09/2025', km: '45.820', type: 'Sintético 5W-30', next: '48.320' },
  { date: '15/03/2025', km: '43.100', type: 'Sintético 5W-30', next: '45.600' },
  { date: '20/09/2024', km: '40.350', type: 'Sintético 5W-30', next: '42.850' },
];

const MAINTENANCE_HISTORY = [
  { date: '12/09/2025', service: 'Troca de óleo e filtro', km: '45.820', cost: 'R$ 280' },
  { date: '15/03/2025', service: 'Revisão dos freios', km: '43.100', cost: 'R$ 450' },
  { date: '10/01/2025', service: 'Alinhamento e balanceamento', km: '41.800', cost: 'R$ 120' },
  { date: '20/09/2024', service: 'Troca de velas de ignição', km: '40.350', cost: 'R$ 380' },
  { date: '05/06/2024', service: 'Filtro de ar e cabine', km: '38.900', cost: 'R$ 95' },
];

// Dados para o gráfico existente de litros abastecidos por mês.
const MONTHLY_FUEL = [18, 22, 19, 25, 21, 28, 24, 20, 26, 23, 19, 22];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ReportsScreen() {
  const { theme, t } = useApp();
  const isDark = theme === 'dark';
  const background = isDark ? '#0A0A0F' : '#F1F5F9';
  const card = isDark ? '#12141A' : '#FFFFFF';
  const text = isDark ? '#F0F2FF' : '#0F172A';
  const muted = isDark ? '#8892A4' : '#64748B';
  const border = isDark ? '#252B37' : '#E2E8F0';
  const track = isDark ? '#252B37' : '#CBD5E1';
  const maxFuel = Math.max(...MONTHLY_FUEL);
  const totalFuel = MONTHLY_FUEL.reduce((sum, value) => sum + value, 0);
  // Os cartões de resumo são derivados dos mesmos registros demonstrativos exibidos abaixo.
  const totalMaintenance = MAINTENANCE_HISTORY.reduce(
    (sum, item) => sum + Number(item.cost.replace(/\D/g, '')),
    0,
  );
  const formattedMaintenance = totalMaintenance.toLocaleString('pt-BR');

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
            <Text style={[styles.metricCaption, { color: muted }]}>Registros mensais</Text>
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
              {MAINTENANCE_HISTORY.length} serviços no histórico de manutenção.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('consumoMensal')}</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>{t('litrosAbastecidos')}</Text>
          <Text style={[styles.cardSubtitle, { color: muted }]}>Acompanhe os litros registrados ao longo do ano.</Text>
          <View style={styles.chart}>
            {MONTHLY_FUEL.map((value, index) => {
              const height = (value / maxFuel) * 78;
              const isMax = value === maxFuel;
              return (
                <View key={MONTHS[index]} style={styles.monthColumn}>
                  <Text style={[styles.monthValue, { color: isMax ? '#00B4FF' : muted }]}>{value}</Text>
                  <View style={[styles.barTrack, { backgroundColor: track }]}>
                    <View style={[styles.barFill, { height, backgroundColor: isMax ? '#00B4FF' : '#087EAE' }]} />
                  </View>
                  <Text style={[styles.monthLabel, { color: muted }]}>{MONTHS[index]}</Text>
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
              <Text style={[styles.cardTitle, { color: text }]}>{t('faltamKm')} 2.400 km</Text>
              <Text style={[styles.cardSubtitle, { color: muted }]}>52% {t('doIntervalo')}</Text>
            </View>
            <Text style={styles.oilPercent}>52%</Text>
          </View>
          <View style={[styles.oilTrack, { backgroundColor: track }]}>
            <View style={styles.oilFill} />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('historicoOleo')}</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
          {OIL_HISTORY.map((item, index) => (
            <View key={`${item.date}-${item.km}`} style={styles.oilHistoryRow}>
              <View style={styles.timelineColumn}>
                <View style={styles.timelineDot} />
                {index < OIL_HISTORY.length - 1 && <View style={[styles.timelineLine, { backgroundColor: track }]} />}
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
          {MAINTENANCE_HISTORY.map((item, index) => (
            <View key={`${item.date}-${item.service}`} style={[styles.maintenanceRow, index > 0 && { borderTopColor: border, borderTopWidth: 1 }]}>
              <View style={styles.maintenanceRowCopy}>
                <Text style={[styles.historyDate, { color: muted }]}>{item.date} · {item.km} km</Text>
                <Text style={[styles.historyTitle, { color: text }]}>{item.service}</Text>
              </View>
              <Text style={styles.cost}>{item.cost}</Text>
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
