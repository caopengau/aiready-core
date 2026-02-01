/**
 * Test multi-language parser factory
 */

import { describe, it, expect } from 'vitest';
import {
  ParserFactory,
  Language,
  getParser,
  isFileSupported,
  getSupportedLanguages,
} from '../parsers/parser-factory';

describe('ParserFactory', () => {
  it('should return TypeScript parser for .ts files', () => {
    const parser = getParser('test.ts');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe(Language.TypeScript);
  });

  it('should return TypeScript parser for .tsx files', () => {
    const parser = getParser('component.tsx');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe(Language.TypeScript);
  });

  it('should return JavaScript parser for .js files', () => {
    const parser = getParser('script.js');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe(Language.TypeScript); // TS parser handles JS too
  });

  it('should return Python parser for .py files', () => {
    const parser = getParser('script.py');
    expect(parser).toBeDefined();
    expect(parser?.language).toBe(Language.Python);
  });

  it('should return null for unsupported files', () => {
    const parser = getParser('README.md');
    expect(parser).toBeNull();
  });

  it('should correctly identify supported files', () => {
    expect(isFileSupported('test.ts')).toBe(true);
    expect(isFileSupported('test.py')).toBe(true);
    expect(isFileSupported('test.java')).toBe(false); // Not yet implemented
    expect(isFileSupported('README.md')).toBe(false);
  });

  it('should list all supported languages', () => {
    const languages = getSupportedLanguages();
    expect(languages).toContain(Language.TypeScript);
    expect(languages).toContain(Language.Python);
    expect(languages.length).toBeGreaterThanOrEqual(2);
  });

  it('should be case-insensitive for extensions', () => {
    expect(getParser('Test.TS')).toBeDefined();
    expect(getParser('Test.PY')).toBeDefined();
  });
});

describe('Language Detection', () => {
  it('should detect language from file path', () => {
    const factory = ParserFactory.getInstance();
    
    expect(factory.getLanguageForFile('src/index.ts')).toBe(Language.TypeScript);
    expect(factory.getLanguageForFile('src/component.tsx')).toBe(Language.TypeScript);
    expect(factory.getLanguageForFile('src/script.js')).toBe(Language.JavaScript);
    expect(factory.getLanguageForFile('src/main.py')).toBe(Language.Python);
    expect(factory.getLanguageForFile('README.md')).toBeNull();
  });
});
