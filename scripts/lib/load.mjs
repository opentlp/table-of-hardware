/**
 * Reading the monorepo hardware package off disk.
 *
 * A device is a Markdown page with YAML front matter. The front matter is the
 * structured record — it feeds the table and the JSON export, and the schema
 * governs it. The body is the wiki: prose, quirks, teardown notes, anything a
 * field cannot hold.
 *
 * This is OpenWrt's arrangement, where a `dataentry` block sits inside an
 * otherwise ordinary wiki page. Everything downstream starts here, so this is
 * the one place that knows the on-disk layout.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const HARDWARE_ROOT = resolve(
    process.env.OPENTLP_HARDWARE_ROOT ||
    (existsSync(join(ROOT, '..', 'opentlp', 'packages', 'hardware'))
        ? join(ROOT, '..', 'opentlp', 'packages', 'hardware')
        : join(ROOT, '..', 'BleWebler2', 'packages', 'hardware'))
);
export const DEVICES_DIR = join(HARDWARE_ROOT, 'devices');
export const FAMILIES_DIR = join(HARDWARE_ROOT, 'families');
export const APPS_DIR = join(HARDWARE_ROOT, 'apps');
export const SITE_DIR = join(ROOT, 'site');

/** @typedef {{ path: string, device: any, body: string }} LoadedDevice */

/**
 * Every device page, sorted by path so output is reproducible.
 *
 * A malformed page is reported against its file and the load continues, so one
 * bad contribution surfaces every problem in a run rather than only the first.
 *
 * @returns {Promise<{ devices: LoadedDevice[], errors: string[] }>}
 */
export async function loadDevices() {
    return loadPages(DEVICES_DIR);
}

/**
 * Every protocol family page.
 *
 * Same page format as a device — front matter plus prose — because a family is
 * the same kind of document: structured claims a driver author can act on, with
 * the narrative that does not fit a field underneath.
 *
 * @returns {Promise<{ devices: LoadedDevice[], errors: string[] }>}
 */
export async function loadFamilies() {
    return loadPages(FAMILIES_DIR);
}

/**
 * Every companion mobile app page.
 *
 * @returns {Promise<{ devices: LoadedDevice[], errors: string[] }>}
 */
export async function loadApps() {
    return loadPages(APPS_DIR);
}

async function loadPages(root) {
    /** @type {LoadedDevice[]} */
    const devices = [];
    /** @type {string[]} */
    const errors = [];

    for (const file of await walk(root)) {
        if (!file.endsWith('.md')) continue;
        const where = relative(HARDWARE_ROOT, file).replaceAll('\\', '/');
        const raw = await readFile(file, 'utf8');

        const split = splitFrontMatter(raw);
        if (!split) {
            errors.push(`${where}: no YAML front matter — the page must open with a --- fenced block`);
            continue;
        }

        try {
            const device = parse(split.frontMatter);
            if (device === null || typeof device !== 'object') {
                errors.push(`${where}: front matter is empty or is not a mapping`);
                continue;
            }
            devices.push({ path: where, device, body: split.body });
        } catch (error) {
            errors.push(`${where}: front matter — ${error.message.split('\n')[0]}`);
        }
    }

    devices.sort((a, b) => a.path.localeCompare(b.path));
    return { devices, errors };
}

/**
 * Split `---\n…\n---\n` from the top of a page.
 *
 * Only a leading fence counts. A `---` further down is a horizontal rule and
 * belongs to the prose.
 */
function splitFrontMatter(raw) {
    const text = raw.replace(/^﻿/, '');
    const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!match) return null;
    return { frontMatter: match[1], body: text.slice(match[0].length).trim() };
}

async function walk(dir) {
    /** @type {string[]} */
    const found = [];
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return found;
        throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...await walk(full));
        else found.push(full);
    }
    return found;
}

/**
 * Determines whether a hardware device record matches a companion mobile app.
 *
 * Disambiguates multi-device applications (e.g. Pocket Printer) and respects
 * explicit `protocol.app` and `protocol.vendor_app` declarations on devices so
 * that models are not greedily captured across manufacturers sharing a wire protocol.
 *
 * @param {any} device
 * @param {any} app
 * @returns {boolean}
 */
export function deviceMatchesApp(device, app) {
    if (!device || !app) return false;

    // 1. Explicit app name or alias match
    if (device.protocol?.app) {
        const a = device.protocol.app.toLowerCase();
        if (a === app.name.toLowerCase() ||
            a.replace(/[^a-z0-9]+/g, '-') === app.id ||
            (app.replaces_apps && app.replaces_apps.some(r => r.toLowerCase() === a)) ||
            (device.protocol.replaces_apps && device.protocol.replaces_apps.some(r =>
                r.toLowerCase() === app.name.toLowerCase() ||
                (app.replaces_apps && app.replaces_apps.some(ar => ar.toLowerCase() === r.toLowerCase()))
            ))) {
            return true;
        }
        return false;
    }

    // 2. Explicit Android vendor package match
    if (device.protocol?.vendor_app && app.platforms?.android?.package) {
        if (device.protocol.vendor_app === app.platforms.android.package) {
            return true;
        }
        return false;
    }

    // 3. Brand name match (e.g. Phomemo brand -> Phomemo app)
    if (device.brand && device.brand.toLowerCase() === app.name.toLowerCase()) {
        if (app.protocols && device.protocol?.family && app.protocols.includes(device.protocol.family)) {
            return true;
        }
    }

    // 4. Fallback for single-device protocol families
    if (!app.is_multi_device && app.protocols && device.protocol?.family && app.protocols.includes(device.protocol.family)) {
        return true;
    }

    return false;
}
