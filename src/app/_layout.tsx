// @ts-ignore
import '../global.css';

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { AppProvider } from '../contexts/AppContext';

/**
 * Previne o fechamento automático da Splash Screen nativa.
 * Isso permite ocultá-la manualmente apenas quando o App estiver totalmente carregado,
 * evitando flashes brancos na inicialização.
 */
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);

  /**
   * Fase 1: Inicialização e Leitura de Memória
   * Verifica a existência de dados de configuração na memória do dispositivo.
   * Determina a flag de estado de acesso (primeiro acesso ou usuário recorrente).
   */
  useEffect(() => {
    async function checkInitialAccess() {
      try {
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
        
        if (veiculoCadastrado === null) {
          setIsFirstAccess(true);
        }
      } catch (error) {
        console.error("[AppLayout] Falha ao ler AsyncStorage durante a inicialização:", error);
      } finally {
        setIsReady(true);
      }
    }

    checkInitialAccess();
  }, []);

  /**
   * Fase 2: Controlador de Tráfego de Navegação (Onboarding)
   * Disparado apenas após a aplicação estar pronta para renderizar.
   * Redireciona o usuário para a tela de cadastro se for a primeira instalação.
   */
  useEffect(() => {
    if (isReady) {
      if (isFirstAccess) {
        // Libera a Splash Screen e dá tempo para o Stack Root montar antes do redirecionamento
        SplashScreen.hideAsync();
        setTimeout(() => {
          router.replace('/(auth)/cadastro' as any);
        }, 150);
      } else {
        // Usuário recorrente: Apenas libera a Splash Screen e segue o fluxo normal
        SplashScreen.hideAsync();
      }
    }
  }, [isReady, isFirstAccess]);

  // Bloqueia a renderização da interface enquanto a verificação inicial (Fase 1) ocorre
  if (!isReady) {
    return null; 
  }

  return (
    <AppProvider>
      <View style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </View>
    </AppProvider>
  );
}