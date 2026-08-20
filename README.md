# MetaPreviewr

> Test and preview how your URLs will appear across Open Graph, Twitter Cards, and LinkedIn with live rich-preview cards before you share.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/wiradifit/metapreviewr?style=social)](https://github.com/wiradifit/metapreviewr)

## ✨ Features

- **Live URL Preview** — Enter any URL and instantly see how it renders on Facebook (Open Graph), Twitter (Cards), and LinkedIn rich preview cards simultaneously.
- **Inline Meta Tag Editor** — Edit Open Graph, Twitter Card, and custom meta tags directly in the browser with real-time card updates as you type.
- **Headless-Browser Style Rendering** — Rich-preview cards are rendered client-side, mimicking how major platforms parse and display your links without needing an actual headless browser.
- **One-Click Copy** — Copy corrected or suggested meta tags for any platform with a single click, ready to paste into your HTML `<head>`.
- **Cross-Platform Validation** — Get instant feedback on missing or malformed tags per platform spec (OG, Twitter Cards v2, LinkedIn).
- **Zero Dependencies** — Built purely with vanilla HTML, CSS, and JavaScript. No build tools, no frameworks, no npm installs required.
- **Fully Client-Side** — No server needed; runs entirely in the browser for privacy and speed.

## 🚀 Quick Start

No build step required. Follow these steps to get MetaPreviewr running locally:

```bash
# Clone the repository
git clone https://github.com/wiradifit/metapreviewr.git
cd metapreviewr

# Option 1: Open directly in your browser
open index.html

# Option 2: Serve via Python
python3 -m http.server 8080
# Then visit http://localhost:8080

# Option 3: Serve via Node.js
npx serve .
# Then visit http://localhost:3000

# Option 4: Use Live Server (VS Code extension)
# Right-click index.html → "Open with Live Server"
```

MetaPreviewr is a static web application — simply open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

## 📖 Usage & Examples

### Previewing a URL

1. Open MetaPreviewr in your browser.
2. Paste any public URL into the input field at the top.
3. The app fetches the page HTML, extracts relevant meta tags, and renders live preview cards for **Facebook**, **Twitter**, and **LinkedIn**.

### Editing Meta Tags Inline

1. After entering a URL (or starting with the default template), click any meta tag value in the editor panel.
2. Modify the content directly.
3. Watch the preview cards update in real time as you edit.

### Copying Corrected Tags

1. Hover over any platform's preview card or meta-tag block.
2. Click the **Copy** button to copy the full set of recommended meta tags for that specific platform.
3. Paste them into your site's `<head>` section.

### Example: Fixing a Missing Twitter Card

```html
<!-- Before (missing Twitter Card tags) -->
<meta property="og:title" content="My Page">
<meta property="og:image" content="https://example.com/image.jpg">

<!-- After copying from MetaPreviewr's Twitter suggestion -->
<meta property="og:title" content="My Page">
<meta property="og:image" content="https://example.com/image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="My Page">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

### Platform-Specific Guidance

- **Facebook / Open Graph** — Requires `og:title`, `og:description`, `og:image`, and `og:url`. Use the OG debugger link provided for final validation.
- **Twitter Cards** — Supports `summary` and `summary_large_image`. The `twitter:site` and `twitter:creator` handles are optional but recommended.
- **LinkedIn** — Uses Open Graph tags primarily. Ensuring `og:image` is at least 200×200 px (recommended: 1200×627 px) avoids fallback rendering.

## 🏗️ Tech Stack

| Component       | Technology              |
|-----------------|-------------------------|
| Structure       | HTML5                   |
| Styling         | CSS3 (Custom Properties) |
| Logic           | Vanilla JavaScript (ES6+) |
| Rendering       | DOM-based client-side    |

This project intentionally uses **zero external dependencies** to remain lightweight, fast, and easy to fork or embed.

## 📁 Project Structure

```
metapreviewr/
├── app.js              # Main application entry point & orchestration
├── index.html          # HTML shell and UI layout
├── meta-editor.js      # Inline meta tag editor logic
├── package.json        # Project metadata and scripts
├── platforms.js        # Platform-specific tag schemas & validators (FB/Twitter/LinkedIn)
├── preview-card.js     # Rich-preview card renderer for each platform
├── styles.css          # All styling, including platform card themes
├── utils.js            # Helper functions (fetch, parse, copy-to-clipboard, etc.)
├── README.md           # This file
├── LICENSE             # MIT License
└── .gitignore          # Git ignore rules
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository.
2. **Clone** your fork and create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** — focus on clean, well-commented code.
4. **Test** by opening `index.html` in a browser.
5. **Commit** your changes:
   ```bash
   git commit -m "feat: add your descriptive message"
   ```
6. **Push** and open a **Pull Request** against the `main` branch.

Please ensure your PR follows existing code style and includes a brief description of what was changed and why.

## 📄 License

MIT © [wiradifit](https://github.com/wiradifit)