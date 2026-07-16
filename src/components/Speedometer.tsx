import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
// MANUTENÇÃO FUTURA: Reanimated é usado para garantir que o ponteiro do velocímetro se mova de forma suave e sem travar o app
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
// MANUTENÇÃO FUTURA: Biblioteca essencial para desenhar linhas, círculos e gráficos (vetores) na tela
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface SpeedometerProps {
  speed: number;
  maxSpeed?: number;
  isActive: boolean;
}

export function Speedometer({ speed, maxSpeed = 240, isActive }: SpeedometerProps) {
  // Valores animados: controlam o brilho e o "zoom" (escala) do velocímetro ao conectar
  const glowOpacity = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);

  // Efeito disparado sempre que o status de conexão (isActive) muda
  useEffect(() => {
    if (isActive) {
      // Faz o velocímetro "pular" para o tamanho normal
      scaleAnim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.2)) });
      // Cria um efeito de "pulso" contínuo no anel de brilho
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0.5, { duration: 1200 })
        ),
        -1, // -1 significa repetição infinita
        true
      );
    } else {
      // Quando desconecta, o velocímetro encolhe e apaga o brilho
      scaleAnim.value = withTiming(0.8, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  // Estilos dinâmicos que aplicam as animações acima
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: scaleAnim.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ==========================================
  // MATEMÁTICA DO DESENHO (SVG)
  // ==========================================
  const size = 220; // Tamanho total do quadrado do SVG
  const cx = size / 2; // Centro X
  const cy = size / 2; // Centro Y
  const radius = 90; // Raio do velocímetro
  const strokeWidth = 10; // Grossura da linha

  // O arco vai de -210 graus até 30 graus (deixando um buraco na parte de baixo)
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;
  // Calcula onde o ponteiro deve estar baseado na velocidade atual
  const speedAngle = startAngle + (speed / maxSpeed) * totalAngle;

  // Função auxiliar: Converte ângulos (graus) para coordenadas X e Y na tela
  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Função auxiliar: Cria o texto de comando do SVG para desenhar um arco
  function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const s = polarToCartesian(cx, cy, r, startDeg);
    const e = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  // Desenha as linhas do velocímetro
  const bgArc = arcPath(cx, cy, radius, startAngle, endAngle);
  const speedArc = speed > 0 ? arcPath(cx, cy, radius, startAngle, speedAngle) : null;

  // Coordenadas para desenhar o triângulo do ponteiro
  const needleTip = polarToCartesian(cx, cy, radius - 15, speedAngle);
  const needleBase1 = polarToCartesian(cx, cy, 12, speedAngle + 90);
  const needleBase2 = polarToCartesian(cx, cy, 12, speedAngle - 90);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Efeito de brilho externo */}
      <Animated.View style={[styles.glowRing, glowStyle]} />

      {/* Início do desenho vetorial */}
      <Svg width={size} height={size}>
        <Defs>
          {/* Degrau de cor (Azul escuro para azul claro) usado na barra de velocidade */}
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#0090D4" />
            <Stop offset="100%" stopColor="#00D4FF" />
          </LinearGradient>
        </Defs>

        {/* Arco de fundo (a trilha apagada) */}
        <Path
          d={bgArc}
          fill="none"
          stroke="#1E2235"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Arco da velocidade atual (colorido) */}
        {speedArc && (
          <Path
            d={speedArc}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Anel fino mais externo */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius + strokeWidth / 2 + 4}
          fill="none"
          stroke="#1E2235"
          strokeWidth={1}
        />

        {/* Ponteiro (Agulha) */}
        <Path
          d={`M ${needleBase1.x} ${needleBase1.y} L ${needleTip.x} ${needleTip.y} L ${needleBase2.x} ${needleBase2.y} Z`}
          fill="#00B4FF"
          opacity={0.9}
        />

        {/* Bolinhas no centro do ponteiro para acabamento visual */}
        <Circle cx={cx} cy={cy} r={10} fill="#00B4FF" />
        <Circle cx={cx} cy={cy} r={5} fill="#0A0A0F" />
      </Svg>

      {/* Texto digital da velocidade (Fica sobreposto ao centro do velocímetro) */}
      <View style={styles.digitalDisplay}>
        <Text style={styles.speedNumber}>{speed}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glowRing: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2,
    borderColor: "#00B4FF",
    shadowColor: "#00B4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  digitalDisplay: {
    position: "absolute",
    alignItems: "center",
    bottom: 48,
  },
  speedNumber: {
    fontSize: 52,
    fontWeight: "700",
    color: "#00FF88",
    fontVariant: ["tabular-nums"], // Mantém os números com a mesma largura
    letterSpacing: 2,
    textShadowColor: "#00FF88",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  speedUnit: {
    fontSize: 13,
    color: "#8892A4",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: -4,
  },
});