// MANUTENÇÃO FUTURA: O arquivo global.css está dentro da pasta 'src'. 
// Como estamos em 'src/app', voltamos apenas uma pasta ('../') para encontrá-lo.
// @ts-ignore
import '../global.css';

// NOVO: Importamos o Stack, que é o verdadeiro motor de navegação do Expo Router
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

// Segura a tela de splash nativa inicial para não piscar branco
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // MANUTENÇÃO FUTURA: Esse useEffect garante que a cortina preta seja levantada
  // assim que o aplicativo terminar de montar os componentes.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        
        {/* Aqui estava o AppTabs. Trocamos pelo Stack para as telas poderem abrir!
            O headerShown: false oculta aquela barra de título feia nativa do Android */}
        <Stack screenOptions={{ headerShown: false }} />

      </ThemeProvider>
    </View>
  );
}