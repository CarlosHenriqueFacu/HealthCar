import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage, signOutCurrentUser } from '../services/firebase';

export default function ConfiguracoesScreen() {
  const { theme, language, toggleTheme, toggleLanguage, t } = useApp();
  const { user, syncStatus, syncNow } = useAuth();

  const [showLangModal, setShowLangModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const iconBg = isDark ? '#1E2235' : '#E2E8F0';
  const locale = language === 'en' ? 'en-US' : 'pt-BR';

  const handleSelectLanguage = (selectedLang: 'pt' | 'en') => {
    if (selectedLang !== language) {
      toggleLanguage();
    }
    setShowLangModal(false);
  };

  const handleSelectTheme = (selectedTheme: 'dark' | 'light') => {
    if (selectedTheme !== theme) {
      toggleTheme();
    }
    setShowThemeModal(false);
  };

  const handleAccountPress = () => {
    if (!user) {
      router.push('/(auth)/login' as any);
      return;
    }

    Alert.alert(t('sairDaContaPergunta'), t('sairDaContaDesc'), [
      { text: t('cancelar'), style: 'cancel' },
      {
        text: t('sair'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutCurrentUser();
          } catch (error) {
            Alert.alert(t('erroSairConta'), getAuthErrorMessage(error));
          }
        },
      },
    ]);
  };

  const syncDescription = syncStatus.phase === 'syncing'
    ? t('sincronizandoNuvem')
    : syncStatus.phase === 'error'
      ? `${t('erroNuvemLocal')}${syncStatus.pendingCount ? ` · ${syncStatus.pendingCount} ${t('pendentes')}` : ''}`
      : syncStatus.pendingCount > 0
        ? `${syncStatus.pendingCount} ${t('alteracoesAguardando')}`
        : syncStatus.lastSyncedAt
          ? `${t('ultimaCopia')} ${new Date(syncStatus.lastSyncedAt).toLocaleString(locale)}`
          : t('copiaSegurancaNuvem');

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: iconBg }, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: textColor }]}>{t('configuracoes')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]}
          onPress={handleAccountPress}
        >
          <MaterialIcons name="account-circle" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>
              {user ? t('sairDaConta') : t('conta')}
            </Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>
              {user?.email ?? t('contaSub')}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

        {user && (
          <Pressable
            style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]}
            onPress={() => void syncNow()}
            disabled={syncStatus.phase === 'syncing'}
          >
            <MaterialIcons name={syncStatus.phase === 'error' ? 'cloud-off' : 'cloud-sync'} size={28} color={syncStatus.phase === 'error' ? '#FFB300' : '#00B4FF'} />
            <View style={styles.menuTextContainer}>
              <Text style={[styles.menuTitle, { color: textColor }]}>{t('sincronizacao')}</Text>
              <Text style={[styles.menuSub, { color: subTextColor }]}>{syncDescription}</Text>
            </View>
            <MaterialIcons name="refresh" size={22} color={subTextColor} />
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/(auth)/cadastro' as any)}
        >
          <MaterialCommunityIcons name="car-cog" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('veiculo')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>{t('veiculoSub')}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]}
          onPress={() => setShowLangModal(true)}
        >
          <MaterialIcons name="language" size={28} color={subTextColor} />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('idioma')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>
              {language === 'pt' ? 'Português (Brasil)' : 'English (US)'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, { borderBottomWidth: 0 }, pressed && styles.menuItemPressed]}
          onPress={() => setShowThemeModal(true)}
        >
          <MaterialIcons name="brightness-6" size={28} color={subTextColor} />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('tema')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>
              {theme === 'dark' ? t('temaSub') : t('temaSubClaro')}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>
      </ScrollView>

      <Modal visible={showLangModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: cardColor, borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>{t('selecioneIdioma')}</Text>
              <MaterialIcons name="language" size={24} color="#00B4FF" />
            </View>

            <Pressable
              style={({ pressed }) => [styles.modalOption, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]}
              onPress={() => handleSelectLanguage('pt')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>Português (Brasil)</Text>
              {language === 'pt' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.modalOption, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}
              onPress={() => handleSelectLanguage('en')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>English (US)</Text>
              {language === 'en' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showThemeModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: cardColor, borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>{t('aparenciaApp')}</Text>
              <MaterialIcons name="palette" size={24} color="#00B4FF" />
            </View>

            <Pressable
              style={({ pressed }) => [styles.modalOption, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]}
              onPress={() => handleSelectTheme('dark')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>{t('modoEscuroOpcao')}</Text>
              {theme === 'dark' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.modalOption, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}
              onPress={() => handleSelectTheme('light')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>{t('modoClaroOpcao')}</Text>
              {theme === 'light' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1 },
  menuItemPressed: { opacity: 0.6 },
  menuTextContainer: { flex: 1, marginLeft: 16 },
  menuTitle: { fontSize: 16, fontWeight: '600' },
  menuSub: { fontSize: 13, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(10, 10, 15, 0.7)", justifyContent: "flex-end", alignItems: "center" },
  modalBox: { width: "100%", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, borderBottomWidth: 1 },
  modalOptionText: { fontSize: 16, fontWeight: "500" },
});