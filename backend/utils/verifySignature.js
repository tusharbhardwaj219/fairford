/* =====================================================================
   utils/verifySignature.js — Razorpay HMAC-SHA256 signature verification

   The browser can send us anything, so a payment is only ever treated as
   genuine when the signature Razorpay generated with OUR key secret matches
   the one we compute server-side.

     Checkout handler:  HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
     Webhook:           HMAC_SHA256(<raw request body>, WEBHOOK_SECRET)

   Comparison uses crypto.timingSafeEqual to avoid leaking information through
   response timing.
   ===================================================================== */

const crypto = require('crypto');
const { getKeySecret, getWebhookSecret } = require('../config/razorpay');

/**
 * Constant-time comparison of two hex signatures.
 * Returns false (never throws) on any length/encoding mismatch.
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_) {
    return false;
  }
}

/**
 * Verify a Razorpay Checkout payment signature.
 *
 * @param {object} p
 * @param {string} p.razorpay_order_id
 * @param {string} p.razorpay_payment_id
 * @param {string} p.razorpay_signature
 * @returns {boolean} true only when the signature is authentic.
 */
function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const secret = getKeySecret();
  if (!secret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return safeEqual(expected, razorpay_signature);
}

/**
 * Verify a Razorpay webhook signature against the RAW request body.
 * `rawBody` MUST be the unparsed Buffer/string — re-serialising the parsed JSON
 * changes byte order/spacing and the HMAC will never match.
 *
 * @param {Buffer|string} rawBody
 * @param {string} signature  value of the x-razorpay-signature header
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = getWebhookSecret();
  if (!secret || !rawBody || !signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8'))
    .digest('hex');

  return safeEqual(expected, signature);
}

module.exports = { verifyPaymentSignature, verifyWebhookSignature, safeEqual };
