/**
 * The Table of Hardware.
 *
 * Every device, one row each, fully rendered server-side. The filter box is an
 * enhancement over a table that already works without it — someone arriving with
 * scripts blocked, or from a search engine, still gets the whole database.
 */

import { escapeHtml, humanise, page } from './html.mjs';
import { projectName } from './projects.mjs';
import {
    CORE_URL,
    DISCORD_URL,
    ORGANIZATION_URL,
    STUDIO_REPO_URL,
    STUDIO_URL
} from './site.mjs';

/** @param {{ devices: any[] }} input */
export function renderTablePage({ devices, families = [] }) {
    const documented = new Set(families.map(family => family.id));

    // What a family is colloquially called, so a search for "cat printer" finds
    // the devices that are one. The name is not on any of them — it belongs to
    // the protocol family, not to a brand — but it is what people type.
    const familyTerms = new Map(families.map(family =>
        [family.id, [family.name, ...(family.also_known_as ?? [])].join(' ')]));
    const rows = devices.map(device => {
        const projects = Object.entries(device.support ?? {})
            .filter(([, entry]) => ['listed', 'works', 'partial'].includes(entry.level))
            .map(([slug, entry]) =>
                `<span class="level level-${escapeHtml(entry.level)}" title="${escapeHtml(humanise(entry.level))}">${escapeHtml(projectName(slug))}</span>`)
            .join(' ');

        const width = device.print?.width_dots
            ? `${device.print.width_dots}<span class="unit">dots</span>`
            : device.print?.width_mm ? `${device.print.width_mm}<span class="unit">mm</span>` : '';

        // Everything the filter box searches, in one attribute, so filtering is
        // a substring test rather than a walk over cells.
        const haystack = [
            device.brand, device.model, device.id,
            ...(device.aliases ?? []),
            ...(device.connectivity?.ble?.name_examples ?? []),
            device.protocol?.family, device.protocol?.variant, device.protocol?.vendor_app,
            familyTerms.get(device.protocol?.family)
        ].filter(Boolean).join(' ').toLowerCase();

        return `<tr data-search="${escapeHtml(haystack)}" data-family="${escapeHtml(device.protocol?.family ?? '')}" data-status="${escapeHtml(device.status ?? 'unverified')}">
<td class="brand">${escapeHtml(device.brand)}</td>
<td class="art">${device.artwork
            ? `<img src="${escapeHtml(device.artwork.file)}" alt="" width="40" height="40" loading="lazy">`
            : ''}</td>
<td class="model"><a href="${escapeHtml(device.id)}.html">${escapeHtml(device.model)}</a>${
            device.rebadge_of ? ' <span class="rebadge" title="Rebadge of another device">rebadge</span>' : ''}</td>
<td class="family">${!device.protocol?.family ? '<span class="muted">unknown</span>'
            : documented.has(device.protocol.family)
                ? `<a href="${escapeHtml(device.protocol.family)}.html"><code>${escapeHtml(device.protocol.family)}</code></a>`
                : `<code>${escapeHtml(device.protocol.family)}</code>`}</td>
<td class="num">${width}</td>
<td class="num">${device.print?.dpi ? `${device.print.dpi}<span class="unit">dpi</span>` : ''}</td>
<td class="support">${projects || '<span class="muted">none recorded</span>'}</td>
<td class="status"><span class="dot dot-${escapeHtml(device.status ?? 'unverified')}" title="${escapeHtml(humanise(device.status ?? 'unverified'))}"></span></td>
</tr>`;
    }).join('\n');

    // Every family present in the data, documented or not — a device whose
    // family has no page still deserves a filter chip.
    const familySlugs = [...new Set(devices.map(d => d.protocol?.family).filter(Boolean))].sort();

    const verified = devices.filter(device => device.status === 'verified').length;
    const protocolCount = families.length;

    const body = `<section class="project-hero" aria-labelledby="project-title">
<p class="eyebrow">Open thermal label printing</p>
<h1 id="project-title">Make the printer yours.</h1>
<p class="hero-lede">Open tools, reusable drivers, and shared hardware knowledge for thermal label printers.</p>
<div class="hero-actions">
  <a class="button button-primary" href="${escapeHtml(STUDIO_URL)}">Open Studio</a>
  <a class="button" href="#hardware">Find a printer</a>
  <a class="text-link" href="${escapeHtml(DISCORD_URL)}">Join the Discord <span aria-hidden="true">→</span></a>
</div>
</section>

<section class="project-map" aria-labelledby="project-map-title">
<div class="section-heading">
  <p class="eyebrow">One project, three layers</p>
  <h2 id="project-map-title">From label design to bytes on the wire.</h2>
</div>
<div class="project-grid">
  <article class="project-card project-studio">
    <p class="project-number">01</p>
    <h3>OpenTLP Studio</h3>
    <p>Design and print labels in a local-first visual application.</p>
    <div class="card-links"><a href="${escapeHtml(STUDIO_URL)}">Open the app</a><a href="${escapeHtml(STUDIO_REPO_URL)}">Source</a></div>
  </article>
  <article class="project-card project-core">
    <p class="project-number">02</p>
    <h3>OpenTLP Core</h3>
    <p>Reusable protocol drivers, rendering contracts, and printer discovery.</p>
    <div class="card-links"><a href="${escapeHtml(CORE_URL)}">Explore Core</a></div>
  </article>
  <article class="project-card project-toh">
    <p class="project-number">03</p>
    <h3>OpenTLP ToH</h3>
    <p>An evidence-based map of models, rebrands, protocols, and software support.</p>
    <div class="card-links"><a href="#hardware">Browse the table</a></div>
  </article>
</div>
</section>

<section class="hardware-section" id="hardware" aria-labelledby="hardware-title">
<div class="hardware-heading">
  <div>
    <p class="eyebrow">OpenTLP ToH</p>
    <h2 id="hardware-title">Table of Hardware</h2>
    <p class="lede">Find a model by its brand, protocol, or Bluetooth name. Every recorded fact links back to evidence.</p>
  </div>
  <dl class="catalogue-stats" aria-label="Catalogue totals">
    <div><dt>${devices.length === 1 ? 'printer' : 'printers'}</dt><dd>${devices.length}</dd></div>
    <div><dt>${protocolCount === 1 ? 'protocol family' : 'protocol families'}</dt><dd>${protocolCount}</dd></div>
    <div><dt>verified</dt><dd>${verified}</dd></div>
  </dl>
</div>

<div class="controls">
<label class="search">
  <span class="visually-hidden">Search printers</span>
  <input type="search" id="filter" placeholder="Search brand, model, protocol, or the name it advertises…" autocomplete="off">
</label>
<div class="chips" id="families">
  <button type="button" class="chip is-on" data-family="">All</button>
  ${familySlugs.map(f => `<button type="button" class="chip" data-family="${escapeHtml(f)}"><code>${escapeHtml(f)}</code></button>`).join('\n  ')}
</div>
</div>

<table class="toh" id="toh">
<thead>
<tr>
<th scope="col">Brand</th>
<th scope="col"><span class="visually-hidden">Artwork</span></th>
<th scope="col">Model</th>
<th scope="col">Protocol</th>
<th scope="col">Width</th>
<th scope="col">Res.</th>
<th scope="col">Supported by</th>
<th scope="col"><span class="visually-hidden">Confidence</span></th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>

<p class="count" id="count" hidden></p>

<aside class="legend">
<h2>Reading this table</h2>
<dl>
<dt><span class="dot dot-verified"></span> Verified</dt><dd>Someone printed from it, or captured its traffic.</dd>
<dt><span class="dot dot-reported"></span> Reported</dt><dd>Credible second-hand account.</dd>
<dt><span class="dot dot-unverified"></span> Unverified</dt><dd>Transcribed from a catalogue, or inferred.</dd>
</dl>
<p>Devices sharing a <strong>protocol</strong> are driven by the same code. Linked protocols
have a page documenting the wire format. A row marked <span class="rebadge">rebadge</span>
is the same hardware as another entry under a different name.</p>
</aside>
</section>

<section class="principles" aria-labelledby="principles-title">
<div class="section-heading">
  <p class="eyebrow">Why it exists</p>
  <h2 id="principles-title">Printer support should outlive a vendor app.</h2>
</div>
<div class="principle-list">
  <article><h3>Local by default</h3><p>Studio stores designs in the browser and sends print data directly to the selected printer.</p></article>
  <article><h3>Protocols, not stickers</h3><p>Rebranded models are connected to the hardware and wire format they share.</p></article>
  <article><h3>Evidence stays visible</h3><p>Verified captures, user reports, vendor documents, and unverified catalogue claims remain distinguishable.</p></article>
  <article><h3>Built to be reused</h3><p>Hardware data is CC0. Core code is MIT. Applications can vendor a pinned snapshot without a runtime service.</p></article>
</div>
</section>

<section class="community-band" aria-labelledby="community-title">
<div>
  <p class="eyebrow">Community hardware needs community evidence</p>
  <h2 id="community-title">Test a printer. Record a protocol. Improve a driver.</h2>
  <p>Hardware reports turn a plausible implementation into confirmed support.</p>
</div>
<div class="community-actions">
  <a class="button button-inverse" href="contributing.html">Contribute</a>
  <a href="${escapeHtml(DISCORD_URL)}">Discord</a>
  <a href="${escapeHtml(ORGANIZATION_URL)}">GitHub</a>
</div>
</section>

<script>
${FILTER_SCRIPT}
</script>`;

    return page({
        title: 'OpenTLP — Open tools for thermal label printing',
        description: 'OpenTLP Studio, reusable thermal-printer drivers, and a community-maintained Table of Hardware.',
        body,
        active: 'home'
    });
}

