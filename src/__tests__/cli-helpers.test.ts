import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import {
  loadMergedConfig,
  getSeverityValue,
  resolveOutputPath,
} from '../utils/cli-helpers';
import { join } from 'path';
import { rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

describe('CLI Helpers Barrel', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `aiready-cli-helpers-barrel-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadMergedConfig should merge defaults, config file, and CLI options', async () => {
    const projectDir = join(tmpDir, 'project-config');
    mkdirSync(projectDir);
    writeFileSync(
      join(projectDir, 'aiready.json'),
      JSON.stringify({ scan: { tools: ['t1'] }, someOpt: 'file' })
    );

    const defaults = { tools: ['def'], someOpt: 'def', otherOpt: 'def' };
    const cliOptions = { someOpt: 'cli' };

    const result = await loadMergedConfig(projectDir, defaults, cliOptions);

    expect(result.someOpt).toBe('cli'); // cli overrides file
    expect(result.otherOpt).toBe('def'); // from defaults
    expect(result.rootDir).toBe(projectDir);
  });

  it('should correctly re-export utilities from severity-utils', () => {
    expect(getSeverityValue('critical')).toBe(4);
    expect(getSeverityValue('major')).toBe(3);
  });

  it('should correctly re-export utilities from fs-utils', () => {
    const userPath = join(tmpDir, 'custom', 'output.json');
    const result = resolveOutputPath(userPath, 'default.json', tmpDir);
    expect(result).toBe(userPath);
  });
});
