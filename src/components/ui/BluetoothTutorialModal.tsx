import { MaterialIcons } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

interface BluetoothTutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BluetoothTutorialModal({ visible, onClose }: BluetoothTutorialModalProps) {
  
  // Função que joga o usuário direto para a tela de Bluetooth do Android
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

          <Text style={styles.title}>Conecte seu Scanner</Text>
          
          <Text style={styles.description}>
            Para que o HealthCar funcione, você precisa parear o scanner OBD-II nas configurações do seu celular.
          </Text>

          <View style={styles.stepsContainer}>
            <Text style={styles.stepText}>1. Conecte o scanner na porta do carro.</Text>
            <Text style={styles.stepText}>2. Ligue a meia-chave (painel do carro).</Text>
            <Text style={styles.stepText}>3. Vá no Bluetooth e busque pelo dispositivo (geralmente "OBDII").</Text>
            <Text style={styles.stepText}>
              4. A senha padrão é <Text style={styles.highlight}>1234</Text> ou <Text style={styles.highlight}>0000</Text>.
            </Text>
          </View>

          <Pressable 
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
            onPress={openBluetoothSettings}
          >
            <Text style={styles.primaryButtonText}>Abrir Configurações de Bluetooth</Text>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
            onPress={onClose}
          >
            <Text style={styles.secondaryButtonText}>Já estou conectado</Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 15, 0.85)", // Fundo escuro transparente
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "#1E2235",
    elevation: 10, // Sombra no Android
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#8892A4",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  stepsContainer: {
    backgroundColor: "#1A1D27",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  stepText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  highlight: {
    color: "#00FF88",
    fontWeight: "bold",
  },
  primaryButton: {
    backgroundColor: "#00B4FF",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
    textTransform: "uppercase",
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#8892A4",
  },
  secondaryButtonText: {
    color: "#8892A4",
    fontWeight: "bold",
    fontSize: 14,
  },
});