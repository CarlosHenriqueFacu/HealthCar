package com.anonymous.HealthCar_TCC;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.HashSet; // NOVO: Importação para o HashSet anti-spam

// Serviço de Background: Mantém o aplicativo monitorando o carro mesmo quando a tela é desligada
public class OBDBluetoothService extends Service {

    // Canais de notificação exigidos pelo Android (Notificação silenciosa vs. Alertas Críticos)
    private static final String CHANNEL_ID = "HealthCarMonitorChannel";
    private static final String ALERT_CHANNEL_ID = "HealthCarAlertChannel";
    
    // Controles de estado do serviço
    private boolean isMonitoring = false;
    private boolean isPausedByRN = true; 
    
    // Thread isolada para não travar a interface do usuário (UI Thread) e WakeLock para não deixar a CPU dormir
    private Thread monitorThread;
    private PowerManager.WakeLock wakeLock;

    // NOVO: HashSet que funciona como uma "memória cache" para não repetirmos o mesmo alerta de erro no dia
    private HashSet<String> dtcsNotificados = new HashSet<>();
    private long ultimoTempoAlertaDtc = 0;
    // 24 horas em milissegundos para perdoar os erros antigos
    private static final long COOLDOWN_MESMO_ERRO = 86400000L; 

    // Tempo de espera (cooldown) para não ficar avisando do motor quente a cada 5 segundos
    private long ultimoTempoAlertaTemp = 0;
    private static final long COOLDOWN_TEMP = 120000L; 

    // Controle de tempo para alerta de bateria em background (30 minutos)
    private long ultimoTempoAlertaBat = 0;
    private static final long COOLDOWN_BAT = 1800000L; 
    
    // NOVO: Controle de tempo para alerta de manutenção em background
    private long ultimoTempoAlertaManutencao = 0;
    private static final long COOLDOWN_MANUTENCAO = 86400000L; // 24 horas em milissegundos

    // Singleton: Ponto de acesso global para conversar com o módulo C++ / Java (React Native)
    public static OBDBluetoothModule obdModuleInstance; 
    private static OBDBluetoothService instance;

    // Memória de identificação (Chaves estrangeiras para o Banco de Dados SQLite)
    private String activeSessaoId = "";
    private String activeUserId = "";

