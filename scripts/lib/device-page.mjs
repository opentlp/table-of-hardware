/**
 * One device page: front matter rendered as structured sections, then the
 * Markdown body underneath.
 *
 * The split matters. The generated sections are claims the schema governs and
 * the validator checks; the body is prose nobody can validate. Keeping them
 * visually distinct means a reader can tell which is which.
 */

import { marked } from 'marked';
import { escapeHtml, humanise, mono, page, specTable } from './html.mjs';
import { PROJECTS, projectName } from './projects.mjs';
import { editFile } from './site.mjs';

/**
 * Placeholder for a spec that should appear whether or not it is known.
 *
 * Omitting a missing field is right for the long tail — nobody wants a page of
 * blanks — but wrong for the handful of specs a reader came to check. If the
 * cutter row is simply absent, a reader cannot tell whether the machine has no
 * cutter or whether nobody wrote it down. Saying "not recorded" answers that,
 * and invites the fix.
 */
const unknown = '<span class="unrecorded">Not recorded</span>';

const STATUS_BLURB = {
    verified: 'Someone has printed from this device or captured its traffic.',
    reported: 'Second-hand account from a credible source.',
    unverified: 'Transcribed from a catalogue or inferred. Not confirmed against hardware.'
};

/** Titles for source kinds — `humanise` would give "Oss Project". */
const KIND_LABEL = {
    'vendor-doc': 'Vendor doc',
    'protocol-capture': 'Protocol capture',
    'oss-project': 'OSS project',
    'user-report': 'User report',
    'retailer-listing': 'Retailer listing',
    catalogue: 'Catalogue'
};

const SUPPORT_BLURB = {
    listed: 'Named by the project; successful output is not confirmed here.',
    works: 'Prints successfully.',
    partial: 'Prints, but something is missing or wrong.',
    broken: 'Recognised, but does not print.',
    planned: 'Announced or in progress.',
    none: 'Not supported.'
};

/** @param {{ device: any, body: string, byId: Map<string, any> }} input */
export function renderDevicePage({ device, body, byId, families = new Set(), apps = new Map() }) {
    const title = `${device.brand} ${device.model}`;
    const sections = [
        `<article class="device">`,
        `<h1>${escapeHtml(title)}</h1>`,
        device.summary ? `<p class="summary">${escapeHtml(device.summary)}</p>` : '',
        artwork(device),
        statusBanner(device),
        identity(device, byId),
        printSpecs(device.print),
        mechanism(device.mechanism, device.print?.dpi),
        protocol(device.protocol, families, apps),
        connectivity(device.connectivity),
        indicators(device.indicators),
        reports(device.reports),
        hardware(device),
        supportMatrix(device.support),
        body ? `<div class="prose">\n${marked.parse(body)}\n</div>` : '',
        documentation(device.documentation),
        sources(device.sources),
        `<p class="edit"><a href="${escapeHtml(editFile(device._path))}">Improve this page</a></p>`,
        `</article>`
    ];

    return page({
        title: `${title} — OpenTLP`,
        description: device.summary ?? `${title} thermal label printer: protocol, specifications and software support.`,
        body: sections.filter(Boolean).join('\n')
    });
}

/**
 * Inlined rather than linked so a colourway can reach it: the custom properties
 * a swatch sets on the stage cascade into the drawing, which they could not do
 * through an `<img>`. The markup was stripped on an allowlist during the build.
 */
function artwork(device) {
    if (!device._svg) return '';
    const credit = [
        device.artwork.credit && escapeHtml(device.artwork.credit),
        device.artwork.licence && `<span class="licence">${escapeHtml(device.artwork.licence)}</span>`
    ].filter(Boolean).join(' · ');

    return `<figure class="artwork">
<div class="art-stage" id="art-${escapeHtml(device.id)}">
${device._svg}
</div>
${colourways(device)}
${lamps(device.artwork, device.indicators)}
${animations(device.artwork)}
${credit ? `<figcaption>${credit}</figcaption>` : ''}
</figure>`;
}

