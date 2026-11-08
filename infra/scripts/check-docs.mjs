// Keeps the documentation honest. Run with `pnpm docs:check` (CI runs it on every PR).
//
// It checks what a machine can check, so a person or an agent does not have to:
//   1. every relative link in a Markdown file points at a file that exists, and every #anchor at a heading that exists;
//   2. every backticked repository path (apps/…, packages/…, infra/…, .github/…) exists, unless it is listed as planned;
//   3. every doc under docs/ is reachable from the docs index (docs/README.md), every ADR from the ADR index, and
//      every doc is routed by the context map;
//   4. every variable in .env.example and every setting the API reads appears in docs/engineering/configuration.md;
//   5. every API path, database table, migration, catalog namespace is described in its owning doc;
//   6. docs/agents/current-state.md carries a valid "Last updated" date.
//
// It does not check that prose is true. Updating the owning doc when behaviour changes is still the author's job
// (docs/agents/playbook.md, "Which docs to update").
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);

const problems = [];
const problem = (file, message) => problems.push(`${file}: ${message}`);

// Paths that docs may mention before they exist (planned work). Remove an entry when the path is created.
const PLANNED_PATHS = new Set(['apps/web/e2e', 'apps/mcp', 'apps/mobile']);

// ---------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------
function listFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', '.next', 'dist'].includes(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else files.push(relative(root, full).split(sep).join('/'));
      }
    };
    walk(root);
    return files;
  }
}

const allFiles = listFiles()
  .filter((file) => existsSync(file))
  // The frozen design handoff and local experiment output are not our documentation.
  .filter((file) => !file.startsWith('design/reference/') && !file.startsWith('spikes/'));
const markdown = allFiles.filter((file) => file.endsWith('.md'));
const docsFiles = markdown.filter((file) => file.startsWith('docs/'));

const read = (file) => readFileSync(file, 'utf8');

// ---------------------------------------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------------------------------------
/** Removes fenced code blocks and inline code, which may contain link-looking text. */
function withoutCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
}

