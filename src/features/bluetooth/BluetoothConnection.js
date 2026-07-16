import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, PermissionsAndroid, Platform, StyleSheet } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

export default function BluetoothConnection() {
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  // Passo 1: Solicitar permissões do Android
  const requestAccess = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ]);
    }
  };

  // Passo 2: Listar dispositivos pareados
  const getPairedDevices = async () => {
    try {
      addLog("Buscando dispositivos pareados...");
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired);
    } catch (err) {
      addLog(`Erro ao buscar dispositivos: ${err.message}`);
    }
  };

  useEffect(() => {
    requestAccess().then(getPairedDevices);
  }, []);

  // Passo 3: Conectar e fazer o Handshake (ATZ, ATE0, etc.)
  const connectToDevice = async (device) => {
    try {
      addLog(`Conectando a ${device.name}...`);
      const connection = await device.connect();
      
      if (connection) {
        setConnectedDevice(device);
        addLog("Conectado! Iniciando Handshake...");

        // O ELM327 exige um "Carriage Return" (\r) no final de cada comando
        await sendCommand(device, "ATZ\r", "Resetando (ATZ)");
        await delay(1000); // Aguarda o ELM reiniciar
        
        await sendCommand(device, "ATE0\r", "Desativando Eco (ATE0)");
        await sendCommand(device, "ATL0\r", "Desativando Linefeeds (ATL0)");
        await sendCommand(device, "ATSP 0\r", "Protocolo Automático (ATSP 0)");
        
        addLog("✅ Handshake concluído com sucesso!");
      }
    } catch (error) {
      addLog(`Falha na conexão: ${error.message}`);
    }
  };

  const sendCommand = async (device, command, logMsg) => {
    addLog(`Enviando: ${logMsg}`);
    await device.write(command);
    const response = await device.read();
    addLog(`Resposta: ${response.trim()}`);
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conexão ELM327</Text>
      
      {connectedDevice ? (
        <Text style={styles.success}>Conectado: {connectedDevice.name}</Text>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.address}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.button} onPress={() => connectToDevice(item)}>
              <Text style={styles.buttonText}>{item.name} ({item.address})</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={styles.subtitle}>Logs do Sistema:</Text>
      <FlatList
        data={logs}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#1E1E1E', borderRadius: 10 },
  title: { fontSize: 24, color: '#00BFFF', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  subtitle: { fontSize: 18, color: '#FFF', marginTop: 20, marginBottom: 10 },
  button: { backgroundColor: '#2D2D2D', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  buttonText: { color: '#FFF', fontSize: 16, textAlign: 'center' },
  success: { color: '#4CAF50', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  logText: { color: '#AAAAAA', fontSize: 12, fontFamily: 'monospace', marginBottom: 4 }
});