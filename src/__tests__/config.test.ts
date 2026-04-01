import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import { loadConfig, mergeConfigWithDefaults } from '../utils/config';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

describe('Config Loader', () => {
  const tmpDir = join(tmpdir(), `aiready-config-tests-${Date.now()}`);

  beforeAll(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
    const configPath = join(tmpDir, 'aiready.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        scan: { include: ['src/**/*.ts'] },
        tools: { 'pattern-detect': { minLines: 10 } },
      })
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should load config from a directory', async () => {
      const config = await loadConfig(tmpDir);
      expect(config).not.toBeNull();
      expect(config?.scan?.include).toContain('src/**/*.ts');
    });

    it('should search upwards for config', async () => {
      const subDir = join(tmpDir, 'sub', 'deep');
      mkdirSync(subDir, { recursive: true });

      const config = await loadConfig(subDir);
      expect(config).not.toBeNull();
      expect(config?.scan?.include).toContain('src/**/*.ts');
    });

    it('should return null if no config found', async () => {
      const emptyDir = join(tmpdir(), `aiready-empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });
      try {
        const config = await loadConfig(emptyDir);
        expect(config).toBeNull();
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('should warn if multiple config files found', async () => {
      const multiDir = join(tmpDir, 'multi');
      mkdirSync(multiDir, { recursive: true });
      writeFileSync(join(multiDir, 'aiready.json'), '{}');
      writeFileSync(join(multiDir, '.aireadyrc.json'), '{}');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await loadConfig(multiDir);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Multiple configuration files found')
      );
      consoleSpy.mockRestore();
    });

    it('should warn for legacy configuration keys', async () => {
      const legacyDir = join(tmpDir, 'legacy');
      mkdirSync(legacyDir, { recursive: true });
      writeFileSync(
        join(legacyDir, 'aiready.json'),
        JSON.stringify({
          toolConfigs: { 'pattern-detect': {} },
        })
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await loadConfig(legacyDir);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Legacy configuration keys found')
      );
      consoleSpy.mockRestore();
    });

    it('should throw error on invalid JSON', async () => {
      const invalidDir = join(tmpDir, 'invalid');
      mkdirSync(invalidDir, { recursive: true });
      writeFileSync(join(invalidDir, 'aiready.json'), '{ invalid json }');

      await expect(loadConfig(invalidDir)).rejects.toThrow(
        'Failed to load config'
      );
    });

    it('should throw error on schema validation failure', async () => {
      const badSchemaDir = join(tmpDir, 'bad-schema');
      mkdirSync(badSchemaDir, { recursive: true });
      writeFileSync(
        join(badSchemaDir, 'aiready.json'),
        JSON.stringify({
          scan: { include: 'not-an-array' },
        })
      );

      await expect(loadConfig(badSchemaDir)).rejects.toThrow(
        'Failed to load config'
      );
    });
  });

  describe('mergeConfigWithDefaults', () => {
    it('should return defaults if userConfig is null', () => {
      const defaults = { opt: 1 };
      expect(mergeConfigWithDefaults(null, defaults)).toBe(defaults);
    });

    it('should merge user config with defaults', () => {
      const defaults = { include: ['**/*'], toolConfigs: {} };
      const userConfig = {
        scan: { include: ['src/*.ts'], exclude: ['test/*.ts'] },
        threshold: 80,
        failOn: 'critical',
        tools: { 'context-analyzer': { maxDepth: 10 } },
        output: { format: 'json' },
      };

      const merged = mergeConfigWithDefaults(
        userConfig as any,
        defaults
      ) as any;

      expect(merged.include).toEqual(['src/*.ts']);
      expect(merged.exclude).toEqual(['test/*.ts']);
      expect(merged.threshold).toBe(80);
      expect(merged.failOn).toBe('critical');
      expect((merged.toolConfigs as any)['context-analyzer'].maxDepth).toBe(10);
      expect(merged.output.format).toBe('json');
    });

    it('should support strict tools mapping', () => {
      const defaults = { toolConfigs: { patterns: { minSimilarity: 0.5 } } };
      const userConfig = {
        tools: { patterns: { minSimilarity: 0.8 } },
      };

      const merged = mergeConfigWithDefaults(userConfig as any, defaults);
      expect((merged.toolConfigs as any)['patterns'].minSimilarity).toBe(0.8);
    });
  });
});