/** GitHub's heading slug: lower case, punctuation dropped, spaces to hyphens. */
function slug(heading) {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const seen = new Map();
  const anchors = new Set();
  for (const line of withoutCode(read(file)).split('\n')) {
    const match = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = slug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  anchorCache.set(file, anchors);
  return anchors;
}

// ---------------------------------------------------------------------------------------------------------
// 1. Links and anchors, and 2. repository paths
// ---------------------------------------------------------------------------------------------------------
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REPO_PATH = /`((?:apps|packages|infra|\.github)\/[A-Za-z0-9_.\-/()[\]]*[A-Za-z0-9_)\]/])`/g;

for (const file of markdown) {
  const text = withoutCode(read(file));

  for (const match of text.matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
    const [pathPart, anchorRaw] = target.split('#');
    let decoded;
    try {
      decoded = decodeURIComponent(pathPart ?? '');
    } catch {
      problem(file, `link "${target}" is not valid`);
      continue;
    }
    const resolved = decoded === '' ? file : normalize(posix.join(dirname(file), decoded));
    if (resolved.startsWith('..')) {
      problem(file, `link "${target}" leaves the repository`);
      continue;
    }
    if (!existsSync(resolved)) {
      problem(file, `link "${target}" points at a file that does not exist`);
      continue;
    }
    if (anchorRaw !== undefined && anchorRaw !== '' && resolved.endsWith('.md')) {
      const anchor = decodeURIComponent(anchorRaw).toLowerCase();
      if (!anchorsOf(resolved).has(anchor)) {
        problem(file, `link "${target}" points at a heading that does not exist in ${resolved}`);
      }
    }
  }

  // Paths in backticks: only those that start at a repository top-level folder, and only concrete ones.
  const prose = read(file).replace(/```[\s\S]*?```/g, '');
  for (const match of prose.matchAll(REPO_PATH)) {
    const path = match[1];
    if (/[*<>{}…]/.test(path)) continue;
    // Build output exists on one machine and not on another, so it cannot be checked.
    if (/(^|\/)(\.next|dist|node_modules|\.turbo|coverage|storybook-static)(\/|$)/.test(path))
      continue;
    const plain = path.replace(/\/$/, '');
    if (PLANNED_PATHS.has(plain) || [...PLANNED_PATHS].some((p) => plain.startsWith(`${p}/`)))
      continue;
    if (!existsSync(plain))
      problem(
        file,
        `mentions \`${path}\`, which does not exist (planned? add it to PLANNED_PATHS)`,
      );
  }
}

// ---------------------------------------------------------------------------------------------------------
// 3. Index, ADR index and context map
// ---------------------------------------------------------------------------------------------------------
function linkedFrom(file) {
  const set = new Set();
  for (const match of withoutCode(read(file)).matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    try {
      set.add(normalize(posix.join(dirname(file), decodeURIComponent(target.split('#')[0] ?? ''))));
    } catch {
      /* reported above */
    }
  }
  return set;
}

const docsIndex = 'docs/README.md';
const adrIndex = 'docs/architecture/adr/README.md';
const indexed = linkedFrom(docsIndex);
const adrIndexed = linkedFrom(adrIndex);
const isAdr = (file) => /^docs\/architecture\/adr\/\d{4}-.*\.md$/.test(file);

for (const file of docsFiles) {
  if (file === docsIndex) continue;
  if (isAdr(file)) {
    if (!adrIndexed.has(file)) problem(adrIndex, `does not list ${file}`);
    continue;
  }
  if (file === 'docs/architecture/adr/template.md' || file === adrIndex) continue;
  if (!indexed.has(file))
    problem(docsIndex, `does not link ${file} (every doc must be reachable from the index)`);
}
if (existsSync(adrIndex)) {
  const adrCount = docsFiles.filter(isAdr).length;
  if (!read(docsIndex).includes(`0001 to ${String(adrCount).padStart(4, '0')}`)) {
    problem(
      docsIndex,
      `the ADR range in the index should read "0001 to ${String(adrCount).padStart(4, '0')}"`,
    );
  }
}

// The context map must route to every doc, so an agent can find it by task type.
const contextMap = read('docs/agents/context-map.md');
for (const file of docsFiles) {
  if (isAdr(file) || file === 'docs/README.md' || file === 'docs/agents/context-map.md') continue;
  if (file === 'docs/architecture/adr/README.md' || file === 'docs/architecture/adr/template.md')
    continue;
  const short = file.replace(/^docs\//, '');
  if (!contextMap.includes(short))
    problem('docs/agents/context-map.md', `does not route to ${short}`);
}
for (const file of docsFiles.filter(isAdr)) {
  const number = /\/(\d{4})-/.exec(file)?.[1];
  if (number && !contextMap.includes(`ADR-${number}`)) {
    problem('docs/agents/context-map.md', `no task type mentions ADR-${number}`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// 4. Settings
// ---------------------------------------------------------------------------------------------------------
const configDoc = read('docs/engineering/configuration.md');
const documented = (name) => configDoc.includes(`\`${name}\``);

for (const line of read('.env.example').split('\n')) {
  const match = /^#?\s?([A-Z][A-Z0-9_]{2,})=/.exec(line);
  if (match && !documented(match[1])) {
    problem(
      'docs/engineering/configuration.md',
      `does not document ${match[1]} (from .env.example)`,
    );
  }
}
const apiConfig = read('apps/api/src/config.ts');
for (const match of apiConfig.matchAll(/^\s+([A-Z][A-Z0-9_]{3,}):\s/gm)) {
  if (!documented(match[1]))
    problem(
      'docs/engineering/configuration.md',
      `does not document ${match[1]} (read by apps/api/src/config.ts)`,
    );
}
for (const match of apiConfig.matchAll(/present\.([A-Z][A-Z0-9_]{3,})/g)) {
  if (!documented(match[1]))
    problem(
      'docs/engineering/configuration.md',
      `does not document ${match[1]} (read by apps/api/src/config.ts)`,
    );
}
if (!documented('API_INTERNAL_URL'))
  problem('docs/engineering/configuration.md', 'does not document API_INTERNAL_URL');

// ---------------------------------------------------------------------------------------------------------
// 5. Contract, schema, migrations, catalogs
// ---------------------------------------------------------------------------------------------------------
const apiDoc = read('docs/architecture/api-contracts.md');
const openapi = JSON.parse(read('packages/api-client/openapi.json'));
for (const [path, methods] of Object.entries(openapi.paths)) {
  const base = path.replace(/\/\{[^}]+\}.*$/, '');
  for (const [method, operation] of Object.entries(methods)) {
    const mentioned =
      apiDoc.includes(operation.operationId) || apiDoc.includes(path) || apiDoc.includes(base);
    if (!mentioned)
      problem(
        'docs/architecture/api-contracts.md',
        `does not describe ${method.toUpperCase()} ${path}`,
      );
    else if (!apiDoc.includes(operation.operationId)) {
      problem(
        'docs/architecture/api-contracts.md',
        `does not name the operation ${operation.operationId} (${method.toUpperCase()} ${path})`,
      );
    }
  }
}

const dataDoc = read('docs/architecture/data-model.md');
for (const file of allFiles.filter((f) => /^packages\/db\/src\/schema\/.*\.ts$/.test(f))) {
  for (const match of read(file).matchAll(/pgTable\(\s*'([a-z_]+)'/g)) {
    if (!dataDoc.includes(`\`${match[1]}\``))
      problem(
        'docs/architecture/data-model.md',
        `the schema reference does not list the table ${match[1]}`,
      );
  }
}
for (const file of allFiles.filter((f) => /^packages\/db\/migrations\/\d{4}_.*\.sql$/.test(f))) {
  const name = file
    .split('/')
    .pop()
    .replace(/\.sql$/, '');
  if (!dataDoc.includes(name))
    problem('docs/architecture/data-model.md', `does not mention the migration ${name}`);
}

const i18nDoc = read('docs/architecture/i18n.md');
const catalog = JSON.parse(read('packages/i18n/messages/en.json'));
for (const namespace of Object.keys(catalog)) {
  if (!i18nDoc.includes(`\`${namespace}\``))
    problem('docs/architecture/i18n.md', `the namespace table does not list \`${namespace}\``);
}

// ---------------------------------------------------------------------------------------------------------
// 6. Current state
// ---------------------------------------------------------------------------------------------------------
{
  const text = read('docs/agents/current-state.md');
  const match = /_Last updated: (\d{4}-\d{2}-\d{2})/.exec(text);
  if (!match) problem('docs/agents/current-state.md', 'needs a "_Last updated: YYYY-MM-DD" line');
  else {
    const date = new Date(`${match[1]}T00:00:00Z`);
    const today = new Date();
    if (Number.isNaN(date.getTime()))
      problem('docs/agents/current-state.md', `"Last updated" is not a date: ${match[1]}`);
    else if (date.getTime() > today.getTime() + 36 * 3600 * 1000)
      problem('docs/agents/current-state.md', `"Last updated" is in the future: ${match[1]}`);
  }
}

// Every doc starts with a level-one heading.
for (const file of markdown) {
  if (file.startsWith('.github/')) continue;
  const first = read(file)
    .split('\n')
    .find((line) => line.trim() !== '' && !line.startsWith('@'));
  if (!first || !/^# /.test(first)) problem(file, 'should start with a "# Title" heading');
}

// ---------------------------------------------------------------------------------------------------------
if (problems.length > 0) {
  console.error(`${problems.length} documentation problem(s):`);
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `Documentation OK: ${markdown.length} Markdown files, links, anchors, index, context map, settings, contract, schema and catalogs agree.`,
);
