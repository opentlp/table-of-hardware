/**
 * The software projects a device's `support` matrix may refer to.
 *
 * A closed list on purpose. If any slug were allowed, `niimblue` and `NiimBlue`
 * and `niim-blue` would all appear as separate columns, each half populated, and
 * the matrix would quietly stop being comparable across devices — which is the
 * one thing it exists to be.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HARDWARE_ROOT } from './load.mjs';

const raw = JSON.parse(await readFile(join(HARDWARE_ROOT, 'data/projects.json'), 'utf8'));

/** @type {Map<string, { name: string, url?: string, licence?: string }>} */
export const PROJECTS = new Map(
    Object.entries(raw).filter(([slug]) => !slug.startsWith('$'))
);

/** Display name for a slug, falling back to the slug itself for robustness. */
export const projectName = slug => PROJECTS.get(slug)?.name ?? slug;
