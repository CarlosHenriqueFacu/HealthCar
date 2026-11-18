import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../contexts/AppContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TermsModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function TermsModal({ visible, onAccept, onDecline }: TermsModalProps) {
  const { theme, t } = useApp();

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
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#00B4FF11' : '#E0F2FE' }]}>
              <MaterialIcons name="gavel" size={24} color="#00B4FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: textColor }]}>{t('termosTitulo')}</Text>
              <Text style={[styles.subtitle, { color: subTextColor }]}>{t('termosSubtitulo')}</Text>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('termosSecao1Titulo')}</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>{t('termosSecao1Texto')}</Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('termosSecao2Titulo')}</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>{t('termosSecao2Texto')}</Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('termosSecao3Titulo')}</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>{t('termosSecao3Texto')}</Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('termosSecao4Titulo')}</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>{t('termosSecao4Texto')}</Text>

            <Text style={[styles.sectionTitle, { color: textColor }]}>{t('termosSecao5Titulo')}</Text>
            <Text style={[styles.paragraph, { color: subTextColor }]}>{t('termosSecao5Texto')}</Text>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <Pressable style={[styles.btnDecline, { borderColor }]} onPress={onDecline}>
              <Text style={[styles.btnDeclineText, { color: subTextColor }]}>{t('naoAceito')}</Text>
            </Pressable>

            <Pressable style={styles.btnAccept} onPress={onAccept}>
              <Text style={styles.btnAcceptText}>{t('liEAceito')}</Text>
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