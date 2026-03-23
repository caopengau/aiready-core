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
