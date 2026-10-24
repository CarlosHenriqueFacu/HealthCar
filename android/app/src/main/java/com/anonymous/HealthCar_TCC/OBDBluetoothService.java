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
 * @description Foreground Service de alta prioridade responsável pela telemetria veicular contínua.
 * Implementa estratégias de resiliência arquitetural:
 * 1. Watchdog: Detecção de quedas silenciosas (Silent Drops) e reconexão autônoma.
 * 2. Batching (I/O): Buffer de memória para gravação em lote no SQLite, evitando travamentos de disco.
 * 3. Anti-Spam: Cooldown de 24h para evitar bombardeio de notificações de falhas idênticas.
 */
public class OBDBluetoothService extends Service {

    // Identificadores dos canais de notificação (Exigência do Android 8.0+)
    private static final String CHANNEL_ID = "HealthCarMonitorChannel";
    private static final String ALERT_CHANNEL_ID = "HealthCarAlertChannel";
    
    // Controle de concorrência e ciclo de vida da thread de monitoramento
    private boolean isMonitoring = false;
    private Thread monitorThread;
    
    // WakeLock garante que a CPU não durma com a tela apagada (Doze Mode)
    private PowerManager.WakeLock wakeLock;

    // Estado em memória para os Filtros Anti-Spam (Evita leituras repetidas em disco)
    private long ultimoTempoAlertaDtc = 0;
    private String ultimoDtcDetectado = ""; 
    private static final long COOLDOWN_MESMO_ERRO = 86400000L; // 24 horas em milissegundos

    private long ultimoTempoAlertaTemp = 0;
    private static final long COOLDOWN_TEMP = 120000L; // 2 minutos em milissegundos

    // Instância global estática mapeada a partir da Bridge do React Native
    public static OBDBluetoothModule obdModuleInstance; 

