package com.anonymous.HealthCar_TCC;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * @class OBDBluetoothService
 * @description Foreground Service otimizado com Buffer de Memória (Batching).
 */
public class OBDBluetoothService extends Service {

    private static final String CHANNEL_ID = "HealthCarMonitorChannel";
    private static final String ALERT_CHANNEL_ID = "HealthCarAlertChannel";
    
    private boolean isMonitoring = false;
    private Thread monitorThread;
    private PowerManager.WakeLock wakeLock;

    private long ultimoTempoAlertaDtc = 0;
    private String ultimoDtcDetectado = ""; 
    private static final long COOLDOWN_MESMO_ERRO = 86400000L;

    private long ultimoTempoAlertaTemp = 0;
    private static final long COOLDOWN_TEMP = 120000L;

    public static OBDBluetoothModule obdModuleInstance; 

    // --- OTIMIZAÇÃO DE MEMÓRIA E BANCO DE DADOS (BATCHING) ---
    private List<ContentValues> telemetryBuffer = new ArrayList<>();
    private static final int MAX_BUFFER_SIZE = 12; // Grava a cada ~1 minuto (12 leituras de 5s)

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        adquirirWakeLock();
    }

    private void adquirirWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HealthCar::TelemetryWakeLock");
            wakeLock.acquire(); 
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("HealthCar - Telemetria Ativa")
                .setContentText("A analisar a saúde do motor em segundo plano.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        startForeground(1, notification);

        if (!isMonitoring) {
            iniciarLoopDeMonitoramento();
        }

        return START_STICKY; 
    }

    private void iniciarLoopDeMonitoramento() {
        isMonitoring = true;
        monitorThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (isMonitoring) {
                    try {
                        if (obdModuleInstance != null && obdModuleInstance.isConnectedNative()) {
                            
                            String rpmRaw = obdModuleInstance.sendCommandNative("010C");
                            if (rpmRaw != null) {
                                double rpmVal = parseHexToDecimal(rpmRaw, "0C");
                                if (rpmVal > 0) adicionarLeituraAoBuffer("010C", rpmVal, "RPM");
                            }

                            String tempRaw = obdModuleInstance.sendCommandNative("0105");
                            if (tempRaw != null) {
                                double tempVal = parseHexToDecimal(tempRaw, "05");
                                if (tempVal > 0) {
                                    adicionarLeituraAoBuffer("0105", tempVal, "°C");
                                    
                                    if (tempVal >= 100) {
                                        long agora = System.currentTimeMillis();
                                        if (agora - ultimoTempoAlertaTemp > COOLDOWN_TEMP) {
                                            dispararAlertaFalha("🔥 Risco de Superaquecimento!", "A temperatura do motor atingiu " + (int)tempVal + "°C. Reduza a velocidade.");
                                            ultimoTempoAlertaTemp = agora;
                                        }
                                    }
                                }
                            }

                            String dtcRaw = obdModuleInstance.sendCommandNative("03");
                            if (dtcRaw != null && contemErrosPendentes(dtcRaw)) {
                                long agora = System.currentTimeMillis();
                                String dtcLimpo = dtcRaw.replaceAll("\\s|>", "").toUpperCase();
                                
                                if (!dtcLimpo.equals(ultimoDtcDetectado) || (agora - ultimoTempoAlertaDtc > COOLDOWN_MESMO_ERRO)) {
                                    // Falhas são críticas, gravamos direto no banco ignorando o buffer
                                    salvarFalhaNoBancoImediato(); 
                                    dispararAlertaFalha("⚠️ Alerta da Injeção Eletrônica", "O módulo do motor relatou um código de falha. Abra o aplicativo para escanear.");
                                    ultimoDtcDetectado = dtcLimpo;
                                    ultimoTempoAlertaDtc = agora;
                                }
                            } else if (dtcRaw != null && !contemErrosPendentes(dtcRaw)) {
                                ultimoDtcDetectado = ""; 
                            }
                        }
                        Thread.sleep(5000);
                    } catch (InterruptedException e) {
                        isMonitoring = false;
                        Thread.currentThread().interrupt();
                    } catch (Exception e) {
                        Log.e("HealthCar_Background", "Erro no ciclo de telemetria", e);
                    }
                }
            }
        });
        monitorThread.start();
    }

    private double parseHexToDecimal(String hexRaw, String pid) {
        try {
            String cleanHex = hexRaw.replaceAll("\\s|>", "").toUpperCase();
            int idx = cleanHex.indexOf("41" + pid);
            if (idx != -1) {
                String payload = cleanHex.substring(idx + 4);
                if (pid.equals("0C") && payload.length() >= 4) { 
                    int A = Integer.parseInt(payload.substring(0, 2), 16);
                    int B = Integer.parseInt(payload.substring(2, 4), 16);
                    return Math.round(((A * 256.0) + B) / 4.0);
                } else if (pid.equals("05") && payload.length() >= 2) { 
                    return Integer.parseInt(payload.substring(0, 2), 16) - 40;
                }
            }
        } catch (Exception e) {}
        return 0;
    }

    private boolean contemErrosPendentes(String dtcRaw) {
        String cleanHex = dtcRaw.replaceAll("\\s|>", "").toUpperCase();
        int idx = cleanHex.indexOf("43");
        if (idx != -1 && cleanHex.length() > idx + 3) {
            try {
                int errorCount = Integer.parseInt(cleanHex.substring(idx + 2, idx + 4), 16);
                return errorCount > 0;
            } catch (Exception e) { return false; }
        }
        return false;
    }

    private File getExpoDatabaseFile() {
        File expoDb = new File(getApplicationContext().getFilesDir(), "SQLite/healthcar.db");
        if (expoDb.exists()) return expoDb;
        return getApplicationContext().getDatabasePath("healthcar.db");
    }

    private String getUltimaSessaoAtiva(SQLiteDatabase db) {
        String sessionId = "sessao_background_service";
        Cursor cursor = null;
        try {
            cursor = db.rawQuery("SELECT id FROM sessao_local ORDER BY inicio DESC LIMIT 1", null);
            if (cursor.moveToFirst()) {
                sessionId = cursor.getString(0);
            }
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Erro ao buscar sessão ativa", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        return sessionId;
    }

    /**
     * @method adicionarLeituraAoBuffer
     * @description Evita I/O constante. Mantém os dados na memória RAM e só aciona 
     * o disco rígido (SQLite) quando o lote atinge o tamanho ideal.
     */
    private void adicionarLeituraAoBuffer(String pid, double valor, String unidade) {
        ContentValues values = new ContentValues();
        values.put("id", UUID.randomUUID().toString());
        values.put("pid", pid);
        values.put("valor", valor);
        values.put("unidade", unidade);
        values.put("timestamp", System.currentTimeMillis());
        values.put("sincronizado", 0);

        telemetryBuffer.add(values);

        // Se o balde encheu, descarrega no banco de dados
        if (telemetryBuffer.size() >= MAX_BUFFER_SIZE) {
            flushBufferToBanco();
        }
    }

    /**
     * @method flushBufferToBanco
     * @description Executa um Batch Insert atômico. Grava múltiplos registros de uma só vez.
     */
    private void flushBufferToBanco() {
        if (telemetryBuffer.isEmpty()) return;

        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (!dbFile.exists()) return; 

            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
            String sessaoAtual = getUltimaSessaoAtiva(db);

            // Inicia transação de alta velocidade
            db.beginTransaction();
            try {
                for (ContentValues values : telemetryBuffer) {
                    values.put("sessaoId", sessaoAtual);
                    db.insert("leitura_local", null, values);
                }
                db.setTransactionSuccessful(); // Confirma o lote todo de uma vez
            } finally {
                db.endTransaction();
            }
            
            telemetryBuffer.clear(); // Limpa a memória RAM após salvar
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Falha de concorrência no Batch Insert", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    private void salvarFalhaNoBancoImediato() {
        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (!dbFile.exists()) return;

            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
            String sessaoAtual = getUltimaSessaoAtiva(db);

            ContentValues values = new ContentValues();
            values.put("id", UUID.randomUUID().toString());
            values.put("sessaoId", sessaoAtual);
            values.put("codigo", "UNSCANNED_DTC");
            values.put("descricao", "Falha crítica identificada pelo monitoramento passivo em background.");
            values.put("sistema", "Injeção Eletrônica");
            values.put("tipo", "Crítico");
            values.put("detectadoEm", System.currentTimeMillis());

            db.insert("dtc_local", null, values);
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Falha ao gravar DTC", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    private void dispararAlertaFalha(String titulo, String mensagem) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        Notification alertNotification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(titulo)
                .setContentText(mensagem)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)
                .build();

        manager.notify((int) System.currentTimeMillis(), alertNotification);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isMonitoring = false;
        if (monitorThread != null) monitorThread.interrupt();
        
        // Se o serviço for morto, garante que os dados residuais na memória RAM não se percam
        flushBufferToBanco();
        
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel serviceChannel = new NotificationChannel(
                        CHANNEL_ID, "Monitoramento Contínuo HealthCar", NotificationManager.IMPORTANCE_LOW);
                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID, "Alertas Críticos do Veículo", NotificationManager.IMPORTANCE_HIGH);

                manager.createNotificationChannel(serviceChannel);
                manager.createNotificationChannel(alertChannel);
            }
        }
    }
}