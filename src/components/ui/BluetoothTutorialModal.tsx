import { MaterialIcons } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "../../contexts/AppContext";

interface BluetoothTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BluetoothTutorialModal({ visible, onClose }: BluetoothTutorialModalProps) {
  const { t } = useApp();

  const openBluetoothSettings = async () => {
    if (Platform.OS === "android") {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS
      );
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="bluetooth-drive" size={48} color="#00B4FF" />
          </View>

          <Text style={styles.title}>{t('btModalTitulo')}</Text>

          <Text style={styles.description}>
            {t('btModalDesc')}
          </Text>

          <View style={styles.stepsContainer}>
            <Text style={styles.stepText}>{t('btPasso1')}</Text>
            <Text style={styles.stepText}>{t('btPasso2')}</Text>
            <Text style={styles.stepText}>{t('btPasso3')}</Text>
            <Text style={styles.stepText}>
              {t('btPasso4Inicio')}
              <Text style={styles.highlight}>1234</Text>
              {t('btPasso4Ou')}
              <Text style={styles.highlight}>0000</Text>.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
            onPress={openBluetoothSettings}
          >
            <Text style={styles.primaryButtonText}>{t('btAbrirConfig')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
            onPress={onClose}
          >
            <Text style={styles.secondaryButtonText}>{t('btJaConectado')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(10, 10, 15, 0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { backgroundColor: "#12141A", borderRadius: 16, padding: 24, width: "100%", borderWidth: 1, borderColor: "#1E2235", elevation: 10 },
  iconContainer: { alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", marginBottom: 12 },
  description: { fontSize: 14, color: "#8892A4", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  stepsContainer: { backgroundColor: "#1A1D27", padding: 16, borderRadius: 12, marginBottom: 24, gap: 10 },
  stepText: { color: "#D1D5DB", fontSize: 14 },
  highlight: { color: "#00FF88", fontWeight: "bold" },
  primaryButton: { backgroundColor: "#00B4FF", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginBottom: 12 },
  primaryButtonText: { color: "#000", fontWeight: "bold", fontSize: 14, textTransform: "uppercase" },
  secondaryButton: { paddingVertical: 12, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#8892A4" },
  secondaryButtonText: { color: "#8892A4", fontWeight: "bold", fontSize: 14 },
});