package com.anonymous.HealthCar_TCC;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Modulo Nativo (React Native Bridge) para comunicação Bluetooth Classic.
 * @description Gerencia a criação de sockets RFCOMM, transações I/O com o 
 * scanner OBD-II e o ciclo de vida do Foreground Service para telemetria em background.
 */
public class OBDBluetoothModule extends ReactContextBaseJavaModule {

    private BluetoothSocket socket;
    private InputStream inputStream;
    private OutputStream outputStream;
    private ReactApplicationContext reactContext;
    
    /** UUID padrão Universal para portas seriais (SPP) no Bluetooth */
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    public OBDBluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "OBDBluetooth";
    }

    /**
     * @method startForegroundMonitor
     * @description Dispara o serviço nativo do Android que impede o OS de 
     * congelar a thread do JavaScript via "Doze Mode".
     */
    private void startForegroundMonitor() {
        Intent serviceIntent = new Intent(reactContext, OBDBluetoothService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(serviceIntent);
        } else {
            reactContext.startService(serviceIntent);
        }
    }

    /**
     * @method stopForegroundMonitor
     * @description Encerra o serviço nativo para poupar bateria do dispositivo.
     */
    private void stopForegroundMonitor() {
        Intent serviceIntent = new Intent(reactContext, OBDBluetoothService.class);
        reactContext.stopService(serviceIntent);
    }

    /**
     * @method startForegroundMonitorTest
     * @description [APENAS PARA TESTES] Inicia manualmente o Foreground Service 
     * a partir do React Native para validar o comportamento em background sem o OBD-II físico.
     */
    @ReactMethod
    public void startForegroundMonitorTest(Promise promise) {
        try {
            startForegroundMonitor();
            promise.resolve("Serviço de Background Iniciado (Modo de Teste)!");
        } catch (Exception e) {
            promise.reject("ERR", "Falha ao iniciar serviço de teste: " + e.getMessage());
        }
    }

    /**
     * @method connect
     * @description Estabelece conexão com o endereço MAC especificado.
     * Implementa retry automático (fallback logic) em caso de falha transitória.
     */
    @ReactMethod
    public void connect(String macAddress, Promise promise) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                promise.reject("ERR", "Hardware Bluetooth não suportado ou inoperante.");
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(macAddress);
            // OBRIGATÓRIO: Cancelar discovery ativo para liberar a rádio Bluetooth
            adapter.cancelDiscovery(); 

            int maxRetries = 5; 
            int attempt = 0;
            boolean connected = false;
            Exception lastException = null;

            // Algoritmo de conexão com Backoff Linear
            while (attempt < maxRetries && !connected) {
                try {
                    attempt++;
                    socket = device.createInsecureRfcommSocketToServiceRecord(MY_UUID);
                    socket.connect();
                    connected = true; 
                } catch (Exception e) {
                    lastException = e;
                    if (socket != null) {
                        try { socket.close(); } catch (Exception ignored) {}
                    }
                    Thread.sleep(500); 
                }
            }

            if (connected) {
                inputStream = socket.getInputStream();
                outputStream = socket.getOutputStream();
                
                // [NOVO] Inicia a monitorização em Background assim que conectar com sucesso
                startForegroundMonitor();
                
                promise.resolve("Conectado com sucesso na tentativa " + attempt + "!");
            } else {
                promise.reject("ERR_CONNECTION", "Socket falhou após " + maxRetries + " tentativas. " + lastException.getMessage());
            }

        } catch (Exception e) {
            promise.reject("ERR_CONNECTION", "Falha crítica no adaptador: " + e.getMessage());
        }
    }

    /**
     * @method sendCommand
     * @description Envia comandos hexadecimais para o buffer da ECU e lê a resposta 
     * com timeout de segurança.
     */
    @ReactMethod
    public void sendCommand(String command, Promise promise) {
        if (socket == null || !socket.isConnected() || inputStream == null || outputStream == null) {
            promise.reject("ERR", "I/O stream bloqueado. Scanner inativo.");
            return;
        }

        try {
            // 1. Limpeza preventiva do buffer de entrada
            while (inputStream.available() > 0) {
                inputStream.read();
            }

            // 2. Transmissão do frame com Carriage Return
            String fullCommand = command + "\r";
            outputStream.write(fullCommand.getBytes());
            outputStream.flush();

            StringBuilder response = new StringBuilder();
            long startTime = System.currentTimeMillis();
            long timeout = 2000; // Timeout de 2000ms (2s)

            byte[] buffer = new byte[1024];

            // 3. Loop de recebimento síncrono
            while ((System.currentTimeMillis() - startTime) < timeout) {
                if (inputStream.available() > 0) {
                    int bytesRead = inputStream.read(buffer);
                    String chunk = new String(buffer, 0, bytesRead);
                    response.append(chunk);

                    // A caracter ">" indica fim da resposta do microcontrolador ELM327
                    if (response.toString().contains(">")) {
                        promise.resolve(response.toString());
                        return;
                    }
                } else {
                    // Liberação de ciclo de CPU via sleep passivo
                    Thread.sleep(50);
                }
            }

            // 4. Fallback de timeout
            if (response.length() > 0) {
                promise.resolve("INCOMPLETO: " + response.toString());
            } else {
                promise.reject("TIMEOUT", "Sem sinal do microcontrolador após 2000ms.");
            }

        } catch (Exception e) {
            promise.reject("ERR_READ", "Falha catastrófica de I/O: " + e.getMessage());
        }
    }

    /**
     * @method disconnect
     * @description Destrói o socket Bluetooth ativo, desaloca o stream de memória 
     * e desativa o serviço de background.
     */
    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            // [NOVO] Para o monitoramento em background quando a conexão for encerrada
            stopForegroundMonitor();
            
            if (inputStream != null) inputStream.close();
            if (outputStream != null) outputStream.close();
            if (socket != null) socket.close();
            promise.resolve("Sessão finalizada graciosamente.");
        } catch (IOException e) {
            promise.reject("ERR", "Vazamento de memória detectado: " + e.getMessage());
        }
    }
}