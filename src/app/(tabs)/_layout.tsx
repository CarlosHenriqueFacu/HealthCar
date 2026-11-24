import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useApp } from '@/contexts/AppContext';

const ACTIVE = '#00B4FF';

export default function MainTabsLayout() {
  const { theme, t } = useApp();
  const isDark = theme === 'dark';

  return (
    // Mantém só as quatro áreas principais na navegação inferior; telas auxiliares ficam no Stack raiz.
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: isDark ? '#8791A3' : '#64748B',
        tabBarStyle: {
          backgroundColor: isDark ? '#0A0B0F' : '#FFFFFF',
          borderTopColor: isDark ? '#252A36' : '#E2E8F0',
          borderTopWidth: 1,
          height: 68,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabInicio'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="manutencao"
        options={{
          title: t('tabManutencao'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="build" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: t('tabScanner'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="center-focus-weak" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: t('tabRelatorios'),
          tabBarIcon: ({ color, size }) => <MaterialIcons name="bar-chart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}