/**
 * Filtering, kept small and dependency-free.
 *
 * The family filter also reads from the URL fragment so a device page can link
 * to "everything else that speaks this protocol".
 */
const FILTER_SCRIPT = `
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('#toh tbody tr'));
  var search = document.getElementById('filter');
  var chips = document.getElementById('families');
  var count = document.getElementById('count');
  var family = '';

  function apply() {
    var term = search.value.trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (row) {
      var ok = (!term || row.dataset.search.indexOf(term) !== -1) &&
               (!family || row.dataset.family === family);
      row.hidden = !ok;
      if (ok) shown++;
    });
    count.hidden = shown === rows.length;
    count.textContent = shown + ' of ' + rows.length + ' devices';
  }

  search.addEventListener('input', apply);

  chips.addEventListener('click', function (event) {
    var chip = event.target.closest('.chip');
    if (!chip) return;
    family = chip.dataset.family;
    Array.prototype.forEach.call(chips.children, function (c) {
      c.classList.toggle('is-on', c === chip);
    });
    apply();
  });

  var match = /family=([^&]+)/.exec(location.hash);
  if (match) {
    var wanted = decodeURIComponent(match[1]);
    var chip = chips.querySelector('[data-family="' + wanted.replace(/"/g, '') + '"]');
    if (chip) chip.click();
  }
})();
`;
