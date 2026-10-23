// @ts-ignore
import '../global.css';

import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppProvider } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { initDatabase } from '../database/database';

SplashScreen.preventAutoHideAsync();

function AccountRestoreScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ActivityIndicator color="#00B4FF" size="large" />
      <Text style={{ color: '#F0F2FF', fontSize: 14 }}>Restaurando os dados da sua conta...</Text>
    </View>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const { user, isLoading, isAccountLoading } = useAuth();

  useEffect(() => {
    if (isLoading || (user && isAccountLoading)) return;

    const group = segments[0];
    const authRoute = group === '(auth)';
    const authPage = segments[1];

    if (!user && !authRoute) {
      router.replace('/(auth)/login' as any);
    } else if (user && authRoute && authPage !== 'cadastro') {
      router.replace('/(tabs)' as any);
    }
  }, [user, isLoading, isAccountLoading, segments]);

  if (isLoading) return <AccountRestoreScreen />;

  return (
    <View style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
      {user && isAccountLoading && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 10, elevation: 10 }]}>
          <AccountRestoreScreen />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .catch((error) => {
        console.error('[Arquitetura de Dados] Falha ao inicializar o SQLite:', error);
      })
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (isReady) void SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <AppProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppProvider>
  );
}
