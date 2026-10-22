import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { ScreenContainer } from "../../components/screen-container";
import { useApp } from "../../contexts/AppContext";

// IMPORTAÇÃO DA CAMADA DE PERSISTÊNCIA (SQLite)
import { obterDadosGrafico, obterHistoricoAbastecimento, obterResumoSessoes, salvarAbastecimentoLocal } from "../../database/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * @interface RefillData
 * @description Estrutura agregada combinando o consumo de combustível e os eventos de abastecimento.
 */
interface RefillData {
  dataString: string;
  litros: number;
  custo: number;
  kmOcasiao: number;
}

/**
 * @component FuelDetailsScreen
 * @description Interface analítica de eficiência energética e logística de combustível.
 * Extrai o nível instantâneo da telemetria (PID 012F) e constrói um histórico
 * de gastos baseado na tabela relacional 'abastecimento_local'.
 */
export default function FuelDetailsScreen() {
  const { theme, t } = useApp();
  
  // --- ESTADOS DA INTERFACE ---
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [abastecimentos, setAbastecimentos] = useState<RefillData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Paleta corporativa
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0A0A0F' : '#F1F5F9';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const primaryColor = "#FFC107"; // Amarelo (Eficiência)
  const dangerColor = "#FF3D57";

  /**
   * @effect Pipeline de Agregação Mista (Telemetria + CRUD Relacional)
   * @description Puxa o nível instantâneo da ECU e cruza com a tabela de abastecimento manual.
   */
  async function carregarDadosCombustivel() {
    setIsLoading(true);
    try {
      // 1. Extração do Nível Atual (Telemetria)
      const sessoes = await obterResumoSessoes();
      if (sessoes && sessoes.length > 0) {
        const sessaoAtiva: any = sessoes[0];
        const leiturasCombustivel: any = await obterDadosGrafico(sessaoAtiva.id, "012F");
        if (leiturasCombustivel && leiturasCombustivel.length > 0) {
          setCurrentLevel(leiturasCombustivel[leiturasCombustivel.length - 1].valor);
        }
      }

      // 2. Extração do Histórico de Abastecimento (Tabela CRUD)
      const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
      if (veiculoCadastrado) {
        const veiculo = JSON.parse(veiculoCadastrado);
        const historico: any = await obterHistoricoAbastecimento(veiculo.id);
        
        if (historico && historico.length > 0) {
          const processado = historico.map((h: any) => {
            const dataObj = new Date(h.dataAbastecimento);
            return {
              dataString: `${dataObj.getDate()}/${(dataObj.getMonth()+1).toString().padStart(2, '0')}`,
              litros: h.litros,
              custo: h.custoTotal,
              kmOcasiao: h.kmNaOcasiao
            };
          });
          // O gráfico usa ordem cronológica (mais antigo para mais recente)
          setAbastecimentos(processado.reverse());
        } else {
          setAbastecimentos([]);
        }
      }
    } catch (error) {
      console.log("[Data Error] Falha ao extrair analítica de combustível:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    carregarDadosCombustivel();
  }, []);

  /**
   * @method injectTestData
   * @description Função de utilidade (apenas para ambiente de desenvolvimento) 
   * que injeta logs fictícios na tabela 'abastecimento_local' para validar a renderização do SVG.
   */
  async function injectTestData() {
    try {
      const veiculoCadastrado = await AsyncStorage.getItem('@veiculo_cadastrado');
      if (veiculoCadastrado) {
        const veiculo = JSON.parse(veiculoCadastrado);
        
        // Injeta 3 abastecimentos simulados em datas diferentes (Timestamp)
        await salvarAbastecimentoLocal(veiculo.id, 45, 250.50, 42100);
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay para timestamp diferente
        await salvarAbastecimentoLocal(veiculo.id, 32, 180.00, 42550);
        await new Promise(resolve => setTimeout(resolve, 100));
        await salvarAbastecimentoLocal(veiculo.id, 40, 220.00, 43100);

        console.log("Dados de teste injetados com sucesso!");
        await carregarDadosCombustivel(); // Recarrega o gráfico na hora
      }
    } catch (error) {
      console.log("Erro ao injetar dados:", error);
    }
  }

  // --- ESTATÍSTICAS E MATEMÁTICA ---
  const autonomiaEstimada = Math.round((currentLevel / 100) * 600); // Exemplo: Tanque cheio = 600km
  
  // Variáveis do Gráfico de Abastecimentos (Litros colocados por data)
  const dataToRender = abastecimentos.length > 0 ? abastecimentos : [{ dataString: "--", litros: 0, custo: 0, kmOcasiao: 0 }];
  const maxLitros = Math.max(...dataToRender.map((d) => d.litros));
  const safeMax = maxLitros > 0 ? maxLitros : 1; // Previne divisão por zero
  const totalLitrosMes = abastecimentos.reduce((sum, d) => sum + d.litros, 0);

  // --- GEOMETRIA DO GRÁFICO ---
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 180;
  const numBars = dataToRender.length > 0 ? dataToRender.length : 1;
  const barWidth = (chartWidth - 40) / numBars;

  return (
    <ScreenContainer containerClassName="" style={{ backgroundColor: bgColor }} edges={["top", "left", "right"]}>
      
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>{t('combustivel')}</Text>
        
        {/* BOTÃO DE INJEÇÃO DE DADOS (Exclusivo para Testes) */}
        <Pressable onPress={injectTestData} style={styles.testBtn}>
           <MaterialIcons name="science" size={20} color="#00B4FF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ================= INDICADOR DE NÍVEL EM TEMPO REAL ================= */}
        <View style={[styles.statusCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.statusLeft}>
            <MaterialIcons name="local-gas-station" size={32} color={currentLevel < 15 ? dangerColor : primaryColor} />
            <View>
              <Text style={[styles.statusLabel, { color: subTextColor }]}>{t('nivelAtual')}</Text>
              <Text style={[styles.statusValue, { color: currentLevel < 15 ? dangerColor : primaryColor }]}>
                {isLoading ? "--" : currentLevel}%
              </Text>
            </View>
          </View>
          <View style={styles.statusRight}>
            <Text style={[styles.statusRange, { color: currentLevel < 15 ? dangerColor : primaryColor }]}>
              ~{isLoading ? "--" : autonomiaEstimada} km
            </Text>
            <Text style={[styles.statusRangeLabel, { color: subTextColor }]}>{t('deAutonomia')}</Text>
          </View>
        </View>

        {/* ================= VOLUMETRIA FINANCEIRA ================= */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>Abastecido</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>{isLoading ? "-" : totalLitrosMes.toFixed(1)}L</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <Text style={[styles.statLabel, { color: subTextColor }]}>Gasto (R$)</Text>
            <Text style={[styles.statValue, { color: primaryColor }]}>
              {isLoading ? "-" : abastecimentos.reduce((s, d) => s + d.custo, 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ================= MOTOR GRÁFICO (SVG) - VOLUME DE ABASTECIMENTO ================= */}
        <View style={[styles.chartContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.chartTitle, { color: textColor }]}>Volume Abastecido</Text>
          
          {isLoading ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : abastecimentos.length === 0 ? (
            <View style={[styles.emptyChart, { height: chartHeight }]}>
              <MaterialIcons name="local-gas-station" size={48} color={borderColor} />
              <Text style={[styles.emptyChartText, { color: subTextColor, marginTop: 12 }]}>Nenhum registro de abastecimento.</Text>
            </View>
          ) : (
            <>
              <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
                <Defs>
                  <LinearGradient id="fuelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {[0, 25, 50, 75, 100].map((percent) => (
                  <Line
                    key={`grid-${percent}`}
                    x1={20}
                    y1={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                    x2={chartWidth - 20}
                    y2={chartHeight - 30 - (percent / 100) * (chartHeight - 60)}
                    stroke={borderColor}
                    strokeWidth={1}
                    opacity={isDark ? 0.3 : 1}
                  />
                ))}

                {dataToRender.map((data, i) => {
                  const barHeight = (data.litros / safeMax) * (chartHeight - 60);
                  const x = 20 + i * barWidth + barWidth * 0.1;
                  const y = chartHeight - 30 - barHeight;
                  
                  return (
                    <Rect
                      key={`bar-${i}`}
                      x={x}
                      y={y}
                      width={barWidth * 0.8}
                      height={barHeight}
                      fill={primaryColor}
                      opacity={selectedDay === i ? 1 : (isDark ? 0.6 : 0.8)}
                      rx={4}
                    />
                  );
                })}
              </Svg>

              <View style={styles.dayLabels}>
                {dataToRender.map((data, i) => (
                  <Text key={`day-${i}`} style={[styles.dayLabel, { color: subTextColor }]}>
                    {data.dataString}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ================= DATAGRID: HISTÓRICO RELACIONAL ================= */}
        <View style={[styles.breakdownContainer, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <Text style={[styles.breakdownTitle, { color: textColor }]}>Logs de Abastecimento</Text>
          
          {isLoading || abastecimentos.length === 0 ? (
            <Text style={{ color: subTextColor, textAlign: 'center', padding: 20 }}>Registe abastecimentos para ver histórico.</Text>
          ) : (
            abastecimentos.slice().reverse().map((data, i) => (
              <View key={`log-${i}`} style={[styles.refillItem, { borderBottomColor: borderColor }]}>
                <MaterialIcons name="local-gas-station" size={24} color="#4CAF50" />
                <View style={styles.refillContent}>
                  <Text style={[styles.refillDay, { color: textColor }]}>{data.dataString}</Text>
                  <Text style={[styles.refillTime, { color: subTextColor }]}>KM do Painel: {data.kmOcasiao.toLocaleString()} km</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                   <Text style={{ color: primaryColor, fontWeight: "700" }}>{data.litros.toFixed(1)} L</Text>
                   <Text style={{ color: subTextColor, fontSize: 10 }}>R$ {data.custo.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 40 },
  testBtn: { padding: 8, backgroundColor: '#00B4FF22', borderRadius: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  
  statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 16, borderWidth: 1 },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusLabel: { fontSize: 12 },
  statusValue: { fontSize: 24, fontWeight: "700", marginTop: 2 },
  statusRight: { alignItems: "flex-end" },
  statusRange: { fontSize: 16, fontWeight: "700" },
  statusRangeLabel: { fontSize: 10, marginTop: 2 },
  
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center" },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "700" },
  
  chartContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  chart: { marginBottom: 8 },
  emptyChart: { justifyContent: "center", alignItems: "center", width: "100%" },
  emptyChartText: { fontSize: 13, fontWeight: "500" },
  
  dayLabels: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20 },
  dayLabel: { fontSize: 10, fontWeight: "600" },
  
  breakdownContainer: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  refillItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  refillContent: { flex: 1 },
  refillDay: { fontSize: 14, fontWeight: "700" },
  refillTime: { fontSize: 11, marginTop: 2 },
});