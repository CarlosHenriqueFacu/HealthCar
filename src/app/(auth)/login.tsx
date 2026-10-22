import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
import { getAuthErrorMessage, loginWithEmail } from '../../services/firebase';

/**
 * @screen LoginScreen
 * @description Tela primária de autenticação. Atua como barreira de entrada (Auth Guard) 
 * para usuários não autenticados, permitindo o acesso via credenciais de e-mail e senha.
 * Inclui navegação para fluxos secundários de Cadastro e Recuperação de Senha.
 */
export default function LoginScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  /**
   * @method handleLogin
   * @description Valida o formulário localmente e orquestra a chamada de autenticação 
   * no provedor de identidade (Firebase). Previne concorrência de requisições travando 
   * o estado de submissão.
   */
  const handleLogin = async (): Promise<void> => {
    // Validação de Frontend (Early Return)
    if (!email.trim() || !senha) {
      Alert.alert('Campos obrigatórios', 'Informe seu e-mail e sua senha para prosseguir.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Integração com a camada de serviço (BaaS)
      await loginWithEmail(email, senha);
      
      // Sucesso na autenticação: Retorna para o stack de navegação anterior (Dashboard)
      router.back();
    } catch (error) {
      console.error('[Auth_Login] Falha ao autenticar com e-mail:', error);
      Alert.alert('Falha na Autenticação', getAuthErrorMessage(error));
    } finally {
      // Libera a thread de UI independentemente do resultado da Promise
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ================= HEADER (Navegação) ================= */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isSubmitting}>
              <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.titulo}>Autenticação</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* ================= BRANDING & BOAS-VINDAS ================= */}
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="directions-car" size={48} color="#00B4FF" />
            </View>
            <ThemedText style={styles.appName}>HEALTHCAR</ThemedText>
            <ThemedText style={styles.descricao}>
              Bem-vindo de volta! Insira suas credenciais para acessar a telemetria e o scanner do veículo.
            </ThemedText>
          </View>

          {/* ================= FORMULÁRIO DE CREDENCIAIS ================= */}
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#8892A4"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#8892A4"
              secureTextEntry
              autoComplete="password"
              value={senha}
              onChangeText={setSenha}
              editable={!isSubmitting}
            />
          </View>

          {/* ================= RECUPERAÇÃO DE ACESSO ================= */}
          <TouchableOpacity 
            style={styles.forgotPasswordContainer} 
            onPress={() => router.push('/esqueci-senha' as any)}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.forgotPasswordText}>Esqueci minha senha</ThemedText>
          </TouchableOpacity>

          {/* ================= AÇÃO PRINCIPAL (LOGIN) ================= */}
          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.primaryBtnText}>
              {isSubmitting ? 'Autenticando...' : 'Entrar na Plataforma'}
            </ThemedText>
            {!isSubmitting && <MaterialIcons name="login" size={20} color="#0A0A0F" />}
          </TouchableOpacity>

          {/* ================= REDIRECIONAMENTO ONBOARDING ================= */}
          <View style={styles.registerContainer}>
            <ThemedText style={styles.registerText}>Ainda não possui acesso? </ThemedText>
            <TouchableOpacity onPress={() => router.push('/cadastro' as any)} disabled={isSubmitting}>
              <ThemedText style={styles.registerLink}>Cadastre-se agora</ThemedText>
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
    backgroundColor: '#00B4FF11',
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
  disabledBtn: {
    opacity: 0.6,
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