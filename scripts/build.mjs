/**
 * Generate the site.
 *
 * Input is the monorepo's `packages/hardware`; output is `site/` — a table, a
 * page per device, and `devices.json`. Everything in `site/` is disposable and rebuilt
 * from scratch, so nothing there should ever be edited by hand.
 *
 * `npm run build`
 */

import { mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadDevices, loadFamilies, loadApps, deviceMatchesApp, HARDWARE_ROOT, ROOT, SITE_DIR } from './lib/load.mjs';
import { renderDevicePage } from './lib/device-page.mjs';
import { renderFamilyPage } from './lib/family-page.mjs';
import { renderAppPage } from './lib/app-page.mjs';
import { renderTablePage } from './lib/table-page.mjs';
import { page, escapeHtml } from './lib/html.mjs';
import { sanitiseSvg } from './lib/svg.mjs';
import { siteRepoFile } from './lib/site.mjs';
import { marked } from 'marked';

/**
 * The shape of `devices.json`.
 *
 * Bumped only when a change would break a consumer that reads the current
 * format. Adding a field does not; removing or repurposing one does.
 */
const EXPORT_VERSION = 1;

const DOC_DESCRIPTION = {
    'README.md': 'What OpenTLP is, how to use the data, and how to contribute.',
    'CONTRIBUTING.md': 'The fields, the evidence rules, and how to add a printer.',
    'COLLABORATION.md': 'How OpenTLP works with projects documenting and supporting thermal printers.'
};

/** Documents that become pages here. Anything else stays on GitHub. */
const DOC_PAGES = {
    'README.md': 'about.html',
    'CONTRIBUTING.md': 'contributing.html',
    'COLLABORATION.md': 'collaboration.html'
};

const { devices: loaded, errors } = await loadDevices();
const { devices: loadedFamilies, errors: familyErrors } = await loadFamilies();
const { devices: loadedApps, errors: appErrors } = await loadApps();
errors.push(...familyErrors, ...appErrors);
if (errors.length) {
    for (const error of errors) console.error(`error ${error}`);
    console.error('\nRefusing to build. Fix the pages above, then run `npm run validate`.');
    process.exit(1);
}

// Sorted for the table, and so the JSON export has a stable order — a
// reproducible build means a diff on the output is a real change.
const devices = loaded
    .map(({ device, body, path }) => ({ ...device, body, _path: path }))
    .sort((a, b) =>
        a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model, undefined, { numeric: true }));

const byId = new Map(devices.map(device => [device.id, device]));

const families = loadedFamilies
    .map(({ device, body, path }) => ({ ...device, body, _path: path }))
    .sort((a, b) => a.id.localeCompare(b.id));

const familyIds = new Set(families.map(family => family.id));

const apps = loadedApps
    .map(({ device, body, path }) => ({ ...device, body, _path: path }))
    .sort((a, b) => a.name.localeCompare(b.name));

const appsById = new Map();
for (const app of apps) {
    appsById.set(app.id, app);
    appsById.set(app.name.toLowerCase(), app);
    appsById.set(app.name, app);
    if (app.replaces_apps) {
        for (const alias of app.replaces_apps) {
            appsById.set(alias.toLowerCase(), app);
            appsById.set(alias.toLowerCase().replace(/[^a-z0-9]+/g, '-'), app);
        }
    }
}

await rm(SITE_DIR, { recursive: true, force: true });
await mkdir(SITE_DIR, { recursive: true });

// Artwork is contributed, so it is stripped to an allowlist before it is
// inlined into a page. See lib/svg.mjs for what survives and why.
for (const device of devices) {
    if (!device.artwork) continue;
    const from = join(HARDWARE_ROOT, dirname(device._path), device.artwork.file);
    let raw;
    try {
        raw = await readFile(from, 'utf8');
    } catch {
        console.error(`error ${device._path}: artwork file ${device.artwork.file} is missing`);
        process.exit(1);
    }
    const { svg, removed } = sanitiseSvg(raw);
    if (removed.length) {
        console.warn(`warn  ${device._path}: stripped from artwork — ${removed.join(', ')}`);
    }
    device._svg = svg;
    await writeFile(join(SITE_DIR, device.artwork.file), svg, 'utf8');
}

