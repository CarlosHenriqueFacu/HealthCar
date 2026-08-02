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

export default function LoginScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleLogin = () => {
    // Futura integração com o Firebase entrará aqui
    console.log("Tentativa de login com:", email);
    alert('Logado com sucesso!');
    // Retorna para a tela principal (Index)
    router.back(); 
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Cabeçalho com botão de voltar */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.titulo}>Login</ThemedText>
            <View style={{ width: 40 }} /> {/* Espaçador para manter o título centralizado */}
          </View>

          {/* Logo / Boas-vindas */}
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="directions-car" size={48} color="#00B4FF" />
            </View>
            <ThemedText style={styles.appName}>HEALTHCAR</ThemedText>
            <ThemedText style={styles.descricao}>
              Bem-vindo de volta! Insira suas credenciais para acessar a telemetria e o scanner do veículo.
            </ThemedText>
          </View>

          {/* ================= CAMPOS DE LOGIN ================= */}
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

          {/* ================= ESQUECI A SENHA ================= */}
          <TouchableOpacity 
            style={styles.forgotPasswordContainer} 
            onPress={() => router.push('/esqueci-senha' as any)}
          >
            <ThemedText style={styles.forgotPasswordText}>Esqueci minha senha</ThemedText>
          </TouchableOpacity>

          {/* ================= BOTÃO DE ENTRAR ================= */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
            <ThemedText style={styles.primaryBtnText}>Entrar</ThemedText>
            <MaterialIcons name="login" size={20} color="#0A0A0F" />
          </TouchableOpacity>

          {/* ================= CRIAR CONTA ================= */}
          <View style={styles.registerContainer}>
            <ThemedText style={styles.registerText}>Ainda não tem uma conta? </ThemedText>
            <TouchableOpacity onPress={() => router.push('/cadastro' as any)}>
              <ThemedText style={styles.registerLink}>Cadastre-se</ThemedText>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    position: 'absolute',
    top: 40,
    left: 24,
    right: 24,
    zIndex: 10,
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 80,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00B4FF11', // Fundo azul translúcido
    borderWidth: 1,
    borderColor: '#00B4FF44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F0F2FF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  descricao: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141A',
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#00B4FF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#00B4FF',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontWeight: 'bold',
    fontSize: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#8892A4',
    fontSize: 14,
  },
  registerLink: {
    color: '#00B4FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});