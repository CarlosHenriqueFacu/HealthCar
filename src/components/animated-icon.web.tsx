import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
// Importa as ferramentas de animação (Reanimated) para criar efeitos fluidos
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

// MANUTENÇÃO FUTURA: O TypeScript não entende arquivos CSS nativamente no React Native.
// O comando '@ts-ignore' abaixo avisa o compilador para pular a verificação desta linha, evitando falsos alertas de erro.
// @ts-ignore
import classes from './animated-icon.module.css';

// Tempo base para a duração das animações (300 milissegundos)
const DURATION = 300;

// Componente de sobreposição (retorna nulo pois a versão web gerencia isso de forma diferente do mobile)
export function AnimatedSplashOverlay() {
  return null;
}

// ==========================================
// BLOCO DE ANIMAÇÕES (KEYFRAMES)
// Funcionam como uma "linha do tempo" (0 a 100%) para criar os efeitos visuais.
// ==========================================

// 1. Animação do Fundo: O elemento cresce de 0 até dar um "pulo" elástico de 1.2, voltando ao tamanho normal (1).
const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2), // Cria aquele efeito suave de mola (vai e volta)
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

// 2. Animação do Logo: Semelhante ao fundo, mas além da escala, ele começa transparente (opacity: 0) e surge na tela (opacity: 1).
const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

// 3. Animação do Brilho (Glow): Gira a imagem no eixo Z (rotateZ) criando um efeito contínuo de rotação.
const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }], // Gira continuamente
  },
});

// ==========================================
// COMPONENTE PRINCIPAL (INTERFACE)
// ==========================================
// MANUTENÇÃO FUTURA: Lembre-se que o sufixo ".web.tsx" indica que este código 
// SÓ É EXECUTADO se o app rodar em um navegador de internet. O celular Android ignora isso.
export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      {/* Camada 1: O Brilho animado girando ao fundo */}
      {/* MANUTENÇÃO: O caminho da imagem foi alterado de '@/assets' para '../../assets' para funcionar corretamente na estrutura atual */}
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('../../assets/images/logo-glow.png')} />
      </Animated.View>

      {/* Camada 2: O fundo do ícone */}
      <Animated.View style={styles.background} entering={keyframe.duration(DURATION)}>
        <div className={classes.expoLogoBackground} />
      </Animated.View>

      {/* Camada 3: O logo principal da aplicação posicionado no topo */}
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('../../assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

// ==========================================
// ESTILOS (CSS NO REACT NATIVE)
// Controla tamanhos, posições absolutas e alinhamentos.
// ==========================================
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1000,
    position: 'absolute',
    top: 128 / 2 + 138,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    width: 128,
    height: 128,
    position: 'absolute',
  },
});