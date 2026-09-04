#!/usr/bin/env node
/* =====================================================================
   delete-extras.js — one-off admin utility
   Permanently deletes the 7 "extra" products (present on the website but
   NOT in the printed Product Index) through the site's own API, which also
   removes each product's Cloudinary images.

   Run from main/backend:
       node delete-extras.js

   Authentication (your credentials stay on YOUR machine — nothing is sent
   anywhere except your own server at API_URL, default http://localhost:5000):
     • Log in when prompted (admin email + password), OR
     • Paste an existing admin token:  FF_ADMIN_TOKEN=<token> node delete-extras.js
       (get it from the Super Admin tab in DevTools: localStorage.getItem('ff_token'))

   Flags:  --yes   skip the typed confirmation
   Safe to delete this file afterwards.
   ===================================================================== */
'use strict';
const readline = require('readline');
const API = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');

// The 7 confirmed targets (name is for display only; deletion is by _id).
const TARGETS = [
  ['6a4353ac040c60767fbc0be5', 'Fordclave - 625 Tablet'],
  ['6a4353ad040c60767fbc0be7', 'Fordclave Dry Syrup'],
  ['6a435520b849aa13f1e740d7', 'Metrofair-400 Tablet'],
  ['6a43555db849aa13f1e740fd', 'Oflofair -MZ Suspension'],
  ['6a4353ef040c60767fbc0bfa', 'Podfair-200 Tablet'],
  ['6a4353f3040c60767fbc0c00', 'Protifair DF'],
  ['6a435405040c60767fbc0c0a', 'Rabezo- 20 Tablet'],
];

function prompt(q, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) rl._writeToOutput = (s) => process.stdout.write(rl.muted ? '' : s);
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
    if (hidden) rl.muted = true;
  });
}

async function getToken() {
  if (process.env.FF_ADMIN_TOKEN) return process.env.FF_ADMIN_TOKEN.trim();
  const email = process.env.ADMIN_EMAIL || await prompt('Admin email: ');
  const password = process.env.ADMIN_PASS || await prompt('Admin password: ', true);
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.token) throw new Error('Login failed: ' + (b.message || ('HTTP ' + r.status)));
  const role = b.user && b.user.role;
  if (role && role !== 'admin' && role !== 'superadmin') {
    throw new Error('That account is a "' + role + '", not an admin — it cannot delete products.');
  }
  console.log('Logged in as ' + ((b.user && b.user.email) || email) + (role ? ' (' + role + ')' : '') + '.');
  return b.token;
}

(async () => {
  console.log('\nTarget server: ' + API);
  console.log('These ' + TARGETS.length + ' products will be PERMANENTLY deleted (with their Cloudinary images):');
  TARGETS.forEach(([id, name], i) => console.log('  ' + (i + 1) + '. ' + name + '   [' + id + ']'));

  const confirmed = process.argv.includes('--yes') || (await prompt('\nType DELETE to confirm: ')) === 'DELETE';
  if (!confirmed) { console.log('Cancelled — nothing was deleted.'); process.exit(0); }

  let token;
  try { token = await getToken(); }
  catch (e) { console.error('\nAuth error: ' + e.message); process.exit(1); }

  console.log('');
  let done = 0;
  for (const [id, name] of TARGETS) {
    try {
      const r = await fetch(API + '/api/products/' + id, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok && b.success) { console.log('  ✓ deleted   ' + name); done++; }
      else if (r.status === 404) { console.log('  – not found ' + name + ' (already gone)'); }
      else { console.log('  ✗ FAILED    ' + name + '  — ' + (b.message || ('HTTP ' + r.status))); }
    } catch (e) { console.log('  ✗ ERROR     ' + name + '  — ' + e.message); }
  }
  console.log('\nFinished: ' + done + ' of ' + TARGETS.length + ' deleted.');
  process.exit(0);
})();
