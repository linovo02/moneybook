/* 记账本 · 逻辑分片 10 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ========== 通知调试面板 ==========
     只在 App 里可用：通过 window.XiaolinApp 调原生能力。
     浏览器里没有这个对象，所以按钮会提示"只在 App 里能用"，不会报错。 */
  function nativeBridge() {
    try {
      return (typeof window !== 'undefined' && window.XiaolinApp) ? window.XiaolinApp : null;
    } catch (e) { return null; }
  }

  function two(n) { return n < 10 ? ('0' + n) : String(n); }

  function fmtClock(ms) {
    if (!ms) return '';
    var d = new Date(Number(ms));
    return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
  }

  function refreshNoti() {
    var app = nativeBridge();
    if (!app) return;

    var has = false, conn = false, raw = '[]';
    try {
      has = !!app.hasAccess();
      conn = !!app.listenerConnected();
      raw = app.notifications() || '[]';
    } catch (e) {}

    // 保活服务状态：running / error: 原因 / not_started
    var ka = '';
    try { ka = (app.keepAlive && app.keepAlive()) || ''; } catch (e) { ka = ''; }
    var kaText = (ka === 'running')
      ? '保活：运行中 ✓'
      : (ka.indexOf('error:') === 0
          ? ('保活启动失败：' + ka.slice(6))
          : '保活：未启动（点「刷新」重试）');

    $('notiStatus').textContent = (!has
      ? '还没授权 —— 现在读不到任何通知。点下面「去开通知使用权」。'
      : (conn ? '已授权，监听服务运行中。' : '已授权，但监听服务还没连上。')) +
      ' ｜ ' + kaText;

    var list = [];
    try { list = JSON.parse(raw); } catch (e) { list = []; }

    if (!list || !list.length) {
      $('notiList').innerHTML = '<div class="noti-empty">' +
        (has ? '还没收到通知。去用微信或支付宝付一笔小钱试试。'
             : '先授权，然后去付一笔小钱试试。') + '</div>';
      return;
    }

    var html = '', i, it;
    for (i = 0; i < list.length && i < 60; i++) {
      it = list[i];
      html += '<div class="noti-item">' +
        '<div class="noti-h"><span class="noti-app">' + esc(it.app || it.pkg || '未知') + '</span>' +
        '<span class="noti-time">' + esc(fmtClock(it.time)) + '</span></div>' +
        '<div class="noti-t">' + esc(it.title || '(无标题)') + '</div>' +
        '<div class="noti-b">' + esc(it.text || '(正文为空)') + '</div>' +
        '</div>';
    }
    $('notiList').innerHTML = html;
  }

  $('btnNoti').addEventListener('click', function () {
    if (!nativeBridge()) {
      toast('这个功能只在 App 里能用，网页版读不到通知');
      return;
    }
    $('notiPanel').classList.add('on');
    refreshNoti();
  });

  $('notiRefresh').addEventListener('click', function () {
    var app = nativeBridge();
    try { if (app && app.startKeepAlive) app.startKeepAlive(); } catch (e) {}
    refreshNoti();
  });
  $('notiClose').addEventListener('click', function () { $('notiPanel').classList.remove('on'); });

  $('notiPerm').addEventListener('click', function () {
    var app = nativeBridge();
    if (!app) return;
    try { app.openSettings(); } catch (e) {}
    toast('在列表里找到「记账本」，把开关打开');
  });

  $('notiClear').addEventListener('click', function () {
    var app = nativeBridge();
    if (!app) return;
    try { app.clear(); } catch (e) {}
    refreshNoti();
    toast('已清空内存里的通知');
  });