/**
 * Colourway swatches.
 *
 * Whole pairings, not two independent colour pickers — shell and cutter are
 * moulded separately but only ship in certain combinations, and offering the
 * cross product would depict products that do not exist.
 *
 * Each swatch carries its properties as a style string, applied to the stage on
 * click. Without scripts the swatches still show which colours exist, which is
 * most of the information.
 */
function colourways(device) {
    const variants = device.artwork.variants;
    if (!variants?.length) return '';

    const buttons = variants.map((variant, index) => {
        const style = Object.entries(variant.colours)
            .map(([name, value]) => `--${name}:${value}`).join(';');
        const swatch = Object.values(variant.colours)
            .map(value => `<span style="background:${escapeHtml(value)}"></span>`).join('');
        return `<button type="button" class="swatch${index === 0 ? ' is-on' : ''}"
 data-style="${escapeHtml(style)}" title="${escapeHtml(variant.label)}">
${swatch}<span class="visually-hidden">${escapeHtml(variant.label)}</span></button>`;
    }).join('\n');

    return `<div class="colourways" data-stage="art-${escapeHtml(device.id)}">
<span class="visually-hidden">Colourways</span>
${buttons}
</div>
<script>${COLOURWAY_SCRIPT}</script>`;
}

const COLOURWAY_SCRIPT = `
(function () {
  document.querySelectorAll('.colourways').forEach(function (group) {
    var stage = document.getElementById(group.dataset.stage);
    if (!stage) return;
    function apply(button) {
      stage.setAttribute('style', button.dataset.style);
      group.querySelectorAll('.swatch').forEach(function (other) {
        other.classList.toggle('is-on', other === button);
      });
    }
    var first = group.querySelector('.swatch');
    if (first) apply(first);
    group.addEventListener('click', function (event) {
      var button = event.target.closest('.swatch');
      if (button) apply(button);
    });
  });
})();
`;

/**
 * Controls that light the drawing.
 *
 * `artwork.lamps` says what colour to draw for a state; `indicators` says what
 * that state means. Joining them here is why they are worth keeping apart in the
 * data: the drawing can be redrawn without touching the documentation, and the
 * documentation is useful on a device with no drawing at all.
 */
function lamps(artwork, indicators) {
    const lamp = artwork.lamps?.[0];
    const property = lamp && artwork.hooks?.[lamp.hook]?.property;
    if (!property) return '';

    const meaning = new Map((indicators ?? [])
        .flatMap(indicator => indicator.states)
        .filter(state => state.colour)
        .map(state => [state.colour, state.means]));

    const off = `<button type="button" class="lampbtn is-on" data-property="${escapeHtml(property)}"
 data-value="${escapeHtml(lamp.unlit)}" title="Unlit"><span class="lamp" style="--lamp:${escapeHtml(lamp.unlit)}"></span></button>`;

    const buttons = Object.entries(lamp.states).map(([state, hex]) =>
        `<button type="button" class="lampbtn" data-property="${escapeHtml(property)}"
 data-value="${escapeHtml(hex)}" title="${escapeHtml(meaning.get(state) ?? humanise(state))}"><span
 class="lamp" style="--lamp:${escapeHtml(hex)}"></span></button>`).join('\n');

    return `<div class="lampbtns">
<span class="visually-hidden">Indicator states</span>
${off}
${buttons}
</div>
<script>${LAMP_SCRIPT}</script>`;
}

const LAMP_SCRIPT = `
(function () {
  var group = document.querySelector('.lampbtns');
  var stage = document.querySelector('.art-stage');
  if (!group || !stage) return;
  group.addEventListener('click', function (event) {
    var button = event.target.closest('.lampbtn');
    if (!button) return;
    stage.style.setProperty(button.dataset.property, button.dataset.value);
    group.querySelectorAll('.lampbtn').forEach(function (other) {
      other.classList.toggle('is-on', other === button);
    });
  });
})();
`;

