import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useApp } from '../../contexts/AppContext';
import { getAuthErrorMessage, sendPasswordReset } from '../../services/firebase';

export default function EsqueciSenhaScreen() {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('emailObrigatorio'), t('emailObrigatorioDesc'));
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      Alert.alert(t('emailEnviado'), t('emailEnviadoDesc'));
    } catch (error) {
      Alert.alert(t('naoFoiPossivelEnviar'), getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('recuperarSenha')}</ThemedText>
      <ThemedText style={styles.description}>
        {t('recuperarSenhaDesc')}
      </ThemedText>
      <View style={styles.inputContainer}>
        <MaterialIcons name="email" size={20} color="#8892A4" />
        <TextInput
          style={styles.input}
          placeholder={t('email')}
          placeholderTextColor="#8892A4"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.disabledButton]}
        onPress={handleResetPassword}
        disabled={isSubmitting}
      >
        <ThemedText style={styles.buttonText}>
          {isSubmitting ? t('enviando') : t('enviarInstrucoes')}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  description: { color: '#8892A4', textAlign: 'center', marginTop: 12, marginBottom: 24 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12141A', borderWidth: 1, borderColor: '#1E2235', borderRadius: 12, height: 54, paddingHorizontal: 16, width: '100%' },
  input: { flex: 1, color: '#F0F2FF', fontSize: 15, paddingHorizontal: 12, height: '100%' },
  button: { backgroundColor: '#00B4FF', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20, width: '100%' },
  buttonText: { color: '#0A0A0F', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { opacity: 0.6 },
});