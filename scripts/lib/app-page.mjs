/**
 * One companion mobile app page.
 *
 * Maps a commercial mobile application to its supported printers, wire protocols,
 * and official app store distribution channels.
 */

import { marked } from 'marked';
import { escapeHtml, humanise, mono, page, specTable } from './html.mjs';
import { editFile } from './site.mjs';

/**
 * Checks if a hex color is light (luminance > 0.8)
 */
function isLightColor(hex) {
    if (!hex) return false;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}

export function getBadgeStyles(palette, brandColor) {
    if (!palette || palette.length === 0) {
        return { bg: brandColor, color: '#ffffff', isLight: false };
    }
    const isLight = isLightColor(palette[0]);
    if (isLight) {
        return {
            bg: palette[0],
            color: palette[1] || brandColor,
            isLight: true
        };
    }
    if (palette.length === 1) {
        return { bg: palette[0], color: '#ffffff', isLight: false };
    }
    return {
        bg: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
        color: '#ffffff',
        isLight: false
    };
}

/** @param {{ app: any, body: string, devices: any[], families: Set<string> }} input */
export function renderAppPage({ app, body, devices, families = new Set() }) {
    const badge = getBadgeStyles(app.brand_palette, app.brand_color);

    const sections = [
        `<article class="device app-page">`,
        `<div class="app-page-header">`,
        `<div class="app-badge${badge.isLight ? ' light-bg' : ''}" style="background:${badge.bg};color:${badge.color};"><span>${escapeHtml(app.badge_letter)}</span></div>`,
        `<div>`,
        `<h1>${escapeHtml(app.name)}</h1>`,
        `<p class="developer">by <strong>${escapeHtml(app.developer)}</strong></p>`,
        `</div>`,
        `</div>`,
        app.summary ? `<p class="summary">${escapeHtml(app.summary)}</p>` : '',
        appStores(app.platforms),
        identity(app, families),
        body ? `<div class="prose">\n${marked.parse(body)}\n</div>` : '',
        deviceList(devices),
        sources(app.sources),
        `<p class="edit"><a href="${escapeHtml(editFile(app._path))}">Improve this page</a></p>`,
        `</article>`
    ];

    return page({
        title: `${app.name} — OpenTLP Companion App`,
        description: app.summary ?? `${app.name} companion mobile app for thermal printers.`,
        body: sections.filter(Boolean).join('\n')
    });
}

function appStores(platforms) {
    if (!platforms) return '';
    const buttons = [];
    if (platforms.android?.url) {
        buttons.push(`<a class="button button-store" href="${escapeHtml(platforms.android.url)}" target="_blank" rel="noopener noreferrer">Google Play ↗</a>`);
    }
    if (platforms.ios?.url) {
        buttons.push(`<a class="button button-store" href="${escapeHtml(platforms.ios.url)}" target="_blank" rel="noopener noreferrer">Apple App Store ↗</a>`);
    }
    if (!buttons.length) return '';
    return `<div class="store-links">${buttons.join(' ')}</div>`;
}

function identity(app, families) {
    const protocolLinks = (app.protocols ?? []).map(p =>
        families.has(p)
            ? `<a href="${escapeHtml(p)}.html"><code>${escapeHtml(p)}</code></a>`
            : `<code>${escapeHtml(p)}</code>`
    ).join(', ') || '<span class="muted">None recorded</span>';

    const rows = [
        ['Developer', escapeHtml(app.developer)],
        ['Protocol families', protocolLinks],
        ['Status', app.status ? `<span class="level level-works">${escapeHtml(humanise(app.status))}</span>` : '']
    ];

    if (app.platforms?.android?.package) {
        rows.push(['Android package', mono(app.platforms.android.package)]);
    }
    const aliases = (app.replaces_apps ?? []).filter(a => a.toLowerCase() !== app.name.toLowerCase());
    if (aliases.length) {
        rows.push(['Also known as / Replaces', aliases.map(escapeHtml).join(', ')]);
    }
    if (app.popular_models?.length) {
        rows.push(['Popular models', app.popular_models.map(escapeHtml).join(', ')]);
    }

    return section('Application details', specTable(rows));
}

function deviceList(devices) {
    if (!devices?.length) return '';
    const rows = devices.map(device => `<tr>
<td class="brand">${escapeHtml(device.brand)}</td>
<td class="model"><a href="${escapeHtml(device.id)}.html">${escapeHtml(device.model)}</a>${device.rebadge_of ? ' <span class="rebadge">rebadge</span>' : ''}</td>
<td class="family">${device.protocol?.family ? `<a href="${escapeHtml(device.protocol.family)}.html"><code>${escapeHtml(device.protocol.family)}</code></a>` : '<span class="muted">unknown</span>'}</td>
<td class="num">${device.print?.width_mm ? `${device.print.width_mm} mm` : device.print?.width_dots ? `${device.print.width_dots} dots` : ''}</td>
<td class="status"><span class="dot dot-${escapeHtml(device.status ?? 'unverified')}" title="${escapeHtml(humanise(device.status ?? 'unverified'))}"></span></td>
</tr>`).join('\n');

    return section(`Compatible hardware (${devices.length})`, `<div class="table-wrap">
<table class="devices-table compact">
<thead>
<tr>
  <th scope="col">Brand</th>
  <th scope="col">Model</th>
  <th scope="col">Protocol</th>
  <th scope="col">Width</th>
  <th scope="col" title="Verification status">Status</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>`);
}

function sources(sourcesList) {
    if (!sourcesList?.length) return '';
    const items = sourcesList.map(s => {
        const title = s.title || s.url || s.kind;
        const link = s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title);
        return `<li><span class="kind">${escapeHtml(humanise(s.kind))}</span>: ${link}${s.note ? ` — <span class="muted">${escapeHtml(s.note)}</span>` : ''}</li>`;
    }).join('\n');

    return section('Sources & Evidence', `<ul class="sources-list">\n${items}\n</ul>`);
}

function section(heading, content) {
    return `<section aria-labelledby="${escapeHtml(heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">\n<h2>${escapeHtml(heading)}</h2>\n${content}\n</section>`;
}
