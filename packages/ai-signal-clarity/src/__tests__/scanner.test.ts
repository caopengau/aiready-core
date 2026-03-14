import { scanFile } from '../scanner';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('AI Signal Clarity Scanner', () => {
  const tmpDir = join(tmpdir(), 'aiready-hr-scan-tests');

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestFile(name: string, content: string): string {
    const filePath = join(tmpDir, name);
    writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  describe('Magic Literals', () => {
    it('should detect top-level unnamed string and number constants', async () => {
      const file = createTestFile(
        'magic-literals.ts',
        `
        function calculate() {
          // These are magic literals
          const timeout = setTimeout(() => {}, 5000);
          if (status === "failed") {
            return 402;
          }
        }
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter(
        (i) => i.category === 'magic-literal'
      );

      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues.some((i) => i.message.includes('5000'))).toBe(true);
      expect(issues.some((i) => i.message.includes('402'))).toBe(true);
      expect(issues.some((i) => i.message.includes('failed'))).toBe(true);
      expect((result.signals as any).magicLiterals).toBeGreaterThanOrEqual(3);
    });

    it('should ignore literals assigned to named constants', async () => {
      const file = createTestFile(
        'named-constants.ts',
        `
        const TIMEOUT_MS = 5000;
        const STATUS_FAILED = "PAYMENT_FAILED";
        const HTTP_PAYMENT_REQUIRED = 402;
        
        function calculate() {
          const timeout = setTimeout(() => {}, TIMEOUT_MS);
          if (status === STATUS_FAILED) {
            return HTTP_PAYMENT_REQUIRED;
          }
        }
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter(
        (i) => i.category === 'magic-literal'
      );
      // Improved: literals assigned to named constants or all-caps strings should be ignored
      expect(issues.length).toBe(0);
      expect((result.signals as any).magicLiterals).toBe(0);
    });

    it('should ignore Tailwind classes and common config strings', async () => {
      const file = createTestFile(
        'tailwind-and-config.tsx',
        `
        export const MyComponent = () => {
          return (
            <div className="p-6 lg:p-10 text-2xl bg-cyber-green/5">
              <span>Neural observation...</span>
            </div>
          );
        };
        
        export const config = {
          mode: "production",
          type: "node",
          action: "remove"
        };
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter(
        (i) => i.category === 'magic-literal'
      );

      // Should ignore:
      // - className values (Tailwind)
      // - "Neural observation..." (length > 20)
      // - config keys (object properties)
      // - config values like "production", "node", "remove" (ignore list)

      expect(issues.length).toBe(0);
      expect((result.signals as any).magicLiterals).toBe(0);
    });
  });

  describe('Boolean Traps', () => {
    it('should detect positional booleans in function calls', async () => {
      const file = createTestFile(
        'boolean-traps.ts',
        `
        function configure(force: boolean, silent: boolean) {}
        
        // This is a boolean trap
        configure(true, false);
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter((i) => i.category === 'boolean-trap');

      expect(issues.length).toBe(1);
      expect((result.signals as any).booleanTraps).toBe(1);
    });

    it('should ignore boolean literals in assignments and returns', async () => {
      const file = createTestFile(
        'boolean-ok.ts',
        `
        const isForce = true;
        let isSilent = false;
        
        function check() {
          return true;
        }
        
        // Named parameter object
        configure({ force: true, silent: false });
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter((i) => i.category === 'boolean-trap');

      expect(issues.length).toBe(0);
      expect((result.signals as any).booleanTraps).toBe(0);
    });
  });

  describe('Ambiguous Names', () => {
    it('should detect single-letter variables and generic names', async () => {
      const file = createTestFile(
        'ambiguous.ts',
        `
        function fn(v: string) {
          return v;
        }
        const temp = {};
        const data = [];
        const result = 1;
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter(
        (i) => i.category === 'ambiguous-name'
      );

      expect(issues.length).toBeGreaterThanOrEqual(3); // temp, data, result
      expect(issues.some((i) => i.message.includes('"temp"'))).toBe(true);
      expect((result.signals as any).ambiguousNames).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Deep Callbacks', () => {
    it('should detect callbacks nested more than 2 levels deep', async () => {
      const file = createTestFile(
        'callbacks.ts',
        `
        function doWork() {
          // Level 1
          fetch(url).then(res => {
            // Level 2
            res.json().then(data => {
              // Level 3 (Deep!)
              data.map(item => {
                // Level 4 (Deeper!)
                setTimeout(() => {
                  console.log(item);
                }, 100);
              });
            });
          });
        }
      `
      );

      const result = await scanFile(file, {
        rootDir: tmpDir,
        minSeverity: 'info',
      });
      const issues = result.issues.filter(
        (i) => i.category === 'deep-callback'
      );

      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect((result.signals as any).deepCallbacks).toBeGreaterThanOrEqual(2); // level 3 and 4
    });
  });
});