for (const device of devices) {
    await writeFile(
        join(SITE_DIR, `${device.id}.html`),
        renderDevicePage({ device, body: device.body, byId, families: familyIds, apps: appsById }),
        'utf8'
    );
}

for (const family of families) {
    await writeFile(
        join(SITE_DIR, `${family.id}.html`),
        renderFamilyPage({
            family,
            body: family.body,
            devices: devices.filter(device => device.protocol?.family === family.id)
        }),
        'utf8'
    );
}

for (const app of apps) {
    await writeFile(
        join(SITE_DIR, `${app.id}.html`),
        renderAppPage({
            app,
            body: app.body,
            devices: devices.filter(device => deviceMatchesApp(device, app)),
            families: familyIds
        }),
        'utf8'
    );
}

await writeFile(join(SITE_DIR, 'index.html'), renderTablePage({ devices, families, apps }), 'utf8');
await writeFile(join(SITE_DIR, 'about.html'), await renderDoc('README.md', 'About', 'about'), 'utf8');
await writeFile(join(SITE_DIR, 'contributing.html'),
    await renderDoc('CONTRIBUTING.md', 'Adding a printer', 'contributing'), 'utf8');
await writeFile(join(SITE_DIR, 'collaboration.html'),
    await renderDoc('COLLABORATION.md', 'Working together', 'collaboration'), 'utf8');
await copyFile(join(ROOT, 'site-src/style.css'), join(SITE_DIR, 'style.css'));

// GitHub Pages runs Jekyll unless told not to, and Jekyll silently drops paths
// beginning with an underscore. Nothing here uses one yet; the cost of finding
// out the hard way later is a missing file with no error anywhere.
await writeFile(join(SITE_DIR, '.nojekyll'), '', 'utf8');

// The integration contract. Front matter only — the prose is for people, and a
// consuming application has no use for a Markdown blob it cannot render.
await writeFile(join(SITE_DIR, 'devices.json'), JSON.stringify({
    version: EXPORT_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    licence: 'CC0-1.0',
    count: devices.length,
    devices: devices.map(({ body, _path, _svg, ...record }) => record)
}, null, 2) + '\n', 'utf8');

// A separate export from devices.json: a driver author wants the wire format,
// not 150 rows of printer specifications, and the two change at different rates.
await writeFile(join(SITE_DIR, 'families.json'), JSON.stringify({
    version: EXPORT_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    licence: 'CC0-1.0',
    count: families.length,
    families: families.map(({ body, _path, ...record }) => record)
}, null, 2) + '\n', 'utf8');

// Companion mobile applications export
await writeFile(join(SITE_DIR, 'apps.json'), JSON.stringify({
    version: EXPORT_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    licence: 'CC0-1.0',
    count: apps.length,
    apps: apps.map(({ body, _path, ...record }) => record)
}, null, 2) + '\n', 'utf8');

console.log(`Built ${devices.length} device page(s), ${families.length} family page(s), and ${apps.length} app page(s) into site/.`);

/**
 * A repository document rendered as a site page.
 *
 * Its links are written for someone reading the file on GitHub, so they point at
 * other files in the repository. On the site those resolve to paths that were
 * never built — which is how `/CONTRIBUTING.md` came to 404. Every one is
 * rewritten: to its built page where one exists, and to GitHub where it does not.
 */
async function renderDoc(file, heading, active) {
    const source = await readFile(join(ROOT, file), 'utf8');
    const trimmed = source
        .replace(/^# .*\n/, '')                       // the chrome already says OpenTLP
        .replace(/^\*\*\[Browse the table.*$/m, '');  // we are on the site

    return page({
        title: `${heading} — OpenTLP`,
        description: DOC_DESCRIPTION[file],
        body: `<article class="prose">\n<h1>${escapeHtml(heading)}</h1>\n${
            rewriteRepoLinks(marked.parse(trimmed))}\n</article>`,
        active
    });
}

function rewriteRepoLinks(html) {
    return html.replace(/href="(?!https?:|#|\/)([^"]+)"/g, (match, target) => {
        const [path, hash] = target.split('#');
        if (DOC_PAGES[path]) return `href="${DOC_PAGES[path]}${hash ? '#' + hash : ''}"`;
        // Not built, so send the reader where the file actually is.
        return `href="${siteRepoFile(path)}"`;
    });
}
