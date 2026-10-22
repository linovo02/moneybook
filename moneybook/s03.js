/* 记账本 · 逻辑分片 3 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 渲染：记录行 ---------- */
  function rowHTML(r, showDate) {
    var info = catInfo(r.category);
    var t = TYPES[r.type] || TYPES.expense;
    var ico = r.type === 'expense' ? info.ico : t.ico;
    var sub = showDate ? r.date.slice(5).replace('-', '/') + ' ' : '';
    sub += t.name + ' · ' + r.category;
    if (r.note) sub += ' · ' + r.note;
    return '<div class="item" data-edit="' + esc(r.id) + '">' +
      '<div class="ic">' + ico + '</div>' +
      '<div class="mid"><div class="t1">' + esc(r.category) + (r.note ? ' <span style="font-weight:400;color:#8b8f99">' + esc(r.note) + '</span>' : '') + '</div>' +
      '<div class="t2">' + esc(sub) + '</div></div>' +
      '<div class="amt ' + r.type + '">' + t.sign + money(r.amount) + '</div>' +
      '<button type="button" class="del" data-del="' + esc(r.id) + '" aria-label="删除">✕</button>' +
      '</div>';
  }

  function sortRecords(list, asc) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? (asc ? -1 : 1) : (asc ? 1 : -1);
      var sa = Number(a.seq) || a.created || 0;
      var sb = Number(b.seq) || b.created || 0;
      if (sa !== sb) return asc ? sa - sb : sb - sa;
      return asc ? (a.created - b.created) : (b.created - a.created);
    });
  }

  /* ---------- 渲染：概览页（第一屏） ---------- */
  var GOAL_KEY = 'xiaolin_goal_v1';

  function loadGoal() {
    try {
      var v = Number(window.localStorage.getItem(GOAL_KEY));
      return (isFinite(v) && v > 0) ? v : 0;
    } catch (e) { return 0; }
  }
  function saveGoal() {
    try { window.localStorage.setItem(GOAL_KEY, String(savingGoal)); } catch (e) {}
  }

  var savingGoal = loadGoal();

  var goalEditing = false;

  /* 某个月有多少天 */
  function daysInMonth(m) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    return new Date(y, mo, 0).getDate();
  }

  /* 花钱节奏：过了多少天、日均多少、照这速度月底大概多少。
     这是"我还能不能花"的预判，比单纯的总数有用得多。 */
  function paceText(m, exp) {
    var total = daysInMonth(m);
    var cur = thisMonth();
    var days, tail;

    if (m === cur) {
      days = Number(todayStr().slice(8, 10));
      tail = days > 0 ? (' · 月底约 ¥' + money(exp / days * total)) : '';
    } else if (m < cur) {
      days = total;
      tail = ' · 整月合计';
    } else {
      return '';
    }
    if (days <= 0) return '';
    var head = (m === cur) ? ('已过 ' + days + ' 天') : ('全月 ' + total + ' 天');
    return head + ' · 日均 ¥' + money(exp / days) + tail;
  }

  function renderGoal(m, saved) {
    // 月份已经在页面顶部显示，这里不再重复
    $('goalTip').textContent = '';

    // 没设目标、也不在编辑：只占一行，不浪费首页最贵的地段
    if (!goalEditing && savingGoal <= 0) {
      $('goalBox').innerHTML =
        '<button type="button" class="goal-line" data-goal="edit">还没设存钱目标，去设一个 →</button>';
      return;
    }

    // 已设目标、不在编辑：显示进度
    if (!goalEditing) {
      var pct = saved / savingGoal * 100;
      if (pct > 100) pct = 100;
      var left = savingGoal - saved;
      $('goalBox').innerHTML =
        '<div class="goal-row"><span>目标 ¥' + money(savingGoal) + '</span>' +
        '<span>已存 ¥' + money(saved) + '</span></div>' +
        '<div class="track"><div class="fill" style="width:' + pct.toFixed(1) +
          '%;background:var(--blue)"></div></div>' +
        '<div class="goal-foot">' +
          (left > 0.004
            ? ('还差 <b>¥' + money(left) + '</b>')
            : ('🎉 已达成，多存了 <b>¥' + money(-left) + '</b>')) +
          ' <button type="button" class="linkbtn" style="width:auto;display:inline;margin:0;padding:4px 8px" data-goal="edit">改</button>' +
        '</div>';
      return;
    }

    // 编辑状态：给输入框
    $('goalBox').innerHTML =
      '<div class="goal-set-row">' +
        '<input type="number" inputmode="decimal" min="0" step="1" id="goalInput" placeholder="比如 1500"' +
        (savingGoal > 0 ? ' value="' + savingGoal + '"' : '') + '>' +
        '<button type="button" data-goal="save">保存</button>' +
      '</div>';
  }

  function renderHome() {
    var m = state.homeMonth || thisMonth();
    state.homeMonth = m;
    var s = stats(m);
    var balance = s.inc - s.exp - s.sav;

    $('homeMonthLabel').textContent = monthLabel(m);
    $('heroNum').textContent = '¥' + money(s.exp);

    // 和上一个月对比。必须把上月金额也显示出来，
    // 否则"比上月少花 710 元"看起来像凭空算的，用户没法核对。
    var pm = prevMonth(m);
    var ps = stats(pm);
    var diff = s.exp - ps.exp;
    // 今日支出：打开 App 第一眼最想知道的"今天花了多少"
    var todayKey = todayStr();
    var todayExp = 0, k;
    for (k = 0; k < state.records.length; k++) {
      if (state.records[k].type === 'expense' && state.records[k].date === todayKey) {
        todayExp += state.records[k].amount;
      }
    }
    $('heroNum').textContent = '¥' + money(todayExp);

    // 本月支出：第二行，字号小一级，不再和上年对比
    $('heroCmp').innerHTML = '本月支出 <b>¥' + money(s.exp) + '</b>';

    $('heroPace').textContent = paceText(m, s.exp);

    $('homeSums').innerHTML =
      '<div class="hsum"><div class="k">收入</div><div class="v income">+' + money(s.inc) + '</div></div>' +
      '<div class="hsum"><div class="k">存钱</div><div class="v saving">-' + money(s.sav) + '</div></div>' +
      '<div class="hsum"><div class="k">结余</div><div class="v">' +
        (balance < 0 ? '-' : '') + money(Math.abs(balance)) + '</div></div>';

    // 钱去哪了（Top 3）—— 这是这个 App 的核心承诺，必须放首页
    var top = s.cats.slice(0, 3);
    $('topTip').textContent = s.cats.length > 3 ? ('共 ' + s.cats.length + ' 类') : '';
    if (!top.length) {
      $('topCats').innerHTML = empty('这个月还没有支出');
    } else {
      var h = '', i, c;
      for (i = 0; i < top.length; i++) {
        c = top[i];
        // 条形长度 = 占总支出的比例，和右边那个百分比一致。
        // 以前按"相对最大类"算，会出现"写着 35% 却拉满整条"的矛盾。
        h += '<div class="topcat">' +
          '<div class="topcat-h"><span class="topcat-n">' + c.ico + ' ' + esc(c.name) + '</span>' +
          '<span class="topcat-a">¥' + money(c.amount) + ' · ' + c.pct.toFixed(0) + '%</span></div>' +
          '<div class="track"><div class="fill" style="width:' +
            Math.max(2, c.pct).toFixed(1) +
            '%;background:' + c.color + '"></div></div>' +
          '</div>';
      }
      $('topCats').innerHTML = h;
    }

    $('btnAllCats').style.display = s.cats.length > 3 ? '' : 'none';
    $('btnAllCats').textContent = '查看全部 ' + s.cats.length + ' 类 →';

    renderGoal(m, s.sav);

    var list = sortRecords(state.records.filter(function (r) { return monthOf(r.date) === m; }), false);
    $('recentSub').textContent = '共 ' + list.length + ' 笔';

    /* 按日期分组：今天 / 昨天 / 10月20日，组头带当天的支收合计 */
    var yd = new Date();
    yd.setDate(yd.getDate() - 1);
    var ydKey = yd.getFullYear() + '-' + pad2(yd.getMonth() + 1) + '-' + pad2(yd.getDate());

    var groups = [], lastDate = '', j;
    for (j = 0; j < list.length; j++) {
      if (list[j].date !== lastDate) {
        groups.push({ date: list[j].date, items: [] });
        lastDate = list[j].date;
      }
      groups[groups.length - 1].items.push(list[j]);
    }

    var html = '', g, dExp, dInc, dl, r2;
    for (g = 0; g < groups.length && g < 3; g++) {
      dExp = 0;
      dInc = 0;
      for (j = 0; j < groups[g].items.length; j++) {
        r2 = groups[g].items[j];
        if (r2.type === 'expense') dExp += r2.amount;
        if (r2.type === 'income') dInc += r2.amount;
      }
      dl = groups[g].date === todayKey ? '今天'
        : (groups[g].date === ydKey ? '昨天'
        : (Number(groups[g].date.slice(5, 7)) + '月' + Number(groups[g].date.slice(8, 10)) + '日'));

      html += '<div class="dayhead">' +
        '<span class="dayhead-d">' + esc(dl) + '</span>' +
        '<span class="dayhead-s">支 ¥' + money(dExp) + ' ｜ 收 ¥' + money(dInc) + '</span>' +
        '</div>';
      for (j = 0; j < groups[g].items.length; j++) html += rowHTML(groups[g].items[j], false);
    }

    $('recentList').innerHTML = html || empty('这个月还没有记一笔');
    $('btnAllRec').style.display = list.length > 0 ? '' : 'none';
  }
