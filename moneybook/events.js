/* 记账本 · 逻辑分片 6 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 事件：记账类 ---------- */
  $('seg').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.type = btn.getAttribute('data-type');
    state.category = state.type === 'expense' ? '吃饭' : (state.type === 'saving' ? '存银行' : '其他');
    renderType();
    renderCats();
  });

  $('cats').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    state.category = btn.getAttribute('data-cat');
    renderCats();
  });

  $('submit').addEventListener('click', function () {
    var raw = $('amount').value.trim();
    var amt = Number(raw);
    if (!raw || !isFinite(amt) || amt <= 0) {
      toast('请输入大于 0 的金额');
      $('amount').focus();
      return;
    }
    if (amt > 99999999) { toast('金额太大了'); return; }
    var date = $('date').value || todayStr();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayStr();

    state.records.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: state.type,
      category: state.category,
      amount: Math.round(amt * 100) / 100,
      date: date,
      note: $('note').value.trim().slice(0, 30),
      created: Date.now(),
      seq: ++seq
    });
    save();

    var t = TYPES[state.type];
    toast('已记 ' + t.name + ' ¥' + money(amt) + '（' + state.category + '）');

    $('amount').value = '';
    $('note').value = '';
    if (monthOf(date) !== (state.month || thisMonth())) state.month = monthOf(date);
    $('month').value = state.month;
    renderAll();
    $('amount').focus();
  });

  $('amount').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('submit').click();
  });
  $('note').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('submit').click();
  });

  /* ---------- 事件：删除 ---------- */
  function onDelete(id) {
    var rec = null;
    for (var i = 0; i < state.records.length; i++) if (state.records[i].id === id) rec = state.records[i];
    if (!rec) return;
    if (!window.confirm('删除这一笔？\n' + TYPES[rec.type].name + ' ' + rec.category + ' ¥' + money(rec.amount) + '  ' + rec.date)) return;
    state.records = state.records.filter(function (r) { return r.id !== id; });
    save();
    renderAll();
    toast('已删除');
  }
  /* 列表点击：点删除按钮就删，点其它任何地方就打开"改分类"面板 */
  function onListClick(e) {
    var del = e.target.closest('button[data-del]');
    if (del) { onDelete(del.getAttribute('data-del')); return; }
    var row = e.target.closest('div[data-edit]');
    if (row) openCatSheet(row.getAttribute('data-edit'));
  }
  $('recentList').addEventListener('click', onListClick);
  $('monthList').addEventListener('click', onListClick);
