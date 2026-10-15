package com.xiaolin.moneybook;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 一个最小的 WebView 外壳。
 *
 * 思路：界面、统计、账单导入这些逻辑我们已经在 moneybook/index.html 里写好了，
 * 全部经过 69 项自动化测试。所以这里不重写任何业务逻辑，只做一件事：
 * 把这个网页当成 App 的主界面加载进来。
 *
 * 好处是「一份代码，两个形态」——同一个 index.html 既是网页版，也是 APK 的界面。
 * 以后加通知自动记账时，原生这边只负责把解析出来的记录塞给网页，界面照样复用。
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        setContentView(web);

        if (savedInstanceState == null) {
            web.loadUrl("file:///android_asset/index.html");
        } else {
            web.restoreState(savedInstanceState);
        }
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
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
