import { compileTokens } from './build.mjs';

const pairs = [
  ['text', 'surface-page'],
  ['text-secondary', 'surface-page'],
  ['text-tertiary', 'surface-page'],
  ['text', 'surface-page-alt'],
  ['text-secondary', 'surface-page-alt'],
  ['text-tertiary', 'surface-page-alt'],
  ['text', 'surface-card'],
  ['text-secondary', 'surface-card'],
  ['text-tertiary', 'surface-card'],
  ['text', 'surface-nested'],
  ['text-secondary', 'surface-nested'],
  ['text-tertiary', 'surface-nested'],
  ['confirmed', 'surface-card'],
  ['estimate', 'surface-card'],
  ['danger', 'surface-card'],
  ['rail-title', 'rail-surface'],
  ['always-light-text', 'always-light-surface'],
  ['always-light-text-secondary', 'always-light-surface'],
  ['always-light-text-tertiary', 'always-light-surface'],
];
function luminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Expected opaque hex color: ' + hex);
  const rgb = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export function contrastReport() {
  const tokens = compileTokens();
  return Object.entries(tokens).flatMap(([theme, values]) => {
    const checks = pairs.map(([fg, bg]) => {
      const ratio = contrastRatio(values['semantic.color.' + fg], values['semantic.color.' + bg]);
      return { theme, fg, bg, ratio, pass: ratio >= 4.5 };
    });
    const fg = theme === 'day' ? 'white' : 'ink';
    const ratio = contrastRatio(values['primitive.color.' + fg], values['semantic.color.danger']);
    checks.push({ theme, fg: 'thread-button-' + fg, bg: 'danger', ratio, pass: ratio >= 4.5 });
    const largeThread = contrastRatio(
      values['semantic.color.thread-ink'],
      values['semantic.color.thread'],
    );
    checks.push({
      theme,
      fg: 'large-thread-ink',
      bg: 'thread',
      ratio: largeThread,
      pass: largeThread >= 3,
    });
    const paidRatio = contrastRatio(
      values['primitive.color.ink'],
      values['semantic.color.marigold'],
    );
    checks.push({
      theme,
      fg: 'paid-ink',
      bg: 'marigold',
      ratio: paidRatio,
      pass: paidRatio >= 4.5,
    });
    return checks;
  });
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const report = contrastReport();
  for (const item of report)
    console.log(
      item.theme +
        ' ' +
        item.fg +
        '/' +
        item.bg +
        ': ' +
        item.ratio.toFixed(2) +
        (item.pass ? ' PASS' : ' FAIL'),
    );
  if (report.some((item) => !item.pass)) process.exitCode = 1;
}
