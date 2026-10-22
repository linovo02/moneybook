/* 记账本 · 逻辑分片 7 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 事件：统计类 ---------- */
  $('month').addEventListener('change', function () {
    state.month = $('month').value || thisMonth();
    renderStat();
  });

  $('tabbar').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    switchTab(btn.getAttribute('data-tab'));
  });

  $('btnExport').addEventListener('click', function () {
    if (!state.records.length) { toast('还没有数据'); return; }
    try {
      var text = JSON.stringify(state.records, null, 2);
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '记账备份_' + todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('已导出备份文件');
    } catch (err) {
      toast('导出失败，可改用清空以外的方式备份');
    }
  });

  /* ========== 分类学习：你改过一次，它下次就记住了 ==========
     为什么需要它：账单里的商家名经常是公司全称（如「北京三快在线科技有限公司」），
     靠内置关键词永远覆盖不全。所以让你改一次，App 记住这个商家，
     下次凡是它出现就自动归到你选的那一类 —— 越用越准，而且全在本机。 */
  var LEARN_KEY = 'xiaolin_learn_v1';

  function loadLearned() {
    try {
      var raw = window.localStorage.getItem(LEARN_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
      return o;
    } catch (e) { return {}; }
  }

  var learned = loadLearned();

  function saveLearned() {
    try { window.localStorage.setItem(LEARN_KEY, JSON.stringify(learned)); } catch (e) {}
  }

  function merchantKey(name) {
    return trimCell(name).slice(0, 40);
  }

  /* 查学习结果：先精确匹配，再"包含匹配"
     （同一个商家在账单里可能带后缀，比如「肯德基(万达店)」） */
  function classifyLearned(name) {
    var m = merchantKey(name);
    if (!m) return '';
    if (Object.prototype.hasOwnProperty.call(learned, m)) return learned[m];
    for (var k in learned) {
      if (Object.prototype.hasOwnProperty.call(learned, k) && k.length >= 2 && m.indexOf(k) >= 0) {
        return learned[k];
      }
    }
    return '';
  }

  function learnMerchant(name, category) {
    var m = merchantKey(name);
    if (!m) return '';
    learned[m] = category;
    saveLearned();
    return m;
  }
