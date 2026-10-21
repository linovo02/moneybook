package com.xiaolin.moneybook;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 通知监听服务（自动记账的地基）。
 *
 * ===== 这个类现在只做一件事：把收到的通知"记在内存里"，让你能看见 =====
 * 不做任何解析、不生成任何账目记录。因为第一步必须先确认：
 * **你的手机到底能不能读到微信 / 支付宝的支付通知。**
 * 读不到的话，后面的解析规则写得再漂亮都是白做。
 *
 * ===== 隐私边界（很重要）=====
 *   · 只在内存里留最近 200 条，**不写文件**
 *   · **不联网**（App 里连 INTERNET 权限都没有，想传也传不出去）
 *   · App 一退出，内存里的东西就没了
 *   · 你可以在调试面板里随时「清空」
 *
 * 要收到通知，用户必须在系统设置里手动打开「通知使用权」——
 * 这是安卓的硬性要求，绕不过去，也不该绕过去。
 */
public class NotifyListener extends NotificationListenerService {

    /** 最多留多少条 */
    private static final int MAX_KEEP = 200;

    /** 最近收到的通知：只放内存，不落盘、不联网 */
    private static final List<Entry> BUFFER = Collections.synchronizedList(new ArrayList<Entry>());

    /** 监听服务是否已经连上（用户在设置里授权后才会连上） */
    private static volatile boolean connected = false;

    public static boolean isConnected() {
        return connected;
    }

    public static void clear() {
        BUFFER.clear();
    }

    /** 把缓冲区导成 JSON 给网页用（最新的在前） */
    public static String toJson() {
        JSONArray arr = new JSONArray();
        synchronized (BUFFER) {
            for (int i = BUFFER.size() - 1; i >= 0; i--) {
                try {
                    arr.put(BUFFER.get(i).toJson());
                } catch (Exception ignored) {
                }
            }
        }
        return arr.toString();
    }

    @Override
    public void onListenerConnected() {
        connected = true;
        super.onListenerConnected();
        // 连上了就顺手拉起保活服务：常驻一条通知，系统就不容易把这个进程杀掉
        KeepAlive.start(this);
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        super.onListenerDisconnected();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        try {
            Notification n = sbn.getNotification();
            if (n == null) return;

            Bundle e = n.extras;
            String title = e == null ? "" : str(e.getCharSequence(Notification.EXTRA_TITLE));
            String text = e == null ? "" : str(e.getCharSequence(Notification.EXTRA_TEXT));
            String big = e == null ? "" : str(e.getCharSequence(Notification.EXTRA_BIG_TEXT));
            // 有些 App（包括支付宝）正文放在 bigText 里，普通 text 是空的
            if (text.isEmpty() && !big.isEmpty()) text = big;

            Entry it = new Entry();
            it.pkg = sbn.getPackageName();
            it.app = appLabel(sbn.getPackageName());
            it.title = title;
            it.text = text;
            it.time = sbn.getPostTime();

            BUFFER.add(it);
            while (BUFFER.size() > MAX_KEEP) {
                BUFFER.remove(0);
            }
        } catch (Exception ignored) {
        }
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }

    /** 把包名换成用户看得懂的名字，比如 com.tencent.mm → 微信 */
    private String appLabel(String pkg) {
        try {
            android.content.pm.PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    static class Entry {
        String pkg = "";
        String app = "";
        String title = "";
        String text = "";
        long time = 0;

        JSONObject toJson() throws Exception {
            JSONObject o = new JSONObject();
            o.put("pkg", pkg);
            o.put("app", app);
            o.put("title", title);
            o.put("text", text);
            o.put("time", time);
            return o;
        }
    }
}
