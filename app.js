// ============================================================
// MetaPreviewr — Main Application Entry Point (app.js)
// ============================================================
// Wires DOM events, orchestrates meta-fetch and render pipelines,
// manages platform-tab state, and drives the live-edit → preview sync loop.
// ============================================================

(function () {
  'use strict';

  // ---------- DOM cache -------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {
    urlInput:       $('#url-input'),
    fetchBtn:       $('#fetch-btn'),
    loadingSpinner: $('#loading-spinner'),
    errorMsg:       $('#error-message'),
    platformTabs:   $$('.tab-btn'),
    previewPanels:  $$('.preview-panel'),
    cardFacebook:   $('.card--facebook'),
    cardTwitter:    $('.card--twitter'),
    cardLinkedIn:   $('.card--linkedin'),
    copyFbBtn:      $('#copy-fb-snippet'),
    copyTwBtn:      $('#copy-tw-snippet'),
    copyLiBtn:      $('#copy-li-snippet'),
    copyAllBtn:     $('#copy-all-snippet'),
    tagsBody:       $('#tags-body'),
    sortSelect:     $('#sort-select'),
    resetBtn:       $('#reset-btn'),
    faviconInput:   $('#favicon-url'),
    previewContainer: $('#preview-container'),
    metaEditorSection: $('#meta-editor-section'),
  };

  // ---------- State -----------------------------------------------------------
  /** @typedef {Object} AppState
   *  @property {string} url            - currently entered / fetched URL
   * @property {boolean} loading        - is a fetch in progress?
   * @property {string|null} error      - human-readable error (or null)
   * @property {object} meta            - parsed meta tags grouped by platform
   * @property {string} activePlatform  - 'facebook' | 'twitter' | 'linkedin'
   * @property {boolean} hasPreview     - has a successful preview been generated?
   */
  const state = {
    url: '',
    loading: false,
    error: null,
    meta: { facebook: {}, twitter: {}, linkedin: {} },
    activePlatform: 'facebook',
    hasPreview: false,
  };

  // ---------- Platform configuration registry (from platforms.js) -------------
  // Inlined here so app.js remains self-consistent regardless of build setup.
  // In production this would be imported from platforms.js; we fall back gracefully.
  const PLATFORMS = window.PLATFORMS || {
    facebook: {
      label: 'Facebook / Open Graph',
      key: 'facebook',
      icon: 'fab fa-facebook-f',
      color: '#1877F2',
      cardTemplate: 'facebook',
      supportedKeys: [
        'og:title', 'og:description', 'og:image', 'og:url',
        'og:type', 'og:site_name', 'og:locale', 'og:image:alt',
        'article:published_time', 'article:modified_time',
      ],
      fallbackImage: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
        '<rect fill="%231a1a2e" width="1200" height="630"/><text x="50%25" y="50%25" ' +
        'dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="28">' +
        'Preview Image</text></svg>'
      ),
    },
    twitter: {
      label: 'Twitter Card',
      key: 'twitter',
      icon: 'fab fa-x-twitter',
      color: '#1DA1F2',
      cardTemplate: 'twitter',
      supportedKeys: [
        'twitter:card', 'twitter:title', 'twitter:description',
        'twitter:image', 'twitter:site', 'twitter:creator', 'twitter:image:alt',
      ],
      fallbackImage: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="314">' +
        '<rect fill="%231a1a2e" width="600" height="314"/><text x="50%25" y="50%25" ' +
        'dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="24">' +
        'Twitter Card Preview</text></svg>'
      ),
    },
    linkedin: {
      label: 'LinkedIn',
      key: 'linkedin',
      icon: 'fab fa-linkedin-in',
      color: '#0A66C2',
      cardTemplate: 'linkedin',
      supportedKeys: [
        'og:title', 'og:description', 'og:image', 'og:url',
        'og:type', 'og:site_name',
      ],
      fallbackImage: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627">' +
        '<rect fill="%231a1a2e" width="1200" height="627"/><text x="50%25" y="50%25" ' +
        'dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="28">' +
        'LinkedIn Preview</text></svg>'
      ),
    },
  };

  // ---------- Debounce helper (standalone — also available in utils.js) --------
  /**
   * Returns a debounced version of fn that delays invocation by wait ms.
   * The last call wins; previously pending invocations are cancelled.
   */
  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ---------- Fetch helpers ---------------------------------------------------
  /**
   * Proxy-aware fetch: uses a configured CORS proxy for remote URLs.
   * Falls back to a direct fetch for same-origin or proxied requests.
   */
  async function fetchWithProxy(url) {
    // Check for an explicitly configured proxy in data attributes or localStorage
    const storedProxy = localStorage.getItem('metapreviewr_proxy');
    const proxyBase =
      storedProxy ||
      'https://api.allorigins.win/raw?url='; // public fallback proxy

    // If it looks like a relative or blob URL, short-circuit
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Please enter a valid HTTP/HTTPS URL.');
    }

    const encoded = encodeURIComponent(url);
    const target = `${proxyBase}${encoded}`;

    const resp = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const html = await resp.text();
    if (!html.trim()) {
      throw new Error('Fetched page returned an empty response.');
    }
    return html;
  }

  /**
   * Parse raw HTML string into a DOMDocument and extract meta/link tags.
   * Returns an object keyed by platform with extracted properties.
   */
  function parseMetaFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getMeta = (prop) => {
      // Check <meta property> and <meta name> forms
      let el = doc.querySelector(`meta[property="${prop}"]`)
        || doc.querySelector(`meta[name="${prop}"]`)
        || doc.querySelector(`meta[itemprop="${prop}"]`);
      return el ? (el.getAttribute('content') || '').trim() : '';
    };

    const getLink = (rel) => {
      // Prefer canonical icon links
      let el = doc.querySelector(`link[rel="icon"]`)
        || doc.querySelector(`link[rel="shortcut icon"]`)
        || doc.querySelector(`link[rel="apple-touch-icon"]`);
      // Fall back to rel=any or first available link[rel]
      if (!el) el = doc.querySelector('link[rel*="icon"]');
      if (!el) el = doc.querySelector('link[rel="alternate"][type="image/icon"]');
      return el ? (el.getAttribute('href') || '').trim() : '';
    };

    const getCanonical = () => {
      const el = doc.querySelector('link[rel="canonical"]');
      return el ? (el.getAttribute('href') || '').trim() : '';
    };

    const getTitle = () => {
      const el = doc.querySelector('title');
      return el ? el.textContent.trim() : getMeta('og:title');
    };

    const getDescription = () => {
      return getMeta('og:description') || getMeta('description') || '';
    };

    // Determine page title and fallback site name
    const title = getTitle();
    const description = getDescription();
    const image = getMeta('og:image') || getMeta('twitter:image') || '';
    const imageAlt = getMeta('og:image:alt') || getMeta('twitter:image:alt') || '';
    const siteName = getMeta('og:site_name') || '';
    const locale = getMeta('og:locale') || 'en_US';
    const type = getMeta('og:type') || 'website';
    const url = getMeta('og:url') || getCanonical() || state.url;
    const card = getMeta('twitter:card') || 'summary_large_image';
    const twitterSite = getMeta('twitter:site') || '';
    const twitterCreator = getMeta('twitter:creator') || '';
    const favicon = getLink('icon');

    // Resolve relative image URLs against the fetched page's origin
    const resolveUrl = (raw) => {
      if (!raw) return '';
      try {
        // Try resolving relative to the original page URL
        return new URL(raw, url).href;
      } catch {
        return raw;
      }
    };

    return {
      facebook: {
        title, description, image: resolveUrl(image), imageAlt,
        url: resolveUrl(url), siteName, locale, type,
        favicon,
      },
      twitter: {
        title, description, image: resolveUrl(image), imageAlt,
        url: resolveUrl(url), card, site: twitterSite, creator: twitterCreator,
        siteName, favicon,
      },
      linkedin: {
        title, description, image: resolveUrl(image),
        url: resolveUrl(url), siteName, type, favicon,
      },
    };
  }

  // ---------- Extract meta tags matching each platform's schema ----------------
  /**
   * Filter the flat meta object down to keys supported by each platform.
   */
  function filterByPlatform(metaFlat) {
    const result = {};
    for (const [platform, cfg] of Object.entries(PLATFORMS)) {
      result[platform] = {};
      for (const key of cfg.supportedKeys) {
        if (metaFlat[key] !== undefined && metaFlat[key] !== '') {
          result[platform][key] = metaFlat[key];
        }
      }
    }
    return result;
  }

  // ---------- Render pipeline -------------------------------------------------
  /**
   * Main entry: given HTML, parse → filter → render previews and meta editor.
   */
  async function fetchAndRender(url) {
    setLoading(true);
    clearError();

    try {
      const html = await fetchWithProxy(url);
      const parsed = parseMetaFromHtml(html);
      const filtered = filterByPlatform(parsed);

      state.url = url;
      state.meta = filtered;
      state.hasPreview = true;

      // Pass the fully-parsed meta to preview-card renderer
      if (window.PreviewCardRenderer) {
        window.PreviewCardRenderer.renderAll(state.meta);
      } else {
        renderPreviewCards(state.meta);
      }

      // Update meta editor
      if (window.MetaEditor) {
        window.MetaEditor.load(state.meta, state.activePlatform);
      } else {
        renderMetaEditor(state.meta, state.activePlatform);
      }

      // Show editor section
      DOM.metaEditorSection.style.display = '';
      DOM.previewContainer.style.display = '';

    } catch (err) {
      console.error('[MetaPreviewr] Fetch error:', err);
      state.error = err.message || String(err);
      showAppError(state.error);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Live-edit → preview sync ----------------------------------------
  /**
   * Called when the user modifies a meta tag in the editor panel.
   * Updates state.meta for the active platform, then re-renders.
   *
   * @param {string} key     - meta property name (e.g. "og:title")
   * @param {string} value   - new value
   * @param {string} platform - 'facebook' | 'twitter' | 'linkedin'
   */
  function onTagEdit(key, value, platform) {
    if (!state.meta[platform]) state.meta[platform] = {};
    // Remove falsy values entirely to keep output clean
    if (!value) {
      delete state.meta[platform][key];
    } else {