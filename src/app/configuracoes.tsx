import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';

import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getAuthErrorMessage, signOutCurrentUser } from '../services/firebase';

/**
 * Tela de Configurações (Settings Screen)
 * 
 * Atua como o menu central do aplicativo, permitindo ao usuário navegar para
 * a gestão da conta, configuração do veículo pareado, e alternar preferências 
 * globais de experiência (Idioma e Tema Claro/Escuro).
 */
export default function ConfiguracoesScreen() {
  // Extração das variáveis de estado e métodos do contexto global (Context API)
  const { theme, language, toggleTheme, toggleLanguage, t } = useApp();
  const { user, syncStatus, syncNow } = useAuth();

  // Estados locais para controlar a abertura/fechamento das janelas de escolha (Modais)
  const [showLangModal, setShowLangModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Definição da paleta de cores reativa baseada no tema atual (Claro ou Escuro)
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const iconBg = isDark ? '#1E2235' : '#E2E8F0';

  /**
   * Lida com a seleção de idioma do utilizador.
   * Se o idioma selecionado for diferente do atual, ele altera. Caso contrário, só fecha o modal.
   */
  const handleSelectLanguage = (selectedLang: 'pt' | 'en') => {
    if (selectedLang !== language) {
      toggleLanguage();
    }
    setShowLangModal(false);
  };

  /**
   * Lida com a seleção do tema do utilizador.
   */
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

    Alert.alert('Sair da conta?', 'Você poderá entrar novamente quando quiser.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutCurrentUser();
          } catch (error) {
            Alert.alert('Não foi possível sair', getAuthErrorMessage(error));
          }
        },
      },
    ]);
  };

  const syncDescription = syncStatus.phase === 'syncing'
    ? 'Sincronizando com a nuvem…'
    : syncStatus.phase === 'error'
      ? `Dados neste aparelho; falha na nuvem${syncStatus.pendingCount ? ` · ${syncStatus.pendingCount} pendentes` : ''}`
      : syncStatus.pendingCount > 0
        ? `${syncStatus.pendingCount} alterações aguardando internet`
        : syncStatus.lastSyncedAt
          ? `Última cópia: ${new Date(syncStatus.lastSyncedAt).toLocaleString('pt-BR')}`
          : 'Cópia de segurança na nuvem';

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      {/* --- Cabeçalho (Header) --- */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={({ pressed }) => [styles.backBtn, { backgroundColor: iconBg }, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: textColor }]}>{t('configuracoes')}</Text>
      </View>

      {/* --- Lista de Opções do Menu --- */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Opção: Conta e Login */}
        <Pressable 
          style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]} 
          onPress={handleAccountPress}
        >
          <MaterialIcons name="account-circle" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>
              {user ? 'Sair da conta' : t('conta')}
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
              <Text style={[styles.menuTitle, { color: textColor }]}>Sincronização</Text>
              <Text style={[styles.menuSub, { color: subTextColor }]}>{syncDescription}</Text>
            </View>
            <MaterialIcons name="refresh" size={22} color={subTextColor} />
          </Pressable>
        )}

        {/* Opção: Configuração do Veículo */}
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

        {/* Opção: Idioma -> Abre o Modal */}
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

        {/* Opção: Tema -> Abre o Modal */}
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

      {/* =========================================
          MODAL: SELEÇÃO DE IDIOMA
      ========================================= */}
      <Modal visible={showLangModal} transparent animationType="fade">
        {/* Fundo escuro interativo que fecha o modal se clicado */}
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangModal(false)}>
          {/* Previne que cliques dentro da caixa fechem o modal */}
          <Pressable style={[styles.modalBox, { backgroundColor: cardColor, borderColor: borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Selecione o Idioma</Text>
              <MaterialIcons name="language" size={24} color="#00B4FF" />
            </View>

            <Pressable 
              style={({ pressed }) => [styles.modalOption, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]} 
              onPress={() => handleSelectLanguage('pt')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>Português (Brasil)</Text>
              {/* Só mostra o ícone de 'check' se esta for a opção atual */}
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

      {/* =========================================
          MODAL: SELEÇÃO DE TEMA
      ========================================= */}
      <Modal visible={showThemeModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: cardColor, borderColor: borderColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Aparência do Aplicativo</Text>
              <MaterialIcons name="palette" size={24} color="#00B4FF" />
            </View>

            <Pressable 
              style={({ pressed }) => [styles.modalOption, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]} 
              onPress={() => handleSelectTheme('dark')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>Modo Escuro (Dark Mode)</Text>
              {theme === 'dark' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.modalOption, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]} 
              onPress={() => handleSelectTheme('light')}
            >
              <Text style={[styles.modalOptionText, { color: textColor }]}>Modo Claro (Light Mode)</Text>
              {theme === 'light' && <MaterialIcons name="check-circle" size={22} color="#00B4FF" />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScreenContainer>
  );
}

// --- Estilos Estáticos ---
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

  // Estilos específicos para os Modais de Seleção
  modalOverlay: { flex: 1, backgroundColor: "rgba(10, 10, 15, 0.7)", justifyContent: "flex-end", alignItems: "center" },
  modalBox: { width: "100%", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20, borderBottomWidth: 1 },
  modalOptionText: { fontSize: 16, fontWeight: "500" }
});
