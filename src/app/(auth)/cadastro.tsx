import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

// IMPORTANTE: Importando o seu modal de Bluetooth que já estava utilizando!
import { BluetoothTutorialModal } from '../../components/ui/BluetoothTutorialModal';

// Listas de opções para o usuário selecionar
const OPCOES_MARCA = ['Chevrolet', 'Volkswagen', 'Fiat', 'Ford', 'Honda', 'Toyota', 'Hyundai', 'Renault', 'Jeep', 'Outra'];
const OPCOES_COMBUSTIVEL = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico'];
const OPCOES_MOTOR = ['1.0', '1.0 Turbo', '1.3', '1.4', '1.6', '1.8', '2.0', '2.0 Turbo', 'V6', 'V8'];

export default function CadastroScreen() {
  const router = useRouter();
  
  // Estados dos dados pessoais
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  
  // Estados dos dados do veículo
  const [veiculo, setVeiculo] = useState('');
  const [ano, setAno] = useState('');
  const [km, setKm] = useState('');
  const [marca, setMarca] = useState('');
  const [combustivel, setCombustivel] = useState('');
  const [motor, setMotor] = useState('');

  // Controle dos Modais
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [selectModalConfig, setSelectModalConfig] = useState({ visible: false, type: '', title: '', data: [] as string[] });

  // Abre a janela de seleção com as opções corretas
  const openSelect = (type: string, title: string, data: string[]) => {
    setSelectModalConfig({ visible: true, type, title, data });
  };

  // Quando o usuário escolhe uma opção na listinha
  const handleSelectOption = (option: string) => {
    if (selectModalConfig.type === 'marca') setMarca(option);
    if (selectModalConfig.type === 'combustivel') setCombustivel(option);
    if (selectModalConfig.type === 'motor') setMotor(option);
    setSelectModalConfig({ ...selectModalConfig, visible: false });
  };

  const handleCadastro = async () => {
    try {
      // 1. Salva na memória do celular que o usuário já configurou o app
      const dadosVeiculo = { marca, veiculo, motor, ano, km, combustivel };
      await AsyncStorage.setItem('@veiculo_cadastrado', JSON.stringify(dadosVeiculo));
      
      // 2. Abre a tela para parear o Bluetooth
      setShowBluetoothModal(true);
    } catch (error) {
      console.error("Erro ao salvar cadastro", error);
    }
  };

  // Quando o usuário terminar de parear o Bluetooth, manda para a tela inicial
  const finalizarOnboarding = () => {
    setShowBluetoothModal(false);
    router.replace('/'); 
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ================= CABEÇALHO ================= */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.titulo}>Configurar App</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ThemedText style={styles.descricao}>
            Configure seu perfil e selecione as características do seu veículo para calibrar a telemetria.
          </ThemedText>

          {/* ================= SESSÃO: DADOS PESSOAIS ================= */}
          <ThemedText style={styles.sectionTitle}>Dados Pessoais</ThemedText>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <MaterialIcons name="person" size={20} color="#8892A4" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Nome" placeholderTextColor="#8892A4" value={nome} onChangeText={setNome} />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <TextInput style={[styles.input, { paddingLeft: 16 }]} placeholder="Sobrenome" placeholderTextColor="#8892A4" value={sobrenome} onChangeText={setSobrenome} />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#8892A4" style={styles.icon} />
            <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#8892A4" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#8892A4" style={styles.icon} />
            <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#8892A4" secureTextEntry value={senha} onChangeText={setSenha} />
          </View>

          {/* ================= SESSÃO: VEÍCULO ================= */}
          <ThemedText style={styles.sectionTitle}>Dados do Veículo</ThemedText>

          {/* Botão de Seleção: Marca */}
          <TouchableOpacity 
            style={styles.inputContainer} 
            activeOpacity={0.7}
            onPress={() => openSelect('marca', 'Selecione a Montadora', OPCOES_MARCA)}
          >
            <MaterialIcons name="directions-car" size={20} color="#8892A4" style={styles.icon} />
            <Text style={[styles.inputSelector, !marca && styles.inputSelectorPlaceholder]}>
              {marca ? marca : "Montadora (Ex: Chevrolet)"}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color="#8892A4" style={{ paddingRight: 12 }} />
          </TouchableOpacity>

          {/* Texto Livre: Modelo */}
          <View style={styles.inputContainer}>
            <MaterialIcons name="sell" size={20} color="#8892A4" style={styles.icon} />
            <TextInput style={styles.input} placeholder="Modelo (Ex: Onix)" placeholderTextColor="#8892A4" value={veiculo} onChangeText={setVeiculo} />
          </View>

          <View style={styles.row}>
            {/* Botão de Seleção: Motor */}
            <TouchableOpacity style={[styles.inputContainer, { flex: 1, marginRight: 8 }]} activeOpacity={0.7} onPress={() => openSelect('motor', 'Selecione o Motor', OPCOES_MOTOR)}>
              <MaterialIcons name="build" size={20} color="#8892A4" style={styles.icon} />
              <Text style={[styles.inputSelector, !motor && styles.inputSelectorPlaceholder]}>{motor ? motor : "Motor"}</Text>
            </TouchableOpacity>

            {/* Botão de Seleção: Combustível */}
            <TouchableOpacity style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]} activeOpacity={0.7} onPress={() => openSelect('combustivel', 'Combustível', OPCOES_COMBUSTIVEL)}>
              <MaterialIcons name="local-gas-station" size={20} color="#8892A4" style={styles.icon} />
              <Text style={[styles.inputSelector, !combustivel && styles.inputSelectorPlaceholder]}>{combustivel ? combustivel : "Tipo"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <MaterialIcons name="date-range" size={20} color="#8892A4" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Ano" placeholderTextColor="#8892A4" keyboardType="numeric" maxLength={4} value={ano} onChangeText={setAno} />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <MaterialIcons name="speed" size={20} color="#8892A4" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Km Atual" placeholderTextColor="#8892A4" keyboardType="numeric" value={km} onChangeText={setKm} />
            </View>
          </View>

          {/* ================= BOTÃO DE CADASTRAR ================= */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCadastro}>
            <ThemedText style={styles.primaryBtnText}>Salvar e Conectar Scanner</ThemedText>
            <MaterialIcons name="bluetooth-connected" size={20} color="#0A0A0F" />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ================= MODAL DE SELEÇÃO CUSTOMIZADO ================= */}
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
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ================= TUTORIAL BLUETOOTH ================= */}
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
  input: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, height: '100%' },
  inputSelector: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, paddingTop: 16 }, // paddingTop compensa o fato de não ser TextInput
  inputSelectorPlaceholder: { color: '#8892A4' },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#00B4FF', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  primaryBtnText: { color: '#0A0A0F', fontWeight: 'bold', fontSize: 16 },
  
  // Estilos do Modal de Seleção
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#12141A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%', borderWidth: 1, borderColor: '#1E2235' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F0F2FF' },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  modalItemText: { fontSize: 16, color: '#00B4FF' }
});