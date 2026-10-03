import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/screen-container';

export default function ConfiguracoesScreen() {
  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Configurações</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => router.push('/(auth)/login' as any)}>
          <MaterialIcons name="account-circle" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Conta e Login</Text>
            <Text style={styles.menuSub}>Gerenciar sessão ou desconectar</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#8892A4" />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => router.push('/(auth)/cadastro' as any)}>
          <MaterialCommunityIcons name="car-cog" size={28} color="#00B4FF" />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Configuração do Veículo</Text>
            <Text style={styles.menuSub}>Alterar parâmetros e pareamento</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#8892A4" />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => {}}>
          <MaterialIcons name="language" size={28} color="#8892A4" />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Idioma</Text>
            <Text style={styles.menuSub}>Português (Brasil)</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#8892A4" />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.menuItem, { borderBottomWidth: 0 }, pressed && styles.menuItemPressed]} onPress={() => {}}>
          <MaterialIcons name="brightness-6" size={28} color="#8892A4" />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Tema</Text>
            <Text style={styles.menuSub}>Modo Escuro</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#8892A4" />
        </Pressable>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, backgroundColor: '#1E2235', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#F0F2FF' },
  content: { flex: 1, paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#1E2235' },
  menuItemPressed: { opacity: 0.6 },
  menuTextContainer: { flex: 1, marginLeft: 16 },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#F0F2FF' },
  menuSub: { fontSize: 13, color: '#8892A4', marginTop: 4 }
});