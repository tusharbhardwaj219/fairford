/* =====================================================================
   payment.js — Razorpay Standard Checkout (frontend)

   Exposes a single global:  FFPayment.payForCart(items, options)

   Flow
     1. POST /api/payments/order  → server prices the cart, reserves stock and
        returns a Razorpay order id. The amount is NEVER sent from here.
     2. Open the Razorpay Checkout modal with that order id.
     3. On success  → POST /api/payments/verify  (server checks the HMAC)
        On dismiss  → POST /api/payments/failed  (user closed the modal)
        On failure  → POST /api/payments/failed  (payment.failed event)

   Requires https://checkout.razorpay.com/v1/checkout.js to be loaded first.
   ===================================================================== */
(function (window) {
  'use strict';

  var API = '/api';
  var BRAND = {
    name:  'Fair Ford Pharmaceuticals',
    logo:  '/LOGO.png',
    theme: '#0F4C81',
  };

  function token() {
    return localStorage.getItem('ff_token') || '';
  }

  /** fetch wrapper that always sends the JWT and unwraps the JSON envelope. */
  async function api(path, body) {
    var res = await fetch(API + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token(),
      },
      body: JSON.stringify(body || {}),
    });
    var data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok || data.success === false) {
      var err = new Error(data.message || ('Request failed (HTTP ' + res.status + ')'));
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  /** Is the Checkout SDK present? (blocked by CSP / offline / adblock) */
  function sdkReady() {
    return typeof window.Razorpay === 'function';
  }

  /**
   * Pay for a cart online.
   * @param {Array}  items                [{ product, quantity }]
   * @param {object} [opts]
   * @param {string} [opts.deliveryPriority='standard']
   * @param {string} [opts.notes]
   * @param {function(string)} [opts.onStatus]   progress messages for the UI
   * @param {function(object)} [opts.onSuccess]  ({ order, paymentId })
   * @param {function(Error)}  [opts.onFailure]
   * @param {boolean} [opts.redirect=true]       go to payment-success/failed page
   */
  async function payForCart(items, opts) {
    opts = opts || {};
    var say = opts.onStatus || function () {};

    if (!items || !items.length) throw new Error('Your cart is empty');
    if (!token()) {
      window.location.href = 'login&signup.html';
      return;
    }
    if (!sdkReady()) {
      throw new Error('Payment library could not load. Check your connection or ad-blocker and retry.');
    }

    // ── 1. Ask the server to create the order ────────────────────────────────
    say('Creating your order…');
    var init = await api('/payments/order', {
      items: items,
      deliveryPriority: opts.deliveryPriority || 'standard',
      notes: opts.notes,
    });

    // ── 2. Open Checkout ─────────────────────────────────────────────────────
    return new Promise(function (resolve, reject) {
      var settled = false;
      function finish(fn, arg) {
        if (settled) return;
        settled = true;
        fn(arg);
      }

      var rzp = new window.Razorpay({
        key:      init.keyId,
        order_id: init.order_id,
        amount:   init.amount,        // paise — display only; server is authoritative
        currency: init.currency || 'INR',
        name:        BRAND.name,
        description: 'Order ' + init.orderNumber,
        image:       BRAND.logo,
        prefill: {
          name:    (init.prefill && init.prefill.name)    || '',
          email:   (init.prefill && init.prefill.email)   || '',
          contact: (init.prefill && init.prefill.contact) || '',
        },
        notes: { orderNumber: init.orderNumber },
        theme: { color: BRAND.theme },

        // ── success ──
        handler: async function (response) {
          try {
            say('Verifying payment…');
            var verified = await api('/payments/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            var result = {
              order: verified.order,
              paymentId: verified.paymentId,
              orderNumber: (verified.order && verified.order.orderNumber) || init.orderNumber,
            };
            if (opts.onSuccess) opts.onSuccess(result);
            if (opts.redirect !== false) {
              window.location.href = 'payment-success.html?order=' +
                encodeURIComponent(result.orderNumber) +
                '&payment=' + encodeURIComponent(result.paymentId || '');
            }
            finish(resolve, result);
          } catch (err) {
            // Money may have left the account but our verification failed —
            // never show "success" here.
            if (opts.onFailure) opts.onFailure(err);
            if (opts.redirect !== false) {
              window.location.href = 'payment-failed.html?order=' +
                encodeURIComponent(init.orderNumber) +
                '&reason=' + encodeURIComponent(err.message || 'verification failed');
            }
            finish(reject, err);
          }
        },

        modal: {
          // ── user closed the modal ──
          ondismiss: function () {
            api('/payments/failed', {
              razorpay_order_id: init.order_id,
              reason: 'cancelled by user',
            }).catch(function () { /* best-effort bookkeeping */ });
            var err = new Error('Payment cancelled. Your order is saved as unpaid — you can retry from My Orders.');
            err.cancelled = true;
            if (opts.onFailure) opts.onFailure(err);
            finish(reject, err);
          },
        },
      });

      // ── gateway-reported failure (card declined, UPI timeout, …) ──
      rzp.on('payment.failed', function (resp) {
        var d = (resp && resp.error) || {};
        api('/payments/failed', {
          razorpay_order_id: (d.metadata && d.metadata.order_id) || init.order_id,
          reason: d.description || d.reason || 'payment failed',
        }).catch(function () {});
        var err = new Error(d.description || 'Payment failed. No money was deducted, or it will be refunded automatically.');
        if (opts.onFailure) opts.onFailure(err);
        if (opts.redirect !== false) {
          window.location.href = 'payment-failed.html?order=' +
            encodeURIComponent(init.orderNumber) +
            '&reason=' + encodeURIComponent(err.message);
        }
        finish(reject, err);
      });

      say('Opening secure checkout…');
      rzp.open();
    });
  }

  /** Whether the server has online payment switched on. */
  async function isEnabled() {
    try {
      var res = await fetch(API + '/payments/config');
      var data = await res.json();
      return Boolean(data && data.enabled) && sdkReady();
    } catch (e) {
      return false;
    }
  }

  window.FFPayment = { payForCart: payForCart, isEnabled: isEnabled, sdkReady: sdkReady };
})(window);
