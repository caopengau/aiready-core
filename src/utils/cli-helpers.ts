import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
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
