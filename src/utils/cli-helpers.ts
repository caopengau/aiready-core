import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname, resolve as resolvePath } from 'path';
import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '../index';
import { Severity, ToolOptions } from '../types';

/**
 * Common CLI configuration interface
 * @deprecated Use ToolOptions from @aiready/core instead
 */
export type CLIOptions = ToolOptions;

/** @internal */
function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** @internal */
function normalizeSeverity(s: string | undefined): Severity | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (['critical', 'high-risk', 'blind-risk'].includes(lower))
    return Severity.Critical;
  if (['major', 'moderate-risk'].includes(lower)) return Severity.Major;
  if (['minor', 'safe'].includes(lower)) return Severity.Minor;
  if (lower === 'info') return Severity.Info;
  return null;
}

/** @internal */
function getFilesByPattern(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter((f) => pattern.test(f));
  } catch {
    return [];
  }
}

/**
 * Resolve output file path, defaulting to .aiready directory.
 * Creates parent directories if they don't exist.
 *
 * @param userPath - User-provided output path (optional).
 * @param defaultFilename - Default filename to use.
 * @param workingDir - Working directory (default: process.cwd()).
 * @returns Resolved absolute path.
 * @lastUpdated 2026-03-18
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
    // If workingDir is a file, use its parent directory
    let baseDir = workingDir;
    try {
      if (statSync(workingDir).isFile()) {
        baseDir = dirname(workingDir);
      }
    } catch {
      // Ignore errors (e.g. if path doesn't exist yet)
    }
    const aireadyDir = join(baseDir, '.aiready');
    outputPath = join(aireadyDir, defaultFilename);
  }

  // Ensure parent directory exists (works for both default and custom paths)
  ensureDir(outputPath);

  return outputPath;
}

/**
 * Load and merge configuration with CLI options.
 *
 * @param directory - Root directory to load config from.
 * @param defaults - Default configuration values.
 * @param cliOptions - Configuration overrides from CLI arguments.
 * @returns Merged configuration object.
 * @lastUpdated 2026-03-18
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
 * Handle JSON output for CLI commands.
 * Writes to file if outputFile is provided, otherwise logs to console.
 *
 * @param data - Data to output.
 * @param outputFile - Optional path to save JSON file.
 * @param successMessage - Optional message to show on success.
 * @lastUpdated 2026-03-18
 */
