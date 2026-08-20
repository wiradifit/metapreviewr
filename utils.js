/**
 * utils.js — Shared utilities for MetaPreviewr
 *
 * Provides:
 *  - proxy-aware fetch for remote URLs
 *  - HTML string parsing helpers
 *  - Open Graph / Twitter Card / LinkedIn field extractors
 *  - debounce / throttle helpers
 *  - clipboard copy with toast feedback
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Public CORS proxies tried in order when fetching remote pages.
 * Each entry must support simple GET requests without authentication.
 */
const PROXY_CHAIN = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

/** Delay in ms before a toast notification auto-dismisses. */
const TOAST_DURATION_MS = 2800;

/** CSS class used to hide elements via display:none. */
const HIDDEN_CLASS = 'mp-hidden';

// ---------------------------------------------------------------------------
// DOM constants (created once, reused)
// ---------------------------------------------------------------------------

/** Cached <template> element for HTML parsing – avoids repeated DOM insertion. */
let _parseTemplate = null;

/** Lazy-initialised parser template. */
function _getParseTemplate() {
  if (!_parseTemplate) {
    _parseTemplate = document.createElement('template');
  }
  return _parseTemplate;
}

// ---------------------------------------------------------------------------
// Proxy-aware fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a remote URL, falling back through a chain of CORS proxies on failure.
 *
 * @param {string} url - The target URL to fetch.
 * @returns {Promise<{status:number, body:string, source:'direct'|'proxy'}>}
 */
async function fetchWithProxy(url) {
  // Normalise to string and reject obviously empty input early.
  const target = String(url).trim();
  if (!target) throw new Error('fetchWithProxy: empty URL');

  const results = await _tryProxies(target, PROXY_CHAIN);
  return results;
}

/**
 * Attempt fetching through each proxy in sequence until one succeeds.
 *
 * @param {string} url
 * @param {string[]} proxies
 * @returns {Promise<{status:number, body:string, source:string}>}
 */
async function _tryProxies(url, proxies) {
  // First, try a direct fetch (works for same-origin or permissive CORS sites).
  try {
    const resp = await fetch(url, { mode: 'cors' });
    const body = await resp.text();
    return { status: resp.status, body, source: 'direct' };
  } catch {
    // Direct request failed – proceed to proxy chain.
  }

  // Try each proxy sequentially.
  for (const proxy of proxies) {
    const proxyUrl = proxy + encodeURIComponent(url);
    try {
      const resp = await fetch(proxyUrl);
      if (!resp.ok) continue;
      const body = await resp.text();
      // Some proxies wrap the response in JSON {contents: "..."} instead of raw text.
      const rawBody = _extractContents(resp, body);
      return { status: resp.status, body: rawBody, source: proxy };
    } catch {
      continue;
    }
  }

  throw new Error(
    `fetchWithProxy: all attempts failed for "${url}". No proxy succeeded.`
  );
}

/**
 * If a proxy returns JSON with a `contents` field, unwrap it.
 * Otherwise return the body as-is.
 *
 * @param {Response} resp
 * @param {string} body
 * @returns {string}
 */
function _extractContents(resp, body) {
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('json')) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.contents === 'string') {
        return parsed.contents;
      }
    } catch {
      // Not valid JSON – fall through to return raw body.
    }
  }
  return body;
}

// ---------------------------------------------------------------------------
// HTML string parsing
// ---------------------------------------------------------------------------

/**
 * Parse an HTML string and return the DocumentFragment containing its root children.
 * Uses a template element to avoid unintended side-effects on the live DOM.
 *
 * @param {string} html
 * @returns {DocumentFragment}
 */
function parseHTML(html) {
  const template = _getParseTemplate();
  template.innerHTML = html.trim();
  // Clone so callers can safely consume the fragment multiple times.
  const fragment = document.createDocumentFragment();
  while (template.content.firstChild) {
    fragment.appendChild(template.content.firstChild);
  }
  return fragment;
}

