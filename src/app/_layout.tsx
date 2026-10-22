// @ts-ignore
import '../global.css';

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { initDatabase } from '../database/database'; // Importação do motor de persistência SQLite

/**
 * Retém a SplashScreen nativa de forma programática.
 * Esta abordagem previne a ocorrência de "flashes" de renderização (FOUC), 
 * garantindo que a árvore de componentes e a infraestrutura de dados local 
 * estejam plenamente hidratadas antes da exposição ao usuário.
 */
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);

  /**
   * Fase 1: Inicialização do Motor de Persistência e Avaliação de Estado (Onboarding)
   * Processo assíncrono que inicializa o esquema de banco de dados offline-first (SQLite)
   * e valida a existência de um perfil veicular no cache de longo prazo (AsyncStorage).
   */
  useEffect(() => {
    async function bootstrapSystem() {
      try {
        // Inicializa as tabelas do banco relacional
        await initDatabase();

        // Valida o estado de onboarding do usuário
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
        
        if (veiculoCadastrado === null) {
          setIsFirstAccess(true);
        }
      } catch (error) {
        console.error("[Arquitetura de Dados] Falha crítica durante o bootstrap do sistema:", error);
      } finally {
        setIsReady(true);
      }
    }

    bootstrapSystem();
  }, []);

  /**
   * Fase 2: Controlador de Roteamento Dinâmico
   * Acionado mediante a conclusão do bootstrap. Redireciona usuários não 
   * autenticados para a esteira de cadastro ou libera a interface principal.
   */
  useEffect(() => {
    if (isReady) {
      if (isFirstAccess) {
        // Desbloqueia a Splash Screen e aloca uma janela de 150ms para a montagem 
        // segura do Router DOM antes do redirecionamento
        SplashScreen.hideAsync();
        setTimeout(() => {
          router.replace('/(auth)/cadastro' as any);
        }, 150);
      } else {
        // Transição suave para a interface principal em usuários com cache válido
        SplashScreen.hideAsync();
      }
    }
  }, [isReady, isFirstAccess]);

  // Aplica o bloqueio de pintura (Render Blocking) enquanto a Fase 1 não for finalizada
  if (!isReady) {
    return null; 
  }

  return (
    <AppProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </View>
      </AuthProvider>
    </AppProvider>
  );
}