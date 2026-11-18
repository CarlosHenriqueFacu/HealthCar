import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import type { User } from 'firebase/auth';
import { TermsModal } from '../../components/TermsModal';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { BluetoothTutorialModal } from '../../components/ui/BluetoothTutorialModal';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { obterVeiculoLocal, salvarPerfilLocal, salvarVeiculoLocal } from '../../database/database';
import { getAuthErrorMessage, registerWithEmail } from '../../services/firebase';

const OPCOES_MARCA = ['Chevrolet', 'Volkswagen', 'Fiat', 'Ford', 'Honda', 'Toyota', 'Hyundai', 'Renault', 'Jeep', 'Outra'];
const OPCOES_COMBUSTIVEL = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico'];
const OPCOES_MOTOR = ['1.0', '1.0 Turbo', '1.3', '1.4', '1.6', '1.8', '2.0', '2.0 Turbo', 'V6', 'V8'];

const FUEL_KEY_MAP: Record<string, string> = {
  'Flex': 'combFlex',
  'Gasolina': 'combGasolina',
  'Etanol': 'combEtanol',
  'Diesel': 'combDiesel',
  'GNV': 'combGnv',
  'Híbrido': 'combHibrido',
  'Elétrico': 'combEletrico',
};

export default function CadastroScreen() {
  const router = useRouter();
  const { t } = useApp();
  const { user, syncNow } = useAuth();

  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [veiculo, setVeiculo] = useState('');
  const [ano, setAno] = useState('');
  const [km, setKm] = useState('');
  const [marca, setMarca] = useState('');
  const [combustivel, setCombustivel] = useState('');
  const [motor, setMotor] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyRegisteredUser, setNewlyRegisteredUser] = useState<User | null>(null);

  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [selectModalConfig, setSelectModalConfig] = useState({ visible: false, type: '', title: '', data: [] as string[] });
  const [showTermsModal, setShowTermsModal] = useState(false);

  const translateOption = (type: string, option: string) => {
    if (type === 'marca' && option === 'Outra') return t('marcaOutra');
    if (type === 'combustivel' && FUEL_KEY_MAP[option]) return t(FUEL_KEY_MAP[option]);
    return option;
  };

  useEffect(() => {
    const carregarDadosExistentes = async () => {
      if (!user) {
        setIsEditing(false);
        return;
      }
      setIsEditing(true);

      try {
        const parsed = await obterVeiculoLocal(user.uid);
        if (!parsed) return;

        setMarca(parsed.marca || '');
        setVeiculo(parsed.veiculo || '');
        setMotor(parsed.motor || '');
        setAno(parsed.ano || '');
        setKm(parsed.km || '');
        setCombustivel(parsed.combustivel || '');
        setIsEditing(true);
      } catch (error) {
        console.error("Falha ao recuperar os dados do veículo: ", error);
      }
    };

    carregarDadosExistentes();
  }, [user?.uid]);

  const openSelect = (type: string, title: string, data: string[]) => {
    setSelectModalConfig({ visible: true, type, title, data });
  };

  const handleSelectOption = (option: string) => {
    if (selectModalConfig.type === 'marca') setMarca(option);
    if (selectModalConfig.type === 'combustivel') setCombustivel(option);
    if (selectModalConfig.type === 'motor') setMotor(option);
    setSelectModalConfig({ ...selectModalConfig, visible: false });
  };

  const handleCadastro = async () => {
    if (!isEditing) {
      if (!nome.trim() || !sobrenome.trim() || !email.trim() || !senha || !confirmarSenha) {
        Alert.alert(t('camposObrigatorios'), t('cadastroCamposDesc'));
        return;
      }
      if (senha.length < 6) {
        Alert.alert(t('senhaInvalida'), t('senhaMinima'));
        return;
      }
      if (senha !== confirmarSenha) {
        Alert.alert(t('senhasNaoCoincidem'), t('senhasNaoCoincidemDesc'));
        return;
      }

      setShowTermsModal(true);
    } else {
      prosseguirComCadastro();
    }
  };

  const prosseguirComCadastro = async () => {
    setShowTermsModal(false);
    setIsSubmitting(true);

    try {
      let authenticatedUser = user ?? newlyRegisteredUser;
      if (!isEditing && !authenticatedUser) {
        authenticatedUser = await registerWithEmail(
          email,
          senha,
          `${nome.trim()} ${sobrenome.trim()}`,
        );
        setNewlyRegisteredUser(authenticatedUser);
      }

      if (!authenticatedUser) {
        throw new Error(t('sessaoIndisponivel'));
      }

      const dadosVeiculo = { marca, veiculo, motor, ano, km: km || '0', combustivel };
      const cachedVehicle = await AsyncStorage.getItem('@veiculo_cadastrado');
      const cachedId = isEditing && cachedVehicle ? JSON.parse(cachedVehicle)?.id : undefined;
      const vehicleId = await salvarVeiculoLocal(authenticatedUser.uid, dadosVeiculo, cachedId);

      await salvarPerfilLocal(authenticatedUser.uid, {
        displayName: authenticatedUser.displayName ?? `${nome.trim()} ${sobrenome.trim()}`.trim(),
        firstName: nome.trim() || authenticatedUser.displayName?.split(' ')[0],
        lastName: sobrenome.trim() || undefined,
        email: authenticatedUser.email ?? email.trim(),
        vehicleId,
      });

      const vehicleCache = { ...dadosVeiculo, id: vehicleId };
      await AsyncStorage.multiSet([
        ['@veiculo_cadastrado', JSON.stringify(vehicleCache)],
        ['@veiculo_cadastrado_uid', authenticatedUser.uid],
      ]);
      void syncNow().catch(() => {});

      if (isEditing) {
        router.back();
      } else {
        setShowBluetoothModal(true);
      }
    } catch (error) {
      console.error('[Cadastro] Falha ao criar conta ou salvar dados locais:', error);
      Alert.alert(t('naoFoiPossivelSalvar'), error instanceof Error ? error.message : getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizarOnboarding = () => {
    setShowBluetoothModal(false);
    router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.titulo}>
              {isEditing ? t('editarVeiculo') : t('configurarApp')}
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ThemedText style={styles.descricao}>
            {isEditing ? t('cadastroDescEditar') : t('cadastroDescNovo')}
          </ThemedText>

          {!isEditing && (
            <>
              <ThemedText style={styles.sectionTitle}>{t('dadosPessoais')}</ThemedText>

              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <MaterialIcons name="person" size={20} color="#8892A4" style={styles.icon} />
                  <TextInput style={styles.input} placeholder={t('nome')} placeholderTextColor="#8892A4" value={nome} onChangeText={setNome} />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <TextInput style={[styles.input, { paddingLeft: 16 }]} placeholder={t('sobrenome')} placeholderTextColor="#8892A4" value={sobrenome} onChangeText={setSobrenome} />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={20} color="#8892A4" style={styles.icon} />
                <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor="#8892A4" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color="#8892A4" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('senha')}
                  placeholderTextColor="#8892A4"
                  secureTextEntry={!mostrarSenha}
                  autoComplete="new-password"
                  value={senha}
                  onChangeText={setSenha}
                />
                <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.eyeIcon}>
                  <MaterialIcons name={mostrarSenha ? "visibility" : "visibility-off"} size={20} color="#8892A4" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="lock-outline" size={20} color="#8892A4" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('confirmarSenha')}
                  placeholderTextColor="#8892A4"
                  secureTextEntry={!mostrarConfirmarSenha}
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                />
                <TouchableOpacity onPress={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)} style={styles.eyeIcon}>
                  <MaterialIcons name={mostrarConfirmarSenha ? "visibility" : "visibility-off"} size={20} color="#8892A4" />
                </TouchableOpacity>
              </View>
            </>
          )}

          <ThemedText style={styles.sectionTitle}>{t('especificacoesVeiculo')}</ThemedText>

          <TouchableOpacity
            style={styles.inputContainer}
            activeOpacity={0.7}
            onPress={() => openSelect('marca', t('selecioneMontadora'), OPCOES_MARCA)}
          >
            <MaterialIcons name="directions-car" size={20} color="#8892A4" style={styles.icon} />
            <Text style={[styles.inputSelector, !marca && styles.inputSelectorPlaceholder]}>
              {marca ? translateOption('marca', marca) : t('montadoraPlaceholder')}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color="#8892A4" style={{ paddingRight: 12 }} />
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <MaterialIcons name="sell" size={20} color="#8892A4" style={styles.icon} />
            <TextInput style={styles.input} placeholder={t('modeloPlaceholder')} placeholderTextColor="#8892A4" value={veiculo} onChangeText={setVeiculo} />
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.inputContainer, { flex: 1, marginRight: 8 }]} activeOpacity={0.7} onPress={() => openSelect('motor', t('selecioneMotor'), OPCOES_MOTOR)}>
              <MaterialIcons name="build" size={20} color="#8892A4" style={styles.icon} />
              <Text style={[styles.inputSelector, !motor && styles.inputSelectorPlaceholder]}>{motor ? motor : t('motorLabel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]} activeOpacity={0.7} onPress={() => openSelect('combustivel', t('combustivel'), OPCOES_COMBUSTIVEL)}>
              <MaterialIcons name="local-gas-station" size={20} color="#8892A4" style={styles.icon} />
              <Text style={[styles.inputSelector, !combustivel && styles.inputSelectorPlaceholder]}>
                {combustivel ? translateOption('combustivel', combustivel) : t('tipoPlaceholder')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <MaterialIcons name="date-range" size={20} color="#8892A4" style={styles.icon} />
              <TextInput style={styles.input} placeholder={t('anoPlaceholder')} placeholderTextColor="#8892A4" keyboardType="numeric" maxLength={4} value={ano} onChangeText={setAno} />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <MaterialIcons name="speed" size={20} color="#8892A4" style={styles.icon} />
              <TextInput style={styles.input} placeholder={t('kmAtualPlaceholder')} placeholderTextColor="#8892A4" keyboardType="numeric" value={km} onChangeText={setKm} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.disabledBtn]}
            onPress={handleCadastro}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.primaryBtnText}>
              {isSubmitting
                ? t('salvando')
                : isEditing
                  ? t('salvarAlteracoes')
                  : t('criarContaConectar')}
            </ThemedText>
            {!isSubmitting && (
              <MaterialIcons
                name={isEditing ? 'save' : 'bluetooth-connected'}
                size={20}
                color="#0A0A0F"
              />
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={selectModalConfig.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectModalConfig.title}</Text>
              <TouchableOpacity onPress={() => setSelectModalConfig({ ...selectModalConfig, visible: false })}>
                <MaterialIcons name="close" size={24} color="#F0F2FF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectModalConfig.data}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectOption(item)}>
                  <Text style={styles.modalItemText}>{translateOption(selectModalConfig.type, item)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <TermsModal
        visible={showTermsModal}
        onAccept={prosseguirComCadastro}
        onDecline={() => setShowTermsModal(false)}
      />

      <BluetoothTutorialModal
        visible={showBluetoothModal}
        onClose={finalizarOnboarding}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scrollContent: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { padding: 8, backgroundColor: '#12141A', borderRadius: 8, borderWidth: 1, borderColor: '#1E2235' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#F0F2FF' },
  descricao: { fontSize: 14, color: '#8892A4', marginBottom: 32, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#00B4FF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12141A', borderWidth: 1, borderColor: '#1E2235', borderRadius: 12, marginBottom: 16, height: 54 },
  icon: { paddingLeft: 16 },
  eyeIcon: { padding: 12, paddingRight: 16 },
  input: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, height: '100%' },
  inputSelector: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, paddingTop: 16 },
  inputSelectorPlaceholder: { color: '#8892A4' },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#00B4FF', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#0A0A0F', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#12141A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%', borderWidth: 1, borderColor: '#1E2235' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F0F2FF' },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  modalItemText: { fontSize: 16, color: '#00B4FF' },
});