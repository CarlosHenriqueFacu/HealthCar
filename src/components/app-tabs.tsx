import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

export default function AppTabs() {
  // Pega o tema atual do sistema do celular (claro ou escuro)
  const scheme = useColorScheme();
  
  // Define a paleta de cores. Se o celular não informar o tema ('unspecified'), usa o claro ('light') por padrão.
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      
      {/* ========================================== */}
      {/* ABA 1: PÁGINA INICIAL (HOME)                 */}
      {/* ========================================== */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          // MANUTENÇÃO: Caminho da imagem corrigido de '@/' para '../../' apontando para a pasta assets real
          src={require('../../assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* ========================================== */}
      {/* ABA 2: EXPLORAR (EXPLORE)                    */}
      {/* ========================================== */}
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          // MANUTENÇÃO: Caminho da imagem corrigido de '@/' para '../../'
          src={require('../../assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      
    </NativeTabs>
  );
}