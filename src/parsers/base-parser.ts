import * as Parser from 'web-tree-sitter';
import {
  ExportInfo,
  Language,
  LanguageParser,
  NamingConvention,
  ParseResult,
} from '../types/language';
import { FileImport } from '../types/ast';
import { setupParser } from './tree-sitter-utils';

/**
 * Base Language Parser implementation to consolidate shared logic
 */
export abstract class BaseLanguageParser implements LanguageParser {
  abstract readonly language: Language;
  abstract readonly extensions: string[];
  protected parser: Parser.Parser | null = null;
  protected initialized = false;

  /**
   * Initialize the tree-sitter parser
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.parser = await setupParser(this.getParserName());
      this.initialized = true;
    } catch (error) {
      console.warn(`Failed to initialize ${this.language} parser:`, error);
    }
  }

  /**
   * Get the parser name for tree-sitter setup
   */
  protected abstract getParserName(): string;

  async getAST(code: string, _filePath?: string): Promise<Parser.Tree | null> {
    void _filePath;
    if (!this.initialized) await this.initialize();
    if (!this.parser) return null;
    return this.parser.parse(code);
  }

  abstract analyzeMetadata(
    node: Parser.Node,
    code: string
  ): Partial<ExportInfo>;

  parse(code: string, filePath: string): ParseResult {
    if (!this.initialized || !this.parser) {
      return this.parseRegex(code, filePath);
    }

    try {
      const tree = this.parser.parse(code);
      if (!tree || tree.rootNode.type === 'ERROR' || tree.rootNode.hasError) {
        return this.parseRegex(code, filePath);
      }

      const imports = this.extractImportsAST(tree.rootNode);
      const exports = this.extractExportsAST(tree.rootNode, code);

      return {
        exports,
        imports,
        language: this.language,
        warnings: [],
      };
    } catch (error) {
      console.warn(
        `AST parsing failed for ${filePath}, falling back to regex: ${(error as Error).message}`
      );
      return this.parseRegex(code, filePath);
    }
  }

  protected abstract extractImportsAST(rootNode: Parser.Node): FileImport[];
  protected abstract extractExportsAST(
    rootNode: Parser.Node,
    code: string
  ): ExportInfo[];
  protected abstract parseRegex(code: string, filePath: string): ParseResult;
  abstract getNamingConventions(): NamingConvention;

  canHandle(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return this.extensions.some((ext) => lowerPath.endsWith(ext));
  }
}