/**
 * Controls that move the drawing.
 *
 * Movement belongs here rather than in the mechanism table: how far a lever
 * travels is not a specification anybody looks up, it is what a picture needs in
 * order to move correctly.
 *
 * An animation names a part; `artwork.hooks` says which custom property drives
 * that part and how many user units make a millimetre. Neither half asserts
 * anything about the other, so a drawing with no hook for a part simply gets no
 * button, and a part with no animation simply never moves.
 */
function animations(artwork) {
    const list = artwork.animations;
    if (!list?.length) return '';

    const actions = list.filter(action => artwork.hooks?.[action.part]?.property);
    if (!actions.length) return '';

    const buttons = actions.map(action => `<button type="button" class="action"
 data-property="${escapeHtml(artwork.hooks[action.part].property)}"
 data-mm="${escapeHtml(action.travel_mm)}"
 data-duration="${escapeHtml(action.duration_ms ?? 600)}"
 data-rest="${action.returns_to_rest === false ? 'false' : 'true'}">${escapeHtml(action.label)}${
        action.duration_ms ? ` <span class="muted">${action.duration_ms} ms</span>` : ''}</button>`).join('\n');

    return `<div class="actions">${buttons}</div>
<script>${ACTION_SCRIPT}</script>`;
}

/**
 * Out, hold, back — the shape of a gesture.
 *
 * The drawing carries its own transition, so setting the property is enough to
 * start the movement; this only has to decide when to send it home. Held for a
 * fraction of the nominal duration so the extreme is visible rather than
 * instantaneous.
 */
const ACTION_SCRIPT = `
(function () {
  var stage = document.querySelector('.art-stage');
  if (!stage) return;
  document.querySelectorAll('.action').forEach(function (button) {
    button.addEventListener('click', function () {
      var property = button.dataset.property;
      stage.style.setProperty(property, button.dataset.mm);
      if (button.dataset.rest !== 'false') {
        setTimeout(function () {
          stage.style.setProperty(property, '0');
        }, Number(button.dataset.duration) * 0.6);
      }
    });
  });
})();
`;

function statusBanner(device) {
    const status = device.status ?? 'unverified';
    return `<p class="status status-${status}"><strong>${humanise(status)}.</strong> ${escapeHtml(STATUS_BLURB[status])}</p>`;
}

function identity(device, byId) {
    const rows = [['Brand', escapeHtml(device.brand)], ['Model', escapeHtml(device.model)]];

    if (device.manufacturer) rows.push(['Manufacturer', escapeHtml(device.manufacturer)]);
    if (device.aliases?.length) rows.push(['Also sold as', device.aliases.map(escapeHtml).join(', ')]);

    if (device.rebadge_of) {
        const original = byId.get(device.rebadge_of);
        const label = original ? `${original.brand} ${original.model}` : device.rebadge_of;
        rows.push(['Rebadge of', `<a href="${escapeHtml(device.rebadge_of)}.html">${escapeHtml(label)}</a>`]);
    }

    // The reverse direction is not in the data — it is derived here, because a
    // reader on the original's page wants to know what else is the same machine.
    const rebadges = [...byId.values()].filter(d => d.rebadge_of === device.id);
    if (rebadges.length) {
        rows.push(['Also sold as', rebadges
            .map(d => `<a href="${escapeHtml(d.id)}.html">${escapeHtml(`${d.brand} ${d.model}`)}</a>`)
            .join(', ')]);
    }

    rows.push(['OpenTLP id', mono(device.id)]);
    return section('Identity', specTable(rows));
}

function printSpecs(print) {
    if (!print) return '';
    const width = print.width_dots && print.width_mm
        ? `${print.width_dots} dots (${print.width_mm} mm)`
        : print.width_dots ? `${print.width_dots} dots`
        : print.width_mm ? `${print.width_mm} mm` : '';

    return section('Printing', specTable([
        ['Printable width', escapeHtml(width)],
        ['Media width', print.media_width_mm ? `${escapeHtml(print.media_width_mm)} mm` : ''],
        ['Resolution', print.dpi ? `${print.dpi} dpi (${(print.dpi / 25.4).toFixed(0)} dots/mm)` : ''],
        ['Media', print.media?.map(humanise).map(escapeHtml).join(', ')],
        ['Colour', print.colour ? escapeHtml(humanise(print.colour)) : '']
    ]));
}

