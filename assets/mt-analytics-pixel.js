/*
 * moodytiger 基础漏斗埋点 —— Custom Pixel（标准漏斗事件）
 * ===========================================================================
 * 部署：Shopify Admin > Settings > Customer events > Add custom pixel，
 *       把本文件内容整段粘贴进去保存。
 * 说明：本文件在 theme 仓库中仅作【版本留存 / source of truth】，
 *       实际运行的是后台粘贴的副本（theme 不会自动加载它）。
 *
 * 覆盖事件（标准 Shopify 事件 -> GA4 风格归一化）：
 *   page_viewed            -> page_view
 *   product_viewed         -> view_item
 *   product_added_to_cart  -> add_to_cart
 *   cart_viewed            -> view_cart
 *   checkout_started       -> begin_checkout (source=checkout_page)
 *   payment_info_submitted -> add_payment_info
 *   checkout_completed     -> purchase
 * 以及来自主题侧（mt-analytics.js）的自定义事件：
 *   mt_view_item_list      -> view_item_list
 *   mt_select_item         -> select_item
 *   mt_begin_checkout      -> begin_checkout (source=cart_button | buy_now)
 *
 * 延后：payment_failed（非标准事件，需 Checkout UI Extension / 后端 webhook 配合）
 *
 * 合规（moodytiger 红线）：
 *   - customer 仅上报 customer_id（方案 A，可回连订单），绝不上报姓名/邮箱/电话/地址明文；
 *   - 不上报任何儿童相关字段；
 *   - 所有上报对象由白名单显式构造，PII 字段不会进入 payload。
 */
