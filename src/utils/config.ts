import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { pathToFileURL } from 'url';
import type { AIReadyConfig } from '../types';

const CONFIG_FILES = [
  'aiready.json',
  'aiready.config.json',
  '.aiready.json',
  '.aireadyrc.json',
  'aiready.config.js',
  '.aireadyrc.js'
];

export async function loadConfig(rootDir: string): Promise<AIReadyConfig | null> {
  // Search upwards from the provided directory to find the nearest config
  let currentDir = resolve(rootDir);

  while (true) {
    for (const configFile of CONFIG_FILES) {
      const configPath = join(currentDir, configFile);

      if (existsSync(configPath)) {
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

          // Basic validation
          if (typeof config !== 'object' || config === null) {
            throw new Error('Config must be an object');
          }

          return config;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to load config from ${configPath}: ${errorMessage}`);
        }
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

export function mergeConfigWithDefaults(
  userConfig: AIReadyConfig | null,
  defaults: any
): any {
  if (!userConfig) return defaults;

  const result = { ...defaults };

  // Merge scan options
  if (userConfig.scan) {
    if (userConfig.scan.include) result.include = userConfig.scan.include;
    if (userConfig.scan.exclude) result.exclude = userConfig.scan.exclude;
  }

  // Merge tool-specific options
  if (userConfig.tools) {
    for (const [toolName, toolConfig] of Object.entries(userConfig.tools)) {
      if (typeof toolConfig === 'object' && toolConfig !== null) {
        // For pattern-detect and context-analyzer tools, merge options directly into result
        if (toolName === 'pattern-detect' || toolName === 'context-analyzer') {
          Object.assign(result, toolConfig);
        }
        // Add other tool configs under their names for future use
        result[toolName] = { ...result[toolName], ...toolConfig };
      }
    }
  }

  // Merge output preferences
  if (userConfig.output) {
    result.output = { ...result.output, ...userConfig.output };
  }

  return result;
}