const DRM_LABEL = {
    none: 'None',
    circumventable: 'Checked; third-party stock accepted',
    strict: 'Enforced; vendor consumables only',
    unknown: 'Unknown'
};

/**
 * Always rendered, even for a device with no mechanism recorded at all.
 *
 * An early return here would drop the whole section, and a reader would have no
 * way to tell a printer with nothing recorded from one where the question was
 * never asked. Six rows of "Not recorded" is the honest answer and shows exactly
 * what a contributor could fill in.
 */
function mechanism(mechanism = {}, dpi) {
    const widths = mechanism.media_widths_mm;
    const widthText = typeof widths === 'number' ? `${widths} mm`
        : widths ? `${widths.min}–${widths.max} mm` : '';

    // Millimetres alongside dots, because a reader thinks in millimetres and a
    // driver feeds in dots. Derived, so it cannot disagree with the dot figure.
    const headToCutter = mechanism.head_to_cutter_dots === undefined ? unknown
        : dpi
            ? `${mechanism.head_to_cutter_dots} dots <span class="muted">(${((mechanism.head_to_cutter_dots / dpi) * 25.4).toFixed(1)} mm)</span>`
            : `${mechanism.head_to_cutter_dots} dots`;

    return section('Mechanism', specTable([
        ['Cutter', mechanism.cutter === undefined ? unknown : mechanism.cutter ? 'Yes' : 'No'],
        ['Head to cutter', headToCutter],
        ['Backfeed', mechanism.backfeed === undefined ? unknown
            : mechanism.backfeed ? 'Yes' : 'No'],
        ['Paper DRM', mechanism.paper_drm ? escapeHtml(DRM_LABEL[mechanism.paper_drm] ?? mechanism.paper_drm) : unknown],
        ['Print speed', mechanism.print_speed_mm_s ? `${mechanism.print_speed_mm_s} mm/s` : unknown],
        ['Accepted media', escapeHtml(widthText) || unknown]
    ]));
}

const REPORT_LABEL = {
    battery: 'Battery level',
    charging: 'Charging state',
    'device-name': 'Device name',
    'serial-number': 'Serial number',
    'firmware-version': 'Firmware version',
    'hardware-version': 'Hardware version',
    media: 'Loaded media',
    faults: 'Faults'
};

function reports(reports) {
    if (!reports?.length) return '';
    return section('Status reporting',
        `<p class="lede">Fields the printer returns over its status channel.</p>
<ul class="tags">${reports.map(field =>
            `<li>${escapeHtml(REPORT_LABEL[field] ?? humanise(field))}</li>`).join('')}</ul>`);
}

/**
 * Lights, and what they mean.
 *
 * Colours are shown as themselves rather than named, because "green" covers a
 * range and a reader is matching against the light in front of them. Flashing is
 * rendered distinctly from steady for the same reason: on most of these machines
 * the two mean different things on the same colour.
 */
function indicators(indicators) {
    if (!indicators?.length) return '';

    const blocks = indicators.map(indicator => {
        const rows = indicator.states.map(state => {
            const pattern = state.pattern ?? 'steady';
            const swatch = state.hex
                ? `<span class="lamp lamp-${escapeHtml(pattern)}" style="--lamp:${escapeHtml(state.hex)}"></span>`
                : '';
            const name = [state.colour && humanise(state.colour), pattern !== 'steady' && pattern]
                .filter(Boolean).join(', ');
            return `<tr>
<th scope="row">${swatch}${escapeHtml(name)}</th>
<td>${escapeHtml(state.means)}</td>
</tr>`;
        }).join('\n');

        const heading = indicators.length > 1 || indicator.label
            ? `<h3>${escapeHtml(indicator.label ?? humanise(indicator.id))}</h3>` : '';

        // Stated because it constrains what software may draw: one emitter shows
        // one colour, so blending two would depict a part that does not exist.
        const kind = indicator.kind === 'smd-single-colour'
            ? '<p class="lede">A single-colour emitter: one state at a time.</p>'
            : '';

        return `${heading}${kind}<table class="matrix lamps"><tbody>
${rows}
</tbody></table>`;
    }).join('\n');

    return section('Indicators', blocks);
}

