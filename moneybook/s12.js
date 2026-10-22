/* 记账本 · 逻辑分片 12 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 开场动画（每次打开都播） ---------- */
  function runIntro() {
    var el = $('intro');
    if (!el) return;

    var hidden = false;
    function hide() {
      if (hidden) return;
      hidden = true;
      el.classList.add('gone');
      // 淡出本身 0.7 秒，结束后彻底移出显示
      window.setTimeout(function () { el.style.display = 'none'; }, 750);
    }

    // 动画本身约 3.7 秒，再停一下让人把字看完，然后自动淡出
    window.setTimeout(hide, 4600);

    // 不想等的：点一下屏幕立刻跳过。
    // 每次都播的动画，必须留一个"跳过"的出口，否则会变成每天都要交的过路费。
    el.addEventListener('click', hide);
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (!storageOK) {
      var w = $('warn');
      w.classList.add('show');
      w.textContent = '⚠️ 当前浏览器不允许本机保存数据（可能开了无痕模式，或 Edge 设置里禁用了站点数据）。现在可以正常记账，但关掉页面后记录会丢失。';
    }
    $('date').value = todayStr();
    state.month = thisMonth();
    $('month').value = state.month;
    renderType();
    renderCats();
    renderTab();
    renderAll();

    // 在 App 里显示版本号（网页版没有原生桥，所以不显示）
    var nb = nativeBridge();
    if (nb) {
      try {
        var ver = nb.versionName();
        if (ver) {
          $('appVer').textContent = 'App 版本 ' + ver;
          $('appVer').style.display = '';
        }
      } catch (e) {}
    }

    runIntro();
  }
  init();
