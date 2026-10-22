import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HealthCarHeader } from '@/components/HealthCarHeader';
import { ScreenContainer } from '@/components/screen-container';
import { useApp } from '@/contexts/AppContext';

// Exemplos visuais da tela; este histórico não é lido nem gravado no banco nesta etapa.
const MAINTENANCE_PREVIEW = [
  {
    title: 'Troca de óleo e filtro',
    category: 'Óleo e filtros',
    date: '12 set 2026',
    mileage: '48.200 km',
    cost: 280,
    receiptAttached: true,
    icon: 'opacity' as const,
  },
  {
    title: 'Revisão dos freios',
    category: 'Freios',
    date: '08 jun 2026',
    mileage: '47.100 km',
    cost: 450,
    receiptAttached: false,
    icon: 'build' as const,
  },
];

export default function MaintenanceScreen() {
  const { theme } = useApp();
  const [showForm, setShowForm] = useState(false);
  const isDark = theme === 'dark';
  const background = isDark ? '#0A0A0F' : '#F1F5F9';
  const card = isDark ? '#12141A' : '#FFFFFF';
  const border = isDark ? '#252B37' : '#DCE3EC';
  const text = isDark ? '#F5F7FB' : '#0F172A';
  const muted = isDark ? '#9AA5B5' : '#64748B';
  // Calcula os valores mostrados a partir dos mesmos serviços de demonstração.
  const totalSpent = MAINTENANCE_PREVIEW.reduce((sum, item) => sum + item.cost, 0);
  const formatCurrency = (amount: number) =>
    amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <ScreenContainer style={{ backgroundColor: background }} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HealthCarHeader />

        <View style={styles.pageHeading}>
          <Text style={[styles.pageTitle, { color: text }]}>Manutenção</Text>
          <Text style={[styles.pageSubtitle, { color: muted }]}>Histórico e cuidados do seu veículo.</Text>
        </View>

        <Pressable
          onPress={() => router.push('/configuracoes')}
          style={({ pressed }) => [styles.vehicleCard, { backgroundColor: card, borderColor: border }, pressed && { opacity: 0.78 }]}
        >
          <View style={styles.vehicleIcon}><MaterialIcons name="directions-car" size={19} color="#00B4FF" /></View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.eyebrow}>VEÍCULO ATUAL</Text>
            <Text style={[styles.vehicleTitle, { color: text }]}>Veículo cadastrado</Text>
            <Text style={[styles.vehicleSubtitle, { color: muted }]}>Quilometragem acompanhada pelo app</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={muted} />
        </Pressable>

        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: muted }]}>Gastos registrados</Text>
            <Text style={[styles.summaryValue, { color: text }]}>{formatCurrency(totalSpent)}</Text>
          </View>
          <Text style={styles.serviceCount}>{MAINTENANCE_PREVIEW.length} serviços</Text>
        </View>

        <Pressable
          onPress={() => setShowForm(true)}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.82 }]}
        >
          <MaterialIcons name="add" size={20} color="#04131A" />
          <Text style={styles.addButtonText}>Adicionar manutenção</Text>
        </Pressable>

        <View style={styles.historyHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>Histórico</Text>
          <Text style={[styles.sortLabel, { color: muted }]}>Mais recentes</Text>
        </View>

        {MAINTENANCE_PREVIEW.map((item) => (
          <View key={item.title} style={[styles.historyCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.historyTop}>
              <View style={styles.serviceIcon}><MaterialIcons name={item.icon} size={19} color="#00B4FF" /></View>
              <View style={styles.historyInfo}>
                <Text style={[styles.serviceTitle, { color: text }]}>{item.title}</Text>
                <Text style={[styles.serviceCategory, { color: muted }]}>{item.category}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Opções de ${item.title}`}
                onPress={() => Alert.alert('Manutenção', 'As opções deste serviço estarão disponíveis em uma próxima etapa.')}
                hitSlop={8}
              >
                <MaterialIcons name="more-horiz" size={22} color={muted} />
              </Pressable>
            </View>

            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <MaterialIcons name="calendar-today" size={15} color={muted} />
                <Text style={[styles.metadataText, { color: muted }]}>{item.date}</Text>
              </View>
              <View style={styles.metadataItem}>
                <MaterialIcons name="speed" size={15} color={muted} />
                <Text style={[styles.metadataText, { color: muted }]}>{item.mileage}</Text>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: border }]} />
            <View style={styles.costRow}>
                  <Text style={[styles.costValue, { color: text }]}>{formatCurrency(item.cost)}</Text>
              <View style={styles.receiptStatus}>
                <MaterialIcons
                  name={item.receiptAttached ? 'receipt-long' : 'description'}
                  size={15}
                  color={item.receiptAttached ? '#20D9A0' : muted}
                />
                <Text style={[styles.receiptText, { color: item.receiptAttached ? '#20D9A0' : muted }]}>
                  {item.receiptAttached ? 'Recibo anexado' : 'Sem recibo'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        {/* Mantém os campos acessíveis quando o teclado reduz a área visível. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.formCard, { backgroundColor: card, borderColor: border }]}>
                <View style={styles.formHeader}>
                  <View>
                    <Text style={[styles.formTitle, { color: text }]}>Adicionar manutenção</Text>
                    <Text style={[styles.formSubtitle, { color: muted }]}>Prévia visual do formulário</Text>
                  </View>
                  <Pressable onPress={() => setShowForm(false)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={muted} />
                  </Pressable>
                </View>

                <TextInput placeholder="Nome do serviço" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                <View style={styles.formRow}>
                  <TextInput placeholder="Data" placeholderTextColor={muted} style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                  <TextInput placeholder="Quilometragem" placeholderTextColor={muted} keyboardType="numeric" style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                </View>
                <TextInput placeholder="Valor pago" placeholderTextColor={muted} keyboardType="decimal-pad" style={[styles.input, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />

                <Pressable
                  onPress={() => Alert.alert('Recibo', 'O anexo de recibos será habilitado em uma próxima etapa.')}
                  style={[styles.receiptButton, { borderColor: border }]}
                >
                  <MaterialIcons name="attach-file" size={18} color="#00B4FF" />
                  <Text style={[styles.receiptButtonText, { color: text }]}>Anexar recibo</Text>
                </Pressable>

                <Text style={[styles.noSaveHint, { color: muted }]}>Este formulário é apenas uma prévia. Nenhum dado será salvo.</Text>
                {/* O botão representa o fluxo futuro e não persiste os campos da prévia. */}
                <Pressable
                  onPress={() => Alert.alert('Prévia visual', 'O cadastro de manutenções ainda não está ativo. Nenhum dado foi salvo.')}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Salvar manutenção</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 26 },
  pageHeading: { marginHorizontal: 20, marginTop: -5, marginBottom: 18 },
  pageTitle: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  pageSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  vehicleCard: { marginHorizontal: 20, marginBottom: 22, minHeight: 92, padding: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#082A3A', alignItems: 'center', justifyContent: 'center' },
  vehicleInfo: { flex: 1 },
  eyebrow: { color: '#83A9C5', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
  vehicleTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  vehicleSubtitle: { fontSize: 11, lineHeight: 16 },
  summaryRow: { marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 3 },
  summaryValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  serviceCount: { color: '#A7C3D9', fontSize: 11, marginTop: 13 },
  addButton: { marginHorizontal: 20, marginBottom: 26, minHeight: 50, borderRadius: 15, backgroundColor: '#00AEEF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  addButtonText: { color: '#04131A', fontSize: 13, fontWeight: '800' },
  historyHeading: { marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sortLabel: { fontSize: 10 },
  historyCard: { marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 17, borderWidth: 1 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#191E27', alignItems: 'center', justifyContent: 'center' },
  historyInfo: { flex: 1 },
  serviceTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  serviceCategory: { fontSize: 10 },
  metadataRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 17, marginBottom: 12 },
  metadataItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metadataText: { fontSize: 10 },
  cardDivider: { height: 1, marginBottom: 10 },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costValue: { fontSize: 12, fontWeight: '800' },
  receiptStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  receiptText: { fontSize: 10 },
  keyboardAvoiding: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  formScroll: { maxHeight: '92%' },
  formScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  formCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, paddingBottom: 32 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  formTitle: { fontSize: 18, fontWeight: '800' },
  formSubtitle: { fontSize: 11, marginTop: 4 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginBottom: 10, fontSize: 13 },
  formRow: { flexDirection: 'row', gap: 9 },
  halfInput: { flex: 1, minWidth: 0 },
  receiptButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  receiptButtonText: { fontSize: 12, fontWeight: '600' },
  noSaveHint: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },
  saveButton: { minHeight: 46, borderRadius: 12, backgroundColor: '#00AEEF', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  saveButtonText: { color: '#04131A', fontSize: 13, fontWeight: '800' },
});
