/* =====================================================================
   contact-redesign.js — Fair Ford Pharmaceuticals · Contact page
   ---------------------------------------------------------------------
   Shared header/footer + the business-inquiry form: per-field validation,
   char counter, honeypot spam guard, loading / success / error states,
   and inquiry-type prefill from ?enquiry=. Posts to POST /api/contact.
   ===================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---- shared chrome (identical to every other page) ---- */
  if (typeof renderHeader === 'function') {
    $('site-header').innerHTML = renderHeader('contact');
    if (typeof initHeader === 'function') initHeader();
  }
  if (typeof renderFooter === 'function') {
    $('site-footer').innerHTML = renderFooter();
    if (typeof initFooter === 'function') initFooter();
  }
  if (typeof store !== 'undefined' && store.syncCounts) store.syncCounts();

  var form = $('cx-form');
  if (!form) return;

  /* ---- prefill inquiry type from ?enquiry= (from About/product CTAs) ---- */
  var ENQUIRY_MAP = {
    'institutional': 'Hospital/Institutional Inquiry',
    'hospital': 'Hospital/Institutional Inquiry',
    'documentation': 'Hospital/Institutional Inquiry',
    'partnership': 'Business Partnership',
    'wholesale-pricing': 'Bulk Order',
    'bulk-quote': 'Bulk Order',
    'distributor': 'Distributor Inquiry',
    'retailer': 'Retailer Support',
    'product': 'Product Inquiry'
  };
  (function prefill() {
    var q = new URLSearchParams(window.location.search).get('enquiry');
    if (!q) return;
    var want = ENQUIRY_MAP[q.toLowerCase().trim()];
    var sel = $('cx-inquiry');
    if (want && sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === want || sel.options[i].text === want) { sel.selectedIndex = i; break; }
      }
    }
  })();

  /* ---- phone: keep to digits only ---- */
  var phone = $('cx-phone');
  phone.addEventListener('input', function () {
    var d = phone.value.replace(/\D/g, '').slice(0, 10);
    if (d !== phone.value) phone.value = d;
  });

  /* ---- message character counter ---- */
  var msg = $('cx-message'), count = $('cx-count');
  msg.addEventListener('input', function () { if (count) count.textContent = msg.value.length; });

  /* ---- validation ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^[6-9]\d{9}$/;

  function fieldOf(el) { return el.closest('.cx-field'); }
  function setError(el, msgText) {
    var f = fieldOf(el); if (!f) return;
    f.classList.add('is-invalid'); f.classList.remove('is-valid');
    var e = f.querySelector('.cx-err'); if (e) e.textContent = msgText || '';
  }
  function setValid(el) {
    var f = fieldOf(el); if (!f) return;
    f.classList.remove('is-invalid'); f.classList.add('is-valid');
    var e = f.querySelector('.cx-err'); if (e) e.textContent = '';
  }
  function clearState(el) {
    var f = fieldOf(el); if (!f) return;
    f.classList.remove('is-invalid', 'is-valid');
  }

  function validateField(el) {
    var v = (el.value || '').trim();
    switch (el.id) {
      case 'cx-name':
        if (!v) return setError(el, 'Please enter your name'), false;
        if (v.length < 3) return setError(el, 'Name must be at least 3 characters'), false;
        break;
      case 'cx-email':
        if (!v) return setError(el, 'Please enter your email'), false;
        if (!EMAIL_RE.test(v)) return setError(el, 'Enter a valid email address'), false;
        break;
      case 'cx-phone':
        if (!v) return setError(el, 'Please enter your phone number'), false;
        if (!PHONE_RE.test(v)) return setError(el, 'Enter a valid 10-digit Indian mobile (starts 6–9)'), false;
        break;
      case 'cx-inquiry':
        if (!v) return setError(el, 'Please choose an inquiry type'), false;
        break;
      case 'cx-message':
        if (!v) return setError(el, 'Please add a short message'), false;
        if (v.length < 10) return setError(el, 'Please add a little more detail (min 10 characters)'), false;
        break;
      default:
        // optional fields — never block, just clear any error state
        clearState(el); return true;
    }
    setValid(el);
    return true;
  }

  // required fields to validate on submit
  var REQUIRED = ['cx-name', 'cx-email', 'cx-phone', 'cx-inquiry', 'cx-message'];

  // live validation: validate a field after the user leaves it / changes it
  REQUIRED.forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('blur', function () { if (el.value.trim()) validateField(el); });
    el.addEventListener('change', function () { validateField(el); });
    el.addEventListener('input', function () { if (fieldOf(el).classList.contains('is-invalid')) validateField(el); });
  });

  /* ---- submit ---- */
  var submitBtn = $('cx-submit');
  var okBox = $('cx-ok'), failBox = $('cx-fail');
  var consent = $('cx-consent');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    okBox.classList.remove('is-on');
    failBox.classList.remove('is-on');

    // honeypot — a real user never fills this; bots do → drop silently
    var gotcha = form.querySelector('[name="_gotcha"]');
    if (gotcha && gotcha.value) { okBox.classList.add('is-on'); form.reset(); return; }

    // validate all required fields
    var firstBad = null, allOk = true;
    REQUIRED.forEach(function (id) {
      var el = $(id);
      if (!validateField(el)) { allOk = false; if (!firstBad) firstBad = el; }
    });
    if (consent && !consent.checked) {
      allOk = false;
      consent.parentNode.style.color = 'var(--err)';
      if (!firstBad) firstBad = consent;
    } else if (consent) {
      consent.parentNode.style.color = '';
    }
    if (!allOk) { if (firstBad && firstBad.focus) firstBad.focus(); return; }

    var payload = {
      name: $('cx-name').value.trim(),
      email: $('cx-email').value.trim(),
      phone: $('cx-phone').value.trim(),
      inquiryType: $('cx-inquiry').value,
      message: $('cx-message').value.trim(),
      company: $('cx-company').value.trim(),
      businessType: $('cx-business').value,
      city: $('cx-city').value.trim(),
      productRequirement: $('cx-req').value.trim(),
      _gotcha: gotcha ? gotcha.value : ''
    };

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; }); })
      .then(function (r) {
        if (r.ok && r.body && r.body.success !== false) {
          okBox.classList.add('is-on');
          form.reset();
          if (count) count.textContent = '0';
          REQUIRED.forEach(function (id) { clearState($(id)); });
          okBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // surface a field error the server flagged, else the generic message
          var errs = r.body && r.body.errors;
          if (Array.isArray(errs) && errs.length) {
            var map = { name: 'cx-name', email: 'cx-email', phone: 'cx-phone', message: 'cx-message', inquiryType: 'cx-inquiry' };
            errs.forEach(function (er) { var el = $(map[er.field]); if (el) setError(el, er.message); });
          }
          failBox.classList.add('is-on');
          failBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(function () {
        failBox.classList.add('is-on');
        failBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .finally(function () {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      });
  });
});