function hardware(device) {
    const hw = device.hardware;
    const power = device.power;
    const size = hw?.dimensions_mm;

    const battery = power?.mains_only ? 'None — mains powered'
        : [power?.battery_mah && `${power.battery_mah} mAh`, power?.battery_cell]
            .filter(Boolean).map(escapeHtml).join(', ');

    // FCC filings get their own row whether or not one is recorded: the public
    // record behind an id — internal photographs, block diagrams, the manual —
    // is often the only primary documentation a cheap printer has, so a missing
    // one is a specific, actionable gap rather than a detail.
    const fcc = (hw?.certification ?? []).filter(cert => cert.authority === 'fcc');
    const others = (hw?.certification ?? []).filter(cert => cert.authority !== 'fcc');

    return section('Hardware', specTable([
        ['FCC ID', fcc.length ? fcc.map(certLink).join('<br>') : unknown],
        ['Other certification', others.length ? others.map(certLink).join('<br>') : ''],
        ['MCU', hw?.mcu ? mono(hw.mcu) : unknown],
        ['Battery', battery || unknown],
        ['Connector', power?.connector ? escapeHtml(humanise(power.connector).replace('Usb', 'USB')) : unknown],
        ['Dimensions', size ? `${size.width} × ${size.height} × ${size.depth} mm` : unknown],
        ['Weight', hw?.weight_g ? `${hw.weight_g} g` : unknown]
    ]));
}

function certLink(cert) {
    const label = escapeHtml(`${cert.authority.toUpperCase()} ${cert.id}`);
    const link = cert.url ? `<a href="${escapeHtml(cert.url)}">${label}</a>` : label;
    return cert.holder ? `${link} <span class="muted">${escapeHtml(cert.holder)}</span>` : link;
}

function protocol(protocol, families, apps) {
    if (!protocol) return '';
    let appLink = '';
    if (protocol.app) {
        const appSlug = protocol.app.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (apps?.has(appSlug)) {
            appLink = `<a href="${escapeHtml(appSlug)}.html">${escapeHtml(protocol.app)}</a>`;
        } else if (apps?.has(protocol.app)) {
            appLink = `<a href="${escapeHtml(apps.get(protocol.app).id)}.html">${escapeHtml(protocol.app)}</a>`;
        } else {
            appLink = escapeHtml(protocol.app);
        }
    }
    return section('Protocol', specTable([
        // Linked only where the family has a page. Linking unconditionally is
        // how fourteen device pages came to point at a file nobody had written.
        ['Family', !protocol.family ? unknown
            : families.has(protocol.family)
                ? `<a href="${escapeHtml(protocol.family)}.html">${mono(protocol.family)}</a>`
                : mono(protocol.family)],
        ['Variant', protocol.variant ? mono(protocol.variant) : ''],
        ['Packet prefix', protocol.packet_prefix ? mono(protocol.packet_prefix) : ''],
        ['Companion app', appLink],
        ['Vendor app', protocol.vendor_app ? mono(protocol.vendor_app) : '']
    ]));
}

