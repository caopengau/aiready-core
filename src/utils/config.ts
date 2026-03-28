import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { pathToFileURL } from 'url';
import { AIReadyConfigSchema } from '../types/schemas/config';
import type { AIReadyConfig } from '../types';

const CONFIG_FILES = [
  'aiready.json',
  'aiready.config.json',
  '.aiready.json',
  '.aireadyrc.json',
  'aiready.config.js',
  '.aireadyrc.js',
];

/**
 * Search upwards for AIReady configuration files and load the first one found.
 * @param rootDir Starting directory for the search
 * @returns Parsed configuration object or null if not found
 */
export async function loadConfig(
  rootDir: string
): Promise<AIReadyConfig | null> {
  // Search upwards from the provided directory to find the nearest config
  let currentDir = resolve(rootDir);

  while (true) {
    const foundConfigs: string[] = [];
    for (const configFile of CONFIG_FILES) {
      if (existsSync(join(currentDir, configFile))) {
        foundConfigs.push(configFile);
      }
    }

    if (foundConfigs.length > 0) {
      if (foundConfigs.length > 1) {
        console.warn(
          `⚠️ Multiple configuration files found in ${currentDir}: ${foundConfigs.join(
            ', '
          )}. Using ${foundConfigs[0]}.`
        );
      } else {
        // console.log(`ℹ️ Loading configuration from ${join(currentDir, foundConfigs[0])}`);
      }

      const configFile = foundConfigs[0];
      const configPath = join(currentDir, configFile);

      try {
        let config: AIReadyConfig;

        if (configFile.endsWith('.js')) {
          // For JS files, use dynamic ES import
          const fileUrl = pathToFileURL(configPath).href;
          const module = await import(`${fileUrl}?t=${Date.now()}`);
          config = module.default || module;
        } else {
          // For JSON files, parse them
          const content = readFileSync(configPath, 'utf-8');
          config = JSON.parse(content);
        }

        // Detect legacy keys to warn users
        const legacyKeys = ['toolConfigs'];
        const rootLevelTools = [
          'pattern-detect',
          'context-analyzer',
          'naming-consistency',
          'ai-signal-clarity',
        ];
        const allKeys = Object.keys(config);
        const foundLegacy = allKeys.filter(
          (k) => legacyKeys.includes(k) || rootLevelTools.includes(k)
        );

        if (foundLegacy.length > 0) {
          console.warn(
            `⚠️ Legacy configuration keys found: ${foundLegacy.join(
              ', '
            )}. These are deprecated and should be moved under the "tools" key.`
          );
        }

        // Strict schema validation
        return AIReadyConfigSchema.parse(config);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const configError = new Error(
          `Failed to load config from ${configPath}: ${errorMessage}`
        );
        try {
          // Attach original error as cause when supported
          (configError as unknown as Record<string, unknown>).cause =
            error instanceof Error ? error : undefined;
        } catch {
          /* ignore */
        }
        throw configError;
      }
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break; // Reached filesystem root
    }
    currentDir = parent;
  }

  return null;
}

/**
 * Merge user-provided configuration with default settings.
 * @param userConfig The configuration loaded from file
 * @param defaults The default configuration object
 * @returns Merged configuration with all defaults applied
 */
export function mergeConfigWithDefaults(
  userConfig: AIReadyConfig | null,
  defaults: any
): any {
  if (!userConfig) return defaults;

  const mergedConfig = { ...defaults };

  // Merge scan options
  if (userConfig.scan) {
    if (userConfig.scan.include) mergedConfig.include = userConfig.scan.include;
    if (userConfig.scan.exclude) mergedConfig.exclude = userConfig.scan.exclude;
  }

  // Merge gatekeeper options
  if (userConfig.threshold !== undefined)
    mergedConfig.threshold = userConfig.threshold;
  if (userConfig.failOn !== undefined) mergedConfig.failOn = userConfig.failOn;

  // Merge tool-specific options (strictly 'tools' map as per schema)
  if (userConfig.tools) {
    if (!mergedConfig.toolConfigs) mergedConfig.toolConfigs = {};
    for (const [toolName, toolConfig] of Object.entries(userConfig.tools)) {
      if (typeof toolConfig === 'object' && toolConfig !== null) {
        mergedConfig.toolConfigs[toolName] = {
          ...mergedConfig.toolConfigs[toolName],
          ...toolConfig,
        };
      }
    }
  }

  // Merge output preferences
  if (userConfig.output) {
    mergedConfig.output = { ...mergedConfig.output, ...userConfig.output };
  }

  return mergedConfig;
}