    // Buffer de dados (Batching) para otimizar chamadas de escrita no SQLite
    private List<ContentValues> telemetryBuffer = new ArrayList<>();
    private static final int MAX_BUFFER_SIZE = 12; // Esvazia para o banco a cada ~1 minuto (12 * 5s)

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        adquirirWakeLock();
    }

    /**
     * @method adquirirWakeLock
     * @description Solicita ao sistema operacional que a CPU continue processando o loop
     * de telemetria mesmo se o motorista bloquear a tela e guardar o celular no bolso.
     */
    private void adquirirWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HealthCar::TelemetryWakeLock");
            wakeLock.acquire(); 
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Promove o serviço para Foreground (Primeiro Plano) blindando-o contra o OOM Killer do Android
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("HealthCar - Telemetria Ativa")
                .setContentText("A analisar a saúde do motor em segundo plano.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        try {
            startForeground(1, notification);
        } catch (Exception e) {
            // Falhas de permissão ou configuração do serviço não devem encerrar o app inteiro.
            Log.e("HealthCar_Background", "Não foi possível iniciar o serviço em primeiro plano.", e);
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        if (!isMonitoring) {
            iniciarLoopDeMonitoramento();
        }

        // START_STICKY instrui o Android a recriar o serviço caso precise destruí-lo por falta de RAM
        return START_STICKY; 
    }

    /**
     * @method iniciarLoopDeMonitoramento
     * @description Worker Thread principal (Isolada da UI Thread).
     * Realiza o Polling (perguntas cíclicas) à injeção eletrônica e gerencia o Watchdog de conexão.
     */
    private void iniciarLoopDeMonitoramento() {
        isMonitoring = true;
        monitorThread = new Thread(new Runnable() {
            @Override
            public void run() {
                int falhasDeComunicacao = 0; // Contador do Watchdog (Queda Silenciosa)
                
                while (isMonitoring) {
                    try {
                        if (obdModuleInstance != null) {
                            
                            // Verifica o estado físico do Socket Bluetooth
                            if (obdModuleInstance.isConnectedNative()) {
                                
                                // --- MÓDULO 1: WATCHDOG DE QUEDA SILENCIOSA (RPM) ---
                                // A injeção pode parar de responder mesmo com o Bluetooth pareado.
                                String rpmRaw = obdModuleInstance.sendCommandNative("010C");
                                
                                // Validação heurística: Se nulo, vazio, apenas prompt (>) ou erro = falha.
                                if (rpmRaw == null || rpmRaw.trim().equals(">") || rpmRaw.contains("ERROR") || rpmRaw.contains("NODATA") || rpmRaw.contains("TIMEOUT")) {
                                    falhasDeComunicacao++;
                                } else {
                                    falhasDeComunicacao = 0; // Handshake bem sucedido, zera o contador
                                    double rpmVal = parseHexToDecimal(rpmRaw, "0C");
                                    if (rpmVal > 0) adicionarLeituraAoBuffer("010C", rpmVal, "RPM");
                                }

                                // Disparo do Watchdog: 3 falhas consecutivas indicam ECU dormindo ou fora de alcance
                                if (falhasDeComunicacao >= 3) {
                                    Log.e("HealthCar_Watchdog", "Comunicação perdida com a ECU em background.");
                                    Thread.sleep(60000); // Backoff strategy: Tenta reconectar em 60s
                                    falhasDeComunicacao = 0;
                                    continue; // Pula o resto do ciclo para evitar NullPointers
                                }

                                // --- MÓDULO 2: TELEMETRIA VITAL (Temperatura) ---
                                String tempRaw = obdModuleInstance.sendCommandNative("0105");
                                if (tempRaw != null) {
                                    double tempVal = parseHexToDecimal(tempRaw, "05");
                                    if (tempVal > 0) {
                                        adicionarLeituraAoBuffer("0105", tempVal, "°C");
                                        
                                        // Gatilho crítico local: Superaquecimento
                                        if (tempVal >= 100) {
                                            long agora = System.currentTimeMillis();
                                            if (agora - ultimoTempoAlertaTemp > COOLDOWN_TEMP) {
                                                dispararAlertaFalha("🔥 Risco de Superaquecimento!", "A temperatura do motor atingiu " + (int)tempVal + "°C. Reduza a velocidade.");
                                                ultimoTempoAlertaTemp = agora;
                                            }
                                        }
                                    }
                                }

                                // --- MÓDULO 3: SCANNER ATIVO DE FALHAS (DTC) ---
                                String dtcRaw = obdModuleInstance.sendCommandNative("03");
                                if (dtcRaw != null) {
                                    String codigoFalha = extrairEDecodificarDtc(dtcRaw);
                                    
                                    if (codigoFalha != null) {
                                        long agora = System.currentTimeMillis();
                                        
                                        // Filtro Anti-Spam: Só alerta e grava se for um erro novo OU se já passou 24h
                                        if (!codigoFalha.equals(ultimoDtcDetectado) || (agora - ultimoTempoAlertaDtc > COOLDOWN_MESMO_ERRO)) {
                                            salvarFalhaNoBancoImediato(codigoFalha); 
                                            dispararAlertaFalha("⚠️ Falha " + codigoFalha + " Detectada", "O sistema reportou o código " + codigoFalha + ". Abra o aplicativo para ler o diagnóstico detalhado.");
                                            
                                            // Atualiza o estado da memória
                                            ultimoDtcDetectado = codigoFalha;
                                            ultimoTempoAlertaDtc = agora;
                                        }
                                    }
                                }
                            } else {
                                // Watchdog físico: Adaptador perdeu energia ou distância excedida
                                Log.e("HealthCar_Watchdog", "Bluetooth desconectado em background. Tentando reconectar...");
                                Thread.sleep(60000); // Backoff de 60s para sustentabilidade da bateria
                            }
                        }
                        Thread.sleep(5000); // Polling Rate: Ciclo padrão de 5 segundos
                        
                    } catch (InterruptedException e) {
                        isMonitoring = false;
                        Thread.currentThread().interrupt(); // Graceful shutdown da thread
                    } catch (Exception e) {
                        Log.e("HealthCar_Background", "Erro no ciclo de telemetria", e);
                    }
                }
            }
        });
        monitorThread.start();
    }

    /**
     * @method parseHexToDecimal
     * @description Parser matemático padronizado para payloads OBD-II.
     * Utiliza indexação de string para contornar ruídos seriais presentes em redes CAN baratas.
     */
    private double parseHexToDecimal(String hexRaw, String pid) {
        try {
            String cleanHex = hexRaw.replaceAll("\\s|>", "").toUpperCase();
            int idx = cleanHex.indexOf("41" + pid); // Procura o byte de sucesso (41) + o PID solicitado
            
            if (idx != -1) {
                String payload = cleanHex.substring(idx + 4); // Extrai os bytes úteis
                
                if (pid.equals("0C") && payload.length() >= 4) { 
                    // Matemática RPM (PID 0C): ((A * 256) + B) / 4
                    int A = Integer.parseInt(payload.substring(0, 2), 16);
                    int B = Integer.parseInt(payload.substring(2, 4), 16);
                    return Math.round(((A * 256.0) + B) / 4.0);
                    
                } else if (pid.equals("05") && payload.length() >= 2) { 
                    // Matemática Temperatura (PID 05): A - 40
                    return Integer.parseInt(payload.substring(0, 2), 16) - 40;
                }
            }
        } catch (Exception e) {}
        return 0; // Fallback seguro
    }

    /**
     * @method extrairEDecodificarDtc
     * @description Decodificador universal SAE J2012 para falhas de injeção eletrônica.
     * Contém defesas contra Padding Bytes (0055, 5555) comuns em centrais que preenchem blocos vazios.
     */
    private String extrairEDecodificarDtc(String dtcRaw) {
        String cleanHex = dtcRaw.replaceAll("\\s|>", "").toUpperCase();
        int idx = cleanHex.indexOf("43"); // Resposta padrão de erro (Mode 03 = 43)
        
        if (idx != -1 && cleanHex.length() >= idx + 6) {
            String hexErro = cleanHex.substring(idx + 2, idx + 6);
            
            // Filtro de Fantasmas: "0000" (Limpo) e Padrões de Preenchimento da ECU
            if (hexErro.equals("0000") || hexErro.equals("0055") || hexErro.equals("5555") || hexErro.equals("00AA") || hexErro.equals("AAAA")) {
                return null;
            }
            
            try {
                // Matemática de decodificação de Prefixos SAE (P, C, B, U) usando deslocamento de bits
                int primeiroByte = Integer.parseInt(hexErro.substring(0, 1), 16);
                String letra;
                
                switch (primeiroByte >> 2) {
                    case 0: letra = "P"; break; // Powertrain (Motor/Transmissão)
                    case 1: letra = "C"; break; // Chassis (Freios/Suspensão)
                    case 2: letra = "B"; break; // Body (Carroceria/Airbag)
                    case 3: letra = "U"; break; // Network (Rede CAN/Módulos)
                    default: letra = "P";
                }
                
                int primeiroDigito = primeiroByte & 0x03; // Máscara de bits para o primeiro numeral
                String restoDoCodigo = hexErro.substring(1);
                
                return letra + primeiroDigito + restoDoCodigo; // Concatenação final (Ex: P0420)
                
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    // --- GERENCIAMENTO DE BANCO DE DADOS (SQLite Nativo) ---

    /**
     * @method getExpoDatabaseFile
     * @description Localiza de forma determinística o arquivo de banco de dados gerado
     * pela biblioteca Expo/SQLite, garantindo que o módulo nativo escreva no mesmo arquivo do React.
     */
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
            if (cursor.moveToFirst()) sessionId = cursor.getString(0);
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Erro ao buscar sessão ativa", e);
        } finally {
            if (cursor != null) cursor.close();
        }
        return sessionId;
    }

    /**
     * @method adicionarLeituraAoBuffer
     * @description Armazena leituras temporariamente em memória RAM em vez de abrir transações
     * de disco a cada milissegundo. Aciona o Flush quando o limiar (MAX_BUFFER) é alcançado.
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

        if (telemetryBuffer.size() >= MAX_BUFFER_SIZE) {
            flushBufferToBanco();
        }
    }

    /**
     * @method flushBufferToBanco
     * @description Realiza Bulk Insert (Inserção em Lote) no SQLite utilizando transações.
     * Habilita o modo WAL (Write-Ahead Logging) para permitir leituras concorrentes pela UI.
     */
    private void flushBufferToBanco() {
        if (telemetryBuffer.isEmpty()) return;

        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (!dbFile.exists()) return; 

            // FLAG: ENABLE_WRITE_AHEAD_LOGGING impede travamentos entre Java e Javascript
            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
            String sessaoAtual = getUltimaSessaoAtiva(db);

            db.beginTransaction();
            try {
                for (ContentValues values : telemetryBuffer) {
                    values.put("sessaoId", sessaoAtual);
                    db.insert("leitura_local", null, values);
                }
                db.setTransactionSuccessful(); // Commita as alterações
            } finally {
                db.endTransaction();
            }
            
            telemetryBuffer.clear(); // Esvazia a RAM
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Falha de concorrência no Batch Insert", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    /**
     * @method salvarFalhaNoBancoImediato
     * @description Ignora o Buffer (Batching) e grava imediatamente qualquer código de falha (DTC)
     * encontrado, dado o seu caráter crítico para a segurança do veículo.
     */
    private void salvarFalhaNoBancoImediato(String codigoDtc) {
        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (!dbFile.exists()) return;

            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
            String sessaoAtual = getUltimaSessaoAtiva(db);

            ContentValues values = new ContentValues();
            values.put("id", UUID.randomUUID().toString());
            values.put("sessaoId", sessaoAtual);
            values.put("codigo", codigoDtc);
            values.put("descricao", "Falha detectada ativamente pelo monitoramento em background.");
            values.put("sistema", "Injeção Eletrônica / OBD-II");
            values.put("tipo", "Aviso");
            values.put("detectadoEm", System.currentTimeMillis());

            db.insert("dtc_local", null, values);
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Falha ao gravar DTC", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    /**
     * @method dispararAlertaFalha
     * @description Utiliza o NotificationManager do Android para enviar alertas visíveis (Heads-up)
     * diretamente para a gaveta de notificações do smartphone.
     */
    private void dispararAlertaFalha(String titulo, String mensagem) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        Notification alertNotification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(titulo)
                .setContentText(mensagem)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH) // PRIORITY_HIGH garante pop-up na tela
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)
                .build();

        manager.notify((int) System.currentTimeMillis(), alertNotification);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isMonitoring = false;
        if (monitorThread != null) monitorThread.interrupt(); // Libera recursos da Thread
        flushBufferToBanco(); // Grava os resquícios da RAM antes de morrer
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); // Libera a restrição de CPU
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    /**
     * @method createNotificationChannels
     * @description Registra os canais de notificação no OS. Exigência arquitetural do Android Oreo+.
     */
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
