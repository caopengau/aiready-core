import { glob } from 'glob';
import { readFile } from 'fs/promises';
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
 * Note: This scanner includes multiple language file types by default (.ts, .tsx, .js, .jsx, .py, .java)
 * to support potential multi-language analysis in the future. Individual tools (like @aiready/consistency)
 * should filter to their supported languages before processing.
 * 
 * @param options - Scan configuration
 * @returns Array of absolute file paths matching the patterns
 */
export async function scanFiles(options: ScanOptions): Promise<string[]> {
  const {
    rootDir,
    include = ['**/*.{ts,tsx,js,jsx,py,java}'], // Broad default - tools should filter further
    exclude,
  } = options;

  // Always merge user excludes with defaults to ensure critical paths like
  // cdk.out, node_modules, build dirs are excluded
  const finalExclude = exclude 
    ? [...new Set([...DEFAULT_EXCLUDE, ...exclude])] 
    : DEFAULT_EXCLUDE;

  const files = await glob(include, {
    cwd: rootDir,
    ignore: finalExclude,
    absolute: true,
  });

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
