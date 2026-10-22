/* 记账本 · 逻辑分片 2 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 工具 ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function monthOf(dateStr) { return String(dateStr).slice(0, 7); }
  function thisMonth() { return todayStr().slice(0, 7); }
  function money(n) {
    var v = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    var s = v.toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthLabel(m) { return m ? (m.slice(0, 4) + '年' + Number(m.slice(5, 7)) + '月') : ''; }

  /* 只显示"9月"，年份由顶部导航负责 —— 一屏里"2026年"出现三次太吵 */
  function monthShort(m) { return m ? (Number(m.slice(5, 7)) + '月') : ''; }

  /* 上一个自然月，比如 2026-01 的上一个月是 2025-12 */
  function prevMonth(m) {
    var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    mo--;
    if (mo < 1) { mo = 12; y--; }
    return y + '-' + pad2(mo);
  }
  function empty(text) { return '<div class="empty">' + esc(text) + '</div>'; }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  /* ---------- 渲染：类型 + 分类 ---------- */
  function renderType() {
    var btns = $('seg').querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-type') === state.type);
    }
    var t = TYPES[state.type];
    $('submit').textContent = '保存这一笔' + t.name;
    var names = [];
    var list = getCats();
    for (var k = 0; k < list.length; k++) names.push(list[k].name);
    $('catLabel').textContent = t.name + '分类（' + names.join(' · ') + '）';
  }

  function renderCats() {
    var cats = getCats();
    var html = '';
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      html += '<button type="button" class="cat' + (c.name === state.category ? ' on' : '') +
              '" data-cat="' + esc(c.name) + '"><span class="ico">' + c.ico + '</span>' + esc(c.name) + '</button>';
    }
    $('cats').innerHTML = html;
  }