(function () {
  'use strict';

  /* ====== 配置（联调时替换）====== */
  var ENDPOINT = 'https://show.moodytiger.work/collect'; // 自建数据采集端点
  var AUTH_HEADER = 'Bearer Hlyy3qRHh-rrxNp7ifDqbkTSK9xR17L9sGo9n6mpz28'; // 与后端 MT_INGEST_TOKEN 一致
  var SOURCE = 'shopify_web_pixel';
  var DEBUG = false;                           // 联调时临时置 true 看 console

  /* 登录用户 ID：方案 A 直发 customer_id，其余 PII 一律丢弃 */
  var customerId = null;
  try {
    customerId = (init && init.data && init.data.customer && init.data.customer.id) || null;
    if (customerId != null) customerId = String(customerId);
  } catch (e) { /* noop */ }

  function log() {
    if (DEBUG && typeof console !== 'undefined') {
      console.log.apply(console, ['[mt-pixel]'].concat([].slice.call(arguments)));
    }
  }

  function uuid() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* noop */ }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function n(v) {
    if (v === undefined || v === null || v === '') return undefined;
    var x = Number(v);
    return isNaN(x) ? undefined : x;
  }

  /* 同意校验：未授权分析时不上报（API 不可用则默认放行，由 Shopify 事件下发层把关）*/
  function consentAllowed() {
    try {
      if (init && init.data && init.data.customerPrivacy) {
        var p = init.data.customerPrivacy;
        if (typeof p.analyticsProcessingAllowed === 'boolean') return p.analyticsProcessingAllowed;
      }
    } catch (e) { /* noop */ }
    return true;
  }

  /* ====== 统一信封 + 发送 ====== */
  function envelope(event, name, payload) {
    var doc = (event && event.context && event.context.document) || {};
    var loc = doc.location || {};
    return {
      event: name,
      event_id: (event && event.id) || uuid(),
      ts: (event && event.timestamp) || new Date().toISOString(),
      source: SOURCE,
      client_id: event && event.clientId,
      customer_id: customerId, // 仅 ID，无明文 PII
      context: {
        url: loc.href,
        path: loc.pathname,
        referrer: doc.referrer,
        title: doc.title
      },
      payload: payload || {}
    };
  }

  /* 防御性兜底：即便上游结构变化，也绝不放行这些 PII key */
  var PII_KEYS = ['email', 'phone', 'firstName', 'lastName', 'name', 'address1', 'address2',
    'company', 'city', 'zip', 'province', 'country', 'phoneNumber', 'shippingAddress', 'billingAddress'];
  function stripPII(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripPII);
    var out = {};
    Object.keys(obj).forEach(function (k) {
      if (PII_KEYS.indexOf(k) !== -1) return;
      out[k] = (obj[k] && typeof obj[k] === 'object') ? stripPII(obj[k]) : obj[k];
    });
    return out;
  }

  function send(body) {
    if (!consentAllowed()) { log('skip (no consent)', body.event); return; }
    var clean = stripPII(body);
    log('send', clean.event, clean);
    if (!ENDPOINT || ENDPOINT.indexOf('__MT_ANALYTICS_ENDPOINT__') === 0) {
      log('ENDPOINT 未配置，仅本地打印'); // 占位阶段不真正发送
      return;
    }
    var json = JSON.stringify(clean);
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (AUTH_HEADER) headers.Authorization = AUTH_HEADER;
      fetch(ENDPOINT, { method: 'POST', headers: headers, body: json, keepalive: true, mode: 'cors' })
        .catch(function (e) { log('fetch error', e); });
    } catch (e) {
      try { if (typeof navigator !== 'undefined' && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, json); }
      catch (e2) { log('send failed', e2); }
    }
  }

  /* ====== 公共映射 ====== */
  function priceOf(money) { return money ? n(money.amount) : undefined; }

  function mapVariant(m) {
    m = m || {};
    var prod = m.product || {};
    return {
      item_id: prod.id != null ? String(prod.id) : undefined,
      item_variant_id: m.id != null ? String(m.id) : undefined,
      item_name: prod.title || m.title,
      item_brand: prod.vendor,
      item_sku: m.sku,
      price: priceOf(m.price)
    };
  }

  function mapLines(lines) {
    return (lines || []).map(function (li) {
      var item = mapVariant(li.variant || li.merchandise);
      item.quantity = li.quantity;
      return item;
    });
  }

  function checkoutPayload(checkout, extra) {
    checkout = checkout || {};
    var base = {
      currency: checkout.currencyCode || (checkout.totalPrice && checkout.totalPrice.currencyCode),
      value: priceOf(checkout.totalPrice),
      order_id: checkout.order && checkout.order.id != null ? String(checkout.order.id) : undefined,
      items: mapLines(checkout.lineItems)
    };
    return Object.assign(base, extra || {});
  }

  /* ====== 订阅标准事件 ====== */
  analytics.subscribe('page_viewed', function (event) {
    send(envelope(event, 'page_view', {}));
  });

  analytics.subscribe('product_viewed', function (event) {
    var pv = event.data && event.data.productVariant;
    send(envelope(event, 'view_item', { item: mapVariant(pv), currency: pv && pv.price && pv.price.currencyCode, value: pv && priceOf(pv.price) }));
  });

  analytics.subscribe('product_added_to_cart', function (event) {
    var line = event.data && event.data.cartLine;
    var item = mapVariant(line && line.merchandise);
    if (line) item.quantity = line.quantity;
    send(envelope(event, 'add_to_cart', { item: item, currency: line && line.merchandise && line.merchandise.price && line.merchandise.price.currencyCode, value: line && line.merchandise && priceOf(line.merchandise.price) }));
  });

  analytics.subscribe('cart_viewed', function (event) {
    var cart = (event.data && event.data.cart) || {};
    send(envelope(event, 'view_cart', {
      currency: cart.cost && cart.cost.totalAmount && cart.cost.totalAmount.currencyCode,
      value: cart.cost && cart.cost.totalAmount && priceOf(cart.cost.totalAmount),
      item_count: cart.totalQuantity,
      items: mapLines(cart.lines)
    }));
  });

  analytics.subscribe('checkout_started', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'begin_checkout', checkoutPayload(c, { source: 'checkout_page' })));
  });

  /* 三期A：结账步骤标准事件（联系方式 / 地址 / 配送方式）。仅记步骤+金额，PII 由 stripPII 兜底剥离 */
  analytics.subscribe('checkout_contact_info_submitted', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'add_contact_info', checkoutPayload(c)));
  });

  analytics.subscribe('checkout_address_info_submitted', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'add_address_info', checkoutPayload(c)));
  });

  analytics.subscribe('checkout_shipping_info_submitted', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'add_shipping_info', checkoutPayload(c, {
      shipping_method: c && c.shippingLine && c.shippingLine.title,
      shipping_cost: c && c.shippingLine && c.shippingLine.price ? priceOf(c.shippingLine.price) : undefined
    })));
  });

  analytics.subscribe('payment_info_submitted', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'add_payment_info', checkoutPayload(c, {
      payment_type: c && c.transactions && c.transactions[0] && c.transactions[0].gateway
    })));
  });

  analytics.subscribe('checkout_completed', function (event) {
    var c = event.data && event.data.checkout;
    send(envelope(event, 'purchase', checkoutPayload(c)));
  });

  /* ====== 订阅主题侧自定义事件 ====== */
  analytics.subscribe('mt_view_item_list', function (event) {
    var d = event.customData || {};
    send(envelope(event, 'view_item_list', { items: d.items || [] }));
  });

  analytics.subscribe('mt_select_item', function (event) {
    var d = event.customData || {};
    send(envelope(event, 'select_item', { item: d.item }));
  });

  analytics.subscribe('mt_begin_checkout', function (event) {
    var d = event.customData || {};
    send(envelope(event, 'begin_checkout', { source: d.source, cart: d.cart, item: d.item }));
  });

  /* ====== 通用事件通道（二期起）======
   * 主题侧 MT.track(name, params) 发出的所有事件都走 mt_track，
   * 这里按 customData.event 作为 GA4 事件名转发，其余字段作为 payload。
   * 好处：以后主题新增任何交互事件，Pixel 端无需改动。 */
  analytics.subscribe('mt_track', function (event) {
    var d = event.customData || {};
    var name = d.event;
    if (!name) return;
    var params = {};
    Object.keys(d).forEach(function (k) {
      if (k !== 'event' && k !== '_mt' && k !== 'ts') params[k] = d[k];
    });
    send(envelope(event, name, params));
  });

  /* Search（标准事件）-> search */
  analytics.subscribe('search_submitted', function (event) {
    var s = event.data && event.data.searchResult;
    send(envelope(event, 'search', {
      query: s && s.query,
      results: s && s.productVariants ? s.productVariants.length : undefined
    }));
  });

  log('moodytiger pixel ready', { customer: !!customerId });
})();
