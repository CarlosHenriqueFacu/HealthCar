package com.anonymous.HealthCar_TCC;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

public class OBDBluetoothModule extends ReactContextBaseJavaModule {

    private BluetoothSocket socket;
    private InputStream inputStream;
    private OutputStream outputStream;
    // UUID padrão Universal para portas seriais (SPP) no Bluetooth
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    public OBDBluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "OBDBluetooth";
    }

    @ReactMethod
    public void connect(String macAddress, Promise promise) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                promise.reject("ERR", "Bluetooth não suportado neste dispositivo");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(macAddress);
            adapter.cancelDiscovery(); // OBRIGATÓRIO cancelar a busca antes de conectar

            int maxRetries = 5; // O app vai insistir 5 vezes automaticamente
            int attempt = 0;
            boolean connected = false;
            Exception lastException = null;

            // O LOOP DE INSISTÊNCIA (Ideia do Carlos)
            while (attempt < maxRetries && !connected) {
                try {
                    attempt++;
                    socket = device.createInsecureRfcommSocketToServiceRecord(MY_UUID);
                    socket.connect();
                    connected = true; // Se chegou aqui sem dar erro, conectou!
                } catch (Exception e) {
                    lastException = e;
                    // Se falhou, fecha a porta quebrada para limpar a memória
                    if (socket != null) {
                        try { socket.close(); } catch (Exception ignored) {}
                    }
                    // Espera meio segundo (500ms) antes de tentar bater na porta de novo
                    Thread.sleep(500); 
                }
            }

            // Verifica o resultado após as tentativas
            if (connected) {
                inputStream = socket.getInputStream();
                outputStream = socket.getOutputStream();
                promise.resolve("Conectado com sucesso na tentativa " + attempt + "!");
            } else {
                // Se tentou 5 vezes e não foi, avisa a tela do aplicativo
                promise.reject("ERR_CONNECTION", "Falha após " + maxRetries + " tentativas. Último erro: " + lastException.getMessage());
            }

        } catch (Exception e) {
            promise.reject("ERR_CONNECTION", "Falha crítica: " + e.getMessage());
        }
    }

    @ReactMethod
    public void sendCommand(String command, Promise promise) {
        if (socket == null || !socket.isConnected() || inputStream == null || outputStream == null) {
            promise.reject("ERR", "Scanner não está conectado");
            return;
        }

        try {
            // 1. Limpa o lixo de leituras anteriores do buffer
            while (inputStream.available() > 0) {
                inputStream.read();
            }

            // 2. Envia o comando com o Retorno de Carro (\r) obrigatório
            String fullCommand = command + "\r";
            outputStream.write(fullCommand.getBytes());
            outputStream.flush();

            StringBuilder response = new StringBuilder();
            long startTime = System.currentTimeMillis();
            long timeout = 2000; // 2 segundos cravados

            byte[] buffer = new byte[1024];

            // 3. Loop de leitura 
            while ((System.currentTimeMillis() - startTime) < timeout) {
                if (inputStream.available() > 0) {
                    int bytesRead = inputStream.read(buffer);
                    String chunk = new String(buffer, 0, bytesRead);
                    response.append(chunk);

                    // Se achou o sinal de "pronto" do scanner, a resposta acabou
                    if (response.toString().contains(">")) {
                        promise.resolve(response.toString());
                        return;
                    }
                } else {
                    // Descansa o processador por 50ms antes de tentar ler de novo
                    Thread.sleep(50);
                }
            }

            // 4. Tratamento se o tempo estourar
            if (response.length() > 0) {
                promise.resolve("INCOMPLETO: " + response.toString());
            } else {
                promise.reject("TIMEOUT", "Nenhuma resposta após 2 segundos");
            }

        } catch (Exception e) {
            promise.reject("ERR_READ", "Erro na comunicação: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            if (inputStream != null) inputStream.close();
            if (outputStream != null) outputStream.close();
            if (socket != null) socket.close();
            promise.resolve("Desconectado com sucesso");
        } catch (IOException e) {
            promise.reject("ERR", "Erro ao desconectar: " + e.getMessage());
        }
    }
}