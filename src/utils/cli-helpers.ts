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
  if (userPath) {
    // User provided a path, use it as-is
    return userPath;
  }

  // Default to .aiready directory
  const aireadyDir = join(workingDir, '.aiready');
  
  // Ensure .aiready directory exists
  if (!existsSync(aireadyDir)) {
    mkdirSync(aireadyDir, { recursive: true });
  }

  return join(aireadyDir, defaultFilename);
}

/**
 * Load and merge configuration with CLI options
 */
export function loadMergedConfig<T extends Record<string, any>>(
  directory: string,
  defaults: T,
  cliOptions: Partial<T>
): T & { rootDir: string } {
  // Load config file if it exists
  const config = loadConfig(directory);

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