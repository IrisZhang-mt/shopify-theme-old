/*
 * moodytiger 基础漏斗埋点 —— 主题侧 DOM 交互
 * ---------------------------------------------------------------------------
 * 职责：捕获主题 DOM 上、Customer Events Pixel 拿不到的交互，
 *       经 Shopify.analytics.publish() 桥接为自定义事件，交给 Custom Pixel
 *       归一化 + 上报（assets/mt-analytics-pixel.js）。
 *
 * 本期覆盖（GA4 风格事件名）：
 *   - mt_view_item_list  商品卡曝光（批量）   -> Pixel 归一化为 view_item_list
 *   - mt_select_item     商品卡点击           -> select_item
 *   - mt_begin_checkout  Buy Now / 购物车 Checkout 点击 -> begin_checkout(source=...)
 *
 * 配置来自 snippets/mt-analytics-config.liquid 注入的 window.MT_ANALYTICS.config
 * 合规：本脚本只发送商品/列表等非个人数据，不采集任何用户 PII 或儿童相关信息。
 */
(function () {
  'use strict';

  var MT = (window.MT_ANALYTICS = window.MT_ANALYTICS || {});
  var cfg = MT.config || (MT.config = {});
  var ctx = cfg.context || (cfg.context = {});
  var impCfg = cfg.impression || { ratio: 0.5, dwell: 300 };
  var DEBUG = cfg.debug || /[?&]mt_debug=1/.test(location.search);

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(console, ['[mt-analytics]'].concat([].slice.call(arguments)));
    }
  }

  /* ---------------------------------------------------------------------------
   * 自定义事件桥接：theme -> Custom Pixel
   * Shopify.analytics.publish 可能晚于本脚本就绪，未就绪时先入队，稍后重试 flush。
   * ------------------------------------------------------------------------- */
  function canPublish() {
    return !!(window.Shopify && Shopify.analytics && typeof Shopify.analytics.publish === 'function');
  }

  // 生成事件唯一 ID
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* noop */ }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // 匿名 client_id：优先 Shopify 的 _shopify_y cookie（与 Pixel 的 clientId 对齐），否则本地生成
  function clientId() {
    var m = document.cookie.match(/(?:^|;\s*)_shopify_y=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    try {
      var v = localStorage.getItem('mt_client_id');
      if (!v) { v = uuid(); localStorage.setItem('mt_client_id', v); }
      return v;
    } catch (e) { return undefined; }
  }

  // 主题侧事件「直连端点」上报（本店 Web Pixel 沙箱不可靠投递自定义事件，绕开它）
  function sendDirect(name, payload) {
    if (!name) return;
    if (!cfg.endpoint) { log('no endpoint configured'); return; }
    var body = {
      event: name,
      event_id: uuid(),
      ts: new Date().toISOString(),
      source: 'theme',
      client_id: clientId(),
      context: {
        url: location.href, path: location.pathname,
        referrer: document.referrer, title: document.title
      },
      payload: payload || {}
    };
    log('send', name, body.payload);
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (cfg.token) headers.Authorization = cfg.token;
      fetch(cfg.endpoint, {
        method: 'POST', headers: headers, body: JSON.stringify(body),
        keepalive: true, mode: 'cors', credentials: 'omit'
      }).catch(function (e) { log('send error', e); });
    } catch (e) { log('send error', e); }
  }

  // publish/track 统一走直连端点（不再依赖 Shopify.analytics 沙箱转发）
  function publish(name, data) {
    sendDirect(name.indexOf('mt_') === 0 ? name.slice(3) : name, data || {});
  }
  MT.publish = publish;

  function track(name, params) {
    sendDirect(name, params || {});
  }
  MT.track = track;

  // add_to_cart 兜底：本店标准 product_added_to_cart 不稳，拦截 /cart/add 自行上报
  (function interceptCartAdd() {
    if (!window.fetch || window.__mtCartHook) return;
    window.__mtCartHook = true;
    var orig = window.fetch;
    window.fetch = function (input) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isAdd = /\/cart\/add(\.js)?(\?|$)/.test(url);
      var pr = orig.apply(this, arguments);
      if (isAdd && pr && pr.then) {
        pr.then(function (res) {
          try {
            res.clone().json().then(function (data) {
              var items = (data && data.items) ? data.items : (data && data.id ? [data] : []);
              items.forEach(function (it) {
                var vid = it.variant_id != null ? it.variant_id : it.id;
                track('add_to_cart', {
                  item: {
                    item_id: it.product_id != null ? String(it.product_id) : undefined,
                    item_variant_id: vid != null ? String(vid) : undefined,
                    item_name: it.product_title || it.title,
                    price: it.final_price != null ? it.final_price / 100 : (it.price != null ? it.price / 100 : undefined),
                    quantity: it.quantity,
                    currency: ctx.currency
                  },
                  value: it.final_line_price != null ? it.final_line_price / 100 : undefined,
                  currency: ctx.currency,
                  source: 'theme_cart_add'
                });
              });
            }).catch(function () {});
          } catch (e) { /* noop */ }
        }).catch(function () {});
      }
      return pr;
    };
  })();

  // 从元素 data-mt-* 读取事件参数：label / value / id / creative / position / params(JSON)
  // 缺 label 时用 aria-label 或文本兜底；有 href 时补 url。
  function paramsOf(el) {
    var d = el.dataset || {};
    var p = {};
    if (d.mtLabel) p.label = d.mtLabel;
    if (d.mtValue !== undefined && d.mtValue !== '') p.value = d.mtValue;
    if (d.mtId) p.id = d.mtId;
    if (d.mtCreative) p.creative = d.mtCreative;
    if (d.mtPosition) p.position = num(d.mtPosition);
    if (d.mtParams) { try { Object.assign(p, JSON.parse(d.mtParams)); } catch (e) { /* noop */ } }
    if (p.label === undefined) {
      var txt = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 100);
      if (txt) p.label = txt;
    }
    var href = el.getAttribute && el.getAttribute('href');
    if (href && p.url === undefined) p.url = href;
    return p;
  }

  function flushQueue() {
    if (!canPublish() || !MT.queue || !MT.queue.length) return;
    MT.queue.splice(0).forEach(function (item) {
      try { Shopify.analytics.publish(item[0], item[1]); } catch (e) { log('flush error', e); }
    });
    log('queue flushed');
  }

  /* ---------------------------------------------------------------------------
   * 商品卡取数
   * 数据来自卡片上的 data-mt-* 属性（见 product-card / product-card-small）。
   * ------------------------------------------------------------------------- */
  function num(v) {
    if (v === undefined || v === null || v === '') return undefined;
    var n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  function cardData(el) {
    var d = el.dataset;
    var priceCents = num(d.mtProductPrice);
    return {
      item_id: d.mtProductId,
      item_variant_id: d.mtVariantId || undefined,
      item_name: d.mtProductTitle,
      item_brand: d.mtProductVendor || undefined,
      item_handle: d.mtProductHandle,
      price: priceCents !== undefined ? priceCents / 100 : undefined,
      currency: ctx.currency,
      url: d.mtProductUrl || undefined
    };
  }

  function listOf(el) {
    var c = el.closest('[data-mt-list]');
    return (c && c.getAttribute('data-mt-list')) || ctx.collection || ctx.page_type || 'unknown';
  }

  function positionOf(el) {
    var scope = el.closest('[data-mt-list]') || document;
    var cards = scope.querySelectorAll('[data-mt-product-card]');
    return Array.prototype.indexOf.call(cards, el) + 1;
  }

  function itemOf(el) {
    var item = cardData(el);
    item.item_list_name = listOf(el);
    item.index = positionOf(el);
    return item;
  }

  /* ---------------------------------------------------------------------------
   * 商品曝光：IntersectionObserver + 停留判定，批量 flush 成一个 view_item_list
   * ------------------------------------------------------------------------- */
  var seen = new WeakSet();
  var buffer = [];
  var flushTimer = null;

  function bufferImpression(el) {
    if (seen.has(el)) return;
    seen.add(el);
    buffer.push(itemOf(el));
    if (!flushTimer) flushTimer = setTimeout(flushImpressions, 800);
  }

  function flushImpressions() {
    flushTimer = null;
    if (!buffer.length) return;
    publish('mt_view_item_list', { items: buffer.splice(0, buffer.length) });
  }

  var io = null;
  var dwellTimers = new WeakMap();

  function ensureObserver() {
    if (io || !('IntersectionObserver' in window)) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting && en.intersectionRatio >= (impCfg.ratio || 0.5)) {
          if (!dwellTimers.has(el)) {
            dwellTimers.set(el, setTimeout(function () {
              bufferImpression(el);
              io.unobserve(el);
              dwellTimers.delete(el);
            }, impCfg.dwell || 300));
          }
        } else if (dwellTimers.has(el)) {
          clearTimeout(dwellTimers.get(el));
          dwellTimers.delete(el);
        }
      });
    }, { threshold: [impCfg.ratio || 0.5] });
    return io;
  }

  function observeCards(root) {
    var obs = ensureObserver();
    if (!obs) return;
    (root || document).querySelectorAll('[data-mt-product-card]:not([data-mt-observed])').forEach(function (el) {
      el.setAttribute('data-mt-observed', '1');
      obs.observe(el);
    });
  }

  /* ---------------------------------------------------------------------------
   * 2C: 商品卡 Hover（悬停≥600ms 视为犹豫/关注，每卡每页一次）-> product_hover
   * ------------------------------------------------------------------------- */
  var hoverSeen = new WeakSet();
  function initHover(root) {
    (root || document).querySelectorAll('[data-mt-product-card]:not([data-mt-hover-bound])').forEach(function (el) {
      el.setAttribute('data-mt-hover-bound', '1');
      var timer = null;
      el.addEventListener('mouseenter', function () {
        if (hoverSeen.has(el)) return;
        timer = setTimeout(function () {
          hoverSeen.add(el);
          track('product_hover', { item: itemOf(el) });
        }, 600);
      });
      el.addEventListener('mouseleave', function () {
        if (timer) { clearTimeout(timer); timer = null; }
      });
    });
  }

  /* ---------------------------------------------------------------------------
   * 点击类事件（事件委托，capture 阶段，确保导航前捕获）
   *   - 商品卡点击 -> mt_select_item
   *   - 购物车 Checkout 按钮 -> mt_begin_checkout(source=cart_button)
   *   - Buy Now 动态结账按钮 -> mt_begin_checkout(source=buy_now)
   * ------------------------------------------------------------------------- */
  function readCart() {
    var c = window.tfxCart; // header-tracking.liquid 已注入 window.tfxCart = {{ cart | json }}
    if (!c) return undefined;
    return {
      value: c.total_price != null ? c.total_price / 100 : undefined,
      currency: c.currency || ctx.currency,
      item_count: c.item_count
    };
  }

  function buyNowItem(el) {
    var form = el.closest('form');
    var variantInput = form && form.querySelector('[name="id"]');
    var qtyInput = form && form.querySelector('[name="quantity"]');
    var p = window.tfxProduct; // header-tracking.liquid 已注入 window.tfxProduct
    return {
      item_id: p ? String(p.id) : undefined,
      item_name: p ? p.title : undefined,
      item_variant_id: variantInput ? variantInput.value : undefined,
      quantity: qtyInput ? (num(qtyInput.value) || 1) : 1,
      currency: ctx.currency
    };
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // 商品卡点击（排除卡内的加购 / quick-view 按钮，那属于其它意图）
    var card = t.closest('[data-mt-product-card]');
    if (card && !t.closest('.product-card--add-to-cart-button, quick-view, button[name="add"]')) {
      publish('mt_select_item', { item: itemOf(card) });
    }

    // 购物车 Checkout 点击 -> begin_checkout
    if (t.closest('button[name="checkout"], .checkout-button')) {
      publish('mt_begin_checkout', { source: 'cart_button', cart: readCart() });
    }

    // Buy Now（动态结账按钮）-> begin_checkout
    var buyNow = t.closest('shopify-payment-button, .shopify-payment-button__button');
    if (buyNow) {
      publish('mt_begin_checkout', { source: 'buy_now', item: buyNowItem(buyNow) });
    }

    // 声明式点击埋点（导航/Banner点击/翻页/Review展开/图片切换等）：元素带 data-mt-track="ga4事件名"
    var trackEl = t.closest('[data-mt-track]');
    if (trackEl) track(trackEl.getAttribute('data-mt-track'), paramsOf(trackEl));
  }, true);

  /* ---------------------------------------------------------------------------
   * 声明式表单控件埋点（Sort 下拉 / Filter 勾选）：元素带 data-mt-track，监听 change
   * ------------------------------------------------------------------------- */
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var trackEl = el.closest('[data-mt-track]');
    if (!trackEl) return;
    // 参数取自「被改动的控件」本身（trackEl 可能是整个表单，只用它取事件名）
    var p = {};
    if (el.tagName === 'SELECT') {
      p.value = el.value;
      var opt = el.options[el.selectedIndex];
      if (opt) p.label = (opt.textContent || '').trim();
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      p.checked = el.checked;
      if (el.name) p.filter = el.name;
      if (el.value) p.value = el.value;
      var lbl = el.id && document.querySelector('label[for="' + el.id + '"]');
      if (lbl) p.label = (lbl.textContent || '').trim().slice(0, 100);
    } else {
      if (el.name) p.filter = el.name;
      if (el.value !== undefined && el.value !== '') p.value = el.value;
    }
    if (trackEl.dataset.mtId && p.id === undefined) p.id = trackEl.dataset.mtId;
    if (trackEl.dataset.mtLabel && p.label === undefined) p.label = trackEl.dataset.mtLabel;
    track(trackEl.getAttribute('data-mt-track'), p);
  }, true);

  /* ---------------------------------------------------------------------------
   * 通用曝光埋点：元素带 data-mt-impress="ga4事件名"，可见≥阈值即触发一次
   * ------------------------------------------------------------------------- */
  var impressSeen = new WeakSet();
  var impressIO = null;
  function ensureImpressObserver() {
    if (impressIO || !('IntersectionObserver' in window)) return impressIO;
    impressIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= (impCfg.ratio || 0.5) && !impressSeen.has(en.target)) {
          impressSeen.add(en.target);
          track(en.target.getAttribute('data-mt-impress'), paramsOf(en.target));
          impressIO.unobserve(en.target);
        }
      });
    }, { threshold: [impCfg.ratio || 0.5] });
    return impressIO;
  }
  function observeImpress(root) {
    var obs = ensureImpressObserver();
    if (!obs) return;
    (root || document).querySelectorAll('[data-mt-impress]:not([data-mt-impress-bound])').forEach(function (el) {
      el.setAttribute('data-mt-impress-bound', '1');
      obs.observe(el);
    });
  }

  /* ---------------------------------------------------------------------------
   * 视频播放埋点：原生 <video>（play / 25·50·75 进度 / 播完）
   * 注：YouTube/Vimeo iframe 的进度需各自 JS API，本期先覆盖原生 video；
   *     视频灯箱「播放」按钮点击用 data-mt-track="video_start" 声明式覆盖。
   * ------------------------------------------------------------------------- */
  function videoMeta(v) {
    return {
      provider: 'native',
      src: v.currentSrc || v.getAttribute('src') || undefined,
      title: v.getAttribute('data-mt-label') || v.getAttribute('title') || undefined
    };
  }
  function initVideos(root) {
    (root || document).querySelectorAll('video:not([data-mt-video-bound])').forEach(function (v) {
      v.setAttribute('data-mt-video-bound', '1');
      var fired = { start: false, m25: false, m50: false, m75: false, done: false };
      v.addEventListener('play', function () {
        if (fired.start) return;
        fired.start = true;
        track('video_start', videoMeta(v));
      });
      v.addEventListener('timeupdate', function () {
        if (!v.duration || !isFinite(v.duration)) return;
        var pct = (v.currentTime / v.duration) * 100;
        [[25, 'm25'], [50, 'm50'], [75, 'm75']].forEach(function (pair) {
          if (!fired[pair[1]] && pct >= pair[0]) {
            fired[pair[1]] = true;
            track('video_progress', Object.assign({ percent: pair[0] }, videoMeta(v)));
          }
        });
      });
      v.addEventListener('ended', function () {
        if (fired.done) return;
        fired.done = true;
        track('video_complete', videoMeta(v));
      });
    });
  }

  /* ---------------------------------------------------------------------------
   * 初始化：观察现有卡片 + 监听后续动态插入（collection AJAX 翻页 / 购物车抽屉）
   * ------------------------------------------------------------------------- */
  function init() {
    observeCards(document);
    observeImpress(document);
    initVideos(document);
    initHover(document);
    initAnalysis();
    if ('MutationObserver' in window) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) {
            observeCards(document);
            observeImpress(document);
            initVideos(document);
            initHover(document);
            break;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
    // Shopify.analytics 可能晚到，重试几次 flush 队列
    flushQueue();
    [500, 1500, 3000].forEach(function (ms) { setTimeout(flushQueue, ms); });
  }

  /* ---------------------------------------------------------------------------
   * 2B 分析类：滚动深度(25/50/75/100) + 页面停留/阅读时长
   *   - scroll：滚动到各档位各触发一次，带 percent_scrolled + page_type
   *   - page_engagement：累计「可见时间」，卸载时上报一次 engaged_seconds + max_scroll
   * 纯前端，无需 Liquid/后端改动。
   * ------------------------------------------------------------------------- */
  function initAnalysis() {
    var pageType = ctx.page_type;

    // 滚动深度
    var marks = [25, 50, 75, 100];
    var fired = {};
    var maxScroll = 0;
    var ticking = false;
    function pct() {
      var doc = document.documentElement;
      var scrollable = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0) - window.innerHeight;
      if (scrollable <= 0) return 100; // 内容不足一屏，视为已看完
      var y = window.scrollY || doc.scrollTop || 0;
      return Math.min(100, Math.round((y / scrollable) * 100));
    }
    function check() {
      ticking = false;
      var p = pct();
      if (p > maxScroll) maxScroll = p;
      marks.forEach(function (m) {
        if (!fired[m] && p >= m) {
          fired[m] = true;
          track('scroll', { percent_scrolled: m, page_type: pageType });
        }
      });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      (window.requestAnimationFrame || function (f) { setTimeout(f, 120); })(check);
    }, { passive: true });
    setTimeout(check, 500); // 短页面/首屏即判定

    // 停留/阅读时长（累计可见时间，卸载时上报一次）
    var engagedMs = 0;
    var lastStart = null;
    var done = false;
    function startEng() { if (lastStart === null && document.visibilityState === 'visible') lastStart = Date.now(); }
    function stopEng() { if (lastStart !== null) { engagedMs += Date.now() - lastStart; lastStart = null; } }
    function finalizeEng() {
      stopEng();
      if (done) return;
      done = true;
      track('page_engagement', {
        engaged_seconds: Math.round(engagedMs / 1000),
        max_scroll: maxScroll,
        page_type: pageType
      });
    }
    startEng();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') stopEng(); else startEng();
    });
    window.addEventListener('pagehide', finalizeEng);
  }

  // 页面隐藏/卸载时强制 flush 未发的曝光
  window.addEventListener('pagehide', flushImpressions);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushImpressions();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
