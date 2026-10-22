/* 记账本 · 逻辑分片 5 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ========== 钱去哪了：饼图详情 ==========
     用 SVG 环形图。每一段用 dasharray 控制长度，dashoffset 控制起点，
     再把 dashoffset 用 CSS 动画从"整圈"收到目标值 —— 就是"一圈圈画出来"的出场效果。
     dasharray / dashoffset 都写在元素上是最终值，所以动画不执行图也是完整的。 */
  function renderCatPanel() {
    var m = state.homeMonth || thisMonth();
    var s = stats(m);

    $('catTotal').textContent = monthLabel(m) + ' · 共 ' + s.cats.length +
      ' 类 · 合计 ¥' + money(s.exp);

    var PIE_COLORS = ['#2f6bf6', '#ff6b4a', '#00b894', '#f5a623', '#8b5cf6', '#e0507a', '#0ea5e9', '#94a3b8'];

    $('catCenterAmt').textContent = s.cats.length ? ('¥' + money(s.exp)) : '';

    if (!s.cats.length) {
      $('catPie').innerHTML = '';
      $('catLegend').innerHTML = '<div class="noti-empty">这个月还没有支出</div>';
      return;
    }

    /* 每个分类有几笔 */
    var cnt = {}, j;
    for (j = 0; j < s.list.length; j++) {
      if (s.list[j].type === 'expense') {
        cnt[s.list[j].category] = (cnt[s.list[j].category] || 0) + 1;
      }
    }

    var CX = 172, CY = 108, R = 56, CIRC = 2 * Math.PI * R;
    var rings = '', legend = '', cum = 0, i, c, len, color, a;
    var lefts = [], rights = [];

    for (i = 0; i < s.cats.length; i++) {
      c = s.cats[i];
      color = PIE_COLORS[i % PIE_COLORS.length];   // 按金额排名配色：最大的最醒目
      len = c.pct / 100 * CIRC;

      rings += '<circle class="seg" cx="' + CX + '" cy="' + CY + '" r="' + R + '" stroke="' + color + '"' +
        ' stroke-dasharray="' + len.toFixed(2) + ' ' + CIRC.toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-cum).toFixed(2) + '"' +
        ' style="--d:' + (i * 0.07).toFixed(2) + 's"></circle>';

      /* 这一段的中点角度（0 = 3 点钟方向，要减去 90 才是从 12 点开始） */
      a = ((cum + len / 2) / CIRC * 360 - 90) * Math.PI / 180;
      cum += len;

      var item = {
        x1: CX + Math.cos(a) * (R + 9),
        y1: CY + Math.sin(a) * (R + 9),
        x2: CX + Math.cos(a) * (R + 26),
        y: CY + Math.sin(a) * (R + 26),
        name: c.name, amount: c.amount, pct: c.pct, color: color
      };
      (Math.cos(a) >= 0 ? rights : lefts).push(item);

      var isOpen = !!(state.pieOpen && state.pieOpen[c.name]);
      legend += '<div class="pl-row' + (isOpen ? ' open' : '') + '" data-piecat="' + esc(c.name) + '">' +
        '<span class="pl-idx">' + (i + 1) + '</span>' +
        '<span class="pl-dot" style="background:' + color + '"></span>' +
        '<span class="pl-name">' + c.ico + ' ' + esc(c.name) +
          '<i class="pl-cnt">' + (cnt[c.name] || 0) + ' 笔</i></span>' +
        '<span class="pl-amt">¥' + money(c.amount) + '</span>' +
        '<span class="pl-pct">' + c.pct.toFixed(1) + '%</span>' +
        '<span class="pl-arrow">' + (isOpen ? '▾' : '▸') + '</span>' +
        '</div>';

      /* 点开了就列出这一类下面的每一笔，直接看出钱花在哪几家 */
      if (isOpen) {
        var recs = [], m2;
        for (m2 = 0; m2 < s.list.length; m2++) {
          if (s.list[m2].type === 'expense' && s.list[m2].category === c.name) recs.push(s.list[m2]);
        }
        recs = sortRecords(recs, false);
        var sub = '';
        for (m2 = 0; m2 < recs.length; m2++) {
          sub += '<div class="pl-rec">' +
            '<span class="pl-rec-n">' + esc(recs[m2].merchant || recs[m2].note || '（没写备注）') + '</span>' +
            '<span class="pl-rec-d">' + esc((recs[m2].date || '').slice(5).replace('-', '/')) + '</span>' +
            '<span class="pl-rec-a">¥' + money(recs[m2].amount) + '</span>' +
            '</div>';
        }
        legend += '<div class="pl-sub">' + sub + '</div>';
      }
    }

    /* 同一侧的标签纵向错开，免得叠在一起 */
    function spread(arr) {
      arr.sort(function (p, q) { return p.y - q.y; });
      var gap = 30, top = 14, bot = 202, t;
      for (t = 1; t < arr.length; t++) {
        if (arr[t].y - arr[t - 1].y < gap) arr[t].y = arr[t - 1].y + gap;
      }
      for (t = arr.length - 1; t >= 0; t--) {
        var limit = bot - (arr.length - 1 - t) * gap;
        if (arr[t].y > limit) arr[t].y = limit;
      }
      if (arr.length && arr[0].y < top) arr[0].y = top;
      return arr;
    }

    function emit(arr, right) {
      var out = '', t, it, tx = right ? 338 : 6, hx = right ? 330 : 14;
      var anchor = right ? 'end' : 'start';
      for (t = 0; t < arr.length; t++) {
        it = arr[t];
        out += '<polyline points="' + it.x1.toFixed(1) + ',' + it.y1.toFixed(1) + ' ' +
            it.x2.toFixed(1) + ',' + it.y.toFixed(1) + ' ' + hx + ',' + it.y.toFixed(1) + '"' +
            ' fill="none" stroke="' + it.color + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<text x="' + tx + '" y="' + (it.y - 2).toFixed(1) + '" text-anchor="' + anchor +
            '" font-size="12" font-weight="600" fill="#1f2126">' + esc(it.name) + '</text>' +
          '<text x="' + tx + '" y="' + (it.y + 12).toFixed(1) + '" text-anchor="' + anchor +
            '" font-size="10.5" fill="#8b8f99">' + it.pct.toFixed(0) + '% · ¥' + money(it.amount) + '</text>';
      }
      return out;
    }

    $('catPie').setAttribute('viewBox', '0 0 344 216');
    $('catPie').innerHTML =
      '<g transform="rotate(-90 ' + CX + ' ' + CY + ')">' + rings + '</g>' +
      emit(spread(lefts), false) + emit(spread(rights), true);
    $('catLegend').innerHTML = legend;
  }

  $('btnAllCats').addEventListener('click', function () {
    $('catPanel').classList.add('on');
    renderCatPanel();
  });
  /* 饼图：点分类行 → 进入独立的分类明细页 */
  $('catLegend').addEventListener('click', function (e) {
    var row = e.target.closest('[data-piecat]');
    if (!row) return;
    state.detailCat = row.getAttribute('data-piecat');
    renderCatDetail();
    $('catDetail').classList.add('on');
  });

  $('cdBack').addEventListener('click', function () { $('catDetail').classList.remove('on'); });
  $('cdClose').addEventListener('click', function () {
    $('catDetail').classList.remove('on');
    $('catPanel').classList.remove('on');
  });

  /* 渲染分类明细页 */
  function renderCatDetail() {
    var PIE_COLORS = ['#2f6bf6', '#ff6b4a', '#00b894', '#f5a623', '#8b5cf6', '#e0507a', '#0ea5e9', '#94a3b8'];
    var m = state.homeMonth || thisMonth();
    var s = stats(m);
    var name = state.detailCat || '';
    var c = null, i, j;

    for (i = 0; i < s.cats.length; i++) {
      if (s.cats[i].name === name) { c = s.cats[i]; break; }
    }
    if (!c) {
      $('cdTitle').textContent = name;
      $('cdSum').textContent = '';
      $('cdList').innerHTML = empty('这一类没有记录');
      return;
    }

    $('cdTitle').innerHTML = '<span class="cd-dot" style="background:' +
      PIE_COLORS[i % PIE_COLORS.length] + '"></span>' + esc(name);
    $('cdSum').textContent = monthLabel(m) + ' · 占 ' + c.pct.toFixed(1) +
      '% · 合计 ¥' + money(c.amount);

    var recs = [];
    for (j = 0; j < s.list.length; j++) {
      if (s.list[j].type === 'expense' && s.list[j].category === name) recs.push(s.list[j]);
    }
    recs = sortRecords(recs, false);

    var html = '';
    for (j = 0; j < recs.length; j++) html += rowHTML(recs[j], false);
    $('cdList').innerHTML = html || empty('这一类没有记录');
  }

  $('catClose').addEventListener('click', function () {
    $('catPanel').classList.remove('on');
  });

  /* 概览页：点对比里的月份，直接翻到那个月 */
  $('heroCmp').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-gomonth]');
    if (!b) return;
    state.homeMonth = b.getAttribute('data-gomonth');
    renderHome();
    window.scrollTo(0, 0);
  });

  /* 概览页：切换月份 */
  function shiftHomeMonth(delta) {
    var m = state.homeMonth || thisMonth();
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) + delta;
    while (mo < 1) { mo += 12; y--; }
    while (mo > 12) { mo -= 12; y++; }
    state.homeMonth = y + '-' + pad2(mo);
    renderHome();
    window.scrollTo(0, 0);
  }
  $('homePrev').addEventListener('click', function () { shiftHomeMonth(-1); });
  $('homeNext').addEventListener('click', function () { shiftHomeMonth(1); });

  /* 概览页：查看全部明细 */
  $('btnAllRec').addEventListener('click', function () { switchTab('stat'); });
