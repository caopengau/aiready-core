import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname, resolve as resolvePath } from 'path';

/** @internal */
export function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** @internal */
export function getFilesByPattern(dir: string, pattern: RegExp): string[] {
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
