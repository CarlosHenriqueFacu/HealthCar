import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ScreenContainer } from '../../components/screen-container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ThemedText } from '../../components/themed-text';
import { AppPalette } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getAuthErrorMessage, sendPasswordReset } from '../../services/firebase';

export default function EsqueciSenhaScreen() {
  const { theme } = useApp();
  const colors = AppPalette[theme];
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('E-mail obrigatório', 'Informe o e-mail da sua conta.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      Alert.alert(
        'E-mail enviado',
        'Se houver uma conta para esse endereço, você receberá instruções para redefinir a senha.',
      );
    } catch (error) {
      console.error('[PasswordReset] Falha ao enviar instruções:', error);
      Alert.alert('Não foi possível enviar', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <ScreenHeader title="Recuperar senha" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialIcons name="lock-reset" size={30} color={colors.primary} />
        </View>
        <ThemedText style={[styles.title, { color: colors.text }]}>Vamos recuperar seu acesso</ThemedText>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          Informe o e-mail associado à sua conta. Enviaremos instruções para criar uma nova senha.
        </ThemedText>
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="email" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Seu e-mail"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="E-mail da conta"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleResetPassword}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            (pressed || isSubmitting) && styles.pressed,
          ]}
        >
          <ThemedText style={styles.buttonText}>
            {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
          </ThemedText>
          {!isSubmitting && <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 28,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    height: '100%',
  },
  button: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
