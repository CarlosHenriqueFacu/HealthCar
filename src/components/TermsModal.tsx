import React from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext'; // Ajuste o caminho se necessário

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TermsModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function TermsModal({ visible, onAccept, onDecline }: TermsModalProps) {
  const { theme } = useApp();
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'rgba(10, 10, 15, 0.85)' : 'rgba(15, 23, 42, 0.7)';
  const cardColor = isDark ? '#12141A' : '#FFFFFF';
  const textColor = isDark ? '#F0F2FF' : '#0F172A';
  const subTextColor = isDark ? '#8892A4' : '#64748B';
  const borderColor = isDark ? '#1E2235' : '#E2E8F0';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={[styles.overlay, { backgroundColor: bgColor }]}>
        <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
          
          {/* HEADER DO MODAL */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#00B4FF11' : '#E0F2FE' }]}>
              <MaterialIcons name="gavel" size={24} color="#00B4FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textColor }]}>Termos de Uso</Text>
              <Text style={[styles.subtitle, { color: subTextColor }]}>Política de Privacidade HealthCar</Text>
            </View>
          </View>

          {/* TEXTO DO TERMO (SCROLL) */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>1. Proposta do Aplicativo</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>
              O HealthCar é uma ferramenta de gestão veicular e telemetria. Ele permite o acompanhamento de manutenções, abastecimentos e a leitura de dados do veículo em tempo real através de um adaptador Bluetooth OBD-II.
            </Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>2. Coleta e Privacidade (Offline-First)</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>
              Seus dados de telemetria, histórico de gastos e informações do veículo são gravados primeiramente de forma local no seu dispositivo para garantir funcionamento sem internet e, posteriormente, sincronizados de forma criptografada com nossos servidores em nuvem, vinculados unicamente à sua conta.
            </Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>3. Permissões de Hardware</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>
              Para entregar a experiência completa, solicitaremos permissões de Bluetooth (para buscar o scanner OBD2) e Execução em Segundo Plano, garantindo a leitura contínua dos dados apenas enquanto o veículo estiver em uso.
            </Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>4. Segurança no Trânsito</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>
              Sua segurança é prioridade. Nunca manuseie o aplicativo enquanto estiver dirigindo. A interface foi projetada para atuar de forma autônoma após a partida do motor.
            </Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>5. Isenção de Responsabilidade</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>
              O recurso de diagnóstico de falhas (Scanner) tem caráter puramente informativo e não substitui a avaliação de um mecânico qualificado.
            </Text>
          </ScrollView>

          {/* BOTÕES DE AÇÃO */}
          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <Pressable style={[styles.btnDecline, { borderColor }]} onPress={onDecline}>
              <Text style={[styles.btnDeclineText, { color: subTextColor }]}>Não aceito</Text>
            </Pressable>
            
            <Pressable style={styles.btnAccept} onPress={onAccept}>
              <Text style={styles.btnAcceptText}>Li e Aceito</Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  container: { height: SCREEN_HEIGHT * 0.85, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderBottomWidth: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  paragraph: { fontSize: 13, lineHeight: 22, textAlign: 'justify' },
  footer: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
  btnDecline: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnDeclineText: { fontWeight: '700', fontSize: 14 },
  btnAccept: { flex: 1.5, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#00B4FF' },
  btnAcceptText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});