    // Buffer de dados em memória RAM: Agrupa 12 leituras antes de gravar no banco (Otimização I/O)
    private List<ContentValues> telemetryBuffer = new ArrayList<>();
    private static final int MAX_BUFFER_SIZE = 12; 

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this; 
        createNotificationChannels(); // Cria os canais obrigatórios no Android 8.0+
        adquirirWakeLock(); // Trava a CPU acordada (Partial WakeLock)
    }

    // Método chamado pelo React Native para pausar/despausar a thread em background
    public static void setPaused(boolean paused, String sessaoId, String userId) {
        if (instance != null) {
            instance.isPausedByRN = paused;
            if (sessaoId != null && !sessaoId.isEmpty()) instance.activeSessaoId = sessaoId;
            if (userId != null && !userId.isEmpty()) instance.activeUserId = userId;
        }
    }

    // Solicita energia extra ao sistema operacional para rodar com o celular bloqueado
    private void adquirirWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HealthCar::TelemetryWakeLock");
            wakeLock.acquire(); 
        }
    }

    // Ponto de entrada do serviço quando o Android dá o "Start"
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Notificação persistente (obrigatória para Foreground Services)
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("HealthCar - Telemetria")
                .setContentText("O serviço de proteção ao motor está ativo.")
                .setSmallIcon(R.mipmap.ic_launcher) // Dica: Use um ícone transparente (Alpha) para evitar quadradão branco
                .setPriority(NotificationCompat.PRIORITY_LOW) // Fica silenciosa na barra
                .build();

        try {
            // Android 14+ exige especificar o tipo de Foreground Service (Dispositivo Conectado)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(1, notification);
            }
        } catch (Exception e) {
            Log.e("HealthCar_Background", "Falha ao iniciar Foreground Service.", e);
            try {
                startForeground(1, notification);
            } catch (Exception ex) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
        }

        // Se a thread ainda não estiver rodando, inicia o coração do sistema
        if (!isMonitoring) {
            iniciarLoopDeMonitoramento();
        }

        return START_STICKY; // Se o Android matar o serviço por falta de memória, recria automaticamente
    }

    // =========================================================
    // NÚCLEO DO SISTEMA: Loop infinito que conversa com o Carro
    // =========================================================
    private void iniciarLoopDeMonitoramento() {
        isMonitoring = true;
        monitorThread = new Thread(new Runnable() {
            @Override
            public void run() {
                int falhasDeComunicacao = 0; 
                
                while (isMonitoring) {
                    try {
                        // Se o app principal (React Native) estiver em tela cheia, pausamos o background para não dar conflito (Colisão de Bluetooth)
                        if (isPausedByRN) {
                            Thread.sleep(2000); 
                            continue;
                        }

                        if (obdModuleInstance != null) {
                            if (obdModuleInstance.isConnectedNative()) {
                                
                                // 1. LEITURA DE RPM (Motor)
                                String rpmRaw = obdModuleInstance.sendCommandNative("010C");
                                if (rpmRaw == null || rpmRaw.trim().equals(">") || rpmRaw.contains("ERROR") || rpmRaw.contains("NODATA") || rpmRaw.contains("TIMEOUT")) {
                                    falhasDeComunicacao++; // Carro pode ter sido desligado
                                } else {
                                    falhasDeComunicacao = 0; 
                                    double rpmVal = parseHexToDecimal(rpmRaw, "0C");
                                    if (rpmVal > 0) adicionarLeituraAoBuffer("010C", rpmVal, "RPM");
                                }

                                // Watchdog: Se falhar 3x seguidas, o carro foi desligado. O serviço "dorme" por 1 minuto para não drenar a bateria do celular atoa.
                                if (falhasDeComunicacao >= 3) {
                                    Log.e("HealthCar_Watchdog", "Conexão Bluetooth congelada em background.");
                                    Thread.sleep(60000); 
                                    falhasDeComunicacao = 0;
                                    continue; 
                                }

                                // 2. LEITURA DE TEMPERATURA (Sensor 0105)
                                String tempRaw = obdModuleInstance.sendCommandNative("0105");
                                if (tempRaw != null) {
                                    double tempVal = parseHexToDecimal(tempRaw, "05");
                                    if (tempVal > 0) {
                                        adicionarLeituraAoBuffer("0105", tempVal, "°C");
                                        
                                        // Regra de Negócio Crítica: Risco de fundir o motor
                                        if (tempVal >= 100) {
                                            long agora = System.currentTimeMillis();
                                            // Trava anti-spam (cooldown)
                                            if (agora - ultimoTempoAlertaTemp > COOLDOWN_TEMP) {
                                                dispararAlertaFalha("🔥 Risco de Superaquecimento!", "A temperatura atingiu " + (int)tempVal + "°C.");
                                                ultimoTempoAlertaTemp = agora;
                                            }
                                        }
                                    }
                                }

                                // 3. LEITURA DA BATERIA (Comando de Terminal)
                                String voltRaw = obdModuleInstance.sendCommandNative("ATRV");
                                if (voltRaw != null && !voltRaw.trim().isEmpty() && !voltRaw.contains("ERROR")) {
                                    try {
                                        // Expressão Regular para arrancar letras (ex: "12.4V" vira "12.4")
                                        String cleanVolt = voltRaw.replaceAll("[^0-9.]", "");
                                        if (!cleanVolt.isEmpty()) {
                                            double voltVal = Double.parseDouble(cleanVolt);
                                            if (voltVal > 0) {
                                                adicionarLeituraAoBuffer("ATRV", voltVal, "V");

                                                long agora = System.currentTimeMillis();
                                                // Regra de Negócio: Abaixo de 12V e respeitando a trava anti-spam
                                                if (voltVal < 12.0 && (agora - ultimoTempoAlertaBat > COOLDOWN_BAT)) {
                                                    dispararAlertaFalha("⚠️ Bateria Fraca", "A tensão elétrica caiu para " + voltVal + "V. Verifique o alternador ou a bateria.");
                                                    ultimoTempoAlertaBat = agora;
                                                }
                                            }
                                        }
                                    } catch (Exception e) {
                                        Log.e("HealthCar_Watchdog", "Erro no parse da bateria", e);
                                    }
                                }

                                // 4. LEITURA DE FALHAS (DTC)
                                String dtcRaw = obdModuleInstance.sendCommandNative("03");
                                if (dtcRaw != null) {
                                    String codigoFalha = extrairEDecodificarDtc(dtcRaw); // Extrai ex: P0300
                                    
                                    if (codigoFalha != null) {
                                        long agora = System.currentTimeMillis();
                                        
                                        // Se virou o dia (24h), limpa a memória para poder avisar de novo caso o erro persista
                                        if (agora - ultimoTempoAlertaDtc > COOLDOWN_MESMO_ERRO) {
                                            dtcsNotificados.clear();
                                        }
                                
                                        // Verifica no HashSet se esse erro já encheu o saco do usuário hoje
                                        if (!dtcsNotificados.contains(codigoFalha)) {
                                            salvarFalhaNoBancoImediato(codigoFalha); // Grava no SQLite
                                            
                                            // Consulta o dicionário estendido e dispara um PUSH agressivo e barulhento
                                            String descricaoExata = obterDescricaoDTC(codigoFalha);
                                            dispararAlertaFalha("⚠️ Falha " + codigoFalha, descricaoExata);
                                            
                                            // Registra na memória cache para não alertar novamente
                                            dtcsNotificados.add(codigoFalha);
                                            ultimoTempoAlertaDtc = agora;
                                        }
                                    }
                                }

                            } else {
                                Log.e("HealthCar_Watchdog", "Sinal Bluetooth perdido em background.");
                                Thread.sleep(30000); // Dorme meia hora se o cabo desconectar
                            }
                        }
                        Thread.sleep(5000); // A cada 5 segundos faz a roda girar (Polling)
                        
                        // NOVO: Verifica manutenções 1 vez por dia em background
                        long agora = System.currentTimeMillis();
                        if (agora - ultimoTempoAlertaManutencao > COOLDOWN_MANUTENCAO) {
                            verificarManutencaoEmBackground();
                            ultimoTempoAlertaManutencao = agora;
                        }
                        
                    } catch (InterruptedException e) {
                        isMonitoring = false;
                        Thread.currentThread().interrupt(); // Encerra a thread limpa
                    } catch (Exception e) {
                        Log.e("HealthCar_Background", "Falha de execução na Worker Thread", e);
                    }
                }
            }
        });
        monitorThread.start();
    }

    // =========================================================
    // FUNÇÕES MATEMÁTICAS E DICIONÁRIO
    // =========================================================

    // Converte hexadecimal recebido da ECU em número decimal físico
    private double parseHexToDecimal(String hexRaw, String pid) {
        try {
            String cleanHex = hexRaw.replaceAll("\\s|>", "").toUpperCase();
            int idx = cleanHex.indexOf("41" + pid); 
            if (idx != -1) {
                String payload = cleanHex.substring(idx + 4); 
                if (pid.equals("0C") && payload.length() >= 4) { 
                    int A = Integer.parseInt(payload.substring(0, 2), 16);
                    int B = Integer.parseInt(payload.substring(2, 4), 16);
                    return Math.round(((A * 256.0) + B) / 4.0); // SAE J1979 RPM
                } else if (pid.equals("05") && payload.length() >= 2) { 
                    return Integer.parseInt(payload.substring(0, 2), 16) - 40; // SAE J1979 Temp
                }
            }
        } catch (Exception e) {}
        return 0; 
    }

    // Isola e traduz a matriz hexadecimal de resposta de falha (DTC)
    private String extrairEDecodificarDtc(String dtcRaw) {
        String cleanHex = dtcRaw.replaceAll("\\s|>", "").toUpperCase();
        int idx = cleanHex.indexOf("43"); 
        
        if (idx != -1 && cleanHex.length() >= idx + 6) {
            String hexErro = cleanHex.substring(idx + 2, idx + 6);
            
            // Filtro de ruído: Ignora preenchimentos de memória vazios (Padding Bites)
            if (hexErro.equals("0000") || hexErro.equals("0055") || hexErro.equals("5555") || hexErro.equals("00AA") || hexErro.equals("AAAA")) {
                return null;
            }
            try {
                // Matemática de Deslocamento de Bits (Bitwise Shift) para descobrir se é Motor (P), Freio (C), Cabine (B) ou Rede (U)
                int primeiroByte = Integer.parseInt(hexErro.substring(0, 1), 16);
                String letra;
                switch (primeiroByte >> 2) {
                    case 0: letra = "P"; break; 
                    case 1: letra = "C"; break; 
                    case 2: letra = "B"; break; 
                    case 3: letra = "U"; break; 
                    default: letra = "P";
                }
                int primeiroDigito = primeiroByte & 0x03; 
                String restoDoCodigo = hexErro.substring(1);
                return letra + primeiroDigito + restoDoCodigo; 
            } catch (Exception e) { return null; }
        }
        return null;
    }

    // NOVO: Dicionário interno para o Background Service falar com o usuário sem precisar abrir o app
    private String obterDescricaoDTC(String codigo) {
        switch (codigo) {
            // CATEGORIA P: POWERTRAIN (MOTOR E INJEÇÃO)
            case "P0100": return "Falha no circuito do sensor de fluxo de ar (MAF).";
            case "P0101": return "Problema de desempenho no sensor de fluxo de ar (MAF).";
            case "P0102": return "Entrada baixa no circuito de fluxo de ar (MAF).";
            case "P0103": return "Entrada alta no circuito de fluxo de ar (MAF).";
            case "P0113": return "Entrada alta no sensor de temperatura do ar de admissão.";
            case "P0118": return "Entrada alta no circuito de temperatura do motor.";
            case "P0128": return "Termostato operando abaixo da temperatura ideal.";
            case "P0087": return "Pressão do sistema de combustível muito baixa (Bomba/Filtro).";
            case "P0133": return "Resposta lenta do sensor de oxigênio (Sonda Lambda).";
            case "P0171": return "Mistura ar/combustível muito pobre (Falta combustível).";
            case "P0172": return "Mistura ar/combustível muito rica (Excesso de combustível).";
            case "P0300": return "Falha de ignição aleatória ou múltipla detectada.";
            case "P0301": return "Falha de ignição detectada no Cilindro 1.";
            case "P0302": return "Falha de ignição detectada no Cilindro 2.";
            case "P0303": return "Falha de ignição detectada no Cilindro 3.";
            case "P0304": return "Falha de ignição detectada no Cilindro 4.";
            case "P0400": return "Fluxo de recirculação de gases de escape (EGR) com defeito.";
            case "P0420": return "Eficiência do catalisador abaixo do limite (Banco 1).";
            case "P0430": return "Eficiência do catalisador abaixo do limite (Banco 2).";
            case "P0455": return "Vazamento grave detectado no sistema de emissões evaporativas.";
            case "P0500": return "Mau funcionamento do sensor de velocidade (VSS).";
            case "P0505": return "Falha no sistema de controle de marcha lenta.";
            case "P0562": return "Tensão do sistema muito baixa (Verifique bateria/alternador).";
            case "P0563": return "Tensão do sistema muito alta (Verifique bateria/alternador).";
            case "P0700": return "Falha geral no sistema de controle da transmissão (Câmbio).";
            case "P0730": return "Relação de marcha incorreta na transmissão.";
    
            // CATEGORIA C: CHASSIS (FREIOS, ABS E SUSPENSÃO)
            case "C0035": return "Falha no sensor de velocidade da roda dianteira esquerda (ABS).";
            case "C0040": return "Falha no sensor de velocidade da roda dianteira direita (ABS).";
            case "C0045": return "Falha no sensor de velocidade da roda traseira esquerda (ABS).";
            case "C0050": return "Falha no sensor de velocidade da roda traseira direita (ABS).";
            case "C1211": return "Falha no circuito da luz indicadora do ABS.";
            case "C1513": return "Anomalia detectada no sistema de direção elétrica.";
    
            // CATEGORIA B: BODY (CARROCERIA, AIRBAGS E CLIMATIZAÇÃO)
            case "B1001": return "Falha no circuito de detecção do Airbag frontal (Motorista).";
            case "B1004": return "Falha no circuito de detecção do Airbag frontal (Passageiro).";
            case "B1200": return "Anomalia no circuito do sistema de climatização (Ar-Condicionado).";
            case "B1325": return "Tensão do circuito de controle da carroceria fora do limite.";
    
            // CATEGORIA U: NETWORK (REDE DE COMUNICAÇÃO CAN)
            case "U0100": return "Perda de comunicação com o Módulo de Controle do Motor (ECM).";
            case "U0101": return "Perda de comunicação com o Módulo de Transmissão (TCM).";
            case "U0121": return "Perda de comunicação com o Módulo de Controle do Freio (ABS).";
            case "U0155": return "Perda de comunicação com o Painel de Instrumentos.";
    
            default:
                // FALLBACK INTELIGENTE (PLANO B): Não sabe o código específico? Avisa pelo tipo (Primeira Letra)
                if (codigo.startsWith("P")) return "Anomalia no motor ou transmissão (Powertrain). Recomenda-se avaliação.";
                if (codigo.startsWith("C")) return "Anomalia no chassi, freios (ABS) ou suspensão.";
                if (codigo.startsWith("B")) return "Anomalia na carroceria ou sistema de airbags (Body).";
                if (codigo.startsWith("U")) return "Falha de comunicação na rede eletrônica do veículo.";
                
                return "Anomalia eletrônica detectada pela central do veículo.";
        }
    }

    // =========================================================
    // BANCO DE DADOS (PERSISTÊNCIA OFFLINE-FIRST SQLite)
    // =========================================================

    // Varredura para encontrar o banco de dados do React Native (Expo) nas entranhas do Android
    private File getExpoDatabaseFile() {
        String dbName = "healthcar.db"; 
        File[] possiblePaths = {
            getApplicationContext().getDatabasePath(dbName),
            new File(getApplicationContext().getFilesDir(), "SQLite/" + dbName),
            new File(getApplicationContext().getNoBackupFilesDir(), "SQLite/" + dbName),
            new File(getApplicationContext().getDataDir(), "databases/" + dbName)
        };
        for (File f : possiblePaths) {
            if (f.exists()) return f;
        }
        return searchDatabaseRecursively(getApplicationContext().getDataDir());
    }

    private File searchDatabaseRecursively(File dir) {
        if (dir == null || !dir.isDirectory()) return null;
        File[] files = dir.listFiles();
        if (files == null) return null;
        for (File f : files) {
            if (f.isDirectory()) {
                String name = f.getName();
                if (name.equals("cache") || name.equals("code_cache") || name.equals("lib") || name.equals("shared_prefs")) continue;
                File res = searchDatabaseRecursively(f);
                if (res != null) return res;
            } else if (f.getName().endsWith(".db") && !f.getName().contains("journal") && !f.getName().contains("wal")) {
                return f; 
            }
        }
        return null;
    }

    private String findTableWithColumn(SQLiteDatabase db, String columnName) {
        Cursor cT = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'android_metadata'", null);
        while (cT.moveToNext()) {
            String tName = cT.getString(0);
            Cursor cC = db.rawQuery("PRAGMA table_info(" + tName + ")", null);
            boolean hasCol = false;
            while (cC.moveToNext()) {
                if (cC.getString(cC.getColumnIndexOrThrow("name")).equals(columnName)) {
                    hasCol = true;
                    break;
                }
            }
            cC.close();
            if (hasCol) {
                cT.close();
                return tName;
            }
        }
        cT.close();
        return null;
    }

    // Guarda a leitura na memória RAM
    private void adicionarLeituraAoBuffer(String pid, double valor, String unidade) {
        ContentValues values = new ContentValues();
        values.put("id", UUID.randomUUID().toString());
        values.put("pid", pid);
        values.put("valor", valor);
        values.put("unidade", unidade);
        values.put("timestamp", System.currentTimeMillis());
        values.put("sincronizado", 0);

        telemetryBuffer.add(values);

        // Se bater o limite (12 itens), descarrega (flush) e grava no disco
        if (telemetryBuffer.size() >= MAX_BUFFER_SIZE) {
            flushBufferToBanco();
        }
    }

    // BULK INSERT: Salva tudo de uma vez no banco com uma transação segura
    private void flushBufferToBanco() {
        if (telemetryBuffer.isEmpty()) return;

        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (dbFile == null || !dbFile.exists()) return; 

            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);

            String sessaoAtual = activeSessaoId;
            if (sessaoAtual == null || sessaoAtual.isEmpty()) {
                String tbSessao = findTableWithColumn(db, "inicio"); 
                if (tbSessao != null) {
                    Cursor cursor = db.rawQuery("SELECT id FROM " + tbSessao + " ORDER BY inicio DESC LIMIT 1", null);
                    if (cursor.moveToFirst()) sessaoAtual = cursor.getString(0);
                    cursor.close();
                }
            }
            if (sessaoAtual == null || sessaoAtual.isEmpty()) sessaoAtual = "sessao_background";

            String tbTelemetria = findTableWithColumn(db, "pid"); 
            if (tbTelemetria == null) tbTelemetria = "leitura_telemetria";

            List<String> validCols = new ArrayList<>();
            Cursor cC = db.rawQuery("PRAGMA table_info(" + tbTelemetria + ")", null);
            while (cC.moveToNext()) validCols.add(cC.getString(cC.getColumnIndexOrThrow("name")));
            cC.close();

            db.beginTransaction(); // Inicia o Bulk Insert
            try {
                for (ContentValues values : telemetryBuffer) {
                    values.put("sessaoId", sessaoAtual);
                    if (activeUserId != null && !activeUserId.isEmpty()) {
                        values.put("ownerUid", activeUserId);
                        values.put("userId", activeUserId);
                    }
                    
                    ContentValues safeValues = new ContentValues();
                    for (String key : values.keySet()) {
                        if (validCols.contains(key)) {
                            Object obj = values.get(key);
                            if (obj != null) safeValues.put(key, obj.toString());
                        }
                    }
                    db.insert(tbTelemetria, null, safeValues);
                }
                db.setTransactionSuccessful(); // Commit (Confirma a gravação de tudo)
            } finally {
                db.endTransaction();
            }
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Erro no Batch Insert", e);
        } finally {
            telemetryBuffer.clear(); // Esvazia o buffer de memória RAM
            if (db != null && db.isOpen()) db.close();
        }
    }

    // Registra falhas graves imediatamente no banco, furando a fila do buffer
    private void salvarFalhaNoBancoImediato(String codigoDtc) {
        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (dbFile == null || !dbFile.exists()) return;

            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
            
            String sessaoAtual = activeSessaoId;
            if (sessaoAtual == null || sessaoAtual.isEmpty()) {
                String tbSessao = findTableWithColumn(db, "inicio");
                if (tbSessao != null) {
                    Cursor cursor = db.rawQuery("SELECT id FROM " + tbSessao + " ORDER BY inicio DESC LIMIT 1", null);
                    if (cursor.moveToFirst()) sessaoAtual = cursor.getString(0);
                    cursor.close();
                }
            }
            if (sessaoAtual == null || sessaoAtual.isEmpty()) sessaoAtual = "sessao_background";

            String tbDtc = findTableWithColumn(db, "codigo");
            if (tbDtc == null) tbDtc = "dtc_local";

            List<String> validCols = new ArrayList<>();
            Cursor cC = db.rawQuery("PRAGMA table_info(" + tbDtc + ")", null);
            while (cC.moveToNext()) validCols.add(cC.getString(cC.getColumnIndexOrThrow("name")));
            cC.close();

            ContentValues values = new ContentValues();
            values.put("id", UUID.randomUUID().toString());
            values.put("sessaoId", sessaoAtual);
            if (activeUserId != null && !activeUserId.isEmpty()) {
                values.put("ownerUid", activeUserId);
                values.put("userId", activeUserId);
            }
            values.put("codigo", codigoDtc);
            values.put("descricao", "Falha detectada ativamente pelo monitoramento em background.");
            values.put("sistema", "Injeção Eletrônica / OBD-II");
            values.put("tipo", "Aviso");
            values.put("detectadoEm", System.currentTimeMillis());

            ContentValues safeValues = new ContentValues();
            for (String key : values.keySet()) {
                if (validCols.contains(key)) {
                    Object obj = values.get(key);
                    if (obj != null) safeValues.put(key, obj.toString());
                }
            }

            db.insert(tbDtc, null, safeValues);
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Falha ao gravar DTC", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    // NOVO: Função que verifica as manutenções no SQLite enquanto a tela do celular está desligada
    private void verificarManutencaoEmBackground() {
        SQLiteDatabase db = null;
        try {
            File dbFile = getExpoDatabaseFile();
            if (dbFile == null || !dbFile.exists()) return;
            
            // Abre o banco apenas para leitura
            db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READONLY);
            
            // 1. Pega a quilometragem atual salva no veículo
            String tbVeiculo = findTableWithColumn(db, "quilometragem");
            if (tbVeiculo == null) tbVeiculo = "veiculo_local";
            
            Cursor cV = db.rawQuery("SELECT quilometragem FROM " + tbVeiculo + " LIMIT 1", null);
            int kmAtual = 0;
            if (cV.moveToFirst()) kmAtual = cV.getInt(cV.getColumnIndexOrThrow("quilometragem"));
            cV.close();
    
            if (kmAtual <= 0) return;
    
            // 2. Busca manutenções programadas
            String tbManutencao = findTableWithColumn(db, "proximaData"); // Procura a tabela de manutenção
            if (tbManutencao == null) tbManutencao = "manutencao_local";
    
            Cursor cM = db.rawQuery("SELECT tipo, proximoKm FROM " + tbManutencao + " WHERE proximoKm IS NOT NULL", null);
            
            boolean disparouAlgo = false; // Controle para saber se já gastamos o cooldown de hoje
            
            while (cM.moveToNext()) {
                String tipo = cM.getString(cM.getColumnIndexOrThrow("tipo"));
                int proximoKm = cM.getInt(cM.getColumnIndexOrThrow("proximoKm"));
                
                // NOVO LIMITE: Só alerta se faltam 100km OU se já passou, mas passou NO MÁXIMO 500km da revisão.
                // Isso evita que o celular fique alertando revisões muito antigas (de 10 anos atrás).
                if (kmAtual >= (proximoKm - 100) && kmAtual <= (proximoKm + 500)) {
                    String mensagem = kmAtual >= proximoKm ? 
                        "URGENTE: A revisão de " + tipo + " passou do limite (" + proximoKm + " km)!" : 
                        "Seu carro atingiu " + kmAtual + " km. A revisão de " + tipo + " está programada para " + proximoKm + " km.";
                    
                    // Dispara o Push Nativo e segue em frente (sem break, alertando todas na janela)
                    dispararAlertaFalha("Lembrete de Manutenção", mensagem);
                    disparouAlgo = true;
                }
            }
            cM.close();
            
            // Se nenhum alerta foi disparado nesta varredura (ex: todas as revisões são velhas > 500km),
            // a gente "zera" o tempo de cooldown, para que ele possa verificar de novo antes de amanhã.
            if (!disparouAlgo) {
                ultimoTempoAlertaManutencao = 0; 
            }
            
        } catch (Exception e) {
            Log.e("HealthCar_SQLite", "Erro ao verificar manutenções em background", e);
        } finally {
            if (db != null && db.isOpen()) db.close();
        }
    }

    // =========================================================
    // ALERTAS PUSH / UI
    // =========================================================

    // Monta o PUSH para apitar na tela de bloqueio do celular
    private void dispararAlertaFalha(String titulo, String mensagem) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        // Se o usuário clicar, vai direto para a tela de Scanner no React Native
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("healthcartcc://scanner"));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 
                0, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification alertNotification = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(titulo)
                .setContentText(mensagem)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent) 
                .setPriority(NotificationCompat.PRIORITY_HIGH) // PRIORITY_HIGH faz a tela acender e vibrar pesado
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true) 
                .build();

        manager.notify((int) System.currentTimeMillis(), alertNotification);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isMonitoring = false;
        instance = null; 
        if (monitorThread != null) monitorThread.interrupt(); 
        flushBufferToBanco(); // Salva qualquer resíduo na memória RAM antes de desligar o serviço
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); // Devolve a bateria pro sistema
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                // Canal Silencioso (Monitoramento Oculto)
                NotificationChannel serviceChannel = new NotificationChannel(
                        CHANNEL_ID, "Monitoramento Contínuo HealthCar", NotificationManager.IMPORTANCE_LOW);
                // Canal Crítico (Alertas que fazem barulho)
                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID, "Alertas Críticos do Veículo", NotificationManager.IMPORTANCE_HIGH);

                manager.createNotificationChannel(serviceChannel);
                manager.createNotificationChannel(alertChannel);
            }
        }
    }
}