/**
 * Extract the <head> portion of an HTML document string.
 * Handles both explicit <head>…</head> and documents that lack one.
 *
 * @param {string} html
 * @returns {DocumentFragment}
 */
function parseHead(html) {
  const doc = parseHTML(html);
  const headEl = doc.querySelector('head');
  if (headEl) {
    const frag = document.createDocumentFragment();
    while (headEl.firstChild) {
      frag.appendChild(headEl.firstChild);
    }
    return frag;
  }
  // No <head> tag – return an empty fragment; callers handle the empty case.
  return document.createDocumentFragment();
}

// ---------------------------------------------------------------------------
// Meta-tag extractors
// ---------------------------------------------------------------------------

/**
 * All supported meta-tag selectors grouped by property prefix.
 */
const META_SELECTORS = {
  og: 'meta[property^="og:"]',
  twitterCard: 'meta[name^="twitter:"]',
  linkedin: 'meta[property="linkedin:"], meta[name="linkedin:"]',
};

/**
 * Read a single attribute value from the first matching meta/link element.
 *
 * @param {Element|DocumentFragment} container
 * @param {string} selector
 * @param {string} attrName  e.g. "content", "value"
 * @returns {string|null}
 */
function getMetaValue(container, selector, attrName = 'content') {
  const el = container.querySelector(selector);
  if (!el) return null;
  const val = el.getAttribute(attrName);
  return val && val.trim() !== '' ? val.trim() : null;
}

/**
 * Parse all meta tags from an HTML string and return a normalised key→value map.
 * Keys are lowercased property names (e.g. "og:title", "twitter:card").
 *
 * @param {string} html
 * @returns {Record<string, string>}
 */
function extractMetaTags(html) {
  const headFrag = parseHead(html);
  const map = {};

  const tagSelectors = [
    'meta[property]',
    'meta[name]',
    'link[rel="image_src"]',
    'link[rel="apple-touch-icon"]',
  ];

  for (const sel of tagSelectors) {
    headFrag.querySelectorAll(sel).forEach((el) => {
      let key = el.getAttribute('property') || el.getAttribute('name');
      if (!key) return;
      key = key.toLowerCase().trim();
      const val = el.getAttribute('content') || el.getAttribute('href') || '';
      if (val.trim()) {
        map[key] = val.trim();
      }
    });
  }

  // Also grab <title> as a fallback for og:title / twitter:title.
  const titleEl = headFrag.querySelector('title');
  if (titleEl && titleEl.textContent.trim()) {
    map['title'] = titleEl.textContent.trim();
  }

  return map;
}

// ---------------------------------------------------------------------------
// Platform-specific extractors
// ---------------------------------------------------------------------------

/**
 * Standard Open Graph fields expected across most platforms.
 */
const OG_FIELDS = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:site_name',
  'og:locale',
];

/**
 * Twitter Card fields (prefix "twitter:").
 */
const TWITTER_FIELDS = [
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
  'twitter:site',
  'twitter:creator',
];

/**
 * LinkedIn-specific fields where available (LinkedIn mostly relies on OG).
 */
const LINKEDIN_FIELDS = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:site_name',
];

/**
 * Return the subset of meta tags relevant to a given platform.
 *
 * @param {Record<string,string>} allTags - Full meta tag map from extractMetaTags.
 * @param {'facebook'|'twitter'|'linkedin'} platform
 * @returns {Record<string,string>}
 */
export function extractPlatformTags(allTags, platform) {
  const fieldSet =
    platform === 'facebook'
      ? OG_FIELDS
      : platform === 'twitter'
      ? TWITTER_FIELDS
      : LINKEDIN_FIELDS;

  const result = {};
  for (const key of fieldSet) {
    if (allTags[key] !== undefined) {
      result[key] = allTags[key];
    }
  }
  return result;
}

