import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { TermsModal } from '../../components/TermsModal';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useApp } from '../../contexts/AppContext';
import { getAuthErrorMessage, loginWithEmail } from '../../services/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useApp();

  const [email, setEmail] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  const handleLogin = (): void => {
    if (!email.trim() || !senha) {
      Alert.alert(t('camposObrigatorios'), t('loginCamposDesc'));
      return;
    }

    setShowTermsModal(true);
  };

  const prosseguirComLogin = async (): Promise<void> => {
    setShowTermsModal(false);
    setIsSubmitting(true);

    try {
      await loginWithEmail(email, senha);
      router.replace('/(tabs)' as any);
    } catch (error) {
      console.error('[Auth_Login] Falha ao autenticar com e-mail:', error);
      Alert.alert(t('falhaAutenticacao'), getAuthErrorMessage(error));
    } finally {
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
          <View style={styles.header}>
            <ThemedText type="title" style={styles.titulo}>{t('autenticacao')}</ThemedText>
          </View>

          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <Image
                source={require('../../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <ThemedText style={styles.appName}>HEALTHCAR</ThemedText>
            <ThemedText style={styles.descricao}>
              {t('loginBoasVindas')}
            </ThemedText>
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#8892A4" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t('email')}
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
              placeholder={t('senha')}
              placeholderTextColor="#8892A4"
              secureTextEntry
              autoComplete="password"
              value={senha}
              onChangeText={setSenha}
              editable={!isSubmitting}
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/esqueci-senha' as any)}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.forgotPasswordText}>{t('esqueciSenha')}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.primaryBtnText}>
              {isSubmitting ? t('autenticando') : t('entrarPlataforma')}
            </ThemedText>
            {!isSubmitting && <MaterialIcons name="login" size={20} color="#0A0A0F" />}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <ThemedText style={styles.registerText}>{t('semAcesso')}</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(auth)/cadastro' as any)} disabled={isSubmitting}>
              <ThemedText style={styles.registerLink}>{t('cadastreSeAgora')}</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsModal
        visible={showTermsModal}
        onAccept={prosseguirComLogin}
        onDecline={() => setShowTermsModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scrollContent: { padding: 24, paddingTop: 40, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32, position: 'absolute', top: 40, left: 24, right: 24, zIndex: 10 },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#F0F2FF' },
  logoContainer: { alignItems: 'center', marginBottom: 40, marginTop: 80 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#09111E', borderWidth: 1.5, borderColor: '#00B4FF44', alignItems: 'center', justifyContent: 'center', marginBottom: 16, padding: 8, overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  appName: { fontSize: 24, fontWeight: '900', color: '#F0F2FF', letterSpacing: 2, marginBottom: 8 },
  descricao: { fontSize: 14, color: '#8892A4', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12141A', borderWidth: 1, borderColor: '#1E2235', borderRadius: 12, marginBottom: 16, height: 54 },
  icon: { paddingLeft: 16 },
  input: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, height: '100%' },
  forgotPasswordContainer: { alignItems: 'flex-end', marginBottom: 24 },
  forgotPasswordText: { color: '#00B4FF', fontSize: 14, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#00B4FF', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 8 },
  primaryBtnText: { color: '#0A0A0F', fontWeight: 'bold', fontSize: 16 },
  disabledBtn: { opacity: 0.6 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { color: '#8892A4', fontSize: 14 },
  registerLink: { color: '#00B4FF', fontSize: 14, fontWeight: 'bold' },
});