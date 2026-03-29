import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadConfig, mergeConfigWithDefaults } from '../utils/config';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Config Loader', () => {
  const tmpDir = join(tmpdir(), 'aiready-config-tests');

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, 'aiready.json'),
      JSON.stringify({
        scan: { include: ['src/**/*.ts'] },
        tools: { 'pattern-detect': { minLines: 10 } },
      })
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load config from a directory', async () => {
    const config = await loadConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config?.scan?.include).toContain('src/**/*.ts');
  });

  it('should merge user config with defaults', () => {
    const defaults = { include: ['**/*'], toolConfigs: {} };
    const userConfig = {
      scan: { include: ['src/*.ts'] },
      tools: { 'context-analyzer': { maxDepth: 10 } },
    };

    const merged = mergeConfigWithDefaults(userConfig as any, defaults);

    expect(merged.include).toEqual(['src/*.ts']);
    expect((merged.toolConfigs as any)['context-analyzer'].maxDepth).toBe(10);
  });

  it('should support strict tools mapping', () => {
    const defaults = { toolConfigs: {} };
    const userConfig = {
      tools: { patterns: { minSimilarity: 0.8 } },
    };

    const merged = mergeConfigWithDefaults(userConfig as any, defaults);
    expect((merged.toolConfigs as any)['patterns'].minSimilarity).toBe(0.8);
  });
});
