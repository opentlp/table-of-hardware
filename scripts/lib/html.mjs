/**
 * The page shell and the small formatting helpers the generator needs.
 *
 * Deliberately plain: no framework, no build step, no client-side routing. The
 * site is a table and some documents, and it should still work in ten years
 * with JavaScript switched off — the search box is the only scripted part, and
 * the table is fully rendered without it.
 */

import {
    CORE_URL,
    DISCORD_URL,
    ORGANIZATION_URL,
    REPO_URL,
    STUDIO_URL
} from './site.mjs';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} value */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

/** Title case for a slug, for headings generated from keys. */
export const humanise = slug =>
    String(slug).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * Wrap body content in the site chrome.
 *
 * `depth` is how many directories deep the page sits, so the stylesheet link
 * resolves whether the site is served from a domain root or a subdirectory.
 */
export function page({ title, description = '', body, active = '' }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">\n` : ''}<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>
<header class="site">
  <a class="wordmark" href="index.html" aria-label="OpenTLP home"><span>Open</span>TLP</a>
  <nav aria-label="Primary navigation">
    <a href="index.html"${active === 'home' ? ' aria-current="page"' : ''}>Overview</a>
    <a href="index.html#hardware">Hardware</a>
    <a href="${escapeHtml(STUDIO_URL)}" aria-label="Studio (external site)">Studio</a>
    <a href="${escapeHtml(CORE_URL)}" aria-label="Core (GitHub)">Core</a>
    <a href="contributing.html"${active === 'contributing' ? ' aria-current="page"' : ''}>Contribute</a>
    <a href="about.html"${active === 'about' ? ' aria-current="page"' : ''}>About</a>
  </nav>
</header>
<main id="content">
${body}
</main>
<footer class="site">
  <div class="footer-grid">
    <section>
      <h2>Use OpenTLP</h2>
      <a href="${escapeHtml(STUDIO_URL)}">Open Studio</a>
      <a href="index.html#hardware">Find a printer</a>
      <a href="devices.json">Device data</a>
      <a href="families.json">Protocol data</a>
    </section>
    <section>
      <h2>Build</h2>
      <a href="${escapeHtml(CORE_URL)}">Core and drivers</a>
      <a href="contributing.html">Contribute hardware</a>
      <a href="collaboration.html">Collaborate</a>
      <a href="${escapeHtml(ORGANIZATION_URL)}">GitHub organization</a>
    </section>
    <section>
      <h2>Project</h2>
      <a href="about.html">About OpenTLP</a>
      <a href="${escapeHtml(DISCORD_URL)}">Discord community</a>
      <a href="index.html#hardware">Table of Hardware</a>
      <a href="${escapeHtml(REPO_URL)}#licence">Licences</a>
    </section>
  </div>
  <p class="legal">Device data is <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0-1.0</a> — public domain. Site code is MIT. Linked sources keep their own terms.</p>
</footer>
</body>
</html>
`;
}

/** A definition table, skipping rows whose value is empty. */
export function specTable(rows) {
    const present = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (!present.length) return '';
    return `<table class="spec">
<tbody>
${present.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${value}</td></tr>`).join('\n')}
</tbody>
</table>`;
}

/** `<code>` for machine values — UUIDs, hex, package names. */
export const mono = value => `<code>${escapeHtml(value)}</code>`;
