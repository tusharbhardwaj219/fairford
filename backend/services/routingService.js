/* =====================================================================
   services/routingService.js — Order routing engine

   Given a retailer's delivery address, find the nearest serviceable
   distributor / stockist. The order is then sent to that node, which
   handles last-mile delivery to the retailer.

   Match strategy (best match wins, evaluated in order):
     1. Exact pincode listed in distributor.serviceablePincodes
     2. Same pincode region (first 3 digits) — nearest pincode numerically
     3. Retailer city listed in distributor.territory (serviceable cities)
     4. Distributor's own businessAddress.city equals the retailer city

   Returns the Distributor document, or null when no active distributor
   covers the area (caller blocks the order as "not serviceable").
   ===================================================================== */

const Distributor = require('../models/Distributor');

const norm = (s) => (s || '').toString().trim().toLowerCase();

// Smallest absolute numeric gap between `pin` and any of the distributor's pincodes.
function nearestPincodeGap(distributor, pin) {
  const target = Number(pin);
  let best = Infinity;
  for (const p of distributor.serviceablePincodes || []) {
    const n = Number(p);
    if (!Number.isNaN(n)) best = Math.min(best, Math.abs(n - target));
  }
  return best;
}

/**
 * @param   {{ pincode?: string, city?: string }} address
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function findServiceableDistributor(address = {}) {
  const actives = await Distributor.find({ status: 'active' });
  if (!actives.length) return null;

  const pin   = (address.pincode || '').toString().trim();
  const cityN = norm(address.city);

  // 1. Exact pincode match
  if (pin) {
    const exact = actives.filter((d) =>
      (d.serviceablePincodes || []).map(String).map((s) => s.trim()).includes(pin)
    );
    if (exact.length) return exact[0];
  }

  // 2. Same region (first 3 digits of a 6-digit pincode) — closest numerically
  if (/^\d{6}$/.test(pin)) {
    const region = pin.slice(0, 3);
    const sameRegion = actives.filter((d) =>
      (d.serviceablePincodes || []).some((p) => String(p).trim().slice(0, 3) === region)
    );
    if (sameRegion.length) {
      sameRegion.sort((a, b) => nearestPincodeGap(a, pin) - nearestPincodeGap(b, pin));
      return sameRegion[0];
    }
  }

  // 3. City listed in serviceable territory
  if (cityN) {
    const byCity = actives.filter((d) => (d.territory || []).map(norm).includes(cityN));
    if (byCity.length) return byCity[0];

    // 4. Distributor's own base city
    const byBaseCity = actives.filter((d) => norm(d.businessAddress && d.businessAddress.city) === cityN);
    if (byBaseCity.length) return byBaseCity[0];
  }

  return null;
}

module.exports = { findServiceableDistributor };
