/**
 * Signal detection helpers for AI Signal Clarity.
 */

export const AMBIGUOUS_NAME_PATTERNS = [
  /^[a-z]$/, // single letter: a, b, x, y
  /^(tmp|temp|data|obj|val|res|ret|result|item|elem|thing|stuff|info|misc|util|helper|handler|cb|fn|func)$/i,
  /^[a-z]\d+$/, // x1, x2, n3
];

export const MAGIC_LITERAL_IGNORE = new Set([0, 1, -1, 2, 10, 100, 1000, 1024]);
export const MAGIC_STRING_IGNORE = new Set([
  '',
  ' ',
  '\n',
  '\t',
  'utf8',
  'utf-8',
  'hex',
  'base64',
  'true',
  'false',
  'null',
  'undefined',
  'node',
  'production',
  'development',
  'test',
  'error',
  'warn',
  'info',
  'debug',
  'main',
  'module',
  'types',
  'scripts',
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'remove',
  'delete',
  'update',
  'create',
]);

const TAILWIND_PATTERN = /^[a-z0-9:-]+(\/[0-9]+)?$/;

export function isAmbiguousName(name: string): boolean {
  return AMBIGUOUS_NAME_PATTERNS.some((p) => p.test(name));
}

export function isMagicNumber(value: number): boolean {
  return !MAGIC_LITERAL_IGNORE.has(value);
}

export function isMagicString(value: string): boolean {
  if (value.length === 0) return false;
  if (value.length > 20) return false;
  if (MAGIC_STRING_IGNORE.has(value)) return false;

  if (TAILWIND_PATTERN.test(value) && value.includes('-')) return false;
  if (value === value.toUpperCase() && value.length > 3) return false;
  if (/[/.]/.test(value)) return false;
  if (/^#[0-9a-fA-F]{3,6}$/.test(value)) return false;

  return !/^\s+$/.test(value);
}
