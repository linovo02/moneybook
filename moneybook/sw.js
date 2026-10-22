/* 记账本 Service Worker —— 让 App 断网也能打开
   策略：
     页面请求（navigate）：先联网拿最新版；联网失败时回落到缓存 → 离线可用
     其它同源资源：缓存优先，缓存里没有才联网
   改完代码记得把 CACHE 版本号 +1，否则手机会一直用旧的缓存。 */
var CACHE = 'jizhang-v0.3.1';

var ASSETS = [
  './',
  './index.html',
  './app.css',
  './s01.js',
  './s02.js',
  './s03.js',
  './s04.js',
  './s05.js',
  './s06.js',
  './s07.js',
  './s08.js',
  './s09.js',
  './s10.js',
  './s11.js',
  './s12.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* 安装：把 App 外壳全部下载到本地缓存 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* 激活：删掉旧版本缓存，并立刻接管已打开的页面 */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* 页面：网络优先，断网时用缓存顶上 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html',
  './app.css',
  './s01.js',
  './s02.js',
  './s03.js',
  './s04.js',
  './s05.js',
  './s06.js',
  './s07.js',
  './s08.js',
  './s09.js',
  './s10.js',
  './s11.js',
  './s12.js', copy); });
        return res;
      })['catch'](function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 图标等静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then(function (hit) { return hit || fetch(req); })
  );
});
