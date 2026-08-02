import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

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

  const handleCadastro = () => {
    // Futura integração com Firebase vai aqui
    console.log("Dados salvos:", { nome, sobrenome, email, veiculo, ano, km });
    alert('Conta criada com sucesso!');
    router.back(); // Volta para a tela de login
  };

  return (
    <ThemedView style={styles.container}>
      {/* KeyboardAvoidingView evita que o teclado cubra os campos no iOS */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ScrollView permite rolar a tela quando o teclado estiver aberto */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Cabeçalho com botão de voltar */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.titulo}>Nova Conta</ThemedText>
            <View style={{ width: 24 }} /> {/* Espaçador para centralizar o título */}
          </View>

          <ThemedText style={styles.descricao}>
            Preencha seus dados e as informações do veículo para começar a monitorar a saúde do seu carro.
          </ThemedText>

          {/* ================= SESSÃO: DADOS PESSOAIS ================= */}
          <ThemedText style={styles.sectionTitle}>Dados Pessoais</ThemedText>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <MaterialIcons name="person" size={20} color="#8892A4" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Nome"
                placeholderTextColor="#8892A4"
                value={nome}
                onChangeText={setNome}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <TextInput
                style={[styles.input, { paddingLeft: 16 }]} // Sem ícone, mais espaço
                placeholder="Sobrenome"
                placeholderTextColor="#8892A4"
                value={sobrenome}
                onChangeText={setSobrenome}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#8892A4"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#8892A4"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>

          {/* ================= SESSÃO: VEÍCULO ================= */}
          <ThemedText style={styles.sectionTitle}>Dados do Veículo</ThemedText>

          <View style={styles.inputContainer}>
            <MaterialIcons name="directions-car" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Modelo do Veículo (Ex: Chevrolet Onix)"
              placeholderTextColor="#8892A4"
              value={veiculo}
              onChangeText={setVeiculo}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <MaterialIcons name="date-range" size={20} color="#8892A4" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Ano"
                placeholderTextColor="#8892A4"
                keyboardType="numeric"
                maxLength={4}
                value={ano}
                onChangeText={setAno}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <MaterialIcons name="speed" size={20} color="#8892A4" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Km Atual"
                placeholderTextColor="#8892A4"
                keyboardType="numeric"
                value={km}
                onChangeText={setKm}
              />
            </View>
          </View>

          {/* ================= BOTÃO DE CADASTRAR ================= */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCadastro}>
            <ThemedText style={styles.primaryBtnText}>Finalizar Cadastro</ThemedText>
            <MaterialIcons name="check-circle" size={20} color="#0A0A0F" />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F', // Fundo principal da aplicação
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    padding: 8,
    backgroundColor: '#12141A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2235',
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F0F2FF',
  },
  descricao: {
    fontSize: 14,
    color: '#8892A4',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00B4FF', // Azul destaque
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141A', // Fundo do card
    borderWidth: 1,
    borderColor: '#1E2235',
    borderRadius: 12,
    marginBottom: 16,
    height: 54,
  },
  icon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    color: '#F0F2FF',
    fontSize: 15,
    paddingHorizontal: 12,
    height: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#00B4FF',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontWeight: 'bold',
    fontSize: 16,
  },
});