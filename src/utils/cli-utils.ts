import chalk from 'chalk';
import { Severity } from '../types';

/** @internal */
export function normalizeSeverity(s: string | undefined): Severity | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (['critical', 'high-risk', 'blind-risk'].includes(lower))
    return Severity.Critical;
  if (['major', 'moderate-risk'].includes(lower)) return Severity.Major;
  if (['minor', 'safe'].includes(lower)) return Severity.Minor;
  if (lower === 'info') return Severity.Info;
  return null;
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
 * Get chalk color function for a given severity
 *
 * @param severity - Severity level string.
 * @param chalkInstance - Optional chalk instance to use.
 * @returns Chalk color function.
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
 * Calculate elapsed time and format for display
 *
 * @param startTime - Start timestamp in milliseconds.
 * @returns Formatted duration string in seconds.
 */
export function getElapsedTime(startTime: number): string {
  return ((Date.now() - startTime) / 1000).toFixed(2);
}

/**
 * Print a stylized terminal header for a tool
 */
export function printTerminalHeader(
  title: string,
  colorFn: any = chalk.cyan.bold,
  width: number = 80
): void {
  const divider = '━'.repeat(width);
  console.log(colorFn(`\n${divider}`));
  console.log(colorFn(`  ${title.toUpperCase()}`));
  console.log(colorFn(`${divider}\n`));
}

/**
 * Common CLI error handler for CLI commands.
 */
export function handleCLIError(error: unknown, commandName: string): never {
  console.error(`❌ ${commandName} failed:`, error);
  process.exit(1);
}

/**
 * Get a terminal divider line
 */
export function getTerminalDivider(
  colorFn: any = chalk.gray,
  width: number = 80
): string {
  return colorFn('━'.repeat(width));
}

/**
 * Get a visual score bar (emoji/block based)
 */
export function getScoreBar(score: number, width: number = 10): string {
  const normalized = Math.max(0, Math.min(100, score));
  const solid = Math.round((normalized / 100) * width);
  const empty = width - solid;
  return '█'.repeat(solid) + '░'.repeat(empty);
}

/**
 * Get safety icon for a score or rating
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
 * Get a formatted severity badge string
 */
export function getSeverityBadge(
  severity: string,
  chalkInstance: any = chalk
): string {
  const normalized = normalizeSeverity(severity);
  switch (normalized) {
    case Severity.Critical:
      return chalkInstance.bgRed.white.bold(' CRITICAL ');
    case Severity.Major:
      return chalkInstance.bgYellow.black.bold(' MAJOR ');
    case Severity.Minor:
      return chalkInstance.bgGreen.black.bold(' MINOR ');
    case Severity.Info:
      return chalkInstance.bgBlue.white.bold(' INFO ');
    default:
      return chalkInstance.bgCyan.black(' UNKNOWN ');
  }
}