export function handleJSONOutput(
  data: any,
  outputFile?: string,
  successMessage?: string
): void {
  if (outputFile) {
    // Ensure directory exists
    ensureDir(outputFile);
    writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(successMessage || `✅ Results saved to ${outputFile}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Get a formatted terminal divider string based on current terminal width.
 *
 * @param color - Chalk color function to use for the divider.
 * @param maxWidth - Maximum width for the divider (default: 60).
 * @returns String representation of the divider.
 */
export function getTerminalDivider(
  color: any = chalk.cyan,
  maxWidth: number = 60
): string {
  const terminalWidth = process.stdout.columns || 80;
  const dividerWidth = Math.min(maxWidth, terminalWidth - 2);
  return color('━'.repeat(dividerWidth));
}

/**
 * Print a standard terminal header with dividers.
 *
 * @param title - Header title text.
 * @param color - Chalk color function for the dividers.
 */
export function printTerminalHeader(
  title: string,
  color: any = chalk.cyan
): void {
  const divider = getTerminalDivider(color);
  console.log(divider);
  console.log(chalk.bold.white(`  ${title.toUpperCase()}`));
  console.log(divider + '\n');
}

/**
 * Common CLI error handler for CLI commands.
 * Logs error and exits process with code 1.
 *
 * @param error - Error object or message.
 * @param commandName - Name of the command that failed.
 * @returns Never returns as it exits the process.
 * @lastUpdated 2026-03-18
 */
export function handleCLIError(error: unknown, commandName: string): never {
  console.error(`❌ ${commandName} failed:`, error);
  process.exit(1);
}

/**
 * Calculate elapsed time and format for display
 *
 * @param startTime - Start timestamp in milliseconds.
 * @returns Formatted duration string in seconds.
 * @lastUpdated 2026-03-18
 */
export function getElapsedTime(startTime: number): string {
  return ((Date.now() - startTime) / 1000).toFixed(2);
}

/**
 * Generate a visual score bar for console output
 *
 * @param val - Score value between 0 and 100.
 * @returns String representation of the bar (e.g., "█████░░░░░").
 * @lastUpdated 2026-03-18
 */
export function getScoreBar(val: number): string {
  const clamped = Math.max(0, Math.min(100, val));
  return '█'.repeat(Math.round(clamped / 10)).padEnd(10, '░');
}

/**
 * Get status icon for safety ratings
 *
 * @param rating - The safety rating slug.
 * @returns Emoji icon representing the rating.
 * @lastUpdated 2026-03-18
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
 * @param processed Number of items processed
 * @param total Total items to process
 * @param toolId Tool identifier
 * @param message Progress message
 * @param onProgress Global progress callback
 * @param throttleCount Frequency of updates (every N items)
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
 *
 * @param severity - Severity level string.
 * @param chalkInstance - Optional chalk instance to use.
 * @returns Chalk color function.
 * @lastUpdated 2026-03-18
 */
export function getSeverityColor(severity: string, chalkInstance: any = chalk) {
  const normalized = normalizeSeverity(severity);
  switch (normalized) {
    case Severity.Critical:
      return chalkInstance.red;
    case Severity.Major:
      return chalkInstance.yellow;
    case Severity.Minor:
      return chalkInstance.green;
    case Severity.Info:
      return chalkInstance.blue;
    default:
      return chalkInstance.white;
  }
}

/**
 * Get numeric severity value for comparison (4-1)
 * @param s Severity level string
 * @returns Numeric value (4: critical, 3: major, 2: minor, 1: info)
 */
export function getSeverityValue(s: string | undefined): number {
  const normalized = normalizeSeverity(s);
  switch (normalized) {
    case Severity.Critical:
      return 4;
    case Severity.Major:
      return 3;
    case Severity.Minor:
      return 2;
    case Severity.Info:
      return 1;
    default:
      return 0;
  }
}

/**
 * Get numeric severity level (alias for getSeverityValue)
 * @param s Severity level string
 * @returns Numeric value
 */
export function getSeverityLevel(s: string | undefined): number {
  return getSeverityValue(s);
}

/**
 * Get colored severity badge for console output
 * @param severity Severity level
 * @param chalkInstance Chalk instance (optional)
 * @returns Formatted badge string
 */
export function getSeverityBadge(
  severity: Severity | string,
  chalkInstance: any = chalk
): string {
  const val = getSeverityValue(
    typeof severity === 'string' ? severity : (severity as string)
  );
  switch (val) {
    case 4:
      return chalkInstance.bgRed.white.bold(' CRITICAL ');
    case 3:
      return chalkInstance.bgYellow.black.bold(' MAJOR ');
    case 2:
      return chalkInstance.bgBlue.white.bold(' MINOR ');
    case 1:
      return chalkInstance.bgCyan.black(' INFO ');
    default:
      return chalkInstance.bgCyan.black(' INFO ');
  }
}

/**
 * Get Severity enum from string for internal logic
 * @param s Severity level string
 * @returns Normalized severity string
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
    default:
      return 'info';
  }
}

/**
 * Find the latest aiready report in a directory by modification time.
 * Searches for both new format (aiready-report-*) and legacy format (aiready-scan-*).
 *
 * @param dirPath - The directory path to search for .aiready directory.
 * @returns The path to the latest report or null if not found.
 * @lastUpdated 2026-03-18
 */
export function findLatestReport(dirPath: string): string | null {
  const aireadyDir = resolvePath(dirPath, '.aiready');

  // Search for new format first, then legacy format
  let files = getFilesByPattern(aireadyDir, /^aiready-report-.*\.json$/);
  if (files.length === 0) {
    files = getFilesByPattern(aireadyDir, /^aiready-scan-.*\.json$/);
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
 * Find the latest scan report file with a specific prefix.
 *
 * @param scanReportsDir - Directory containing reports.
 * @param reportFilePrefix - Filename prefix to match (e.g. "report-").
 * @returns Path to the latest matching report or null.
 * @lastUpdated 2026-03-18
 */
export function findLatestScanReport(
  scanReportsDir: string,
  reportFilePrefix: string
): string | null {
  try {
    const prefixRegex = new RegExp(`^${reportFilePrefix}\\d+\\.json$`);
    const reportFiles = getFilesByPattern(scanReportsDir, prefixRegex);

    if (reportFiles.length === 0) return null;

    // Sort the files by their ID numbers in descending order
    reportFiles.sort((a, b) => {
      const idA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const idB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return idB - idA; // Descending order
    });

    return join(scanReportsDir, reportFiles[0]);
  } catch {
    console.error('Error while finding latest scan report');
    return null;
  }
}