/**
 * Resolve the canonical image URL for a platform.
 * Handles relative URLs, Twitter image fallbacks, and image alt-text extraction.
 *
 * @param {Record<string,string>} tags
 * @param {string} baseUrl - The original page URL (used for resolving relative image paths).
 * @param {'facebook'|'twitter'|'linkedin'} platform
 * @returns {{url: string|null, alt: string|null}}
 */
export function resolveImage(tags, baseUrl, platform) {
  const imageKey =
    platform === 'twitter' ? 'twitter:image' : 'og:image';
  const altKey =
    platform === 'twitter' ? 'twitter:image:alt' : null;

  let rawUrl = tags[imageKey] || null;

  // Fallback to link[rel="image_src"] for older sites.
  if (!rawUrl) {
    rawUrl = tags['link:image_src'] || null;
  }

  let alt = altKey ? tags[altKey] : null;

  // Resolve relative URLs against the source page origin.
  let resolvedUrl = rawUrl;
  if (rawUrl) {
    try {
      resolvedUrl = new URL(rawUrl, baseUrl).href;
    } catch {
      // Invalid URL – leave as-is; the preview component will handle the error.
    }
  }

  return { url: resolvedUrl, alt };
}

/**
 * Compute a display title: prefers the platform-specific meta tag,
 * falls back to the generic <title> element.
 *
 * @param {Record<string,string>} tags
 * @param {'facebook'|'twitter'|'linkedin'} platform
 * @returns {string|null}
 */
export function resolveTitle(tags, platform) {
  const key =
    platform === 'twitter' ? 'twitter:title' : 'og:title';
  return tags[key] || tags['title'] || null;
}

/**
 * Compute a display description: prefers the platform-specific meta tag,
 * falls back to og:description.
 *
 * @param {Record<string,string>} tags
 * @param {'facebook'|'twitter'|'linkedin'} platform
 * @returns {string|null}
 */
export function resolveDescription(tags, platform) {
  const twitterKey = 'twitter:description';
  const ogKey = 'og:description';
  return tags[twitterKey] || tags[ogKey] || null;
}

/**
 * Compute the site name (used under the title in preview cards).
 *
 * @param {Record<string,string>} tags
 * @returns {string|null}
 */
export function resolveSiteName(tags) {
  return tags['og:site_name'] || null;
}

/**
 * Determine the card type for Twitter (summary vs summary_large_image).
 *
 * @param {Record<string,string>} tags
 * @returns {string}
 */
export function resolveTwitterCardType(tags) {
  const card = tags['twitter:card'];
  if (!card) return 'summary';
  const lower = card.toLowerCase().trim();
  return lower === 'summary_large_image' ? 'summary_large_image' : 'summary';
}

/**
 * Resolve the canonical URL for display in preview cards.
 *
 * @param {Record<string,string>} tags
 * @param {string} providedUrl - The URL the user typed (may differ from og:url).
 * @returns {string|null}
 */
export function resolveUrl(tags, providedUrl) {
  return tags['og:url'] || providedUrl || null;
}

// ---------------------------------------------------------------------------
// Debounce & Throttle
// ---------------------------------------------------------------------------

/**
 * Returns a debounced version of the provided function.
 * Calls `fn` after `delay` ms have elapsed since the last invocation.
 *
 * @template {Function} T
 * @param {T} fn
 * @param {number} delayMs
 * @param {{leading?: boolean, trailing?: boolean}} [options]
 * @returns {T & {cancel: () => void}}
 */
