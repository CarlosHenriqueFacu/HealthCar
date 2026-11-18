import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  atualizarManutencaoLocal,
  excluirManutencaoLocal,
  obterHistoricoManutencao,
  obterVeiculoLocal,
  salvarManutencaoLocal,
} from '@/database/database';

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function MaintenanceScreen() {
  const { theme } = useApp();
  const { user, syncNow } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [serviceName, setServiceName] = useState('');
  const [serviceDate, setServiceDate] = useState(() => dateInputValue(new Date()));
  const [serviceKm, setServiceKm] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  const [nextKm, setNextKm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isDark = theme === 'dark';
  const background = isDark ? '#0A0A0F' : '#F1F5F9';
  const card = isDark ? '#12141A' : '#FFFFFF';
  const border = isDark ? '#252B37' : '#DCE3EC';
  const text = isDark ? '#F5F7FB' : '#0F172A';
  const muted = isDark ? '#9AA5B5' : '#64748B';
  const totalSpent = maintenance.reduce((sum, item) => sum + Number(item.custo ?? 0), 0);
  const formatCurrency = (amount: number) =>
    amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const loadMaintenance = useCallback(async () => {
    if (!user?.uid) return;
    const currentVehicle = await obterVeiculoLocal(user.uid);
    setVehicle(currentVehicle);
    if (currentVehicle) {
      setMaintenance(await obterHistoricoManutencao(user.uid, currentVehicle.id));
    } else {
      setMaintenance([]);
    }
  }, [user?.uid]);

  useFocusEffect(useCallback(() => {
    void loadMaintenance();
  }, [loadMaintenance]));

  const openEditForm = (item: any) => {
    const date = new Date(item.dataRealizada);
    setEditingId(item.id);
    setServiceName(String(item.tipo ?? ''));
    setServiceDate(dateInputValue(date));
    setServiceKm(String(item.kmNaOcasiao ?? ''));
    setServiceCost(String(item.custo ?? ''));
    setNextKm(item.proximoKm ? String(item.proximoKm) : '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setServiceName('');
    setServiceDate(dateInputValue(new Date()));
    setServiceKm('');
    setServiceCost('');
    setNextKm('');
  };

  const deleteMaintenance = async (item: any) => {
    if (!user?.uid) return;
    try {
      await excluirManutencaoLocal(user.uid, item.id);
      await loadMaintenance();
      void syncNow().catch(() => {});
    } catch (error) {
      Alert.alert('Não foi possível excluir', 'A manutenção continua no histórico deste aparelho. Tente novamente.');
      console.error('[Manutenção] Falha ao excluir o registro:', error);
    }
  };

  const showMaintenanceActions = (item: any) => {
    Alert.alert('Opções da manutenção', String(item.tipo ?? 'Registro'), [
      { text: 'Editar', onPress: () => openEditForm(item) },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Excluir manutenção?',
          'O registro será removido do histórico e sincronizado com sua conta.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => void deleteMaintenance(item) },
          ],
        ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const saveMaintenance = async () => {
    if (!user?.uid || !vehicle) {
      Alert.alert('Veículo não encontrado', 'Cadastre um veículo antes de registrar uma manutenção.');
      return;
    }
    const kmValue = Number(serviceKm.replace(/\D/g, ''));
    const costValue = Number(serviceCost.replace(',', '.')) || 0;
    const nextKmValue = Number(nextKm.replace(/\D/g, '')) || null;
    const dateValue = new Date(`${serviceDate}T12:00:00`).getTime();
    if (!serviceName.trim() || !Number.isFinite(kmValue) || kmValue <= 0 || !Number.isFinite(dateValue)) {
      Alert.alert('Confira os dados', 'Informe o serviço, a data e a quilometragem da manutenção.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await atualizarManutencaoLocal(user.uid, editingId, serviceName.trim(), dateValue, kmValue, costValue, nextKmValue);
      } else {
        await salvarManutencaoLocal(user.uid, vehicle.id, serviceName.trim(), dateValue, kmValue, costValue, nextKmValue);
      }
      await loadMaintenance();
      void syncNow().catch(() => {});
      setServiceName('');
      closeForm();
    } catch (error) {
      Alert.alert('Não foi possível salvar', 'A manutenção não foi gravada no banco local. Tente novamente.');
      console.error('[Manutenção] Falha ao gravar no SQLite:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
            <Text style={[styles.vehicleTitle, { color: text }]}>{vehicle ? `${vehicle.marca} ${vehicle.veiculo}`.trim() : 'Veículo cadastrado'}</Text>
            <Text style={[styles.vehicleSubtitle, { color: muted }]}>{vehicle ? `${Number(vehicle.km).toLocaleString('pt-BR')} km` : 'Quilometragem acompanhada pelo app'}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={muted} />
        </Pressable>

        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryLabel, { color: muted }]}>Gastos registrados</Text>
            <Text style={[styles.summaryValue, { color: text }]}>{formatCurrency(totalSpent)}</Text>
          </View>
          <Text style={styles.serviceCount}>{maintenance.length} serviços</Text>
        </View>

        <Pressable
          onPress={() => { setEditingId(null); setServiceKm(String(vehicle?.km ?? '')); setShowForm(true); }}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.82 }]}
        >
          <MaterialIcons name="add" size={20} color="#04131A" />
          <Text style={styles.addButtonText}>Adicionar manutenção</Text>
        </Pressable>

        <View style={styles.historyHeading}>
          <Text style={[styles.sectionTitle, { color: text }]}>Histórico</Text>
          <Text style={[styles.sortLabel, { color: muted }]}>Mais recentes</Text>
        </View>

        {maintenance.length === 0 && <Text style={[styles.noSaveHint, { color: muted }]}>Nenhuma manutenção registrada ainda.</Text>}
        {maintenance.map((item) => {
          const date = new Date(item.dataRealizada);
          const title = String(item.tipo ?? 'Manutenção');
          const icon = /óleo|oleo/i.test(title) ? 'opacity' : 'build';
          return (
          <View key={item.id} style={[styles.historyCard, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.historyTop}>
              <View style={styles.serviceIcon}><MaterialIcons name={icon as any} size={19} color="#00B4FF" /></View>
              <View style={styles.historyInfo}>
                <Text style={[styles.serviceTitle, { color: text }]}>{title}</Text>
                <Text style={[styles.serviceCategory, { color: muted }]}>{item.proximoKm ? `Próxima revisão: ${Number(item.proximoKm).toLocaleString('pt-BR')} km` : 'Serviço registrado'}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Opções de ${title}`}
                onPress={() => showMaintenanceActions(item)}
                hitSlop={8}
              >
                <MaterialIcons name="more-horiz" size={22} color={muted} />
              </Pressable>
            </View>

            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <MaterialIcons name="calendar-today" size={15} color={muted} />
                <Text style={[styles.metadataText, { color: muted }]}>{date.toLocaleDateString('pt-BR')}</Text>
              </View>
              <View style={styles.metadataItem}>
                <MaterialIcons name="speed" size={15} color={muted} />
                <Text style={[styles.metadataText, { color: muted }]}>{Number(item.kmNaOcasiao).toLocaleString('pt-BR')} km</Text>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: border }]} />
            <View style={styles.costRow}>
              <Text style={[styles.costValue, { color: text }]}>{formatCurrency(Number(item.custo ?? 0))}</Text>
              <View style={styles.receiptStatus}>
                <MaterialIcons
                  name="cloud-done"
                  size={15}
                  color="#20D9A0"
                />
                <Text style={[styles.receiptText, { color: '#20D9A0' }]}>
                  Salvo neste aparelho
                </Text>
              </View>
            </View>
          </View>
        )})}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
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
                    <Text style={[styles.formTitle, { color: text }]}>{editingId ? 'Editar manutenção' : 'Adicionar manutenção'}</Text>
                    <Text style={[styles.formSubtitle, { color: muted }]}>O registro funciona mesmo sem internet.</Text>
                  </View>
                  <Pressable onPress={closeForm} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={muted} />
                  </Pressable>
                </View>

                <TextInput value={serviceName} onChangeText={setServiceName} placeholder="Nome do serviço" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                <View style={styles.formRow}>
                  <TextInput value={serviceDate} onChangeText={setServiceDate} placeholder="Data AAAA-MM-DD" placeholderTextColor={muted} style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                  <TextInput value={serviceKm} onChangeText={setServiceKm} placeholder="Quilometragem" placeholderTextColor={muted} keyboardType="numeric" style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                </View>
                <View style={styles.formRow}>
                  <TextInput value={serviceCost} onChangeText={setServiceCost} placeholder="Valor pago (R$)" placeholderTextColor={muted} keyboardType="decimal-pad" style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                  <TextInput value={nextKm} onChangeText={setNextKm} placeholder="Próxima revisão (km)" placeholderTextColor={muted} keyboardType="numeric" style={[styles.input, styles.halfInput, { color: text, borderColor: border, backgroundColor: isDark ? '#0B0D12' : '#F8FAFC' }]} />
                </View>

                <Pressable
                  onPress={() => Alert.alert('Recibo', 'O anexo de recibos será habilitado em uma próxima etapa.')}
                  style={[styles.receiptButton, { borderColor: border }]}
                >
                  <MaterialIcons name="attach-file" size={18} color="#00B4FF" />
                  <Text style={[styles.receiptButtonText, { color: text }]}>Anexar recibo</Text>
                </Pressable>

                <Pressable
                  onPress={() => void saveMaintenance()}
                  disabled={isSaving}
                  style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
                >
                  <Text style={styles.saveButtonText}>{isSaving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Salvar manutenção'}</Text>
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
