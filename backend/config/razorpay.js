/* =====================================================================
   config/razorpay.js — Razorpay SDK client (singleton)

   Credentials come ONLY from environment variables — never hardcoded:
     RAZORPAY_KEY_ID          public key, safe to send to the browser
     RAZORPAY_KEY_SECRET      private, server-only. NEVER expose this.
     RAZORPAY_WEBHOOK_SECRET  optional; enables the webhook endpoint.

   The module deliberately does NOT throw when the keys are missing: the rest
   of the API (COD ordering, catalogue, auth) must keep working on a deployment
   where online payment isn't configured yet. Callers check
   `isRazorpayConfigured()` and return a clean 503 instead.
   ===================================================================== */

const Razorpay = require('razorpay');

const KEY_ID     = (process.env.RAZORPAY_KEY_ID || '').trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();

let client = null;

if (KEY_ID && KEY_SECRET) {
  client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  // rzp_test_* = test mode, rzp_live_* = real money. Log the MODE only —
  // never the key material itself.
  console.log(`[razorpay] initialised in ${KEY_ID.startsWith('rzp_live_') ? 'LIVE' : 'TEST'} mode`);
} else {
  console.warn('[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — online payment disabled (COD unaffected)');
}

/** True when both credentials are present and the SDK client is ready. */
const isRazorpayConfigured = () => Boolean(client);

/** Public key id — safe to hand to the browser for Checkout. */
const getPublicKeyId = () => KEY_ID;

/** Secret — server-side only (HMAC signature verification). */
const getKeySecret = () => KEY_SECRET;

/** Webhook signing secret; empty string when webhooks aren't configured. */
const getWebhookSecret = () => (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

module.exports = {
  /** The raw Razorpay SDK instance (null when unconfigured). */
  get instance() { return client; },
  isRazorpayConfigured,
  getPublicKeyId,
  getKeySecret,
  getWebhookSecret,
};
