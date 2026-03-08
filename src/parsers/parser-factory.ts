import * as fs from 'fs';
fs.appendFileSync(
  '/tmp/aiready_debug.log',
  `[TRACE] Loading ParserFactory.ts from ${__filename} at ${new Date().toISOString()}\n`
);
/**
 * Parser Factory - Manages language-specific parsers
 *
 * This factory provides a centralized way to access the appropriate parser
 * for a given file based on its extension.
 */

import {
  Language,
  LanguageParser,
  LANGUAGE_EXTENSIONS,
} from '../types/language';
export { Language, LanguageParser, LANGUAGE_EXTENSIONS };
import { TypeScriptParser } from './typescript-parser';
import { PythonParser } from './python-parser';
import { JavaParser } from './java-parser';
import { CSharpParser } from './csharp-parser';
import { GoParser } from './go-parser';

/**
 * Factory for creating and managing language parsers
 */
export class ParserFactory {
  private static instance: ParserFactory;
  private parsers: Map<Language, LanguageParser>;
  private extensionMap: Map<string, Language>;

  private constructor() {
    this.parsers = new Map();
    this.extensionMap = new Map(
      Object.entries(LANGUAGE_EXTENSIONS).map(([ext, lang]) => [ext, lang])
    );

    // Register default parsers
    this.registerParser(new TypeScriptParser());
    this.registerParser(new PythonParser());
    this.registerParser(new JavaParser());
    this.registerParser(new CSharpParser());
    this.registerParser(new GoParser());
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ParserFactory {
    if (!ParserFactory.instance) {
      ParserFactory.instance = new ParserFactory();
    }
    return ParserFactory.instance;
  }

  /**
   * Register a language parser
   */
  public registerParser(parser: LanguageParser): void {
    // Register parser for its primary language
    this.parsers.set(parser.language, parser);

    // Map extensions and register for all supported languages
    parser.extensions.forEach((ext) => {
      const lang = LANGUAGE_EXTENSIONS[ext] || parser.language;
      this.extensionMap.set(ext, lang);
      this.parsers.set(lang, parser);
    });
  }

  /**
   * Get parser for a specific language
   */
  public getParserForLanguage(language: Language): LanguageParser | null {
    return this.parsers.get(language) || null;
  }

  /**
   * Get parser for a file based on its extension
   */
  public getParserForFile(filePath: string): LanguageParser | null {
    const ext = this.getFileExtension(filePath);
    const language = this.extensionMap.get(ext);

    if (!language) {
      return null;
    }

    return this.parsers.get(language) || null;
  }

  /**
   * Check if a file is supported
   */
  public isSupported(filePath: string): boolean {
    return this.getParserForFile(filePath) !== null;
  }

  /**
   * Get all registered languages
   */
  public getSupportedLanguages(): Language[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Get all supported file extensions
   */
  public getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Get language for a file
   */
  public getLanguageForFile(filePath: string): Language | null {
    const ext = this.getFileExtension(filePath);
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Extract file extension (with dot)
   */
  private getFileExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : '';
  }

  /**
   * Reset factory (useful for testing)
   */
  public static reset(): void {
    ParserFactory.instance = new ParserFactory();
  }

  /**
   * Initialize all registered parsers
   */
  public async initializeAll(): Promise<void> {
    const promises = Array.from(this.parsers.values()).map((p) =>
      p.initialize()
    );
    await Promise.all(promises);
  }
}

/**
 * Convenience function to get parser for a file
 */
export function getParser(filePath: string): LanguageParser | null {
  return ParserFactory.getInstance().getParserForFile(filePath);
}

/**
 * Initialize all parsers
 */
export async function initializeParsers(): Promise<void> {
  await ParserFactory.getInstance().initializeAll();
}

/**
 * Convenience function to check if file is supported
 */
export function isFileSupported(filePath: string): boolean {
  return ParserFactory.getInstance().isSupported(filePath);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Language[] {
  return ParserFactory.getInstance().getSupportedLanguages();
}
