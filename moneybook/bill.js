/* 记账本 · 逻辑分片 9 / 12 （按原顺序拆分，行为与单文件一致） */
  /* ========== 导入微信 / 支付宝账单 ========== */

  /* 商家关键词 → 分类。从上往下匹配，先命中先用。
     原则：越容易失控的花钱方式放越前面，宁可多报到「充游戏」，也别让它悄悄溜走。 */
  var BILL_RULES = [
    // 游戏充值放最前面：这类钱最容易悄悄溜走，宁可多报也别漏
    ['充游戏', ['腾讯游戏', '王者荣耀', '和平精英', '英雄联盟', '网易游戏', '米哈游', '原神',
      '崩坏', '明日方舟', '叠纸', '鹰角', '莉莉丝', '三七互娱', '心动网络', '完美世界',
      '巨人网络', '盛趣', '西山居', '多益', '游卡', '点券', '钻石', '金币', '元宝',
      '腾讯计算机', '网易(杭州)', '网易（杭州）', '哔哩哔哩', 'bilibili',
      'steam', 'google play', 'app store', 'apple.com/bill', '心悦', '游戏']],
    ['吃饭', ['美团', '三快在线', '饿了么', '拉扎斯', '肯德基', 'kfc', '麦当劳', '金拱门',
      '百胜', '星巴克', '瑞幸', 'luckin', '蜜雪', '喜茶', '奈雪', '茶百道', '古茗',
      '沪上阿姨', 'coco', '一点点', '库迪', '汉堡王', '必胜客', '海底捞', '华莱士', '塔斯汀',
      '真功夫', '老乡鸡', '沙县', '米线', '面馆', '火锅', '烧烤', '烤肉', '早餐', '快餐',
      '餐饮', '餐厅', '饭店', '小吃', '食堂', '食品', '饮食', 'food', '外卖']],
    ['零食', ['零食', '良品铺子', '三只松鼠', '百草味', '来伊份', '罗森', '全家', '7-eleven',
      '711', '美宜佳', '便利', '薯片', '辣条', '糖果', '坚果']],
    ['水果', ['水果', '鲜果', '果业', '百果园', '果多美', '榴莲', '车厘子', '草莓', '西瓜',
      '生鲜', '菜市场', '果蔬']],
    ['买衣服', ['优衣库', 'uniqlo', 'zara', 'h&m', '耐克', 'nike', '阿迪', 'adidas',
      '李宁', '安踏', '波司登', '海澜之家', '太平鸟', '森马', '得物', '唯品会', 'shein',
      'gap', '服饰', '服装', '内衣', '运动鞋', '鞋业', '箱包']],
    ['日用', ['超市', '永辉', '大润发', '沃尔玛', '华润万家', '家乐福', '物美', '盒马', '山姆',
      '屈臣氏', '名创优品', 'miniso', '天猫超市', '京东超市', '日用', '洗护', '纸巾',
      '药房', '药店', '大药房', '医药', '诊所']],
    ['交通', ['滴滴', '高德', '曹操', 't3出行', '花小猪', '地铁', '公交', '轨道交通', '一卡通',
      '12306', '中铁', '铁路', '航旅', '航空', '机票', '加油', '中石化', '中石油', '壳牌',
      '石油', '停车', '高速', 'etc', '哈啰', '青桔', '单车', '打车', '出行']],
    // 房租放最后：里面有「中国移动／话费」这类词，
    // 而「充值」不放进游戏那一组，就是为了避免"话费充值"被误判成游戏充值
    ['房租', ['房租', '租金', '物业', '水费', '电费', '燃气', '暖气', '宽带', '中国移动',
      '中国联通', '中国电信', '话费', '国家电网', '供电', '水务']]
  ];

  function classifyBill(counterparty, goods) {
    // 1) 先查"你以前改过的" —— 学习结果优先，它最贴近你的真实习惯
    var byLearn = classifyLearned(counterparty);
    if (byLearn) return byLearn;

    // 2) 再用内置关键词
    var text = (String(counterparty || '') + ' ' + String(goods || '')).toLowerCase();
    for (var i = 0; i < BILL_RULES.length; i++) {
      var kws = BILL_RULES[i][1];
      for (var j = 0; j < kws.length; j++) {
        if (text.indexOf(kws[j]) >= 0) return BILL_RULES[i][0];
      }
    }
    return '其他';
  }

  /* 解码文件字节：先按 UTF-8 试，失败就当 GBK。
     微信/支付宝导出的 CSV 经常是 GBK，直接按 UTF-8 读会全是乱码。 */
  function decodeBytes(buf) {
    var bytes = new Uint8Array(buf);
    if (typeof TextDecoder === 'undefined') {
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
    if (bytes.length > 2 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));   // 去掉 BOM
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      try { return new TextDecoder('gbk').decode(bytes); }
      catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
    }
  }

  /* 正经 CSV 解析：支持引号包裹的字段、字段里带逗号 */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += c;
      } else if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        row.push(cell); cell = '';
      } else if (c === '\n') {
        row.push(cell); rows.push(row); row = []; cell = '';
      } else if (c !== '\r') {
        cell += c;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* 账单表头字段候选名。微信和支付宝叫法不同，版本之间也会变，
     所以不写死列号，而是按名字去认，认不出来也不会崩。 */
  var BILL_COLS = {
    date:   ['交易时间', '交易创建时间', '付款时间', '创建时间', '交易日期', '时间'],
    amount: ['金额(元)', '金额（元）', '金额', '发生额'],
    dir:    ['收/支', '收支'],
    party:  ['交易对方', '对方', '商户名称', '交易对象'],
    goods:  ['商品名称', '商品说明', '商品', '交易说明'],
    status: ['当前状态', '交易状态', '状态'],
    order:  ['交易单号', '交易号', '商户单号', '订单号']
  };

  function findCol(header, names) {
    for (var i = 0; i < names.length; i++) {
      for (var j = 0; j < header.length; j++) {
        if (header[j].indexOf(names[i]) >= 0) return j;
      }
    }
    return -1;
  }

  function trimCell(v) {
    return String(v == null ? '' : v).replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }

  function parseBillAmount(v) {
    var s = trimCell(v).replace(/[¥￥,\s元]/g, '');
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function parseBillDate(v) {
    var m = /(\d{4})\D{1,2}(\d{1,2})\D{1,2}(\d{1,2})/.exec(String(v || ''));
    if (!m) return '';
    return m[1] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[3]));
  }

  function hashKey(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /* 账单文本 → 记录数组（只解析，不写存储） */
  function parseBill(text) {
    var rows = parseCSV(text);
    var head = -1, cols = null, i;

    // 账单文件前面通常有几行说明文字，先找到真正的表头行
    for (i = 0; i < rows.length; i++) {
      var probe = rows[i].map(trimCell);
      var hit = 0;
      if (findCol(probe, BILL_COLS.date) >= 0) hit++;
      if (findCol(probe, BILL_COLS.amount) >= 0) hit++;
      if (findCol(probe, BILL_COLS.dir) >= 0) hit++;
      if (hit >= 2) { head = i; cols = probe; break; }
    }
    if (head < 0) return { records: [], skipped: 0, error: '没在文件里找到账单表头' };

    var cDate = findCol(cols, BILL_COLS.date);
    var cAmt  = findCol(cols, BILL_COLS.amount);
    var cDir  = findCol(cols, BILL_COLS.dir);
    var cPar  = findCol(cols, BILL_COLS.party);
    var cGood = findCol(cols, BILL_COLS.goods);
    var cStat = findCol(cols, BILL_COLS.status);
    var cOrd  = findCol(cols, BILL_COLS.order);

    var out = [], skipped = 0;
    for (i = head + 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.length < 2) continue;

      var dir  = cDir >= 0 ? trimCell(r[cDir]) : '';
      var amt  = parseBillAmount(cAmt >= 0 ? r[cAmt] : '');
      var date = parseBillDate(cDate >= 0 ? r[cDate] : '');

      if (dir.indexOf('支出') < 0 && dir.indexOf('收入') < 0) { skipped++; continue; }
      if (!date || !isFinite(amt) || amt <= 0) { skipped++; continue; }

      var stat = cStat >= 0 ? trimCell(r[cStat]) : '';
      if (stat.indexOf('退款') >= 0 || stat.indexOf('失败') >= 0 ||
          stat.indexOf('撤销') >= 0 || stat.indexOf('关闭') >= 0) { skipped++; continue; }

      var party = cPar >= 0 ? trimCell(r[cPar]) : '';
      var goods = cGood >= 0 ? trimCell(r[cGood]) : '';
      var order = cOrd >= 0 ? trimCell(r[cOrd]) : '';

      var type = dir.indexOf('收入') >= 0 ? 'income' : 'expense';
      var category = type === 'income' ? '其他' : classifyBill(party, goods);

      var note = party;
      if (goods && goods !== '/' && goods !== party) note += (note ? ' · ' : '') + goods;

      // 有交易单号就用单号当身份，没有就用内容拼一个 → 同一份账单重复导入不会重复记账
      var key = (order && order !== '/') ? ('no:' + order)
        : (date + '|' + type + '|' + amt.toFixed(2) + '|' + party + '|' + goods);

      out.push({
        id: 'bill_' + hashKey(key + '|' + type + '|' + amt.toFixed(2)),
        type: type,
        category: category,
        amount: Math.round(amt * 100) / 100,
        date: date,
        note: note.slice(0, 30),
        merchant: party.slice(0, 60),
        created: Date.now(),
        seq: 0
      });
    }
    return { records: out, skipped: skipped, error: '' };
  }

  $('btnBill').addEventListener('click', function () {
    $('fileBill').click();
  });

  $('fileBill').addEventListener('change', function (e) {
    var files = e.target.files;
    var f = files && files[0];
    e.target.value = '';
    if (!f) return;

    var reader = new FileReader();
    reader.onerror = function () { toast('读文件失败，换一个文件再试'); };
    reader.onload = function () {
      var raw = reader.result;
      var text;
      try {
        text = typeof raw === 'string' ? raw : decodeBytes(raw);
      } catch (err) { toast('文件解码失败'); return; }

      var res = parseBill(text);
      if (res.error) { toast(res.error + '，确认是微信/支付宝导出的账单 CSV 吗'); return; }
      if (!res.records.length) { toast('没解析出任何记录，确认是账单 CSV 吗'); return; }

      var have = {};
      for (var i = 0; i < state.records.length; i++) have[state.records[i].id] = true;

      var add = [], sumExp = 0, sumInc = 0, byCat = {};
      for (var j = 0; j < res.records.length; j++) {
        var rec = res.records[j];
        if (have[rec.id]) continue;
        add.push(rec);
        if (rec.type === 'income') sumInc += rec.amount;
        else { sumExp += rec.amount; byCat[rec.category] = (byCat[rec.category] || 0) + rec.amount; }
      }
      var dup = res.records.length - add.length;
      if (!add.length) { toast('这 ' + res.records.length + ' 笔都已经导入过了'); return; }

      var cats = [], k;
      for (k in byCat) if (Object.prototype.hasOwnProperty.call(byCat, k)) cats.push({ n: k, v: byCat[k] });
      cats.sort(function (a, b) { return b.v - a.v; });
      var catText = [];
      for (k = 0; k < cats.length; k++) catText.push(cats[k].n + ' ¥' + money(cats[k].v));

      var msg = '账单解析结果：\n\n' +
        '读到 ' + res.records.length + ' 笔' +
        (res.skipped ? '（另有 ' + res.skipped + ' 行不是消费，已忽略）' : '') + '\n' +
        '其中 ' + dup + ' 笔已经导入过，会跳过\n' +
        '本次新增 ' + add.length + ' 笔：支出 ¥' + money(sumExp) + '，收入 ¥' + money(sumInc) + '\n\n' +
        '自动分类：\n  ' + catText.join('\n  ') + '\n\n' +
        '确认导入吗？';
      if (!window.confirm(msg)) return;

      var latest = '';
      for (var m = 0; m < add.length; m++) {
        add[m].seq = ++seq;
        add[m].created = Date.now() + m;
        state.records.push(add[m]);
        if (add[m].date > latest) latest = add[m].date;
      }
      if (latest) { state.month = monthOf(latest); $('month').value = state.month; }
      save();
      renderAll();
      toast('账单导入完成：新增 ' + add.length + ' 笔，跳过 ' + dup + ' 笔重复');
    };
    if (reader.readAsArrayBuffer) reader.readAsArrayBuffer(f);
    else reader.readAsText(f);
  });
