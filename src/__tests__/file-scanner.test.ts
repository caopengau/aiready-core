import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanFiles, scanEntries, isSourceFile } from '../utils/file-scanner';
import { join } from 'path';
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

  it('should identify source files correctly', () => {
    expect(isSourceFile('test.ts')).toBe(true);
    expect(isSourceFile('test.py')).toBe(true);
    expect(isSourceFile('test.txt')).toBe(false);
    expect(isSourceFile('test.min.js')).toBe(true); // isSourceFile only checks extension
  });
});
