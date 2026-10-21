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
 * ===== 为什么要这个东西 =====
 * 通知监听服务挂在 App 的进程里。华为/荣耀这类手机的"应用启动管理"会主动
 * 冻结或杀掉后台进程 —— 进程一死，监听就断了（表现就是"能连上，过一会儿又断"）。
 *
 * 唯一稳的办法是让系统知道"这个 App 正在干活"：开一个前台服务，并在通知栏
 * 常驻一条通知。钱迹、一木记账都是这么做的。
 *
 * ===== 隐私边界没变 =====
 * 这个服务只做一件事：往通知栏放一条"我在运行"的提示。
 * 它不读取任何东西，也不联网 —— 整个 App 依然没有 INTERNET 权限。
 */
public class KeepAlive extends Service {

    private static final String CHANNEL = "moneybook_keepalive";
    private static final int NOTI_ID = 1001;

    /** 从任何地方把保活服务拉起来 */
    public static void start(Context c) {
        if (c == null) return;
        try {
            Intent i = new Intent(c, KeepAlive.class);
            if (Build.VERSION.SDK_INT >= 26) {
                c.startForegroundService(i);
            } else {
                c.startService(i);
            }
        } catch (Exception ignored) {
            // 系统不让起就算了，不崩
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
        } catch (Exception ignored) {
            // 起不来也不能让 App 崩
        }
        return START_STICKY;   // 被系统杀了以后，尽量自己回来
    }
}
