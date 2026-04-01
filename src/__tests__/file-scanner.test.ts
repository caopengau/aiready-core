import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  scanFiles,
  scanEntries,
  isSourceFile,
  getFileExtension,
} from '../utils/file-scanner';
import { join, relative } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('File Scanner Advanced', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `aiready-scanner-advanced-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    // Root structure
    mkdirSync(join(tmpDir, 'src'));
    mkdirSync(join(tmpDir, 'ignored-by-git'));

    writeFileSync(join(tmpDir, 'src/main.ts'), 'code');
    writeFileSync(join(tmpDir, 'ignored-by-git/file.ts'), 'code');

    // .gitignore at root
    writeFileSync(
      join(tmpDir, '.gitignore'),
      'ignored-by-git/\nnode_modules/\n*.log'
    );

    // Nested .gitignore
    mkdirSync(join(tmpDir, 'src/nested'));
    writeFileSync(join(tmpDir, 'src/nested/internal.ts'), 'code');
    writeFileSync(join(tmpDir, 'src/nested/secret.log'), 'logs');
    writeFileSync(join(tmpDir, 'src/nested/.gitignore'), 'secret.log');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should respect root .gitignore', async () => {
    const files = await scanFiles({ rootDir: tmpDir });
    const relFiles = files.map((f) =>
      join(f)
        .replace(tmpDir, '')
        .replace(/^[/\\]/, '')
    );

    expect(relFiles).toContain('src/main.ts');
    expect(relFiles).not.toContain('ignored-by-git/file.ts');
  });

  it('should respect nested .gitignore', async () => {
    const files = await scanFiles({ rootDir: tmpDir });
    const relFiles = files.map((f) =>
      join(f)
        .replace(tmpDir, '')
        .replace(/^[/\\]/, '')
    );

    expect(relFiles).toContain('src/nested/internal.ts');
    expect(relFiles).not.toContain('src/nested/secret.log');
  });

  it('should scan entries (files and dirs)', async () => {
    const { files, dirs } = await scanEntries({ rootDir: tmpDir });

    expect(files.length).toBeGreaterThan(0);
    expect(dirs.some((d) => d.endsWith('src'))).toBe(true);
    expect(dirs.some((d) => d.endsWith('ignored-by-git'))).toBe(false);
  });

  describe('Advanced Ignore Features', () => {
    let advancedTmpDir: string;

    beforeEach(() => {
      advancedTmpDir = join(tmpdir(), `aiready-scanner-extra-${Date.now()}`);
      mkdirSync(advancedTmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(advancedTmpDir, { recursive: true, force: true });
    });

    it('should respect .aireadyignore', async () => {
      mkdirSync(join(advancedTmpDir, 'src'), { recursive: true });
      writeFileSync(join(advancedTmpDir, 'src/important.ts'), 'code');
      writeFileSync(join(advancedTmpDir, 'src/secret.ts'), 'code');
      writeFileSync(
        join(advancedTmpDir, '.aireadyignore'),
        'src/secret.ts\n# comment\n'
      );

      const files = await scanFiles({ rootDir: advancedTmpDir });
      const relFiles = files.map((f) => relative(advancedTmpDir, f));

      expect(relFiles).toContain('src/important.ts');
      expect(relFiles).not.toContain('src/secret.ts');
    });

    it('should include tests when includeTests is true', async () => {
      mkdirSync(join(advancedTmpDir, 'src/__tests__'), { recursive: true });
      writeFileSync(join(advancedTmpDir, 'src/__tests__/app.test.ts'), 'test');
      writeFileSync(join(advancedTmpDir, 'src/app.ts'), 'code');

      // Default (includeTests = false)
      const filesDefault = await scanFiles({ rootDir: advancedTmpDir });
      expect(
        filesDefault.map((f) => relative(advancedTmpDir, f))
      ).not.toContain('src/__tests__/app.test.ts');

      // Explicitly true
      const filesWithTests = await scanFiles({
        rootDir: advancedTmpDir,
        includeTests: true,
      });
      expect(filesWithTests.map((f) => relative(advancedTmpDir, f))).toContain(
        'src/__tests__/app.test.ts'
      );
    });

    it('should handle missing .aireadyignore gracefully', async () => {
      writeFileSync(join(advancedTmpDir, 'app.ts'), 'code');
      const files = await scanFiles({ rootDir: advancedTmpDir });
      expect(files).toHaveLength(1);
    });

    it('should handle multiple nested .gitignore files with relative prefixes', async () => {
      mkdirSync(join(advancedTmpDir, 'pkg-a/src'), { recursive: true });
      mkdirSync(join(advancedTmpDir, 'pkg-b/src'), { recursive: true });

      writeFileSync(join(advancedTmpDir, 'pkg-a/.gitignore'), 'secret.ts');
      writeFileSync(join(advancedTmpDir, 'pkg-a/src/secret.ts'), 'code');
      writeFileSync(join(advancedTmpDir, 'pkg-a/src/public.ts'), 'code');

      writeFileSync(
        join(advancedTmpDir, 'pkg-b/.gitignore'),
        '/absolute-style.ts'
      );
      writeFileSync(
        join(advancedTmpDir, 'pkg-b/src/absolute-style.ts'),
        'code'
      );
      writeFileSync(join(advancedTmpDir, 'pkg-b/src/other.ts'), 'code');

      const files = await scanFiles({ rootDir: advancedTmpDir });
      const relFiles = files.map((f) =>
        relative(advancedTmpDir, f).replace(/\\/g, '/')
      );

      expect(relFiles).toContain('pkg-a/src/public.ts');
      expect(relFiles).not.toContain('pkg-a/src/secret.ts');
      expect(relFiles).toContain('pkg-b/src/other.ts');
    });
  });

  it('should identify source files correctly', () => {
    expect(isSourceFile('test.ts')).toBe(true);
    expect(isSourceFile('test.py')).toBe(true);
    expect(isSourceFile('test.txt')).toBe(false);
    expect(isSourceFile('test.min.js')).toBe(true);
  });

  it('should get file extension', () => {
    expect(getFileExtension('test.ts')).toBe('ts');
    expect(getFileExtension('no-ext')).toBe('no-ext');
    expect(getFileExtension('.gitignore')).toBe('gitignore');
  });
});
