import {
  Language,
  LanguageParser,
  LANGUAGE_EXTENSIONS,
} from '../types/language';
export { Language, LanguageParser, LANGUAGE_EXTENSIONS };

/**
 * Factory for creating and managing language parsers.
 * Supports both singleton usage and multiple instances for test isolation.
 *
 * @lastUpdated 2026-03-22
 */
export class ParserFactory {
  private static instance: ParserFactory;
  private parsers: Map<Language, LanguageParser>;
  private extensionMap: Map<string, Language>;
  private registeredParsers: Map<Language, () => Promise<LanguageParser>>;

  /**
   * Create a new ParserFactory instance
   */
  constructor() {
    this.parsers = new Map();
    this.registeredParsers = new Map();
    this.extensionMap = new Map(
      Object.entries(LANGUAGE_EXTENSIONS).map(([ext, lang]) => [ext, lang])
    );

    // Register lazy-loaded parsers
    this.registerLazyParser(Language.TypeScript, async () => {
      const { TypeScriptParser } = await import('./typescript-parser');
      return new TypeScriptParser();
    });
    this.registerLazyParser(Language.JavaScript, async () => {
      const { TypeScriptParser } = await import('./typescript-parser');
      return new TypeScriptParser();
    });
    this.registerLazyParser(Language.Python, async () => {
      const { PythonParser } = await import('./python-parser');
      return new PythonParser();
    });
    this.registerLazyParser(Language.Java, async () => {
      const { JavaParser } = await import('./java-parser');
      return new JavaParser();
    });
    this.registerLazyParser(Language.CSharp, async () => {
      const { CSharpParser } = await import('./csharp-parser');
      return new CSharpParser();
    });
    this.registerLazyParser(Language.Go, async () => {
      const { GoParser } = await import('./go-parser');
      return new GoParser();
    });
  }

  /**
   * Register a lazy-loaded parser
   */
  public registerLazyParser(
    language: Language,
    loader: () => Promise<LanguageParser>
  ): void {
    this.registeredParsers.set(language, loader);
  }

  /**
   * Get the global singleton instance
   *
   * @returns The singleton ParserFactory instance
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
  public async getParserForLanguage(
    language: Language
  ): Promise<LanguageParser | null> {
    const parser = this.parsers.get(language);
    if (parser) return parser;

    const loader = this.registeredParsers.get(language);
    if (loader) {
      const loadedParser = await loader();
      this.parsers.set(language, loadedParser);
      return loadedParser;
    }

    return null;
  }

  /**
   * Get parser for a file based on its extension
   */
  public async getParserForFile(
    filePath: string
  ): Promise<LanguageParser | null> {
    const ext = this.getFileExtension(filePath);
    const language = this.extensionMap.get(ext);

    if (!language) {
      return null;
    }

    return this.getParserForLanguage(language);
  }

  /**
   * Check if a file is supported (synchronous check based on extension)
   */
  public isSupported(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return this.extensionMap.has(ext);
  }

  /**
   * Get all registered languages
   */
  public getSupportedLanguages(): Language[] {
    const languages = new Set<Language>([
      ...this.parsers.keys(),
      ...this.registeredParsers.keys(),
    ]);
    return Array.from(languages);
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
 * Convenience function to get parser for a file.
 *
 * @param filePath - Path to the file to get a parser for.
 * @returns LanguageParser instance or null if unsupported.
 * @lastUpdated 2026-03-22
 */
export async function getParser(
  filePath: string
): Promise<LanguageParser | null> {
  return ParserFactory.getInstance().getParserForFile(filePath);
}

/**
 * Initialize all parsers
 */
export async function initializeParsers(): Promise<void> {
  await ParserFactory.getInstance().initializeAll();
}

/**
 * Convenience function to check if file is supported.
 *
 * @param filePath - Path to the file to check.
 * @returns True if the file extension is supported.
 * @lastUpdated 2026-03-18
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
