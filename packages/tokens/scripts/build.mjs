import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format } from 'prettier';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) =>
  JSON.parse(readFileSync(join(root, 'source', name + '.tokens.json'), 'utf8'));
const primitive = read('primitive');
const themes = { day: read('day'), 'red-eye': read('red-eye') };

function flatten(node, path = [], result = {}) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const next = [...path, key];
    if (value && typeof value === 'object' && '$value' in value)
      result[next.join('.')] = value.$value;
    else flatten(value, next, result);
  }
  return result;
}

export function compileTokens() {
  const result = {};
  for (const [theme, source] of Object.entries(themes)) {
    const raw = { ...flatten(primitive), ...flatten(source) };
    const resolve = (name, stack = []) => {
      if (!(name in raw)) throw new Error('Unknown token: ' + name);
      if (stack.includes(name)) throw new Error('Circular token: ' + [...stack, name].join(' -> '));
      const value = raw[name];
      return typeof value === 'string'
        ? value.replace(/\{([^{}]+)\}/g, (_, ref) => resolve(ref, [...stack, name]))
        : value;
    };
    result[theme] = Object.fromEntries(Object.keys(raw).map((key) => [key, resolve(key)]));
  }
  return result;
}

export function cssFrom(tokens) {
  const block = (selector, entries) =>
    selector +
    ' {\n' +
    Object.entries(entries)
      .map(([key, value]) => '  --gt-' + key.replaceAll('.', '-') + ': ' + value + ';')
      .join('\n') +
    '\n}\n';
  return (
    '/* Generated from source/*.tokens.json. Do not edit. */\n' +
    block(':root, [data-theme="day"]', tokens.day) +
    block('[data-theme="red-eye"]', tokens['red-eye']) +
    '[data-always-light] {\n  --gt-semantic-color-text: var(--gt-semantic-color-always-light-text);\n  --gt-semantic-color-text-secondary: var(--gt-semantic-color-always-light-text-secondary);\n}\n'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = compileTokens();
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(
    join(root, 'src', 'generated.ts'),
    await format(
      '// Generated from source/*.tokens.json. Do not edit.\nexport const tokens = ' +
        JSON.stringify(tokens, null, 2) +
        ' as const;\n',
      { parser: 'typescript', singleQuote: true, trailingComma: 'all', printWidth: 100 },
    ),
  );
  writeFileSync(join(root, 'dist', 'tokens.css'), cssFrom(tokens));
}
