package com.xiaolin.moneybook;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * 保活服务：让通知监听在后台不被系统杀掉。
 *
 * ===== 这一版的重点：不再"静默失败" =====
 * 上一版把所有异常都 catch 住丢掉了，结果"保活没生效"完全查不出原因。
 * 现在把失败原因记在 lastError 里，网页上能直接看到 —— 能看见才修得动。
 *
 * ===== 隐私边界没变 =====
 * 只往通知栏放一条提示。不读任何东西，不联网（App 依然没有 INTERNET 权限）。
 */
public class KeepAlive extends Service {

    private static final String CHANNEL = "moneybook_keepalive";
    private static final int NOTI_ID = 1001;

    /** 上一次启动失败的原因；空字符串 = 没失败过 */
    private static volatile String lastError = "";

    /** 服务是否已经跑起来（startForeground 成功） */
    private static volatile boolean running = false;

    public static boolean isRunning() { return running; }

    public static String getError() { return lastError; }

    /** 给网页看的一句话状态 */
    public static String stateText() {
        if (running) return "running";
        if (lastError.length() > 0) return "error: " + lastError;
        return "not_started";
    }

    public static void start(Context c) {
        if (c == null) return;
        try {
            Intent i = new Intent(c, KeepAlive.class);
            if (Build.VERSION.SDK_INT >= 26) {
                c.startForegroundService(i);
            } else {
                c.startService(i);
            }
        } catch (Exception e) {
            lastError = "startForegroundService: " + e.getClass().getSimpleName()
                    + (e.getMessage() == null ? "" : (" " + e.getMessage()));
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm =
                        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    NotificationChannel ch = new NotificationChannel(
                            CHANNEL, "自动记账", NotificationManager.IMPORTANCE_MIN);
                    ch.setShowBadge(false);
                    nm.createNotificationChannel(ch);
                }
            }

            Notification.Builder b = (Build.VERSION.SDK_INT >= 26)
                    ? new Notification.Builder(this, CHANNEL)
                    : new Notification.Builder(this);

            Notification n = b
                    .setContentTitle("记账本正在记录支付通知")
                    .setContentText("保持这条通知，才能持续自动记账")
                    .setSmallIcon(android.R.drawable.stat_notify_sync)
                    .setOngoing(true)
                    .build();

            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTI_ID, n,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTI_ID, n);
            }
            running = true;
            lastError = "";
        } catch (Exception e) {
            running = false;
            // 关键：把原因留下来，别再默默吞掉
            lastError = "startForeground: " + e.getClass().getSimpleName()
                    + (e.getMessage() == null ? "" : (" " + e.getMessage()));
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }
}
