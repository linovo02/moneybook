/* 记账本 · 逻辑分片 1 / 12 （按原顺序拆分，行为与单文件一致） */
var STORE_KEY = 'xiaolin_jizhang_v1';
  var TYPES = {
    expense: { name: '支出', ico: '💸', sign: '-' },
    income:  { name: '收入', ico: '💰', sign: '+' },
    saving:  { name: '存钱', ico: '🏦', sign: '-' }
  };
  var EXPENSE_CATS = [
    { name: '吃饭',   ico: '🍚', color: '#e5484d' },
    { name: '充游戏', ico: '🎮', color: '#7c5cff' },
    { name: '买衣服', ico: '👕', color: '#e0699b' },
    { name: '水果',   ico: '🍎', color: '#f0813c' },
    { name: '零食',   ico: '🍬', color: '#e8b13a' },
    { name: '日用',   ico: '🧴', color: '#2fa8a0' },
    { name: '交通',   ico: '🚌', color: '#3b6cf6' },
    { name: '房租',   ico: '🏠', color: '#8a6a4f' },
    { name: '其他',   ico: '📦', color: '#8b8f99' }
  ];
  var INCOME_CATS = [{ name: '其他', ico: '💰', color: '#0aa06e' }];
  var SAVING_CATS = [
    { name: '存银行', ico: '🏦', color: '#3b6cf6' },
    { name: '余额宝', ico: '💰', color: '#0aa06e' },
    { name: '存钱罐', ico: '🐷', color: '#e0699b' },
    { name: '理财',   ico: '📈', color: '#7c5cff' },
    { name: '其他',   ico: '📦', color: '#8b8f99' }
  ];
  // 查图标时三个列表都要找，否则存钱的分类会全部退化成兜底图标
  var ALL_CATS = EXPENSE_CATS.concat(SAVING_CATS, INCOME_CATS);
  var PALETTE = ['#3b6cf6', '#e5484d', '#0aa06e', '#f0813c', '#7c5cff', '#e0699b', '#2fa8a0', '#e8b13a', '#8a6a4f'];

  var $ = function (id) { return document.getElementById(id); };

  function getCats() {
    if (state.type === 'expense') return EXPENSE_CATS;
    if (state.type === 'saving') return SAVING_CATS;
    return INCOME_CATS;
  }
  function catInfo(name) {
    for (var i = 0; i < ALL_CATS.length; i++) if (ALL_CATS[i].name === name) return ALL_CATS[i];
    return { name: name || '其他', ico: '💰', color: '#0aa06e' };
  }

  var state = {
    records: load(),
    type: 'expense',
    category: '吃饭',
    month: '',
    tab: 'home',
    homeMonth: ''      // 概览页正在看的月份，空 = 本月
  };
  // 记录顺序号：同一毫秒内连记两笔时也能稳定排序（值越大越新）
  var seq = (function () {
    var max = 0;
    for (var i = 0; i < state.records.length; i++) {
      var s = Number(state.records[i].seq) || 0;
      if (s > max) max = s;
    }
    return max;
  })();

  /* ---------- 本地存储 ---------- */
  var storageOK = (function () {
    try {
      window.localStorage.setItem('__t__', '1');
      window.localStorage.removeItem('__t__');
      return true;
    } catch (e) { return false; }
  })();

  // 把任意来源的原始数组清洗成合法记录：本地存储和导入备份共用同一套规则
  function sanitize(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      if (!r || typeof r !== 'object') continue;
      if (!TYPES[r.type]) continue;
      var amt = Number(r.amount);
      if (!isFinite(amt) || amt <= 0) continue;
      out.push({
        id: String(r.id || (Date.now() + '_' + i)),
        type: r.type,
        category: typeof r.category === 'string' && r.category ? r.category : '其他',
        amount: amt,
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayStr(),
        note: typeof r.note === 'string' ? r.note.slice(0, 30) : '',
        merchant: typeof r.merchant === 'string' ? r.merchant.slice(0, 60) : '',
        created: Number(r.created) || 0,
        seq: Number(r.seq) || 0
      });
    }
    return out;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      return sanitize(JSON.parse(raw));
    } catch (e) { return []; }
  }

  function save() {
    if (!storageOK) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state.records));
    } catch (e) {
      toast('保存失败：手机浏览器存储空间已满');
    }
  }
