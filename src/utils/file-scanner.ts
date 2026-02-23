import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
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
        .map(s => s.trim())
        .filter(Boolean)
        .filter(l => !l.startsWith('#'))
        .filter(l => !l.startsWith('!')); // ignore negations for now
    } catch (e) {
      // noop - fall back to defaults if file can't be read
      ignoreFromFile = [];
    }
  }

  const finalExclude = [...new Set([...(exclude || []), ...ignoreFromFile, ...DEFAULT_EXCLUDE])];

  // First pass glob using aireadyignore + defaults + CLI excludes
  const files = await glob(include, {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

  // If a .gitignore exists, apply its rules (including negations) using the
  // `ignore` package. We filter the glob result because `glob` doesn't
  // fully implement gitignore semantics (negations, directory-relative rules).
  const gitignorePath = join(rootDir || '.', '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const gitTxt = await readFile(gitignorePath, 'utf-8');
      const ig = ignorePkg();
      // add accepts a newline-separated string or an array of patterns
      ig.add(gitTxt);

      const filtered = files.filter((f) => {
        // Compute path relative to rootDir and normalize to posix-style
        let rel = relative(rootDir || '.', f).replace(/\\/g, '/');
        if (rel === '') rel = f;
        return !ig.ignores(rel);
      });

      return filtered;
    } catch (e) {
      // If gitignore can't be read/parsed, fall back to the glob result
      return files;
    }
  }

  return files;
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