export function debounce(fn, delayMs, options = {}) {
  let timer = null;
  const { leading = false, trailing = true } = options;

  const debounced = function (...args) {
    const later = () => {
      timer = null;
      if (trailing) fn.apply(this, args);
    };
    const callNow = leading && !timer;
    clearTimeout(timer);
    timer = setTimeout(later, delayMs);
    if (callNow) fn.apply(this, args);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}

/**
 * Returns a throttled version of `fn` that invokes at most once per `periodMs`.
 * The invocation is aligned to the leading edge (first call fires immediately).
 *
 * @template {Function} T
 * @param {T} fn
 * @param {number} periodMs
 * @returns {T & {cancel: () => void}}
 */
export function throttle(fn, periodMs) {
  let lastCall = 0;
  let timer = null;

  const throttled = function (...args) {
    const now = Date.now();
    const remaining = periodMs - (now - lastCall);
    clearTimeout(timer);

    if (remaining <= 0) {
      // Enough time has passed – fire immediately.
      lastCall = now;
      fn.apply(this, args);
    } else {
      // Schedule for the end of the window.
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    clearTimeout(timer);
  };

  return throttled;
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

/**
 * Create and show a brief toast notification.
 * Appends a temporary element to the document body and removes it after dismissal.
 *
 * @param {string} message - Text to display in the toast.
 * @param {'success'|'error'|'info'} [type='success'] - Visual style variant.
 */
export function showToast(message, type = 'success') {
  const toast = _createToastElement(message, type);
  document.body.appendChild(toast);

  // Trigger reflow so the entrance animation plays.
  void toast.offsetHeight;
  toast.classList.add('mp-toast--visible');

  const dismiss = () => {
    toast.classList.remove('mp-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  };

  // Auto-dismiss after TOAST_DURATION_MS.
  setTimeout(dismiss, TOAST_DURATION_MS);
}

/**
 * Factory for building a toast DOM node.
 *
 * @param {string} message
 * @param {string} type
 * @returns {HTMLElement}
 */
function _createToastElement(message, type) {
  const toast = document.createElement('div');
  toast.className = `mp-toast mp-toast--${type} ${HIDDEN_CLASS}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  return toast;
}

// ---------------------------------------------------------------------------
// Clipboard copy
// ---------------------------------------------------------------------------

/**
 * Copy text to the clipboard using the Async Clipboard API with a fallback
 * to the legacy execCommand approach for older browsers.
 *
 * Shows a toast on success or failure.
 *
 * @param {string} text - The string to copy.
 * @param {string} [label='Copied to clipboard'] - Success message shown in toast.
 * @returns {Promise<boolean>} True if the copy succeeded.
 */
export async function copyToClipboard(text, label = 'Copied to clipboard') {
  if (!text) {
    showToast('Nothing to copy', 'error');
    return false;
  }

  try {
    // Modern async API.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(label, 'success');
      return true;
    }

    // Legacy fallback: temporarily place text in a hidden textarea and execCommand.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.setAttribute('aria-hidden', 'true');
    textarea.readOnly = true;
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
      showToast(label, 'success');
      return true;
    }
    throw new Error('execCommand copy failed');
  } catch (err) {
    console.warn('[MetaPreviewr] Clipboard copy failed:', err.message);
    showToast('Failed to copy — check browser permissions', 'error');
    return false;
  }
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Normalise a user-provided string into a valid HTTP/HTTPS URL.
 * Prepends `https://` if no protocol is detected.
 *
 * @param {string} raw
 * @returns {string|null} Normalised URL string, or null if unparseable.
 */
export function normaliseUrl(raw) {
  if (!raw || !String(raw).trim()) return null;
  let url = String(raw).trim();

  // Strip surrounding quotes that users sometimes paste.
  url = url.replace(/^["']|["']$/g, '');

  // Prepend protocol if missing.
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Fall through to return null.
  }

  return null;
}

/**
 * Check whether a string looks like a valid absolute URL.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// String / text helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a string to `maxLength` characters, appending "…" when truncated.
 *
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}

/**
 * Strip HTML tags from a string, returning plain text.
 *
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

// ---------------------------------------------------------------------------
// Expose utility for testing / debugging (dev only)
// ---------------------------------------------------------------------------

if (import.meta.url) {
  // In a module context nothing extra needed; all named exports are already
  // available via the `export` declarations above.
}