import { loadConfig, mergeConfigWithDefaults } from '../index';
import { ToolOptions } from '../types';

export * from './fs-utils';
export * from './cli-utils';

/**
 * Common CLI configuration interface
 * @deprecated Use ToolOptions from @aiready/core instead
 */
export type CLIOptions = ToolOptions;

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
