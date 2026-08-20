/**
 * meta-editor.js — Inline meta-tag table component for MetaPreviewr
 *
 * Manages key-value editing, platform-scoped visibility toggles,
 * validation highlighting, and generating corrected <meta>/<link>
 * snippet strings ready for one-click copy.
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  /** Debounce helper – returns a new fn that delays call by ms ms. */
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /** Escape HTML special characters to prevent XSS in rendered output. */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str ?? ''));
    return div.innerHTML;
  }

  /** Copy string to clipboard with toast feedback (mirrors utils.js behaviour). */
  async function copyToClipboard(text, anchorEl) {
    try {
      await navigator.clipboard.writeText(text);
      const rect = anchorEl
        ? anchorEl.getBoundingClientRect()
        : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
      showToast('Copied to clipboard', rect.left, rect.top - 40);
    } catch {
      showToast('Failed to copy', rect.left, rect.top - 40);
    }
  }

  /** Show a brief floating toast notification near (x, y). */
  function showToast(message, x, y) {
    let toast = document.getElementById('mp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mp-toast';
      toast.className = 'mp-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    toast.style.top = `${Math.max(y, 10)}px`;
    toast.classList.add('mp-show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('mp-show'), 2000);
  }

  // ----------------------------------------------------------------
  // Platform label lookup
  // ----------------------------------------------------------------

  /** Return a human-readable short label for a platform key. */
  function platformLabel(key) {
    return { facebook: 'FB', twitter: 'X', linkedin: 'LI' }[key] ?? key;
  }

  /** Return the emoji/icon string for a platform key. */
  function platformIcon(key) {
    return { facebook: '\u{1F4E1}', twitter: '\u{1F426}', linkedin: '\u{1F4BC}' }[key] ?? key.charAt(0).toUpperCase();
  }

  // ----------------------------------------------------------------
  // Validation rules per meta-key
  // ----------------------------------------------------------------
  const VALIDATORS = {
    'og:title': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : value.length > 70 ? { valid: true, warn: true, msg: `Title is ${value.length} chars (max 70)` }
      : { valid: true },

    'og:description': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : value.length > 300 ? { valid: true, warn: true, msg: `Description is ${value.length} chars (max 300)` }
      : { valid: true },

    'twitter:description': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : value.length > 200 ? { valid: true, warn: true, msg: `Description is ${value.length} chars (max 200)` }
      : { valid: true },

    'og:image': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : !/^https?:\/\//i.test(value) ? { valid: false, msg: 'Must be an absolute URL' }
      : { valid: true },

    'twitter:image': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : !/^https?:\/\//i.test(value) ? { valid: false, msg: 'Must be an absolute URL' }
      : { valid: true },

    'og:url': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : !/^https?:\/\//i.test(value) ? { valid: false, msg: 'Must be an absolute URL' }
      : { valid: true },

    'twitter:url': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : !/^https?:\/\//i.test(value) ? { valid: false, msg: 'Must be an absolute URL' }
      : { valid: true },

    'og:type': ({ value }) =>
      !value ? { valid: false, msg: 'Required' }
      : { valid: true },

    'og:site_name': ({ value }) => ({ valid: !!value }),

    'twitter:site': ({ value }) => ({ valid: !!value }),

    'twitter:creator': ({ value }) => ({ valid: !!value }),

    'og:locale': ({ value }) => ({ valid: !!value }),

    'linkedin:title': ({ value }) => ({ valid: !!value }),

    'linkedin:description': ({ value }) => ({ valid: !!value }),
  };

  // ----------------------------------------------------------------
  // MetaEditor class
  // ----------------------------------------------------------------

  class MetaEditor {
    /**
     * @param {Object} opts
     * @param {string|HTMLElement} opts.element   Selector or DOM node for the editor container
     * @param {Array<{key:string, value:string, property?:string}>} opts.tags  Initial meta-tag list
     * @param {Object} [opts.platforms]          Platform config from platforms.js (keys → {name, icon})
     * @param {Function} [opts.onChange]         Called when the tag set changes ({tags})
     * @param {boolean} [opts.showPlatforms]     Whether to render platform-toggle columns
     */
    constructor(opts = {}) {
      // Resolve container
      this._container =
        typeof opts.element === 'string'
          ? document.querySelector(opts.element)
          : opts.element;

      if (!this._container) {
        throw new Error('[MetaEditor] Element not found: ' + (opts.element ?? 'undefined'));
      }

      this._tags = Array.isArray(opts.tags) ? JSON.parse(JSON.stringify(opts.tags)) : [];
      this._platforms = opts.platforms || { facebook: {}, twitter: {}, linkedin: {} };
      this._visiblePlatforms = Object.keys(this._platforms);
      this._onChange = opts.onChange || null;

      // Platform → Set of keys that are natively owned by that platform (not inherited)
      this._platformOwnedKeys = this._computePlatformOwnedKeys();

      this._init();
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    /** Replace the current tag list and re-render. */
    setTags(tags) {
      this._tags = Array.isArray(tags) ? JSON.parse(JSON.stringify(tags)) : [];
      this._renderTable();
      this._renderCode();
      this._fireChange();
    }

    /** Add a single meta tag (merge by key if already present). */
    addTag(tag) {
      const idx = this._tags.findIndex(t => t.key === tag.key);
      if (idx >= 0) {
        this._tags[idx] = { ...this._tags[idx], ...tag };
      } else {
        this._tags.push({ ...tag });
      }
      this._renderTable();
      this._renderCode();
      this._fireChange();
    }

    /** Remove a tag by key. */
    removeTag(key) {
      this._tags = this._tags.filter(t => t.key !== key);
      this._renderTable();
      this._renderCode();
      this._fireChange();
    }

    /** Toggle visibility of a platform column. */
    setPlatformVisible(platformKey, visible) {
      if (visible) {
        if (!this._visiblePlatforms.includes(platformKey)) {
          this._visiblePlatforms.push(platformKey);
        }
      } else {
        this._visiblePlatforms = this._visiblePlatforms.filter(p => p !== platformKey);
      }
      this._renderTable();
      this._fireChange();
    }

    /** Get the current list of tags. */
    getTags() {
      return JSON.parse(JSON.stringify(this._tags));
    }

    /** Get the generated meta-tag snippet as an HTML string. */
    getCode() {
      return this._generateMetaTags();
    }

    /** Destroy the editor – remove listeners & clean up DOM. */
    destroy() {
      this._listeners.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
      this._listeners.length = 0;
      this._container.innerHTML = '';
      this._onChange = null;
    }

    // ----------------------------------------------------------------
    // Internal – wiring & lifecycle
    // ----------------------------------------------------------------

    _init() {
      this._listeners = [];
      this._buildStructure();
      this._renderTable();
      this._renderCode();
      this._wireEvents();
    }

    _buildStructure() {
      this._container.innerHTML = `
        <div class="mp-editor">
          <div class="mp-editor__header">
            <h3 class="mp-editor__title">Meta Tags</h3>
            <button class="mp-btn mp-btn--copy" id="mp-copy-code" disabled title="Copy meta tag snippet">
              <span class="mp-btn__icon">&#10064;</span> Copy Code
            </button>
          </div>
          <div class="mp-editor__body">
            <div class="mp-editor__table-wrap" id="mp-table-wrap">
              <!-- table injected by _renderTable -->
            </div>
            <div class="mp-editor__code-wrap">
              <pre class="mp-editor__code" id="mp-code-output"><code>&lt;!-- Meta tags will appear here --&gt;</code></pre>
              <button class="mp-btn mp-btn--small" id="mp-copy-inline" disabled title="Copy to clipboard">
                <span class="mp-btn__icon">&#10064;</span> Copy
              </button>
            </div>
          </div>
        </div>`;
    }

    _wireEvents() {
      const self = this;
      const copyCodeBtn = document.getElementById('mp-copy-code');
      const copyInlineBtn = document.getElementById('mp-copy-inline');
      const codeOutput = document.getElementById('mp-code-output');

      // Click handlers delegated to table wrapper
      this._listen(this._container, 'click', e => {
        // Platform toggle buttons
        const toggleBtn = e.target.closest('.mp-toggle-btn');
        if (toggleBtn) {
          const platform = toggleBtn.dataset.platform;
          const isActive = toggleBtn.classList.contains('mp-toggle-btn--active');
          toggleBtn.classList.toggle('mp-toggle-btn--active', !isActive);
          // Persist visibility state on each tag for this platform
          self._tags.forEach(tag => {
            if (!tag.platforms) tag.platforms = {};
            tag.platforms[platform] = !isActive;
          });
          return;
        }

        // Copy-code header button
        if (e.target.closest('#mp-copy-code')) {
          self._doCopy(codeOutput);
          return;
        }

        // Copy-inline button inside code wrap
        if (e.target.closest('#mp-copy-inline')) {
          self._doCopy(codeOutput, e.target.closest('.mp-editor__code-wrap'));
          return;
        }
      });

      // Input / change delegation
      this._listen(this._container, 'input', e => {
        if (!e.target.classList.contains('mp-tag-input')) return;
        const row = e.target.closest('.mp-tag-row');
        if (!row) return;
        const key = row.dataset.key;
        const tag = self._tags.find(t => t.key === key);
        if (tag) {
          tag.value = e.target.value;
          // Re-validate just this row
          self._validateRow(row, tag);
          // Update code snippet
          self._renderCode();
          self._fireChange();
        }
      });

      // Blur → final validation
      this._listen(this._container, 'blur', e => {
        if (!e.target.classList.contains('mp-tag-input')) return;
        const row = e.target.closest('.mp-tag-row');
        if (row) {
          const key = row.dataset.key;
          const tag = self._tags.find(t => t.key === key);
          if (tag) self._validateRow(row, tag);
        }
      }, true);
    }

    /** Register a one-time or persistent listener, tracking it for cleanup. */
    _listen(el, event, handler, capture = false) {
      el.addEventListener(event, handler, capture);
      this._listeners.push({ el, evt: event, fn: handler, capture });
    }

    /** Run the validator for a given tag and style its row accordingly. */
    _validateRow(row, tag) {
      const rule = VALIDATORS[tag.key];
      const result = rule ? rule(tag) : { valid: true };
      row.classList.toggle('is-valid', result.valid && !result.warn);
      row.classList.toggle('is-warning', result.warn);
      row.classList.toggle('is-invalid', !result.valid);

      const statusCell = row.querySelector('.mp-status');
      if (statusCell) {
        statusCell.className = 'mp-status ' + (result.valid
          ? (result.warn ? 'mp-status--warning' : 'mp-status--valid')
          : 'mp-status--invalid');
        statusCell.textContent = result.msg || (result.valid ? 'OK' : '');
      }
    }

    // ----------------------------------------------------------------
    // Rendering – Table
    // ----------------------------------------------------------------

    _renderTable() {
      const wrap = document.getElementById('mp-table-wrap');
      if (!wrap) return;

      if (this._tags.length === 0) {
        wrap.innerHTML = '<p class="mp-editor__empty">No meta tags yet. Paste a URL above to extract them.</p>';
        return;
    9f5c4b8d-e2b3-4c7a-8d47-5f8a2b6e4d1c