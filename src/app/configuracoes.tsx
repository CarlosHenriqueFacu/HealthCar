import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// Biblioteca para salvar dados na memória do aparelho (Banco de dados Local)
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ==========================================================
   MANUTENÇÃO FUTURA: PROTOCOLOS OBD-II
   Estes são os protocolos de comunicação padrão de mercado.
   O ELM327 geralmente descobre isso no modo "Auto", mas 
   deixamos as opções caso o carro force um padrão específico.
========================================================== */
const OBD2_PROTOCOLS = ["Auto", "ISO 9141-2", "KWP2000", "CAN 11-bit", "CAN 29-bit"];

export default function SettingsScreen() {
  const [brand, setBrand] = useState("Chevrolet");
  const [model, setModel] = useState("Camaro SS");
  const [year, setYear] = useState("2023");
  const [color, setColor] = useState("Preto");
  const [engine, setEngine] = useState("V8 6.2L");
  const [protocol, setProtocol] = useState("Auto");
  const [saved, setSaved] = useState(false);

  /* ==========================================================
     CARREGAMENTO INICIAL DOS DADOS
     Assim que a tela abre, este bloco procura na memória do 
     celular se o usuário já havia salvo alguma configuração antes.
  ========================================================== */
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedData = await AsyncStorage.getItem("@camaro_vehicle");
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setBrand(parsed.brand || "Chevrolet");
          setModel(parsed.model || "Camaro SS");
          setYear(parsed.year || "2023");
          setColor(parsed.color || "Preto");
          setEngine(parsed.engine || "V8 6.2L");
          setProtocol(parsed.protocol || "Auto");
        }
      } catch (error) {
        console.log("Erro ao carregar configurações salvas");
      }
    }
    loadSettings();
  }, []);

  /* ==========================================================
     SALVAR DADOS
     Converte os dados da tela em um texto (JSON) e guarda
     na chave "@camaro_vehicle" da memória local do aparelho.
  ========================================================== */
  async function handleSave() {
    try {
      await AsyncStorage.setItem(
        "@camaro_vehicle",
        JSON.stringify({ brand, model, year, color, engine, protocol })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar as configurações.");
    }
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      {/* ================= CABEÇALHO SUPERIOR ================= */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#F0F2FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Configurar Veículo</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= DADOS DO VEÍCULO ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="directions-car" size={18} color="#00B4FF" />
            <Text style={styles.sectionTitle}>Dados do Veículo</Text>
          </View>

          <View style={styles.fieldGroup}>
            <InputField label="Marca" value={brand} onChangeText={setBrand} placeholder="Ex: Chevrolet" />
            <InputField label="Modelo" value={model} onChangeText={setModel} placeholder="Ex: Camaro SS" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <InputField label="Ano" value={year} onChangeText={setYear} placeholder="Ex: 2023" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <InputField label="Cor" value={color} onChangeText={setColor} placeholder="Ex: Preto" />
              </View>
            </View>
            <InputField label="Motor" value={engine} onChangeText={setEngine} placeholder="Ex: V8 6.2L" />
          </View>
        </View>

        {/* ================= CONFIGURAÇÕES OBD-II ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="settings-input-component" size={18} color="#00B4FF" />
            <Text style={styles.sectionTitle}>Configurações OBD2</Text>
          </View>

          <Text style={styles.fieldLabel}>Protocolo de Comunicação</Text>
          <View style={styles.protocolGrid}>
            {OBD2_PROTOCOLS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setProtocol(p)}
                style={[
                  styles.protocolChip,
                  protocol === p && styles.protocolChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.protocolChipText,
                    protocol === p && styles.protocolChipTextActive,
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="bluetooth" size={16} color="#00B4FF" />
            <Text style={styles.infoText}>Bluetooth OBD2 · ELM327</Text>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>Conectado</Text>
            </View>
          </View>
        </View>

        {/* ================= BOTÃO SALVAR ================= */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            saved && styles.saveBtnSuccess,
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialIcons
            name={saved ? "check" : "save"}
            size={20}
            color={saved ? "#0A0A0F" : "#0A0A0F"}
          />
          <Text style={styles.saveBtnText}>
            {saved ? "Salvo com sucesso!" : "Salvar Configurações"}
          </Text>
        </Pressable>

        {/* ================= INFO DO APLICATIVO ================= */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Camaro Monitor v1.0</Text>
          <Text style={styles.appInfoSub}>OBD2 Vehicle Telemetry</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

/* ==========================================================
   COMPONENTE AUXILIAR: INPUT FIELD
   Gera as caixinhas de texto padronizadas para não repetir
   código de CSS em todos os campos.
========================================================== */
function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8892A4"
        keyboardType={keyboardType}
        style={inputStyles.input}
        returnKeyType="done"
      />
    </View>
  );
}

// ================= ESTILOS (CSS in JS) =================
const inputStyles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 11, color: "#8892A4", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#0A0A0F",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E2235",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#F0F2FF",
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2235",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#F0F2FF",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  section: {
    backgroundColor: "#12141A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2235",
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F0F2FF",
  },
  fieldGroup: { gap: 12 },
  row: { flexDirection: "row", gap: 10 },

  fieldLabel: {
    fontSize: 11,
    color: "#8892A4",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  protocolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  protocolChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2235",
    backgroundColor: "#0A0A0F",
  },
  protocolChipActive: {
    borderColor: "#00B4FF",
    backgroundColor: "#00B4FF22",
  },
  protocolChipText: {
    fontSize: 12,
    color: "#8892A4",
  },
  protocolChipTextActive: {
    color: "#00B4FF",
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A0A0F",
    borderRadius: 10,
    padding: 12,
  },
  infoText: { flex: 1, fontSize: 13, color: "#8892A4" },
  connectedBadge: {
    backgroundColor: "#00E67622",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  connectedText: { fontSize: 10, color: "#00E676", fontWeight: "600" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00B4FF",
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnSuccess: {
    backgroundColor: "#00E676",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A0A0F",
  },

  appInfo: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
  },
  appInfoText: { fontSize: 12, color: "#8892A4" },
  appInfoSub: { fontSize: 10, color: "#1E2235" },
});