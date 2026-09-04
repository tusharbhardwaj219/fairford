/*
  categorySeo.js — server-side per-category <head> rendering for the catalogue.

  A category view is served at /product.html?category=<Name> (the self-canonical,
  independently-indexable URL). This module resolves the requested category
  against the live catalogue, and injects a unique title, meta description,
  canonical, Open Graph tags and a CollectionPage + BreadcrumbList JSON-LD into
  product.html — so crawlers that don't run JavaScript still get a real category
  landing page instead of the generic catalogue head. product.js re-applies the
  same values client-side (applyCategoryMeta), and its writeURL() uses the same
  URLSearchParams encoding, so the canonical is identical on both sides.

  Category names and counts come straight from the live product data — nothing
  is invented and the intro copy carries no medical claims.
*/

const { attr, jsonForScript, setAttrById, ORIGIN, DEFAULT_IMG } = require('./productSeo');

// Category counts change rarely (admin edits) — cache for 5 minutes so the
// common /product.html and /sitemap.xml paths don't re-scan every request.
let _cache = null, _cacheAt = 0;
const TTL = 5 * 60 * 1000;

/** { "<categoryName>": <activeProductCount> } built the same way the frontend
 *  derives a product's category (populated category.categoryName, else the
 *  plain categoryName field). */
async function getCategoryCounts() {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;
  const Product = require('../models/Product');
  const docs = await Product.find({ status: 'active' }).select('categoryName category').lean();
  const map = {};
  docs.forEach(d => {
    const name = String((d.category && d.category.categoryName) || d.categoryName || '').trim();
    if (name) map[name] = (map[name] || 0) + 1;
  });
  _cache = map; _cacheAt = Date.now();
  return map;
}

/** URLSearchParams encoding (space→'+', '&'→'%26') — matches product.js writeURL
 *  so the SSR canonical, the internal links and the client canonical all agree. */
function categoryUrl(name) {
  return ORIGIN + '/product.html?' + new URLSearchParams({ category: name }).toString();
}

/** Case-insensitive match of a ?category= value to a real, non-empty category.
 *  Returns the canonical-cased {name, count} or null (unknown → not a page). */
function resolveCategory(value, map) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  const hit = Object.keys(map).find(k => k.toLowerCase() === v);
  return hit ? { name: hit, count: map[hit] } : null;
}

function buildCategorySeo(name, count) {
  const canonical = categoryUrl(name);
  const title = name + ' — Fair Ford Pharmaceuticals';
  const description = ('Browse ' + count + ' ' + name + ' ' + (count === 1 ? 'product' : 'products') +
    ' from Fair Ford Pharmaceuticals — available for B2B order by retailers, distributors and stockists across India. View compositions, pack sizes and specifications.').slice(0, 300);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: name,
    description: description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Fair Ford Pharmaceuticals', url: ORIGIN + '/' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Products', item: ORIGIN + '/product.html' },
        { '@type': 'ListItem', position: 3, name: name, item: canonical }
      ]
    }
  };
  return { title, description, canonical, jsonld };
}

/** Inject category SEO into a product.html string. */
function injectCategorySeo(html, name, count) {
  const seo = buildCategorySeo(name, count);
  let out = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + attr(seo.title) + '</title>');
  out = setAttrById(out, 'meta-desc', 'content', attr(seo.description));
  out = setAttrById(out, 'canonical-link', 'href', attr(seo.canonical));
  out = setAttrById(out, 'og-title', 'content', attr(seo.title));
  out = setAttrById(out, 'og-desc', 'content', attr(seo.description));
  out = setAttrById(out, 'og-url', 'content', attr(seo.canonical));
  // H1 matches the page topic for non-JS crawlers.
  out = out.replace(/(<h1 id="ffm-hero-title">)[\s\S]*?(<\/h1>)/, '$1' + attr(name) + '$2');
  out = out.replace(
    /(<script type="application\/ld\+json" id="pg-jsonld">)[\s\S]*?(<\/script>)/,
    '$1' + jsonForScript(seo.jsonld) + '$2'
  );
  return out;
}

module.exports = { getCategoryCounts, resolveCategory, categoryUrl, buildCategorySeo, injectCategorySeo };
