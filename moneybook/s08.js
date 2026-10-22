/* 记账本 · 逻辑分片 8 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 改分类面板 ---------- */
  var editingId = null;

  function catsForType(t) {
    if (t === 'expense') return EXPENSE_CATS;
    if (t === 'saving') return SAVING_CATS;
    return INCOME_CATS;
  }

  function findRecord(id) {
    for (var i = 0; i < state.records.length; i++) {
      if (state.records[i].id === id) return state.records[i];
    }
    return null;
  }

  function openCatSheet(id) {
    var rec = findRecord(id);
    if (!rec) return;
    editingId = id;

    var t = TYPES[rec.type] || TYPES.expense;
    $('sheetInfo').textContent = rec.date + ' · ' + t.name + ' ¥' + money(rec.amount) +
      (rec.merchant ? ' · ' + rec.merchant : '');

    var list = catsForType(rec.type), i, html = '';
    for (i = 0; i < list.length; i++) {
      html += '<button type="button" class="cat' + (list[i].name === rec.category ? ' on' : '') +
              '" data-sheet-cat="' + esc(list[i].name) + '">' +
              '<span class="ico">' + list[i].ico + '</span>' + esc(list[i].name) + '</button>';
    }
    $('sheetCats').innerHTML = html;

    $('sheetTip').textContent = rec.merchant
      ? ('改完之后，「' + rec.merchant + '」这个商家以后的记录会自动归到这一类')
      : '改完之后下次导入会更准';
    $('catSheet').classList.add('on');
  }

  function closeCatSheet() {
    editingId = null;
    $('catSheet').classList.remove('on');
  }

  $('catSheet').addEventListener('click', function (e) {
    if (e.target === $('catSheet')) { closeCatSheet(); return; }   // 点灰色背景关闭
    var btn = e.target.closest('button[data-sheet-cat]');
    if (!btn) return;

    var rec = findRecord(editingId);
    if (!rec) { closeCatSheet(); return; }

    var cat = btn.getAttribute('data-sheet-cat');
    rec.category = cat;

    // 只对支出学习：收入/存钱就那么几个分类，学了没意义
    var remembered = '';
    if (rec.type === 'expense' && rec.merchant) {
      remembered = learnMerchant(rec.merchant, cat);
    }

    save();
    closeCatSheet();
    renderAll();
    toast(remembered
      ? ('已改成「' + cat + '」，以后「' + remembered + '」自动归这类')
      : ('已改成「' + cat + '」'));
  });

  $('sheetCancel').addEventListener('click', closeCatSheet);
