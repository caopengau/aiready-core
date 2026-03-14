import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname, resolve as resolvePath } from 'path';
import { loadConfig, mergeConfigWithDefaults } from '../index';

/**
 * Common CLI configuration interface
 */
export interface CLIOptions {
  rootDir: string;
  include?: string[];
  exclude?: string[];
  [key: string]: any;
}

/**
 * Resolve output file path, defaulting to .aiready directory
 * Creates parent directories if they don't exist.
 * @param userPath - User-provided output path (optional)
 * @param defaultFilename - Default filename to use
 * @param workingDir - Working directory (default: process.cwd())
 * @returns Resolved absolute path
 */
export function resolveOutputPath(
  userPath: string | undefined,
  defaultFilename: string,
  workingDir: string = process.cwd()
): string {
  let outputPath: string;

  if (userPath) {
    // User provided a path, use it as-is
    outputPath = userPath;
  } else {
    // Default to .aiready directory
    const aireadyDir = join(workingDir, '.aiready');
    outputPath = join(aireadyDir, defaultFilename);
  }

  // Ensure parent directory exists (works for both default and custom paths)
  const parentDir = dirname(outputPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  return outputPath;
}

/**
 * Load and merge configuration with CLI options
 */
export async function loadMergedConfig<T extends Record<string, any>>(
  directory: string,
  defaults: T,
  cliOptions: Partial<T>
): Promise<T & { rootDir: string }> {
  // Load config file if it exists
  const config = await loadConfig(directory);

  // Merge config with defaults
  const mergedConfig = mergeConfigWithDefaults(config, defaults);

  // Override with CLI options (CLI takes precedence)
  const result: T & { rootDir: string } = {
    ...mergedConfig,
    ...cliOptions,
    rootDir: directory,
  };

  return result;
}

/**
 * Handle JSON output for CLI commands
 */
export function handleJSONOutput(
  data: any,
  outputFile?: string,
  successMessage?: string
): void {
  if (outputFile) {
    // Ensure directory exists
    const dir = dirname(outputFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(successMessage || `✅ Results saved to ${outputFile}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Common error handler for CLI commands
 */
export function handleCLIError(error: unknown, commandName: string): never {
  console.error(`❌ ${commandName} failed:`, error);
  process.exit(1);
}

/**
 * Calculate elapsed time and format for display
 */
export function getElapsedTime(startTime: number): string {
  return ((Date.now() - startTime) / 1000).toFixed(2);
}

/**
 * Generate a visual score bar for console output
 */
export function getScoreBar(val: number): string {
  const clamped = Math.max(0, Math.min(100, val));
  return '█'.repeat(Math.round(clamped / 10)).padEnd(10, '░');
}

/**
 * Get status icon for safety ratings
 */
export function getSafetyIcon(rating: string): string {
  switch (rating) {
    case 'safe':
      return '✅';
    case 'moderate-risk':
      return '⚠️ ';
    case 'high-risk':
      return '🔴';
    case 'blind-risk':
      return '💀';
    default:
      return '❓';
  }
}

/**
 * Emit progress update with throttling to reduce log noise
 */
export function emitProgress(
  processed: number,
  total: number,
  toolId: string,
  message: string,
  onProgress?: (processed: number, total: number, message: string) => void,
  throttleCount: number = 50
): void {
  if (!onProgress) return;

  if (processed % throttleCount === 0 || processed === total) {
    onProgress(processed, total, `${message} (${processed}/${total})`);
  }
}

/**
 * Get chalk color function for a given severity
 * @param severity severity level
 * @param chalk chalk instance
 */
export function getSeverityColor(severity: string, chalk: any) {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high-risk':
    case 'blind-risk':
      return chalk.red;
    case 'major':
    case 'moderate-risk':
      return chalk.yellow;
    case 'minor':
    case 'safe':
      return chalk.green;
    case 'info':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

/**
 * Get numeric severity level for comparison
 */
export function getSeverityLevel(s: string | undefined): number {
  if (!s) return 0;
  switch (s.toLowerCase()) {
    case 'critical':
      return 4;
    case 'major':
      return 3;
    case 'minor':
      return 2;
    case 'info':
      return 1;
    default:
      return 0;
  }
}

/**
 * Get Severity enum from string
 */
export function getSeverityEnum(s: string | undefined): any {
  const level = getSeverityLevel(s);
  switch (level) {
    case 4:
      return 'critical';
    case 3:
      return 'major';
    case 2:
      return 'minor';
    case 1:
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Find the latest aiready report in a directory by modification time
 * Searches for both new format (aiready-report-*) and legacy format (aiready-scan-*)
 * @param dirPath - The directory path to search for .aiready directory
 * @returns The path to the latest report or null if not found
 */
export function findLatestReport(dirPath: string): string | null {
  const aireadyDir = resolvePath(dirPath, '.aiready');
  if (!existsSync(aireadyDir)) {
    return null;
  }

  // Search for new format first, then legacy format
  let files = readdirSync(aireadyDir).filter(
    (f) => f.startsWith('aiready-report-') && f.endsWith('.json')
  );
  if (files.length === 0) {
    files = readdirSync(aireadyDir).filter(
      (f) => f.startsWith('aiready-scan-') && f.endsWith('.json')
    );
  }

  if (files.length === 0) {
    return null;
  }

  // Sort by modification time, most recent first
  const sortedFiles = files
    .map((f) => ({
      name: f,
      path: resolvePath(aireadyDir, f),
      mtime: statSync(resolvePath(aireadyDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return sortedFiles[0].path;
}

/**
 * Find the latest scan report file in a directory
 */
export function findLatestScanReport(
  scanReportsDir: string,
  reportFilePrefix: string
): string | null {
  try {
    let reportFiles: string[] = [];
    if (existsSync(scanReportsDir)) {
      const files = readdirSync(scanReportsDir);
      if (files.length > 0) {
        const prefixRegex = new RegExp(`^${reportFilePrefix}\\d+\\.json$`);
        reportFiles = files.filter((file) => prefixRegex.test(file));
      }
    }
    if (reportFiles.length === 0) return null;

    // Sort the files by their ID numbers in descending order
    reportFiles.sort((a, b) => {
      const idA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const idB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return idB - idA; // Descending order
    });

    return join(scanReportsDir, reportFiles[0]);
  } catch (e) {
    console.error('Error while finding latest scan report:', e);
    return null;
  }
}
