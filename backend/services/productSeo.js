/*
  productSeo.js — server-side per-product <head> rendering.

  Computes the exact same SEO fields the browser sets in
  frontend/js/productdetail.js (applyMeta + buildProductJsonLd) and injects
  them into the served productdetail.html, so a crawler that does NOT execute
  JavaScript still receives the real title, meta description, canonical, Open
  Graph tags and Product + BreadcrumbList JSON-LD. When JS does run it re-applies
  identical values, so there is no conflict.

  Only verified, on-page facts are emitted — no price, offers, availability or
  aggregateRating. Nothing is invented; missing fields are simply omitted.
*/

const ORIGIN = 'https://www.fairfordpharma.com';

const real = (v) => { const s = String(v == null ? '' : v).trim(); return (!s || s === '-') ? '' : s; };
const compArr = (p) => Array.isArray(p.composition) ? p.composition.filter(Boolean).map(String) : (p.composition ? [String(p.composition)] : []);
const compText = (p) => compArr(p).join(' + ');
const catOf = (p) => p.categoryName
  || (p.category && typeof p.category === 'object' ? p.category.categoryName : '')
  || (typeof p.category === 'string' ? p.category : '') || '';
const codeOf = (p) => { const t = (p.tags || []).filter(x => /^code:/i.test(String(x)))[0]; return t ? String(t).slice(5).trim() : ''; };
const galOf = (p) => {
  const out = [];
  (Array.isArray(p.images) ? p.images : []).forEach(x => { const u = !x ? '' : (typeof x === 'string' ? x : (x.url || '')); if (u && out.indexOf(u) < 0) out.push(u); });
  const primary = p.image ? (typeof p.image === 'string' ? p.image : (p.image.url || '')) : '';
  if (primary && out.indexOf(primary) < 0) out.unshift(primary);
  return out;
};

// HTML-escape for an attribute value (content="...", href="...").
const attr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Neutralise a </script> inside JSON-LD so it can't close the host <script>.
const jsonForScript = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\/');

const DEFAULT_IMG = 'https://res.cloudinary.com/dp4yririh/image/upload/v1782967649/fairford/site/m5d8pmtzdjr4dcgctvuc.png';

/** Compute the SEO field set for a product record (mirrors applyMeta). */
function buildProductSeo(p) {
  const name = real(p.name) || 'Product';
  const cat = catOf(p);
  const comp = compText(p);
  const gal = galOf(p);
  const code = codeOf(p);
  const bits = [real(p.strength), real(p.packSize), real(p.dosageForm), comp].filter(Boolean);
  const description = (name + (cat ? ' — ' + cat : '') + '. ' + (bits.length ? bits.join(' · ') + '. ' : '') +
    'Available for B2B order from Fair Ford Pharmaceuticals.').slice(0, 300);
  const canonical = p.slug ? ORIGIN + '/product/' + encodeURIComponent(p.slug)
    : (p.id || p._id ? ORIGIN + '/productdetail.html?id=' + encodeURIComponent(p.id || p._id) : ORIGIN + '/product.html');
  const ogImage = gal[0] || DEFAULT_IMG;
  const active = !p.status || p.status === 'active';

  // Product + BreadcrumbList (identical shape to buildProductJsonLd)
  const product = { '@type': 'Product', name, description, url: canonical };
  if (gal.length) product.image = gal.slice(0, 4);
  if (real(p.brand)) product.brand = { '@type': 'Brand', name: p.brand };
  if (code) product.sku = code;
  if (comp) product.additionalProperty = [{ '@type': 'PropertyValue', name: 'Composition', value: comp }];
  if (cat) product.category = cat;
  product.manufacturer = { '@type': 'Organization', name: 'Fair Ford Pharmaceuticals Pvt. Ltd.' };

  const crumbs = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: 'Products', item: ORIGIN + '/product.html' }
  ];
  let pos = 3;
  if (cat) crumbs.push({ '@type': 'ListItem', position: pos++, name: cat, item: ORIGIN + '/product.html?category=' + encodeURIComponent(cat) });
  crumbs.push({ '@type': 'ListItem', position: pos, name, item: canonical });

  const jsonld = { '@context': 'https://schema.org', '@graph': [product, { '@type': 'BreadcrumbList', itemListElement: crumbs }] };

  return {
    title: 'Fair Ford — ' + name,
    ogTitle: name + ' — Fair Ford Pharmaceuticals',
    description, canonical, ogImage, jsonld, active
  };
}

/* Replace the value of the content/href attribute on the tag carrying id="ID".
   meta/link tags contain no '>' internally, so the tag is [^>]*. */
function setAttrById(html, id, attrName, value) {
  const re = new RegExp('(<[^>]*\\bid="' + id + '"[^>]*\\b' + attrName + '=")[^"]*(")');
  return html.replace(re, '$1' + value.replace(/\$/g, '$$$$') + '$2');
}

/** Inject the computed SEO into a productdetail.html string. */
function injectProductSeo(html, p) {
  const seo = buildProductSeo(p);
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, '<title>' + attr(seo.title) + '</title>');
  out = setAttrById(out, 'meta-desc', 'content', attr(seo.description));
  out = setAttrById(out, 'canonical-link', 'href', attr(seo.canonical));
  out = setAttrById(out, 'og-title', 'content', attr(seo.ogTitle));
  out = setAttrById(out, 'og-desc', 'content', attr(seo.description));
  out = setAttrById(out, 'og-image', 'content', attr(seo.ogImage));
  out = setAttrById(out, 'og-url', 'content', attr(seo.canonical));
  // Inactive/archived products are servable but should not be indexed.
  if (!seo.active) {
    out = out.replace(/(<meta name="robots" content=")[^"]*(")/, '$1noindex, follow$2');
  }
  out = out.replace(
    /(<script type="application\/ld\+json" id="pdx-jsonld">)[\s\S]*?(<\/script>)/,
    '$1' + jsonForScript(seo.jsonld) + '$2'
  );
  return out;
}

module.exports = { buildProductSeo, injectProductSeo, attr, jsonForScript, setAttrById, ORIGIN, DEFAULT_IMG };
