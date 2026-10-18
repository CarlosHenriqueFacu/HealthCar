package com.anonymous.HealthCar_TCC;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class OBDBluetoothService extends Service {

    private static final String CHANNEL_ID = "HealthCarMonitorChannel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("HealthCar - Monitoramento Ativo")
                .setContentText("A analisar a telemetria do veículo em segundo plano...")
                .setSmallIcon(R.mipmap.ic_launcher) // Substitua pelo ícone da sua notificação se necessário
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        // O ID '1' é arbitrário. Inicia o serviço em modo foreground fixo.
        startForeground(1, notification);

        // START_STICKY avisa ao Android para reiniciar este serviço se ele for morto por falta de memória
        return START_STICKY; 
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // O Android remove a notificação automaticamente quando o serviço para.
    }

    @Override
    public IBinder onBind(Intent intent) {
        // Não estamos usando "bound service", apenas "started service"
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Canal de Monitoramento de Segurança do Veículo",
                    NotificationManager.IMPORTANCE_LOW // Low importance para não ficar apitando e incomodando
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}