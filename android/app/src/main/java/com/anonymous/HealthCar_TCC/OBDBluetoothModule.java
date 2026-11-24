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

public class OBDBluetoothModule extends ReactContextBaseJavaModule {

    private BluetoothSocket socket;
    private InputStream inputStream;
    private OutputStream outputStream;
    private ReactApplicationContext reactContext;
    private final Object ioLock = new Object();
    
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private volatile boolean isAppPolling = false;

    public OBDBluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        OBDBluetoothService.obdModuleInstance = this;
    }

    @Override
    public String getName() {
        return "OBDBluetooth";
    }

    @ReactMethod
    public void pauseBackgroundPolling(boolean pause, Promise promise) {
        this.isAppPolling = pause;
        try {
            OBDBluetoothService.setPaused(pause, "", "");
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("HANDOVER_ERROR", e);
        }
    }

    // NOVA FUNÇÃO: Recebe os IDs de segurança e os envia para o Motor Java
    @ReactMethod
    public void pauseBackgroundPollingWithSession(boolean pause, String sessaoId, String userId, Promise promise) {
        this.isAppPolling = pause;
        try {
            OBDBluetoothService.setPaused(pause, sessaoId, userId);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("HANDOVER_ERROR", e);
        }
    }

    private void startForegroundMonitor() {
        Intent serviceIntent = new Intent(reactContext, OBDBluetoothService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(serviceIntent);
        } else {
            reactContext.startService(serviceIntent);
        }
    }

    private void stopForegroundMonitor() {
        Intent serviceIntent = new Intent(reactContext, OBDBluetoothService.class);
        reactContext.stopService(serviceIntent);
    }

    @ReactMethod
    public void startForegroundMonitorTest(Promise promise) {
        try {
            startForegroundMonitor();
            promise.resolve("Serviço de Background Iniciado (Modo de Teste)!");
        } catch (Exception e) {
            promise.reject("ERR", "Falha ao iniciar serviço de teste: " + e.getMessage());
        }
    }

    @ReactMethod
    public void connect(String macAddress, Promise promise) {
        synchronized (ioLock) {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    promise.reject("ERR", "Hardware Bluetooth não suportado ou inoperante.");
                    return;
                }

                BluetoothDevice device = adapter.getRemoteDevice(macAddress);
                adapter.cancelDiscovery();

                int maxRetries = 5;
                int attempt = 0;
                boolean connected = false;
                Exception lastException = null;

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
                    startForegroundMonitor();
                    promise.resolve("Conectado com sucesso na tentativa " + attempt + "!");
                } else {
                    promise.reject("ERR_CONNECTION", "Socket falhou após " + maxRetries + " tentativas. " + lastException.getMessage());
                }

            } catch (Exception e) {
                promise.reject("ERR_CONNECTION", "Falha crítica no adaptador: " + e.getMessage());
            }
        }
    }

    @ReactMethod
    public void sendCommand(String command, Promise promise) {
        synchronized (ioLock) {
            if (socket == null || !socket.isConnected() || inputStream == null || outputStream == null) {
                promise.reject("ERR", "I/O stream bloqueado. Scanner inativo.");
                return;
            }

            try {
                while (inputStream.available() > 0) {
                    inputStream.read();
                }

                String fullCommand = command + "\r";
                outputStream.write(fullCommand.getBytes());
                outputStream.flush();

                StringBuilder response = new StringBuilder();
                long startTime = System.currentTimeMillis();
                long timeout = 2000;

                byte[] buffer = new byte[1024];

                while ((System.currentTimeMillis() - startTime) < timeout) {
                    if (inputStream.available() > 0) {
                        int bytesRead = inputStream.read(buffer);
                        String chunk = new String(buffer, 0, bytesRead);
                        response.append(chunk);

                        if (response.toString().contains(">")) {
                            promise.resolve(response.toString());
                            return;
                        }
                    } else {
                        Thread.sleep(50);
                    }
                }

                if (response.length() > 0) {
                    promise.resolve("INCOMPLETO: " + response.toString());
                } else {
                    promise.reject("TIMEOUT", "Sem sinal do microcontrolador após 2000ms.");
                }

            } catch (Exception e) {
                promise.reject("ERR_READ", "Falha catastrófica de I/O: " + e.getMessage());
            }
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            stopForegroundMonitor();

            synchronized (ioLock) {
                if (inputStream != null) inputStream.close();
                if (outputStream != null) outputStream.close();
                if (socket != null) socket.close();
                inputStream = null;
                outputStream = null;
                socket = null;
            }
            promise.resolve("Sessão finalizada graciosamente.");
        } catch (IOException e) {
            promise.reject("ERR", "Vazamento de memória detectado ao fechar conexões: " + e.getMessage());
        }
    }

    public boolean isConnectedNative() {
        if (isAppPolling) return false; 
        return socket != null && socket.isConnected() && inputStream != null && outputStream != null;
    }

    public String sendCommandNative(String command) {
        synchronized (ioLock) {
            if (!isConnectedNative()) return null;

            try {
                while (inputStream.available() > 0) inputStream.read();

                String fullCommand = command + "\r";
                outputStream.write(fullCommand.getBytes());
                outputStream.flush();

                StringBuilder response = new StringBuilder();
                long startTime = System.currentTimeMillis();

                while ((System.currentTimeMillis() - startTime) < 2000) {
                    if (inputStream.available() > 0) {
                        byte[] buffer = new byte[1024];
                        int bytesRead = inputStream.read(buffer);
                        response.append(new String(buffer, 0, bytesRead));

                        if (response.toString().contains(">")) {
                            return response.toString();
                        }
                    } else {
                        Thread.sleep(50);
                    }
                }

                return response.length() > 0 ? response.toString() : null;

            } catch (Exception e) {
                return null;
            }
        }
    }
}