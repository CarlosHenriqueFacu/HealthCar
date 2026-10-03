import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';

import { useApp } from '../contexts/AppContext';

/**
 * Tela de Configurações (Settings Screen)
 * 
 * Atua como o menu central do aplicativo, permitindo ao usuário navegar para
 * a gestão da conta, configuração do veículo pareado, e alternar preferências 
 * globais de experiência (Idioma e Tema Claro/Escuro).
 */
export default function ConfiguracoesScreen() {
  // Extração das variáveis de estado e métodos do contexto global (Context API)
  const { theme, toggleTheme, toggleLanguage, t } = useApp();

  // Definição da paleta de cores reativa baseada no tema atual (Claro ou Escuro)
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const iconBg = isDark ? '#1E2235' : '#E2E8F0';

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
          onPress={() => router.push('/(auth)/login' as any)}
        >
          <MaterialIcons name="account-circle" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('conta')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>{t('contaSub')}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

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

        {/* Opção: Alternância de Idioma (Aciona método do AppContext) */}
        <Pressable 
          style={({ pressed }) => [styles.menuItem, { borderBottomColor: borderColor }, pressed && styles.menuItemPressed]} 
          onPress={toggleLanguage}
        >
          <MaterialIcons name="language" size={28} color={subTextColor} />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('idioma')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>{t('idiomaSub')}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

        {/* Opção: Alternância de Tema (Aciona método do AppContext) */}
        <Pressable 
          style={({ pressed }) => [styles.menuItem, { borderBottomWidth: 0 }, pressed && styles.menuItemPressed]} 
          onPress={toggleTheme}
        >
          <MaterialIcons name="brightness-6" size={28} color={subTextColor} />
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: textColor }]}>{t('tema')}</Text>
            <Text style={[styles.menuSub, { color: subTextColor }]}>{theme === 'dark' ? t('temaSub') : t('temaSubClaro')}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={subTextColor} />
        </Pressable>

      </ScrollView>
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
  menuSub: { fontSize: 13, marginTop: 4 }
});