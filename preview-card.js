/**
 * preview-card.js — Component-level renderer for MetaPreviewr
 *
 * Constructs platform-specific rich-preview cards (Open Graph/Facebook,
 * Twitter/X, LinkedIn) in pure DOM. Supports real-time reactive updates
 * without any library dependency.
 *
 * Architecture:
 *   - PreviewCard   : Single DOM component backed by a platform config
 *                     (dimensions, colors, truncation rules). Manages its
 *                     own node tree and reacts to data changes.
 *   - PreviewCardManager : Orchestrates all three card instances, exposes
 *                     a unified update(data) API so app.js only calls once.
 */

// ─── Fallback / placeholder assets ──────────────────────────────────────────

const FALLBACK_IMAGE =
  'https://via.placeholder.com/1200x630/1a1a2e/ffffff?text=Preview';

const FALLBACK_FAVICON =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<circle cx="16" cy="16" r="14" fill="%23333"/>' +
      '<text x="16" y="22" text-anchor="middle" fill="%23fff" font-size="16" font-family="sans-serif">?</text>' +
    '</svg>'
  );

// ─── Platform configuration ─────────────────────────────────────────────────

const PLATFORMS = {
  facebook: {
    id: 'facebook',
    label: 'Facebook / Open Graph',
    // Canonical OG card dimensions (reference size for preview)
    ratio: { w: 1200, h: 630 },
    previewScale: 0.2917, // fits nicely at ~350px wide
    maxTitleChars: 60,
    maxDescriptionChars: 200,
    siteNameMaxChars: 30,
    // Visual tokens matching Facebook's OG card style
    tokens: {
      rootBg: '#ffffff',
      rootColor: '#1c1e21',
      titleColor: '#1c1e21',
      descColor: '#606770',
      siteColor: '#606770',
      imageUrl: null, // injected per-card
      containerBorderRadius: '8px',
      imageBorderRadius: '8px',
      faviconSize: 16,
      showSiteAboveTitle: true,
      showDomainBelowSite: false,
      fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
    },
  },
  twitter: {
    id: 'twitter',
    label: 'Twitter / X',
    // Twitter summary-large-image card aspect ratio
    ratio: { w: 1200, h: 600 },
    previewScale: 0.35,
    maxTitleChars: 70,
    maxDescriptionChars: 200,
    siteNameMaxChars: 30,
    tokens: {
      rootBg: '#15202b',
      rootColor: '#ffffff',
      titleColor: '#ffffff',
      descColor: '#8b98a5',
      siteColor: '#8b98a5',
      containerBorderRadius: '12px',
      imageBorderRadius: '12px',
      faviconSize: 14,
      showSiteAboveTitle: false,
      showDomainBelowSite: true,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    // LinkedIn shares at 1200×627
    ratio: { w: 1200, h: 627 },
    previewScale: 0.2917,
    maxTitleChars: 70,
    maxDescriptionChars: 200,
    siteNameMaxChars: 40,
    tokens: {
      rootBg: '#ffffff',
      rootColor: '#000000',
      titleColor: '#000000',
      descColor: '#666666',
      siteColor: '#666666',
      containerBorderRadius: '0px',
      imageBorderRadius: '8px',
      faviconSize: 16,
      showSiteAboveTitle: false,
      showDomainBelowSite: true,
      fontFamily: '"LinkedIn Font", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Truncate text to `max` chars, appending "…" when cut. */
function truncate(text, max) {
  if (text == null) return '';
  const s = String(text);
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

/** Extract the hostname (domain) from a URL string. Returns empty on failure. */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Resolve a favicon URL from a page URL using common heuristics. */
function resolveFavicon(pageUrl) {
  try {
    const u = new URL(pageUrl);
    // Try standard location first
    const candidate = u.origin + '/favicon.ico';
    // Return the candidate URL directly; we'll handle missing-favicon visually
    return candidate;
  } catch {
    return null;
  }
}

// ─── PreviewCard class ────────────────────────────────────────────────────────

class PreviewCard {
  /**
   * @param {object} cfg         — Platform config from PLATFORMS
   * @param {string} cfg.id      — Unique identifier ('facebook'|'twitter'|'linkedin')
   * @param {string} cfg.label   — Display label for the tab
   * @param {object} cfg.tokens  — Visual tokens (colors, fonts, radii…)
   * @param {number} cfg.maxTitleChars
   * @param {number} cfg.maxDescriptionChars
   * @param {number} cfg.previewScale  — Scale factor to fit OG ratio into preview width
   */
  constructor(cfg) {
    this.cfg = Object.freeze(cfg);
    this._el = null;
    this._mounted = false;
  }

  // ── Mount / unmount ──────────────────────────────────────────────────

  mount(container) {
    if (this._mounted) return;
    this._el = this._buildDOM();
    container.appendChild(this._el);
    this._mounted = true;
  }

  unmount() {
    if (!this._mounted) return;
    this._el.remove();
    this._el = null;
    this._mounted = false;
  }

  // ── Reactive update ───────────────────────────────────────────────────

  /**
   * Call whenever metadata changes. Accepts a partial meta object;
   * only present fields are applied (null/undefined fields are ignored).
   * @param {object} meta  — { url, title, description, image, favicon, siteName }
   */
  update(meta = {}) {
    if (!this._mounted) return;
    const t = this.cfg.tokens;

    // Image
    if (meta.image != null && meta.image !== '') {
      this._setImage(meta.image);
    } else if (this._currentImage !== FALLBACK_IMAGE) {
      this._setImage(FALLBACK_IMAGE);
    }

    // Title
    const titleEl = this._el.querySelector('[data-field="title"]');
    if (titleEl && meta.title != null) {
      titleEl.textContent = truncate(meta.title, this.cfg.maxTitleChars);
      titleEl.title = meta.title; // full text on hover
    }

    // Description
    const descEl = this._el.querySelector('[data-field="description"]');
    if (descEl && meta.description != null) {
      descEl.textContent = truncate(meta.description, this.cfg.maxDescriptionChars);
      descEl.title = meta.description;
    }

    // Site name / domain
    const siteEl = this._el.querySelector('[data-field="site"]');
    const domainEl = this._el.querySelector('[data-field="domain"]');
    const siteName = meta.siteName || meta.url
      ? extractDomain(meta.url)
      : '';
    if (siteEl) {
      siteEl.textContent = truncate(siteName, this.cfg.siteNameMaxChars);
      siteEl.hidden = !t.showSiteAboveTitle;
    }
    if (domainEl) {
      domainEl.textContent = siteName;
      domainEl.hidden = !t.showDomainBelowSite;
    }

    // Favicon
    if (meta.favicon != null) {
      this._setIcon(meta.favicon);
    } else if (meta.url != null) {
      const favicon = resolveFavicon(meta.url);
      if (favicon) this._setIcon(favicon);
    }

    // Store current image so fallback logic works correctly
    this._currentImage = meta.image || FALLBACK_IMAGE;

    // Apply platform-specific theme overrides to root element
    this._applyTokens(t);
  }

  // ── Private: DOM tree construction ────────────────────────────────────

  _buildDOM() {
    const { tokens: t } = this.cfg;

    const card = document.createElement('div');
    card.className = 'mpc-card';
    card.dataset.platform = this.cfg.id;
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', `${this.cfg.label} preview card`);

    // Outer wrapper: bg + border-radius set here to avoid inner-element bleed
    const wrapper = document.createElement('div');
    wrapper.className = 'mpc-card__wrapper';

    // Image area
    const imgArea = document.createElement('div');
    imgArea.className = 'mpc-card__image-area';

    const imgFig = document.createElement('figure');
    imgFig.className = 'mpc-card__figure';

    const img = document.createElement('img');
    img.className = 'mpc-card__image';
    img.alt = '';
    img.loading = 'lazy';
    img.dataset.field = 'image';
    img.style.borderRadius = t.imageBorderRadius;

    const figcaption = document.createElement('figcaption');
    figcaption.className = 'mpc-card__img-overlay';
    // Hidden overlay used for lazy-fade-in animation
    figcaption.hidden = true;

    imgFig.append(img, figcaption);
    imgArea.appendChild(imgFig);
    wrapper.appendChild(imgArea);

    // Content area
    const content = document.createElement('div');
    content.className = 'mpc-card__content';

    // Site name row (Facebook-style): shown above title
    const siteRow = document.createElement('div');
    siteRow.className = 'mpc-card__site-row';
    siteRow.hidden = !t.showSiteAboveTitle;

    const faviconImg = document.createElement('img');
    faviconImg.className = 'mpc-card__favicon';
    faviconImg.alt = '';
    faviconImg.dataset.field = 'favicon';
    faviconImg.style.width = `${t.faviconSize}px`;
    faviconImg.style.height = `${t.faviconSize}px`;
    faviconImg.style.borderRadius = '2px';

    const siteSpan = document.createElement('span');
    siteSpan.className = 'mpc-card__site';
    siteSpan.dataset.field = 'site';
    siteSpan.textContent = '';

    siteRow.append(faviconImg, siteSpan);
    content.appendChild(siteRow);

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'mpc-card__title';
    titleEl.dataset.field = 'title';
    titleEl.textContent = '';
    content.appendChild(titleEl);

    // Description
    const descEl = document.createElement('div');
    descEl.className = 'mpc-card__description';
    descEl.dataset.field = 'description';
    descEl.textContent = '';
    content.appendChild(descEl);

    // Domain row (Twitter / LinkedIn style): shown below description
    const domainRow = document.createElement('div');
    domainRow.className = 'mpc-card__domain-row';
    domainRow.hidden = !t.showDomainBelowSite;

    const domainSpan = document.createElement('span');
    domainSpan.className = 'mpc-card__domain';
    domainSpan.dataset.field = 'domain';
    domainSpan.textContent = '';

    domainRow.appendChild(domainSpan);
    content.appendChild(domainRow);

    wrapper.appendChild(content);
    card.appendChild(wrapper);

    this._els = {
      card,
      wrapper,
      img,
      siteRow,
      siteSpan,
      faviconImg,
      titleEl,
      descEl,
      domainRow,
      domainSpan,
    };

    return card;
  }

  // ── Private: token application ─────────────────────────────────────────

  _applyTokens(t) {
    const { card, wrapper, siteRow, titleEl, descEl, domainRow, img } = this._els;

    // Root background is applied to the wrapper so it shows through behind
    // the card if there's any spacing
    wrapper.style.backgroundColor = t.rootBg;
    wrapper.style.color = t.rootColor;
    wrapper.style.fontFamily = t.fontFamily;
    wrapper.style.borderRadius = t.containerBorderRadius;

    titleEl.style.color = t.titleColor;
    descEl.style.color = t.descColor;
    siteRow.style.color = t.siteColor;
    domainRow.style.color = t.siteColor;
  }

  // ── Private: image handling ───────────────────────────────────────────

  _setImage(src) {
    const { img } = this._els;
    // Guard against setting the same URL (avoids reload flash)
    if (img.src === src) return;
    img.src = src;
    img.onerror = () => {
      // On load failure, replace with fallback placeholder
      if (img.dataset.fallbackHandled !== '1') {
        img.dataset.fallbackHandled = '1';
        img.src = FALLBACK_IMAGE;
      }
    };
  }

  // ── Private: favicon handling ─────────────────────────────────────────

  _setIcon(src) {
    const { faviconImg } = this._els;
    faviconImg.src = src;
    faviconImg.onerror = () => {
      faviconImg.src = FALLBACK_FAVICON;
    };
  }
}

// ─── PreviewCardManager ───────────────────────────────────────────────────────

class PreviewCardManager {
  /**
   * @param {HTMLElement} container  — Parent element that holds the three cards
   */
  constructor(container) {
    this._container = container;
    this._cards = new Map();
    this._initialised = false;
  }

  /**
   * Initialise all three platform cards inside `container`.
   * Called once during app bootstrap.
   */
  init() {
    if (this._initialised) return;

    // Clear container
    this._container.innerHTML = '';

    for (const key of Object.keys(PLATFORMS)) {
      const cfg = PLATFORMS[key];
      const card = new PreviewCard(cfg);

      // Per-platform card wrapper so tabs can show/hide individually
      const cardWrapper = document.createElement('div');
      cardWrapper.className = 'mpc-card-container';
      cardWrapper.dataset.platform = key;

      card.mount(cardWrapper);
      this._cards.set(key, card);
      this._container.appendChild(cardWrapper);
    }

    this._initialised = true;
  }

  /**
   * Show only the card for `platformId` and hide the others.
   * @param {'facebook'|'twitter'|'linkedin'} platformId
   */
  show(platformId) {
    for (const [key, card] of this._cards) {
      const wrapper = card._els?.card?.parentElement;
      if (!wrapper) continue;
      wrapper.classList.toggle('mpc-card-container--visible', key === platformId);
    }
  }

  /**
   * Update every mounted card with the supplied metadata.
   * This is the single entry point called from app.js on each reactive tick.
   *
   * @param {object} meta  — { url, title, description, image, favicon, siteName }
   */
  update(meta = {}) {
    for (const card of this._cards.values()) {
      card.update(meta);
    }
  }

  /**
   * Clean up all DOM nodes and references.
   */
  destroy() {
    for (const card of this._cards.values()) {
      card.unmount();
    }
    this._cards.clear();
    this._initialised = false;
    this._container.innerHTML = '';
  }
}

// ─── Module export ────────────────────────────────────────────────────────────

// Provide a shared singleton via a closure so multiple script loaders don't
// create duplicate managers on the same container.
let _managerInstance = null;

/**
 * Get (or create) the global PreviewCardManager for a given container.
 * @param {HTMLElement} container
 * @returns {PreviewCardManager}
 */
function getCardManager(container) {
  if (_managerInstance == null) {
    _managerInstance = new PreviewCardManager(container);
    _managerInstance.init();
  }
  return _managerInstance;
}

/** Reset the singleton (useful for testing or hot-reload scenarios). */
function resetCardManager() {
  if (_managerInstance) {
    _managerInstance.destroy();
    _managerInstance = null;
  }
}

export { PreviewCard, PreviewCardManager, getCardManager, resetCardManager, PLATFORMS };