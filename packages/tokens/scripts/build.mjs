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
      if (typeof value === 'string')
        return value.replace(/\{([^{}]+)\}/g, (_, ref) => resolve(ref, [...stack, name]));
      if (Array.isArray(value))
        return value
          .map((family) => (family.includes(' ') ? JSON.stringify(family) : family))
          .join(', ');
      if (value && typeof value === 'object' && value.colorSpace === 'srgb') {
        if (typeof value.hex !== 'string') throw new Error('Missing sRGB hex fallback: ' + name);
        const alpha =
          value.alpha === undefined
            ? ''
            : Math.round(value.alpha * 255)
                .toString(16)
                .padStart(2, '0')
                .toUpperCase();
        return value.hex + alpha;
      }
      if (value && typeof value === 'object' && 'unit' in value && 'value' in value)
        return String(value.value) + value.unit;
      if (value && typeof value === 'object' && 'offsetX' in value) {
        const dim = (part) => String(part.value) + part.unit;
        const color = value.color.replace(/\{([^{}]+)\}/g, (_, ref) =>
          resolve(ref, [...stack, name]),
        );
        return [
          dim(value.offsetX),
          dim(value.offsetY),
          dim(value.blur),
          dim(value.spread),
          color,
        ].join(' ');
      }
      return value;
    };
    const values = Object.fromEntries(Object.keys(raw).map((key) => [key, resolve(key)]));
    for (const size of ['hero', 'section', 'page', 'answer', 'app-page', 'app-money-hero']) {
      const base = 'primitive.type.' + size;
      values[base] =
        'clamp(' +
        values[base + '.min'] +
        ', ' +
        values[base + '.viewport-percent'] +
        'vw, ' +
        values[base + '.max'] +
        ')';
    }
    for (const key of Object.keys(values)) {
      if (key.endsWith('-tracking')) values[key] = values[key] + 'em';
      if (key.endsWith('-stretch') || key === 'primitive.radius.circle')
        values[key] = values[key] * 100 + '%';
    }
    result[theme] = values;
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
    '[data-always-light] {\n  --gt-semantic-color-text: var(--gt-semantic-color-always-light-text);\n  --gt-semantic-color-text-secondary: var(--gt-semantic-color-always-light-text-secondary);\n  --gt-semantic-color-text-tertiary: var(--gt-semantic-color-always-light-text-tertiary);\n}\n'
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
  for (const [theme, source] of Object.entries(themes)) {
    writeFileSync(
      join(root, 'dist', theme + '.tokens.json'),
      JSON.stringify({ ...primitive, ...source }, null, 2) + '\n',
    );
  }
}
