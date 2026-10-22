package com.xiaolin.moneybook;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

/**
 * 一个最小的 WebView 外壳。
 *
 * 思路：界面、统计、账单导入这些逻辑我们已经在 moneybook/index.html 里写好了，
 * 全部经过自动化测试。所以这里不重写任何业务逻辑，只做一件事：
 * 把这个网页当成 App 的主界面加载进来。
 *
 * 好处是「一份代码，两个形态」——同一个 index.html 既是网页版，也是 APK 的界面。
 * 以后加通知自动记账时，原生这边只负责把解析出来的记录塞给网页，界面照样复用。
 *
 * ============================================================
 * 这里有一段非常重要的原生桥，缺了它 App 会「看起来正常、其实残废」：
 *
 *   1. onShowFileChooser —— 网页里的 <input type="file"> 选文件
 *      「导入备份」「导入微信/支付宝账单」都靠它。不实现 = 按钮点下去毫无反应。
 *
 *   2. onJsAlert / onJsConfirm / onJsPrompt —— 网页里的 alert/confirm/prompt
 *      删记录、导入账单、重算分类都要弹确认框。不实现的话，这些确认
 *      可能静默返回 false —— 表现就是「点了没反应」，比报错还难查。
 *
 * 这两个坑都属于同一类：**网页里由浏览器代劳的事，进了 WebView 全要自己接。**
 * ============================================================
 */
public class MainActivity extends Activity {

    /** 请求码：选文件 */
    private static final int REQ_PICK_FILE = 1001;

    private WebView web;

    /** 网页正在等我们选完文件，把结果还给它 */
    private ValueCallback<Uri[]> pendingFileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 一进 App 就把保活服务拉起来（常驻一条通知）。
        // ⚠️ 这一句必须在这里，不能只放在 NotifyListener 的回调里 ——
        //    因为监听"连不上"的时候回调根本不执行，保活也就永远起不来（这是个死循环）。
        KeepAlive.start(this);

        // Android 13 起，常驻通知要用户允许才显示；没授权就顺手要一下
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 2001);
                }
            } catch (Exception ignored) { }
        }

        web = new WebView(this);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        // 关键：账目数据就存在 WebView 的 localStorage 里，不打开这个，记完就丢
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // 固定字体缩放，否则系统调大字体时布局会被撑坏
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        // 让页面里的链接留在 App 内，不要跳出去开浏览器
        web.setWebViewClient(new WebViewClient());

        // 网页通过 window.XiaolinApp 访问原生能力（通知调试面板用）。
        // 安全上没问题：我们只加载自己打包在 assets 里的 HTML，没有任何远程页面。
        web.addJavascriptInterface(new Bridge(), "XiaolinApp");

        web.setWebChromeClient(new WebChromeClient() {

            /* ---------- 桥 1：网页选文件 ---------- */
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             WebChromeClient.FileChooserParams params) {
                // 上一次还没还回去的，先作废，避免回调一直挂着
                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // 用 */* 而不是网页里写的 accept：
                // 各家手机对 csv / json 的 MIME 识别不一致，写死了会选不中文件
                intent.setType("*/*");

                try {
                    startActivityForResult(Intent.createChooser(intent, "选择文件"), REQ_PICK_FILE);
                    return true;
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
            }

            /* ---------- 桥 2：alert / confirm / prompt ---------- */
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setCancelable(false)
                        .setPositiveButton("知道了", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.confirm(); }
                        })
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setCancelable(false)
                        .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.confirm(); }
                        })
                        .setNegativeButton("取消", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.cancel(); }
                        })
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                      final JsPromptResult result) {
                final EditText input = new EditText(MainActivity.this);
                input.setText(defaultValue == null ? "" : defaultValue);
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setView(input)
                        .setCancelable(false)
                        .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) {
                                result.confirm(input.getText().toString());
                            }
                        })
                        .setNegativeButton("取消", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.cancel(); }
                        })
                        .show();
                return true;
            }
        });

        setContentView(web);

        if (savedInstanceState == null) {
            web.loadUrl("file:///android_asset/index.html");
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    /* ============================================================
       给网页用的桥
       网页里通过 window.XiaolinApp.xxx() 调用
       ============================================================ */
    public class Bridge {

        /** 最近收到的通知（JSON 字符串，最新的在前） */
        @android.webkit.JavascriptInterface
        public String notifications() {
            return NotifyListener.toJson();
        }

        /** 用户有没有在系统设置里打开「通知使用权」 */
        @android.webkit.JavascriptInterface
        public boolean hasAccess() {
            return hasNotifyAccess();
        }

        /** 监听服务是否真的连上了（刚授权完可能要重启一次 App） */
        @android.webkit.JavascriptInterface
        public boolean listenerConnected() {
            return NotifyListener.isConnected();
        }

        /** 跳到系统的「通知使用权」设置页 */
        @android.webkit.JavascriptInterface
        public void openSettings() {
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception e) {
                try {
                    startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
                } catch (Exception ignored) { }
            }
        }

        /** 清空内存里的通知 */
        @android.webkit.JavascriptInterface
        public void clear() {
            NotifyListener.clear();
        }

        /** App 版本号 —— 显示在网页里，这样一眼就知道装的是哪一版 */
        @android.webkit.JavascriptInterface
        public String versionName() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }

    /** 检查「通知使用权」有没有授予本 App */
    private boolean hasNotifyAccess() {
        try {
            String flat = android.provider.Settings.Secure.getString(
                    getContentResolver(), "enabled_notification_listeners");
            return flat != null && flat.contains(getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    /** 文件选择器回来了：把选中的文件交还给网页 */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_PICK_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    result = new Uri[]{ uri };
                }
            }
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(result);
                pendingFileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** 转屏、切后台时保存页面状态，回来不会白屏 */
    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    /** 返回键：网页里能后退就后退，退到底才退出 App */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
