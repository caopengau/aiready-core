/**
 * Metric Parity Integration Tests
 * Verifies that all supported languages extract parity metadata (purity, docs, side effects)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ParserFactory, Language } from '../parsers/parser-factory';

describe('Metric Parity', () => {
  const factory = ParserFactory.getInstance();

  beforeAll(async () => {
    await factory.initializeAll();
  });

  const testCases = [
    {
      language: Language.TypeScript,
      extension: '.ts',
      code: `/**
 * Pure function with documentation
 */
export function pureFunc(s: string): string {
  return s.trim();
}

/**
 * Impure function with documentation
 */
export function impureFunc(s: string): void {
  console.log(s);
  globalVar = s;
}`,
    },
    {
      language: Language.Python,
      extension: '.py',
      code: `def pure_func(s: str) -> str:
    """Pure function with documentation"""
    return s.strip()

def impure_func(s: str) -> None:
    """Impure function with documentation"""
    print(s)
    global global_var
    global_var = s`,
    },
    {
      language: Language.Java,
      extension: '.java',
      code: `public class MyClass {
    /**
     * Pure function with documentation
     */
    public String pureFunc(String s) {
        return s.trim();
    }

    /**
     * Impure function with documentation
     */
    public void impureFunc(String s) {
        System.out.println(s);
        this.value = s;
    }
}`,
    },
    {
      language: Language.CSharp,
      extension: '.cs',
      code: `public class MyClass {
    /// <summary>Pure function with documentation</summary>
    public string PureFunc(string s) {
        return s.Trim();
    }

    /// <summary>Impure function with documentation</summary>
    public void ImpureFunc(string s) {
        Console.WriteLine(s);
        this.value = s;
    }
}`,
    },
    {
      language: Language.Go,
      extension: '.go',
      code: `package main

// Pure function with documentation
func PureFunc(s string) string {
    return strings.TrimSpace(s)
}

// Impure function with documentation
func ImpureFunc(s string) {
    fmt.Println(s)
    GlobalVar = s
}`,
    },
  ];

  testCases.forEach(({ language, extension, code }) => {
    describe(`Language: ${language}`, () => {
      it('should extract purity and documentation metadata correctly', () => {
        const parser = factory.getParserForLanguage(language);
        expect(parser).toBeDefined();

        const result = parser!.parse(code, `test${extension}`);

        if (result.exports.length === 0) {
          console.log(`[DEBUG] No exports found for ${language}.`);
          console.log(`[DEBUG] Result warnings:`, result.warnings);
        } else {
          console.log(
            `[DEBUG] Exports for ${language}:`,
            result.exports.map((e) => e.name)
          );
        }

        // Find pure function
        const pureFunc = result.exports.find(
          (e) =>
            e.name.toLowerCase().includes('purefunc') ||
            e.name.toLowerCase().includes('pure_func')
        );

        if (pureFunc) {
          console.log(
            `[DEBUG] ${language} pureFunc documentation:`,
            pureFunc.documentation
          );
          console.log(
            `[DEBUG] ${language} pureFunc purity: pure=${pureFunc.isPure}, sideEffects=${pureFunc.hasSideEffects}`
          );
        } else {
          console.log(`[DEBUG] ${language} pureFunc NOT FOUND`);
        }

        expect(pureFunc).toBeDefined();
        expect(pureFunc!.isPure).toBe(true);
        expect(pureFunc!.hasSideEffects).toBe(false);
        expect(pureFunc!.documentation).toBeDefined();
        expect(pureFunc!.documentation!.content).toContain('Pure function');

        // Find impure function
        const impureFunc = result.exports.find(
          (e) =>
            e.name.toLowerCase().includes('impurefunc') ||
            e.name.toLowerCase().includes('impure_func')
        );

        if (impureFunc) {
          console.log(
            `[DEBUG] ${language} impureFunc documentation:`,
            impureFunc.documentation
          );
          console.log(
            `[DEBUG] ${language} impureFunc purity: pure=${impureFunc.isPure}, sideEffects=${impureFunc.hasSideEffects}`
          );
        } else {
          console.log(`[DEBUG] ${language} impureFunc NOT FOUND`);
        }

        expect(impureFunc).toBeDefined();
        expect(impureFunc!.isPure).toBe(false);
        expect(impureFunc!.hasSideEffects).toBe(true);
        expect(impureFunc!.documentation).toBeDefined();
        expect(impureFunc!.documentation!.content).toContain('Impure function');
      });
    });
  });
});
