/* 记账本 · 通知解析
 * ------------------------------------------------------------------
 * 输入：安卓通知的 (app 名字, 标题, 正文)
 * 输出：{ amount, direction, merchant, category } 或 null（不是支付通知）
 *
 * 解析的是真实世界里五花八门的通知文案，不是理想情况：
 *   微信支付   标题「微信支付」  正文「微信支付凭证 ￥25.00」
 *   微信商户   正文「微信支付凭证 ￥25.00 瑞幸咖啡(万达店)」
 *   支付宝     正文「你已成功付款 38.00 元」
 *   支付宝收款 正文「你已收到 3.00 元」          → 收入
 *   退款       正文「退款到账 ￥19.90」          → 不记账（返回 null）
 *   转账       正文「XX 向你转账 100.00 元」      → 收入
 *
 * 设计原则：**宁可漏记，不可错记**。解析不确定时返回 null，
 * 让用户自己补一笔，比自动记错一笔要好得多。
 */

var NOTIFY_SKIP_WORDS = [
  '退款', '退货', '已退款', '红包退回', '撤销', '失败', '未成功',
  '账单', '月账单', '提醒', '优惠券', '红包即将', '活动'
];

var NOTIFY_INCOME_WORDS = [
  '收到', '收款', '入账', '转入', '向你转账', '退回', '返还', '到账'
];

/* 常见商家 → 分类关键词（解析后顺带归类，命中不了就交给后面的学习规则） */
var NOTIFY_CAT_RULES = [
  ['滴滴', '交通'], ['出行', '交通'], ['地铁', '交通'], ['公交', '交通'],
  ['美团', '吃饭'], ['饿了么', '吃饭'], ['饭', '吃饭'], ['餐', '吃饭'],
  ['咖啡', '吃饭'], ['奶茶', '吃饭'], ['炸鸡', '吃饭'], ['超市', '日用'],
  ['便利', '日用'], ['药店', '日用'], ['洗衣', '日用'],
  ['淘宝', '买衣服'], ['衣服', '买衣服'], ['鞋', '买衣服'],
  ['水果', '水果'], ['零食', '零食'],
  ['游戏', '充游戏'], ['腾讯', '充游戏'], ['点券', '充游戏']
];

/**
 * 从通知里解析出一笔支付。
 * @param {string} app    通知来自哪个 App（如「微信」「支付宝」）
 * @param {string} title  通知标题
 * @param {string} text   通知正文
 * @returns {object|null}
 */
function parsePayNotify(app, title, text) {
  var a = String(app || '');
  var t = String(title || '');
  var s = String(text || '');
  var all = (t + ' ' + s).trim();

  if (!all) return null;

  // 只认微信 / 支付宝 / 银行类，其它 App 的通知一律不碰
  if (!/微信|支付宝|财付通|银行|云闪付/.test(a + ' ' + t)) return null;

  // 明确是退款/失败/账单提醒 → 不记账
  for (var i = 0; i < NOTIFY_SKIP_WORDS.length; i++) {
    if (all.indexOf(NOTIFY_SKIP_WORDS[i]) >= 0) return null;
  }

  // ---- 抠金额 ----
  var m = all.match(/[¥￥]\s*([\d,]+(?:\.\d{1,2})?)/)
       || all.match(/([\d,]+(?:\.\d{1,2})?)\s*元/);
  if (!m) return null;

  var amount = Number(String(m[1]).replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0 || amount > 1000000) return null;

  // ---- 判断方向 ----
  var income = false;
  for (var k = 0; k < NOTIFY_INCOME_WORDS.length; k++) {
    if (all.indexOf(NOTIFY_INCOME_WORDS[k]) >= 0) { income = true; break; }
  }
  // 「付款」「支付」出现时优先当支出（"收到你的付款"这种罕见说法不至于搞反）
  if (/付款|支付|消费|扣款/.test(all)) income = false;

  // ---- 抠商家 ----
  var merchant = '';
  var rest = (s || t).replace(m[0], ' ');
  // 去掉常见套话
  rest = rest.replace(/微信支付凭证|支付宝|你已成功|你已|成功|付款|支付|收款|收到|转账|元|人民币/g, ' ');
  // 取剩下的中文/字母串（长度 ≥2）当商家
  var cands = rest.match(/[\u4e00-\u9fa5A-Za-z0-9·（）()\-]{2,}/g) || [];
  cands.sort(function (x, y) { return y.length - x.length; });
  if (cands.length && cands[0].length <= 30) merchant = cands[0].trim();
  if (merchant === String(amount)) merchant = '';

  // ---- 猜分类 ----
  var cat = '';
  for (var c = 0; c < NOTIFY_CAT_RULES.length; c++) {
    if ((merchant + ' ' + all).indexOf(NOTIFY_CAT_RULES[c][0]) >= 0) {
      cat = NOTIFY_CAT_RULES[c][1];
      break;
    }
  }

  return {
    amount: Math.round(amount * 100) / 100,
    direction: income ? 'income' : 'expense',
    merchant: merchant,
    category: cat,
    raw: all
  };
}

/* 同一条通知可能被系统重发多次 —— 用「金额 + 商家 + 同一分钟内」判断重复 */
function isDuplicateNotify(records, parsed, nowMs) {
  if (!parsed) return false;
  var win = 5 * 60 * 1000;   // 5 分钟窗口
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (Math.abs(Number(r.amount) - parsed.amount) > 0.004) continue;
    if ((r.merchant || '') !== (parsed.merchant || '')) continue;
    if (Math.abs(Number(r.created || 0) - nowMs) > win) continue;
    return true;
  }
  return false;
}
