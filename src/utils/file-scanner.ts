import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import ignorePkg from 'ignore';
import { ScanOptions } from '../types';

export const DEFAULT_EXCLUDE = [
  // Dependencies
  '**/node_modules/**',

  // Build outputs
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/output/**',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',
  '**/cdk.out/**',

  // Framework-specific build dirs
  '**/.next/**',
  '**/.sst/**',
  '**/.open-next/**',
  '**/.nuxt/**',
  '**/.vuepress/**',
  '**/.cache/**',
  '**/.turbo/**',

  // Test files and coverage
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/test/**',
  '**/tests/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  '**/.jest/**',

  // Version control and IDE
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/*.swp',
  '**/*.swo',

  // Build artifacts and minified files
  '**/*.min.js',
  '**/*.min.css',
  '**/*.bundle.js',
  '**/*.tsbuildinfo',

  // Logs and temporary files
  '**/logs/**',
  '**/*.log',
  '**/.DS_Store',
];

export const VAGUE_FILE_NAMES = new Set([
  'utils',
  'helpers',
  'helper',
  'misc',
  'common',
  'shared',
  'tools',
  'util',
  'lib',
  'libs',
  'stuff',
  'functions',
  'methods',
  'handlers',
  'data',
  'temp',
  'tmp',
  'test-utils',
  'test-helpers',
  'mocks',
]);

/**
 * Scan files in a directory using glob patterns
 *
 * Note: This scanner supports multiple languages (.ts, .tsx, .js, .jsx, .py, .java, etc.)
 * Individual tools can filter to their supported languages if needed.
 *
 * @param options - Scan configuration
 * @returns Array of absolute file paths matching the patterns
 */
export async function scanFiles(options: ScanOptions): Promise<string[]> {
  const {
    rootDir,
    include = ['**/*.{ts,tsx,js,jsx,py,java,go,rs,cs}'], // Multi-language support
    exclude,
  } = options;

  // Always merge user excludes with defaults to ensure critical paths like
  // cdk.out, node_modules, build dirs are excluded
  // Load .aireadyignore from repository root if present and merge
  const ignoreFilePath = join(rootDir || '.', '.aireadyignore');
  let ignoreFromFile: string[] = [];
  if (existsSync(ignoreFilePath)) {
    try {
      const txt = await readFile(ignoreFilePath, 'utf-8');
      ignoreFromFile = txt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((l) => !l.startsWith('#'))
        .filter((l) => !l.startsWith('!')); // ignore negations for now
    } catch (e) {
      // noop - fall back to defaults if file can't be read
      ignoreFromFile = [];
    }
  }

  const TEST_PATTERNS = ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/test/**', '**/tests/**'];

  const baseExclude = options.includeTests
    ? DEFAULT_EXCLUDE.filter(p => !TEST_PATTERNS.includes(p))
    : DEFAULT_EXCLUDE;

  const finalExclude = [
    ...new Set([...(exclude || []), ...ignoreFromFile, ...baseExclude]),
  ];

  // First pass glob using aireadyignore + defaults + CLI excludes
  const files = await glob(include, {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

  // If a .gitignore exists, apply its rules (including negations) using the
  // `ignore` package. We filter the glob result because `glob` doesn't
  // fully implement gitignore semantics (negations, directory-relative rules).
  // Recursively apply .gitignore rules from all .gitignore files in the hierarchy
  const gitignoreFiles = await glob('**/.gitignore', {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

  if (gitignoreFiles.length > 0) {
    try {
      // Sort ignore files by depth (shallowest first) to ensure correct precedence if needed,
      // though 'ignore' package handles multiple patterns.
      // We'll create a single ignore instance and add patterns with their relative prefixes.
      const ig = ignorePkg();

      for (const gitignorePath of gitignoreFiles) {
        const gitTxt = await readFile(gitignorePath, 'utf-8');
        const gitignoreDir = dirname(gitignorePath);
        const relativePrefix = relative(rootDir || '.', gitignoreDir).replace(/\\/g, '/');

        const patterns = gitTxt
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((l) => !l.startsWith('#'));

        if (relativePrefix === '.' || relativePrefix === '') {
          ig.add(patterns);
        } else {
          // Add patterns with directory prefix for nested gitignores
          ig.add(patterns.map((p) => (p.startsWith('/') ? `${relativePrefix}${p}` : `${relativePrefix}/**/${p}`)));
        }
      }

      const filtered = files.filter((f) => {
        let rel = relative(rootDir || '.', f).replace(/\\/g, '/');
        if (rel === '') rel = f;
        return !ig.ignores(rel);
      });

      return filtered;
    } catch (e) {
      return files;
    }
  }

  return files;
}

/**
 * Scan for both files and directories, respecting ignore rules.
 * Useful for tools that need to analyze directory structure.
 */
export async function scanEntries(options: ScanOptions): Promise<{ files: string[]; dirs: string[] }> {
  const files = await scanFiles(options);
  const { rootDir, include = ['**/*'], exclude, includeTests } = options;

  const ignoreFilePath = join(rootDir || '.', '.aireadyignore');
  let ignoreFromFile: string[] = [];
  if (existsSync(ignoreFilePath)) {
    try {
      const txt = await readFile(ignoreFilePath, 'utf-8');
      ignoreFromFile = txt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((l) => !l.startsWith('#'))
        .filter((l) => !l.startsWith('!'));
    } catch (e) {
      ignoreFromFile = [];
    }
  }

  const TEST_PATTERNS = ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/test/**', '**/tests/**'];
  const baseExclude = includeTests
    ? DEFAULT_EXCLUDE.filter(p => !TEST_PATTERNS.includes(p))
    : DEFAULT_EXCLUDE;

  const finalExclude = [...new Set([...(exclude || []), ...ignoreFromFile, ...baseExclude])];

  const dirs = await glob('**/', {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

  // Apply gitignore to directories if available
  const gitignoreFiles = await glob('**/.gitignore', {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

  if (gitignoreFiles.length > 0) {
    const ig = ignorePkg();
    for (const gitignorePath of gitignoreFiles) {
      const gitTxt = await readFile(gitignorePath, 'utf-8');
      const gitignoreDir = dirname(gitignorePath);
      const relativePrefix = relative(rootDir || '.', gitignoreDir).replace(/\\/g, '/');
      const patterns = gitTxt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter((l) => !l.startsWith('#'));

      if (relativePrefix === '.' || relativePrefix === '') {
        ig.add(patterns);
      } else {
        ig.add(patterns.map((p) => (p.startsWith('/') ? `${relativePrefix}${p}` : `${relativePrefix}/**/${p}`)));
      }
    }

    const filteredDirs = dirs.filter((d) => {
      let rel = relative(rootDir || '.', d).replace(/\\/g, '/').replace(/\/$/, '');
      if (rel === '') return true; // project root is never ignored by its own gitignore
      return !ig.ignores(rel);
    });

    return { files, dirs: filteredDirs };
  }

  return { files, dirs };
}

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export function getFileExtension(filePath: string): string {
  return filePath.split('.').pop() || '';
}

export function isSourceFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs'].includes(ext);
}