function connectivity(connectivity) {
    if (!connectivity) return '';
    const { ble, usb, wifi, serial } = connectivity;
    const blocks = [];

    if (ble) {
        blocks.push(`<h3>Bluetooth LE</h3>` + specTable([
            // An inferred pattern is shown as what it is. Without this a
            // model number transcribed from a catalogue reads exactly like a
            // name somebody watched a printer broadcast.
            ['Advertises as', !ble.name_pattern ? unknown
                : ble.name_examples?.length
                    ? mono(ble.name_pattern)
                    : `${mono(ble.name_pattern)} <span class="unrecorded">inferred from the model number, not observed</span>`],
            ['Seen as', ble.name_examples?.map(mono).join(' ')],
            ['Service', ble.service_uuid ? mono(ble.service_uuid) : ''],
            ['Write', ble.write_uuid ? mono(ble.write_uuid) : ''],
            ['Notify', ble.notify_uuid ? mono(ble.notify_uuid) : '']
        ]));
    }
    if (usb) {
        blocks.push(`<h3>USB</h3>` + specTable([
            ['Vendor id', usb.vid ? mono(`0x${usb.vid}`) : ''],
            ['Product id', usb.pid ? mono(`0x${usb.pid}`) : ''],
            ['Class', usb.class ? escapeHtml(humanise(usb.class)) : '']
        ]));
    }
    const others = [wifi && 'Wi-Fi', serial && 'Serial'].filter(Boolean);
    if (others.length) blocks.push(`<h3>Other</h3><p>${others.join(', ')}</p>`);

    return section('Connectivity', blocks.join('\n'));
}

function supportMatrix(support) {
    const entries = Object.entries(support ?? {});
    if (!entries.length) {
        return section('Software support', `<p class="empty">${unknown}</p>`);
    }

    const rows = entries
        .sort(([a], [b]) => projectName(a).localeCompare(projectName(b)))
        .map(([slug, entry]) => {
            const project = PROJECTS.get(slug);
            const label = escapeHtml(projectName(slug));
            return `<tr>
<th scope="row">${project?.url ? `<a href="${escapeHtml(project.url)}">${label}</a>` : label}</th>
<td><span class="level level-${escapeHtml(entry.level)}">${escapeHtml(humanise(entry.level))}</span></td>
<td>${[
                entry.notes && escapeHtml(entry.notes),
                entry.driver && `Driver: ${mono(entry.driver)}`,
                entry.since && `Since ${escapeHtml(entry.since)}`
            ].filter(Boolean).join('<br>') || `<span class="muted">${escapeHtml(SUPPORT_BLURB[entry.level] ?? '')}</span>`}</td>
</tr>`;
        }).join('\n');

    return section('Software support', `<table class="matrix"><tbody>
${rows}\n</tbody></table>`);
}

function documentation(links) {
    if (!links?.length) return '';
    const items = links.map(link => {
        const covers = link.covers?.length ? ` <span class="muted">— ${link.covers.map(escapeHtml).join(', ')}</span>` : '';
        const licence = link.licence ? ` <span class="licence">${escapeHtml(link.licence)}</span>` : '';
        return `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.title ?? link.url)}</a>${covers}${licence}</li>`;
    }).join('\n');

    return section('Further documentation',
        `<ul class="links">\n${items}\n</ul>`);
}

function sources(sources) {
    if (!sources?.length) return '';
    const items = sources.map(source => {
        // The kind already appears as a badge, so an untitled source shows the
        // badge and its note rather than the kind twice.
        const label = source.title ?? source.url;
        const link = !label ? ''
            : source.url ? `<a href="${escapeHtml(source.url)}">${escapeHtml(label)}</a>`
            : escapeHtml(label);
        return `<li>
<span class="kind kind-${escapeHtml(source.kind)}">${escapeHtml(KIND_LABEL[source.kind] ?? humanise(source.kind))}</span>
${link}
${source.licence ? `<span class="licence">${escapeHtml(source.licence)}</span>` : ''}
${source.note ? `<p class="note">${escapeHtml(source.note)}</p>` : ''}
${source.covers?.length ? `<p class="note">Supports: ${source.covers.map(escapeHtml).join(', ')}</p>` : ''}
${source.retrieved ? `<p class="note">Retrieved ${escapeHtml(source.retrieved)}</p>` : ''}
</li>`;
    }).join('\n');

    return section('Sources', `<ul class="sources">\n${items}\n</ul>`);
}

const section = (heading, content) =>
    content ? `<section><h2>${escapeHtml(heading)}</h2>\n${content}\n</section>` : '';
