/**
 * Where this site lives, and where its source does.
 *
 * One place, because these strings otherwise scatter across the generator and
 * the first move breaks a link nobody notices. Read from `data/site.json` so
 * changing the host is a data edit rather than a code one.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './load.mjs';

const config = JSON.parse(await readFile(join(ROOT, 'data/site.json'), 'utf8'));

/** Public base URL, without a trailing slash. */
export const SITE_URL = config.url.replace(/\/+$/, '');

const REPO = `https://github.com/${config.owner}/${config.repo}`;
const SOURCE_REPO = `https://github.com/${config.source_owner}/${config.source_repo}`;
const SOURCE_PREFIX = config.source_path.replace(/^\/+|\/+$/g, '');

/** A file in the repository, for reading. */
export const repoFile = path => `${SOURCE_REPO}/blob/${config.source_branch}/${SOURCE_PREFIX}/${path}`;

/** A file belonging to this presentation repository. */
export const siteRepoFile = path => `${REPO}/blob/${config.branch}/${path}`;

/** A file in the repository, opened in GitHub's editor. */
export const editFile = path => `${SOURCE_REPO}/edit/${config.source_branch}/${SOURCE_PREFIX}/${path}`;

/** The repository itself. */
export const REPO_URL = REPO;
export const HARDWARE_REPO_URL = `${SOURCE_REPO}/tree/${config.source_branch}/${SOURCE_PREFIX}`;

/** Project links, kept beside the deployment coordinates so the site chrome
 * does not scatter organization-specific URLs across renderers. */
export const ORGANIZATION_URL = config.organization_url;
export const DISCORD_URL = config.discord_url;
export const STUDIO_URL = config.studio_url;
export const STUDIO_REPO_URL = config.studio_repo_url;
export const CORE_URL = config.core_url;
