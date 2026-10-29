import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { obterDadosGrafico, obterResumoSessoes } from '../database/database';

interface FuelChartProps {
  onPress?: () => void;
}

const CAPACIDADE_TANQUE_LITROS = 50; 

export function FuelChart({ onPress }: FuelChartProps) {
  const { theme, t } = useApp();
  const { user } = useAuth();
  
  const [chartData, setChartData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === 'dark';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const trackColor = isDark ? '#1E2235' : '#CBD5E1';

  const processarConsumoReal = async () => {
    try {
      if (!user?.uid) return;
      const sessoes = await obterResumoSessoes(user.uid);
      
      const defaultLabels = [t('dom'), t('seg'), t('ter'), t('qua'), t('qui'), t('sex'), t('sab')];
      
      if (!sessoes || sessoes.length === 0) {
        setChartLabels(defaultLabels.map(l => l.substring(0,3)));
        setIsLoading(false);
        return;
      }

      const agora = Date.now();
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      const limiteSeteDias = agora - seteDiasMs;
      
      const sessoesValidas = sessoes.filter((s: any) => s.inicio >= limiteSeteDias);
      const mapaDias: { [key: number]: { distMeters: number, fuelDroppedPerc: number } } = {};

      for (const sessao of sessoesValidas) {
        const diaIndex = new Date(sessao.inicio).getDay(); // 0 a 6
        
        const leiturasCombustivel: any = await obterDadosGrafico(user.uid, sessao.id, "012F");
        
        let variacaoCombustivel = 0;
        if (leiturasCombustivel && leiturasCombustivel.length >= 2) {
          const combustivelInicio = leiturasCombustivel[0].valor;
          const combustivelFim = leiturasCombustivel[leiturasCombustivel.length - 1].valor;
          if (combustivelInicio > combustivelFim) {
              variacaoCombustivel = combustivelInicio - combustivelFim;
          }
        }

        const distanciaSessaoMeters = sessao.distanciaPercorrida || 0;

        if (!mapaDias[diaIndex]) {
            mapaDias[diaIndex] = { distMeters: 0, fuelDroppedPerc: 0 };
        }
        
        mapaDias[diaIndex].distMeters += distanciaSessaoMeters;
        mapaDias[diaIndex].fuelDroppedPerc += variacaoCombustivel;
      }

      const dataArray = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 7; i++) {
          if (mapaDias[i] && mapaDias[i].distMeters > 0 && mapaDias[i].fuelDroppedPerc > 0) {
              const litrosConsumidos = (mapaDias[i].fuelDroppedPerc / 100) * CAPACIDADE_TANQUE_LITROS;
              dataArray[i] = parseFloat(litrosConsumidos.toFixed(1));
          }
      }

      // Reorganiza o array para que o dia atual fique na última posição do gráfico (à direita)
      const hojeIndex = new Date().getDay();
      const orderedData = [];
      const orderedLabels = [];
      
      for (let i = 1; i <= 7; i++) {
         const targetIndex = (hojeIndex + i) % 7;
         orderedData.push(dataArray[targetIndex]);
         orderedLabels.push(defaultLabels[targetIndex].substring(0, 3));
      }

      setChartData(orderedData);
      setChartLabels(orderedLabels);
      
    } catch (error) {
      console.log("[FuelChart Error]", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      processarConsumoReal();
    }, [user?.uid])
  );

  const maxVal = Math.max(...chartData, 1); // Evita divisão por zero
  const isAllZero = chartData.every(val => val === 0);

  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: cardColor, borderColor: borderColor },
        pressed && { opacity: 0.8 } 
      ]}
    >
      <Text style={[styles.title, { color: textColor }]}>{t('consumoSemanal')}</Text>
      <Text style={[styles.subtitle, { color: subTextColor }]}>{t('litrosPorDia')}</Text>

      {isLoading ? (
         <View style={[styles.chartArea, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color="#00B4FF" />
         </View>
      ) : isAllZero ? (
         <View style={[styles.chartArea, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: subTextColor, fontSize: 11 }}>Sem dados registados nesta semana.</Text>
         </View>
      ) : (
        <View style={styles.chartArea}>
          {chartData.map((val, i) => {
            const heightPct = (val / maxVal) * 100;
            const isMax = val === maxVal && val > 0;
            
            return (
              <View key={i} style={styles.barWrapper}>
                <Text style={[styles.barValue, { color: subTextColor }, isMax && styles.barValueMax]}>
                  {val > 0 ? `${val}L` : ''}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPct}%` as any },
                      isMax && styles.barFillMax,
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: subTextColor }]}>{chartLabels[i]}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 6,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barValue: {
    fontSize: 9,
    marginBottom: 4,
  },
  barValueMax: {
    color: "#00B4FF",
    fontWeight: "700",
  },
  barTrack: {
    width: "100%",
    height: 70,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#0090D4",
    borderRadius: 4,
    minHeight: 4,
  },
  barFillMax: {
    backgroundColor: "#00B4FF",
    shadowColor: "#00B4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
    textTransform: 'capitalize'
  },
});