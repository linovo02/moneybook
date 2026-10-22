/* 记账本 · 逻辑分片 11 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ---------- 用最新规则重算历史账单的分类 ----------
     为什么需要它：关键词库变强了、你也教过几个商家，但老记录不会自己变。
     点一下按最新规则重算。
     你手动改过的会自动保留 —— 因为改的时候已经"学会"了，重算用的就是同一条学习规则。 */
  $('btnRecat').addEventListener('click', function () {
    var targets = [], i, r;
    for (i = 0; i < state.records.length; i++) {
      r = state.records[i];
      // 只重算"从账单来的"记录（有商家名）。
      // 手动记的没有商家名，那个分类是你亲手选的，机器不该覆盖。
      if (r.type === 'expense' && r.merchant) targets.push(r);
    }
    if (!targets.length) { toast('还没有从账单导入的支出记录'); return; }

    var changed = [], want;
    for (i = 0; i < targets.length; i++) {
      // 第二个参数传备注：备注里就是「商家 · 商品」，商品名也参与关键词匹配
      want = classifyBill(targets[i].merchant, targets[i].note);
      if (want !== targets[i].category) changed.push({ rec: targets[i], to: want });
    }
    if (!changed.length) { toast('这 ' + targets.length + ' 笔的分类已经是最新的了'); return; }

    var show = [], n = changed.length < 5 ? changed.length : 5;
    for (i = 0; i < n; i++) show.push('  ' + changed[i].rec.merchant + ' → ' + changed[i].to);

    if (!window.confirm('按最新规则重算 ' + targets.length + ' 笔账单记录，其中 ' + changed.length + ' 笔会变：\n\n' +
        show.join('\n') + (changed.length > n ? '\n  …' : '') +
        '\n\n（你自己手动改过的会自动保留）')) return;

    for (i = 0; i < changed.length; i++) changed[i].rec.category = changed[i].to;
    save();
    renderAll();
    toast('重算完成：修正了 ' + changed.length + ' 笔');
  });

  /* ---------- 导入备份 ---------- */
  $('btnImport').addEventListener('click', function () {
    $('fileImport').click();
  });

  $('fileImport').addEventListener('change', function (e) {
    var files = e.target.files;
    var f = files && files[0];
    e.target.value = '';          // 清空，让同一个文件能再次选择
    if (!f) return;

    var reader = new FileReader();
    reader.onerror = function () { toast('读文件失败，换一个文件再试'); };
    reader.onload = function () {
      var incoming;
      try {
        incoming = sanitize(JSON.parse(String(reader.result)));
      } catch (err) {
        toast('这不是本 App 导出的备份文件');
        return;
      }
      if (!incoming.length) { toast('文件里没有可用的记录'); return; }

      var have = {};
      for (var i = 0; i < state.records.length; i++) have[state.records[i].id] = true;
      var add = [];
      for (var j = 0; j < incoming.length; j++) if (!have[incoming[j].id]) add.push(incoming[j]);

      if (!add.length) { toast('这 ' + incoming.length + ' 条都已经有了，没有新增'); return; }
      if (!window.confirm('备份里读到 ' + incoming.length + ' 条记录，其中 ' + add.length + ' 条是新的。\n\n' +
          '【确定】合并进来（现有 ' + state.records.length + ' 条一条都不会删）\n' +
          '【取消】什么都不做')) return;

      for (var k = 0; k < add.length; k++) {
        if (Number(add[k].seq) > seq) seq = Number(add[k].seq);
        state.records.push(add[k]);
      }
      state.records = sanitize(state.records);
      save();
      renderAll();
      toast('导入完成：新增 ' + add.length + ' 条，跳过 ' + (incoming.length - add.length) + ' 条重复');
    };
    reader.readAsText(f);
  });

  $('btnClear').addEventListener('click', function () {
    if (!state.records.length) { toast('本来就没有数据'); return; }
    if (!window.confirm('确定清空全部 ' + state.records.length + ' 条记录？清空后无法恢复。')) return;
    if (!window.confirm('再确认一次：真的要全部删掉吗？')) return;
    state.records = [];
    save();
    renderAll();
    toast('已清空');
  });
