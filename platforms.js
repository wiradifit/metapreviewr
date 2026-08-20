/**
 * platforms.js
 *
 * Platform configuration registry for MetaPreviewr.
 *
 * Holds:
 *   - Platform definition objects (id, label, display order)
 *   - Supported Open Graph / Twitter Card / LinkedIn meta-tag keys
 *   - Per-platform validation schemas (required fields, field types)
 *   - Default / fallback values (images, colors, site names)
 *   - Card-renderer template strings and component factory functions
 *   - A small set of utility helpers used by preview-card.js and meta-editor.js
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_IDS = {
  FACEBOOK: 'facebook',
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin',
};

const SUPPORTED_PLATFORMS = [
  PLATFORM_IDS.FACEBOOK,
  PLATFORM_IDS.TWITTER,
  PLATFORM_IDS.LINKEDIN,
];

// Aspect ratios by platform (width : height)
const ASPECT_RATIOS = {
  [PLATFORM_IDS.FACEBOOK]: '1.91:1',
  [PLATFORM_IDS.TWITTER]: '1.91:1',
  [PLATFORM_IDS.LINKEDIN]: '1.91:1',
};

// Default placeholder image – a tiny transparent SVG data URI so the layout
// reserves space even when no real image is available.
const DEFAULT_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221200%22%20height%3D%22630%22%3E%3Crect%20fill%3D%22%23374151%22%20width%3D%221200%22%20height%3D%22630%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2248%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20dy%3D%22.35em%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';

// Minimal favicon fallback (transparent 1×1 PNG)
const DEFAULT_FAVICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Default color swatches for each platform header bar
const PLATFORM_COLORS = {
  [PLATFORM_IDS.FACEBOOK]: '#1877F2',
  [PLATFORM_IDS.TWITTER]: '#000000',
  [PLATFORM_IDS.LINKEDIN]: '#0A66C2',
};

// ---------------------------------------------------------------------------
// Supported meta-tag keys per platform
//
// Keys are grouped into "universal" (rendered by every platform) and
// "platform-specific" (rendered only when that platform tab is active).
// The union of all three groups forms the complete key set an implementation
// may expose in the meta-tag editor table.
// ---------------------------------------------------------------------------

const UNIVERSAL_KEYS = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:site_name',
  'og:locale',
  'twitter:card',
  'favicon',
];

const PLATFORM_SPECIFIC_KEYS = {
  [PLATFORM_IDS.FACEBOOK]: [
    'og:image:width',
    'og:image:height',
    'og:image:alt',
    'og:image:type',
    'article:published_time',
    'article:modified_time',
    'profile:first_name',
    'profile:last_name',
    'profile:username',
  ],
  [PLATFORM_IDS.TWITTER]: [
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt',
    'twitter:site',
    'twitter:creator',
    'twitter:player',
    'twitter:player:width',
    'twitter:player:height',
    'twitter:player:str',
    'twitter:app:name:iphone',
    'twitter:app:id:iphone',
    'twitter:app:name:ipad',
    'twitter:app:id:ipad',
    'twitter:app:name:googleplay',
    'twitter:app:id:googleplay',
  ],
  [PLATFORM_IDS.LINKEDIN]: [
    'linkedin:title',
    'linkedin:description',
    'linkedin:image',
    'og:title', // LinkedIn also consumes standard OG tags
    'og:description',
    'og:image',
  ],
};

// ---------------------------------------------------------------------------
// Validation schemas
//
// Each entry describes one supported meta-tag key with:
//   - type       : expected value type ("string" | "url" | "image" | "color")
//   - required   : whether the field must be present to render a "valid" card
//   - maxLength  : soft length guideline; values exceeding this get highlighted
//   - placeholder: default text shown in the editor input
// ---------------------------------------------------------------------------

const META_SCHEMAS = {
  'og:title': {
    type: 'string',
    required: true,
    maxLength: 60,
    placeholder: 'Enter page title …',
  },
  'og:description': {
    type: 'string',
    required: false,
    maxLength: 200,
    placeholder: 'Enter page description …',
  },
  'og:image': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/image.jpg',
  },
  'og:image:width': {
    type: 'string',
    required: false,
    maxLength: 6,
    placeholder: '1200',
  },
  'og:image:height': {
    type: 'string',
    required: false,
    maxLength: 6,
    placeholder: '630',
  },
  'og:image:alt': {
    type: 'string',
    required: false,
    maxLength: 420,
    placeholder: 'Descriptive alt text …',
  },
  'og:image:type': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'image/jpeg',
  },
  'og:url': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/page',
  },
  'og:type': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'website',
  },
  'og:site_name': {
    type: 'string',
    required: false,
    maxLength: 50,
    placeholder: 'Example Site',
  },
  'og:locale': {
    type: 'string',
    required: false,
    maxLength: 12,
    placeholder: 'en_US',
  },
  'twitter:card': {
    type: 'string',
    required: false,
    maxLength: 20,
    placeholder: 'summary_large_image',
  },
  'twitter:title': {
    type: 'string',
    required: false,
    maxLength: 70,
    placeholder: 'Enter Twitter title …',
  },
  'twitter:description': {
    type: 'string',
    required: false,
    maxLength: 200,
    placeholder: 'Enter Twitter description …',
  },
  'twitter:image': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/twitter-image.jpg',
  },
  'twitter:image:alt': {
    type: 'string',
    required: false,
    maxLength: 420,
    placeholder: 'Alt text for Twitter image …',
  },
  'twitter:site': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: '@example',
  },
  'twitter:creator': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: '@creatorhandle',
  },
  'twitter:player': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/player.html',
  },
  'twitter:player:width': {
    type: 'string',
    required: false,
    maxLength: 6,
    placeholder: '1200',
  },
  'twitter:player:height': {
    type: 'string',
    required: false,
    maxLength: 6,
    placeholder: '630',
  },
  'twitter:player:str': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/video.mp4',
  },
  'twitter:app:name:iphone': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'My App',
  },
  'twitter:app:id:iphone': {
    type: 'string',
    required: false,
    maxLength: 20,
    placeholder: '123456789',
  },
  'twitter:app:name:ipad': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'My App',
  },
  'twitter:app:id:ipad': {
    type: 'string',
    required: false,
    maxLength: 20,
    placeholder: '123456789',
  },
  'twitter:app:name:googleplay': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'My App',
  },
  'twitter:app:id:googleplay': {
    type: 'string',
    required: false,
    maxLength: 20,
    placeholder: 'com.example.app',
  },
  'linkedin:title': {
    type: 'string',
    required: false,
    maxLength: 200,
    placeholder: 'Enter LinkedIn title …',
  },
  'linkedin:description': {
    type: 'string',
    required: false,
    maxLength: 200,
    placeholder: 'Enter LinkedIn description …',
  },
  'linkedin:image': {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/linkedin-image.jpg',
  },
  favicon: {
    type: 'url',
    required: false,
    maxLength: null,
    placeholder: 'https://example.com/favicon.ico',
  },
  'article:published_time': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: '2024-01-15T12:00:00+00:00',
  },
  'article:modified_time': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: '2024-01-16T10:00:00+00:00',
  },
  'profile:first_name': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'Jane',
  },
  'profile:last_name': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'Doe',
  },
  'profile:username': {
    type: 'string',
    required: false,
    maxLength: 30,
    placeholder: 'janedoe',
  },
};

// ---------------------------------------------------------------------------
// Platform definition objects
//
// Each platform gets a rich metadata block describing:
//   - Human-readable label & icon (emoji used as a lightweight stand-in)
//   - The set of meta-tag keys it natively consumes
//   - Validation & rendering behaviour
//   - A reference to its card-renderer factory function
// ---------------------------------------------------------------------------

function _buildPlatformDefinitions() {
  const definitions = {};

  definitions[PLATFORM_IDS.FACEBOOK] = {
    id: PLATFORM_IDS.FACEBACK,
    label: 'Facebook',
    shortLabel: 'FB',
    icon: '📘',
    colors: PLATFORM_COLORS[PLATFORM_IDS.FACEBOOK],
    aspectRatio: ASPECT_RATIOS[PLATFORM_IDS.FACEBOOK],
    keys: [...UNIVERSAL_KEYS, ...PLATFORM_SPECIFIC_KEYS[PLATFORM_IDS.FACEBOOK]],
    requiredKeys: ['og:title', 'og:description'],
    preferredImageSize: { width: 1200, height: 630 },
    cardRenderer: _createFacebookCard,
  };

  definitions[PLATFORM_IDS.TWITTER] = {
    id: PLATFORM_IDS.TWITTER,
    label: 'Twitter / X',
    shortLabel: 'X',
    icon: '🐦',
    colors: PLATFORM_COLORS[PLATFORM_IDS.TWITTER],
    aspectRatio: ASPECT_RATIOS[PLATFORM_IDS.TWITTER],
    keys: [...UNIVERSAL_KEYS, ...PLATFORM_SPECIFIC_KEYS[PLATFORM_IDS.TWITTER]],
    requiredKeys: ['twitter:card', 'twitter:title'],
    preferredImageSize: { width: 1200, height: 628 },
    cardRenderer: _createTwitterCard,
  };

  definitions[PLATFORM_IDS.LINKEDIN] = {
    id: PLATFORM_IDS.LINKEDIN,
    label: 'LinkedIn',
    shortLabel: 'in',
    icon: '💼',
    colors: PLATFORM_COLORS[PLATFORM_IDS.LINKEDIN],
    aspectRatio: ASPECT_RATIOS[PLATFORM_IDS.LINKEDIN],
    keys: [
      ...UNIVERSAL_KEYS.filter((k) => !k.startsWith('twitter:')),
      ...PLATFORM_SPECIFIC_KEYS[PLATFORM_IDS.LINKEDIN],
    ],
    requiredKeys: ['og:title'],
    preferredImageSize: { width: 1200, height: 627 },
    cardRenderer: _createLinkedInCard,
  };

  return definitions;
}

// ---------------------------------------------------------------------------
// Card-renderer factories
//
// Each factory returns a function that takes a data map (key → value) and a
// DOM container, and populates the container with a faithful pixel-level
// replica of the corresponding social-media preview card.
//
// The returned DOM nodes are pure elements — no libraries — so they can be
// moved into the document tree at any time.
// ---------------------------------------------------------------------------

function _createFacebookCard(data, container) {
  // Facebook uses an ~1.91:1 image + a white preview panel below.
  // We replicate the look with a flex column inside the provided container.

  const card = document.createElement('div');
  card.className = 'mp-preview-card facebook';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', 'Facebook preview');

  // --- Image area ---------------------------------------------------------
  const imageWrapper = document.createElement('a');
  imageWrapper.href = data['og:url'] || '#';
  imageWrapper.target = '_blank';
  imageWrapper.rel = 'noopener noreferrer';
  imageWrapper.className = 'mp-preview-card__image-wrapper';

  const img = document.createElement('img');
  img.src = data['og:image'] || DEFAULT_PLACEHOLDER_IMAGE;
  img.alt = data['og:image:alt'] || '';
  img.className = 'mp-preview-card__image';
  img.loading = 'lazy';
  img.decoding = 'async';

  imageWrapper.appendChild(img);
  card.appendChild(imageWrapper);

  // --- Info area ----------------------------------------------------------
  const info = document.createElement('div');
  info.className = 'mp-preview-card__info';

  // Host line (domain extraction from url)
  const hostSpan = document.createElement('span');
  hostSpan.className = 'mp-preview-card__host';
  hostSpan.textContent = _extractHost(data['og:url']);
  info.appendChild(hostSpan);

  // Title
  const titleEl = document.createElement('h2');
  titleEl.className = 'mp-preview-card__title';
  titleEl.textContent = data['og:title'] || '';
  titleEl.title = titleEl.textContent; // tooltip on overflow
  info.appendChild(titleEl);

  // Description
  const descEl = document.createElement('p');
  descEl.className = 'mp-preview-card__description';
  descEl.textContent = data['og:description'] || '';
  descEl.title = descEl.textContent;
  info.appendChild(descEl);

  // Site name
  if (data['og:site_name']) {
    const siteEl = document.createElement('span');
    siteEl.className = 'mp-preview-card__site-name';
    siteEl.textContent = data['og:site_name'];
    info.appendChild(siteEl);
  }

  card.appendChild(info);
  container.appendChild(card);
  return card;
}

function _createTwitterCard(data, container) {
  // Twitter/X cards come in two flavours: summary (small, 2:1 image) and
  // summary_large_image (large, 1.91:1 image). We detect via twitter:card.
  const isLargeImage = data['twitter:card'] !== 'summary';
  const card = document.createElement('div');
  card.className = `mp-preview-card twitter${isLargeImage ? '' : ' compact'}`;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', 'Twitter preview');

  // --- Wrapper link -------------------------------------------------------
  const link = document.createElement('a');
  link.href = data['og:url'] || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'mp-preview-card__link';

  // --- Image area ---------------------------------------------------------
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'mp-preview-card__image-wrapper';

  const img = document.createElement('img');
  img.src = data['twitter:image'] || data['og:image'] || DEFAULT_PLACEHOLDER_IMAGE;
  img.alt = data['twitter:image:alt'] || data['og:image:alt'] || '';
  img.className = 'mp-preview-card__image';
  img.loading = 'lazy';
  img.decoding = 'async';

  imageWrapper.appendChild(img);
  link.appendChild(imageWrapper);

  // --- Content area -------------------------------------------------------
  const content = document.createElement('div');
  content.className = 'mp-preview-card__content';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'mp-preview-card__title';
  titleEl.textContent = data['twitter:title'] || data['og:title'] || '';
  titleEl.title = titleEl.textContent;
  content.appendChild(titleEl);

  // Description
  const descEl = document.createElement('div');
  descEl.className = 'mp-preview-card__description';
  descEl.textContent = data['twitter:description'] || data['og:description'] || '';
  descEl.title = descEl.textContent;
  content.appendChild(descEl);

  // Host + site handle
  const metaRow = document.createElement('div');
  metaRow.className = 'mp-preview-card__meta-row';

  const hostEl = document.createElement('span');
  hostEl.className = 'mp-preview-card__host';
  hostEl.textContent = _extractHost(data['og:url']);
  metaRow.appendChild(hostEl);

  const handleEl = document.createElement('span');
  handleEl.className = 'mp-preview-card__handle';
  handleEl.textContent = data['twitter:site'] || '';
  metaRow.appendChild(handleEl);

  content.appendChild(metaRow);
  link.appendChild(content);
  card.appendChild(link);

  container.appendChild(card);
  return card;
}

function _createLinkedInCard(data, container) {
  // LinkedIn mirrors the Facebook-like card shape but uses its own colour
  // accents and renders the site name differently.
  const card = document.createElement('div');
  card.className = 'mp-preview-card linkedin';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', 'LinkedIn preview');

  // Use twitter:image if set, otherwise og:image
  const effectiveImage = data['linkedin:image'] || data['twitter:image'] || data['og:image'] || '';
  const effectiveTitle = data['linkedin:title'] || data['og:title'] || '';
  const effectiveDesc = data['linkedin:description'] || data['og:description'] || '';

  // --- Image area ---------------------------------------------------------
  const imageWrapper = document.createElement('a');
  imageWrapper.href = data['og:url'] || '#';
  imageWrapper.target = '_blank';
  imageWrapper.rel = 'noopener noreferrer';
  imageWrapper.className = 'mp-preview-card__image-wrapper';

  const img = document.createElement('img');
  img.src = effectiveImage || DEFAULT_PLACEHOLDER_IMAGE;
  img.alt = data['og:image:alt'] || '';
  img.className = 'mp-preview-card__image';
  img.loading = 'lazy';
  img.decoding = 'async';

  imageWrapper.appendChild(img);
  card.appendChild(imageWrapper);

  // --- Info area ----------------------------------------------------------
  const info = document.createElement('div');
  info.className = 'mp-preview-card__info';

  const hostSpan = document.createElement('span');
  hostSpan.className = 'mp-preview-card__host';
  hostSpan.textContent = _extractHost(data['og:url']);
  info.appendChild(hostSpan);

  const titleEl = document.createElement('h2');
  titleEl.className = 'mp-preview-card__title';
  titleEl.textContent = effectiveTitle;
  titleEl.title = titleEl.textContent;
  info.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'mp-preview-card__description';
  descEl.textContent = effectiveDesc;
  descEl.title = descEl.textContent;
  info.appendChild(descEl);

  // LinkedIn shows the site name as part of the URL line rather than separately
  card.appendChild(info);
  container.appendChild(card);
  return card;
}

// ---------------------------------------------------------------------------
// Tiny helper: pull host from a URL string safely.
// ---------------------------------------------------------------------------

function _extractHost(urlString) {
  if (!urlString) return '';
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    // Fall back to naive strip for malformed URLs
    const m = urlString.match(/^https?:\/\/([^\/]+)/i);
    return m ? m[1] : urlString;
  }
}

// ---------------------------------------------------------------------------
// Normalise a flat key→value map for use by the renderers.
//
// Strategy:
//   1. Copy all raw pairs verbatim.
//   2. Fill missing "og:" defaults from their "twitter:" counterparts (and
//      vice-versa where useful) so a single meta tag pair can satisfy both
//      previews.
//   3. Always attach fallbacks for structural pieces the renderers expect
//      (fallback image, favicon, site name).
// ---------------------------------------------------------------------------

function normaliseMetaTags(rawTags) {
  if (!rawTags || typeof rawTags !== 'object') return {};

  const out = Object.assign({}, rawTags);

  // Mirror twitter:image → og:image and twitter:title → og:title when the OG
  // variant is absent.  This means editing a Twitter-only field still produces
  // a decent Facebook preview (and the reverse).
  if (!out['og:image'] && out['twitter:image']) out['og:image'] = out['twitter:image'];
  if (!out['og:title'] && out['twitter:title']) out['og:title'] = out['twitter:title'];
  if (!out['og:description'] && out['twitter:description']) out['twitter:description'] && (out['og:description'] = out['twitter:description']);
  if (!out['twitter:image'] && out['og:image']) out['twitter:image'] = out['og:image'];
  if (!out['twitter:title'] && out['og:title']) out['twitter:title'] = out['og:title'];
  if (!out['twitter:description'] && out['og:description']) out['twitter:description'] = out['og:description'];

  // Ensure structural fall-backs are always defined.
  if (!out['og:url']) out['og:url'] = '';
  if (!out.favicon) out.favicon = DEFAULT_FAVICON;
  if (!out['og:site_name']) out['og:site_name'] = _extractHost(out['og:url']);

  return out;
}

// ---------------------------------------------------------------------------
// Validate a normalised tag map against the schema.
// Returns an object { valid: bool, errors: [{ key, message }] }.
// ---------------------------------------------------------------------------

function validateMetaTags(tags) {
  const normalized = normaliseMetaTags(tags);
  const errors = [];
  const warnings = [];

  for (const [key, schema] of Object.entries(META_SCHEMAS)) {
    const value = normalized[key];

    // Required-field check
    if (schema.required && (!value || String(value).trim() === '')) {
      errors.push({ key, message: `${key} is required` });
      continue;
    }

    if (!value || String(value).trim() === '') continue;

    const strValue = String(value).trim();

    // Length warning (non-fatal)
    if (schema.maxLength && strValue.length > schema.maxLength) {
      warnings.push({ key, message: `${key} exceeds ${schema.maxLength} characters` });
    }

    // Type checks
    if (schema.type === 'url' || schema.type === 'image') {
      try {
        new URL(strValue);
      } catch {
        if (!strValue.startsWith('data:')) {
          errors.push({ key, message: `${key} is not a valid URL` });
        }
      }
    }

    if (schema.type === 'color') {
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(strValue)) {
        errors.push({ key, message: `${key} is not a valid hex color` });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

// ---------------------------------------------------------------------------
// Build a <meta> / <link> HTML snippet from a normalised tag map, optionally
// scoped to a single platform's key set.
// ---------------------------------------------------------------------------

function buildMetaSnippet(tags, platformId) {
  const normalized = normaliseMetaTags(tags);
  const keys = platformId
    ? (_buildPlatformDefinitions()[platformId]?.keys || [])
    : [...new Set(Object.keys(META_SCHEMAS))];

  const lines = [];

  for (const key of keys) {
    const value = normalized[key];
    if (!value || String(value).trim() === '') continue;

    const strKey = String(key).trim();
    const strValue = String(value).trim().replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    if (strKey === 'favicon') {
      lines.push(`<link rel="icon" href="${strValue}" />`);
    } else if (strKey.startsWith('og:') || strKey.startsWith('twitter:') || strKey.startsWith('article:') || strKey.startsWith('profile:')) {
      lines.push(`<meta property="${strKey}" content="${strValue}" />`);
    } else {
      lines.push(`<meta name="${strKey}" content="${strValue}" />`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Platforms = Object.freeze({
  // Raw identifiers
  ids: { ...PLATFORM_IDS },
  supportedPlatforms: [...SUPPORTED_PLATFORMS],

  // Human-readable definitions keyed by id
  definitions: _buildPlatformDefinitions(),

  // Full schema for every supported meta-tag key
  metaSchema: { ...META_SCHEMAS },

  // Collection of all known keys (flattened)
  allKeys: [...new Set([
    ...UNIVERSAL_KEYS,
    ...Object.values(PLATFORM_SPECIFIC_KEYS).flat(),
  ])],

  // Default / placeholder values
  defaults: {
    placeholderImage: DEFAULT_PLACEHOLDER_IMAGE,
    favicon: DEFAULT_FAVICON,
    colors: { ...PLATFORM_COLORS },
    aspectRatios: { ...ASPECT_RATIOS },
  },

  // Rendering entry points (called by preview-card.js)
  createCard(platformId, tags, container) {
    const definition = this.definitions[platformId];
    if (!definition) throw new Error(`Unknown platform id: ${platformId}`);

    const normalized = normaliseMetaTags(tags);
    container.innerHTML = '';
    return definition.cardRenderer(normalized, container);
  },

  // Re-render an existing card node with fresh data (avoids full DOM rebuild)
  updateCard(platformId, tags, container) {
    const definition = this.definitions[platformId];
    if (!definition) throw new Error(`Unknown platform id: ${platformId}`);

    const normalized = normaliseMetaTags(tags);
    container.innerHTML = '';
    return definition.cardRenderer(normalized, container);
  },

  // Validation
  validate: validateMetaTags,
  normaliseMetaTags,

  // Snippet generation for the meta-editor
  buildMetaSnippet,

  // Utility: retrieve keys that belong to a given platform
  getPlatformKeys(platformId) {
    const definition = this.definitions[platformId];
    return definition ? [...definition.keys] : [];
  },

  // Utility: check whether a key is shared across all platforms
  isUniversalKey(key) {
    return UNIVERSAL_KEYS.includes(key);
  },
});

// ---------------------------------------------------------------------------
// Export for module systems and globals
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Platforms;
}

if (typeof window !== 'undefined') {
  window.Platforms = Platforms;
}