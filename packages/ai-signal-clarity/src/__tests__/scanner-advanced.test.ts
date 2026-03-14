import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanFile } from '../scanner';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Scanner Advanced Signals', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `aiready-clarity-advanced-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects all signals in a complex TS file', async () => {
    const filePath = join(tmpDir, 'complex.ts');
    const code = `
      export const VERSION = 1.2; // Magic number
      export const SECRET = "xyz123"; // Magic string
      
      /** 
       * Missing docs check 
       */
      export function documented() {}
      
      export function undocumented() {} // Undocumented export
      
      export function mutate() { // Implicit side effect
        global.x = 1;
      }
      
      export function overloaded(x: number): void;
      export function overloaded(x: string): void;
      export function overloaded(x: any): void {}
      
      function logic() {
        const a = 1; // Ambiguous name
        const data = "stuff"; // Ambiguous name
        
        call(true, false); // Boolean traps
        
        // Deep callbacks
        func(() => {
          func(() => {
            func(() => {
              func(() => {
                console.log("too deep");
              });
            });
          });
        });
      }
    `;
    writeFileSync(filePath, code);

    const result = await scanFile(filePath);

    expect((result.signals as any).magicLiterals).toBeGreaterThanOrEqual(2);
    expect((result.signals as any).undocumentedExports).toBeGreaterThanOrEqual(
      1
    );
    expect((result.signals as any).implicitSideEffects).toBeGreaterThanOrEqual(
      1
    );
    expect((result.signals as any).overloadedSymbols).toBeGreaterThanOrEqual(1);
    expect((result.signals as any).booleanTraps).toBeGreaterThanOrEqual(1);
    expect((result.signals as any).ambiguousNames).toBeGreaterThanOrEqual(2);
    expect((result.signals as any).deepCallbacks).toBeGreaterThanOrEqual(1);
  });

  it('handles non-existent files gracefully', async () => {
    const result = await scanFile(join(tmpDir, 'non-existent.ts'));
    expect(result.issues).toHaveLength(0);
    expect((result.signals as any).totalSymbols).toBe(0);
  });
});
