// MANUTENÇÃO FUTURA: O arquivo global.css está dentro da pasta 'src'. 
// Como estamos em 'src/app', voltamos apenas uma pasta ('../') para encontrá-lo.
// @ts-ignore
import '../global.css';

import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

// Importamos o AsyncStorage para ler a memória do celular
import AsyncStorage from "@react-native-async-storage/async-storage";

// === NOVO: Importação do Provedor de Contexto Global (Tema e Idioma) ===
import { AppProvider } from '../contexts/AppContext';

// Segura a tela de splash nativa inicial para não piscar branco
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  // MANUTENÇÃO FUTURA: Controlador de Tráfego do Onboarding
  useEffect(() => {
    async function verificarAcesso() {
      try {
        // Verifica se existe a chave do carro salvo na memória
        const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
        
        if (veiculoCadastrado === null) {
          // SE FOR A PRIMEIRA VEZ: Manda para a tela de cadastro
          // (O setTimeout é um truque do Expo para garantir que a rota foi carregada antes de redirecionar)
          setTimeout(() => {
            router.replace('/(auth)/cadastro' as any); 
          }, 100);
        }
      } catch (error) {
        console.error("Erro ao verificar o AsyncStorage:", error);
      } finally {
        // Libera a tela para aparecer e levanta a cortina da Splash Screen
        setIsReady(true);
        SplashScreen.hideAsync();
      }
    }

    verificarAcesso();
  }, []);

  // Enquanto estiver lendo a memória, não renderiza nada (segura a splash)
  if (!isReady) {
    return null; 
  }

  return (
    // === NOVO: AppProvider envolve toda a aplicação para fornecer os dados dinâmicos ===
    <AppProvider>
      <View style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* O headerShown: false oculta aquela barra de título feia nativa do Android */}
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </View>
    </AppProvider>
  );
}