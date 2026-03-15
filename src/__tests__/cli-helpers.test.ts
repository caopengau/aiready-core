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
  getScoreBar,
  loadMergedConfig,
  handleJSONOutput,
} from '../utils/cli-helpers';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

describe('CLI Helpers Advanced', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `aiready-cli-helpers-advanced-${Date.now()}`);
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
      JSON.stringify({ tools: ['t1'], someOpt: 'file' })
    );

    const defaults = { tools: ['def'], someOpt: 'def', otherOpt: 'def' };
    const cliOptions = { someOpt: 'cli' };

    const result = await loadMergedConfig(projectDir, defaults, cliOptions);

    expect(result.someOpt).toBe('cli'); // cli overrides file
    expect(result.otherOpt).toBe('def'); // from defaults
    expect(result.rootDir).toBe(projectDir);
  });

  it('handleJSONOutput should write to file', () => {
    const outFile = join(tmpDir, 'out.json');
    const data = { test: true };

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    handleJSONOutput(data, outFile, 'Success');

    expect(existsSync(outFile)).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith('Success');
    consoleSpy.mockRestore();
  });

  it('handleJSONOutput should log to console if no file provided', () => {
    const data = { test: true };
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    handleJSONOutput(data);

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    consoleSpy.mockRestore();
  });

  it('getScoreBar handles boundaries', () => {
    expect(getScoreBar(-10)).toBe('░░░░░░░░░░');
    expect(getScoreBar(110)).toBe('██████████');
  });
});
