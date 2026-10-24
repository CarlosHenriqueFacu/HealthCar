import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../contexts/AppContext';

export function HealthCarHeader() {
  const { theme } = useApp();
  const isDark = theme === 'dark';

  // Cabeçalho compartilhado para manter marca e acesso às configurações consistentes entre as abas.
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: isDark ? '#082A3A' : '#E0F2FE' }]}>
          <MaterialIcons name="directions-car" size={19} color="#00B4FF" />
        </View>
        <Text style={[styles.brandName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>HealthCar</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir configurações"
        onPress={() => router.push('/configuracoes' as any)}
        style={({ pressed }) => [
          styles.settingsButton,
          {
            backgroundColor: isDark ? '#111318' : '#FFFFFF',
            borderColor: isDark ? '#29303D' : '#D8E0EA',
          },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="settings" size={19} color={isDark ? '#C4CBD6' : '#475569'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 46,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});
