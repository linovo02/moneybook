/* 记账本 · 逻辑分片 4 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 渲染：统计 ---------- */
  function stats(m) {
    var list = state.records.filter(function (r) { return monthOf(r.date) === m; });
    var exp = 0, inc = 0, sav = 0;
    var byCat = {};
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.type === 'expense') {
        exp += r.amount;
        byCat[r.category] = (byCat[r.category] || 0) + r.amount;
      } else if (r.type === 'income') inc += r.amount;
      else sav += r.amount;
    }
    var cats = [];
    for (var k in byCat) if (Object.prototype.hasOwnProperty.call(byCat, k)) cats.push({ name: k, amount: byCat[k] });
    cats.sort(function (a, b) { return b.amount - a.amount; });
    for (var j = 0; j < cats.length; j++) {
      cats[j].pct = exp > 0 ? (cats[j].amount / exp) * 100 : 0;
      var info = catInfo(cats[j].name);
      cats[j].ico = info.ico;
      cats[j].color = info.color;
    }
    return { list: list, exp: exp, inc: inc, sav: sav, cats: cats };
  }

  function renderStat() {
    var m = state.month || thisMonth();
    state.month = m;
    var s = stats(m);
    var balance = s.inc - s.exp - s.sav;

    $('sums').innerHTML =
      '<div class="sum"><div class="k">支出</div><div class="v expense">-' + money(s.exp) + '</div></div>' +
      '<div class="sum"><div class="k">收入</div><div class="v income">+' + money(s.inc) + '</div></div>' +
      '<div class="sum"><div class="k">存钱</div><div class="v saving">-' + money(s.sav) + '</div></div>';
    $('monthTip').innerHTML = '收入 - 支出 - 存钱 = <b style="color:' + (balance < 0 ? 'var(--red)' : 'var(--green)') + '">' +
      (balance < 0 ? '-' : '') + money(Math.abs(balance)) + '</b>　|　共 ' + s.list.length + ' 笔';

    // 环形图 + 图例
    if (!s.cats.length) {
      $('donutWrap').innerHTML = empty('本月还没有支出记录');
    } else {
      var stops = [], cum = 0;
      for (var i = 0; i < s.cats.length; i++) {
        var from = (cum / s.exp) * 360;
        cum += s.cats[i].amount;
        var to = (cum / s.exp) * 360;
        stops.push(s.cats[i].color + ' ' + from.toFixed(2) + 'deg ' + to.toFixed(2) + 'deg');
      }
      var legend = '';
      for (var j = 0; j < s.cats.length; j++) {
        legend += '<div class="lg"><span class="dot" style="background:' + s.cats[j].color + '"></span>' +
          '<span class="name">' + s.cats[j].ico + ' ' + esc(s.cats[j].name) + '</span>' +
          '<span class="pct">' + s.cats[j].pct.toFixed(1) + '%</span></div>';
      }
      $('donutWrap').innerHTML =
        '<div class="donut" style="background:conic-gradient(' + stops.join(',') + ')">' +
        '<div class="hole"><div class="k">总支出</div><div class="v">¥' + money(s.exp) + '</div></div></div>' +
        '<div class="legend">' + legend + '</div>';
    }

    // 分类条形明细
    if (!s.cats.length) {
      $('bars').innerHTML = empty('暂无数据');
    } else {
      var max = s.cats[0].amount;
      var html = '';
      for (var n = 0; n < s.cats.length; n++) {
        var c = s.cats[n];
        html += '<div class="bar">' +
          '<div class="h"><span class="name">' + c.ico + ' ' + esc(c.name) + '</span>' +
          '<span class="pct">' + c.pct.toFixed(1) + '%</span>' +
          '<span class="amt">¥' + money(c.amount) + '</span></div>' +
          '<div class="track"><div class="fill" style="width:' + (max > 0 ? (c.amount / max) * 100 : 0).toFixed(1) + '%;background:' + c.color + '"></div></div>' +
          '</div>';
      }
      $('bars').innerHTML = html;
    }

    // 本月明细
    var list = sortRecords(s.list, false);
    $('monthSub').textContent = monthLabel(m) + ' · ' + list.length + ' 笔';
    var out = '';
    for (var q = 0; q < list.length; q++) out += rowHTML(list[q], true);
    $('monthList').innerHTML = list.length ? out : empty('本月没有记录');
  }

  function renderTab() {
    var views = { home: $('view-home'), add: $('view-add'), stat: $('view-stat') };
    for (var k in views) views[k].classList.toggle('on', k === state.tab);
    var btns = $('tabbar').querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-tab') === state.tab);
  }

  function renderAll() { renderHome(); renderStat(); }

  /* 切页：三个页面一起重画，免得某个页停在旧数据上 */
  function switchTab(tab) {
    state.tab = tab;
    renderTab();
    renderAll();
    window.scrollTo(0, 0);
  }

  /* 存钱目标：编辑 / 保存 */
  $('goalBox').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-goal]');
    if (!btn) return;

    if (btn.getAttribute('data-goal') === 'edit') {
      goalEditing = true;
      renderHome();
      return;
    }

    var raw = $('goalInput') ? $('goalInput').value : '';
    var n = Number(String(raw).replace(/[^\d.]/g, ''));
    if (!isFinite(n) || n <= 0) { toast('请填一个大于 0 的数字'); return; }
    savingGoal = Math.round(n * 100) / 100;
    goalEditing = false;
    saveGoal();
    renderHome();
    toast('存钱目标已设为 ¥' + money(savingGoal));
  });
