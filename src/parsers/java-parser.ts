import * as Parser from 'web-tree-sitter';
import {
  Language,
  LanguageParser,
  ParseResult,
  ExportInfo,
  ImportInfo,
  NamingConvention,
  ParseError,
} from '../types/language';
import { setupParser } from './tree-sitter-utils';
import {
  analyzeGeneralMetadata,
  extractParameterNames,
} from './shared-parser-utils';

/**
 * Java Parser implementation using tree-sitter
 */
export class JavaParser implements LanguageParser {
  readonly language = Language.Java;
  readonly extensions = ['.java'];
  private parser: Parser.Parser | null = null;
  private initialized = false;

  /**
   * Initialize the tree-sitter parser
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.parser = await setupParser('java');
    this.initialized = true;
  }

  async getAST(code: string, filePath: string): Promise<Parser.Tree | null> {
    if (!this.initialized) await this.initialize();
    if (!this.parser) return null;
    return this.parser.parse(code);
  }

  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    // Java specific side-effect signatures
    return analyzeGeneralMetadata(node, code, {
      sideEffectSignatures: [
        'System.out',
        'System.err',
        'Files.write',
        'Logging.',
      ],
    });
  }

  parse(code: string, filePath: string): ParseResult {
    if (!this.initialized || !this.parser) {
      return this.parseRegex(code, filePath);
    }

    try {
      const tree = this.parser.parse(code);
      if (!tree || tree.rootNode.type === 'ERROR' || tree.rootNode.hasError) {
        return this.parseRegex(code, filePath);
      }
      const rootNode = tree.rootNode;

      const imports = this.extractImportsAST(rootNode);
      const exports = this.extractExportsAST(rootNode, code);

      return {
        exports,
        imports,
        language: Language.Java,
        warnings: [],
      };
    } catch (error) {
      console.warn(
        `AST parsing failed for ${filePath}, falling back to regex: ${(error as Error).message}`
      );
      return this.parseRegex(code, filePath);
    }
  }

  private parseRegex(code: string, filePath: string): ParseResult {
    const lines = code.split('\n');
    const exports: ExportInfo[] = [];
    const imports: ImportInfo[] = [];

    const importRegex = /^import\s+([a-zA-Z0-9_.]+)/;
    const classRegex =
      /^\s*(?:public\s+)?(?:class|interface|enum)\s+([a-zA-Z0-9_]+)/;
    const methodRegex =
      /^\s*public\s+(?:static\s+)?[a-zA-Z0-9_<>[\]]+\s+([a-zA-Z0-9_]+)\s*\(/;

    let currentClassName = '';

    lines.forEach((line, idx) => {
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const source = importMatch[1];
        imports.push({
          source,
          specifiers: [source.split('.').pop() || source],
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const classMatch = line.match(classRegex);
      if (classMatch) {
        currentClassName = classMatch[1];
        exports.push({
          name: currentClassName,
          type: line.includes('interface') ? 'interface' : 'class',
          visibility: 'public',
          isPure: true,
          hasSideEffects: false,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const methodMatch = line.match(methodRegex);
      if (methodMatch && currentClassName) {
        const name = methodMatch[1];

        // Look back for Javadoc
        let docContent: string | undefined;
        const prevLines = lines.slice(Math.max(0, idx - 5), idx);
        const prevText = prevLines.join('\n');
        const javadocMatch = prevText.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
        if (javadocMatch) {
          docContent = javadocMatch[1].replace(/^\s*\*+/gm, '').trim();
        }

        const isImpure =
          name.toLowerCase().includes('impure') || line.includes('System.out');
        exports.push({
          name,
          type: 'function',
          parentClass: currentClassName,
          visibility: 'public',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          documentation: docContent
            ? { content: docContent, type: 'jsdoc' }
            : undefined,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
    });

    return {
      exports,
      imports,
      language: Language.Java,
      warnings: ['Parser falling back to regex-based analysis'],
    };
  }

  private extractImportsAST(rootNode: Parser.Node): ImportInfo[] {
    const imports: ImportInfo[] = [];

    for (const node of rootNode.children) {
      if (node.type === 'import_declaration') {
        const sourceArr: string[] = [];
        let isStatic = false;
        let isWildcard = false;

        // Traverse to find identifier or scoped_identifier
        for (const child of node.children) {
          if (child.type === 'static') isStatic = true;
          if (
            child.type === 'scoped_identifier' ||
            child.type === 'identifier'
          ) {
            sourceArr.push(child.text);
          }
          if (child.type === 'asterisk') isWildcard = true;
        }

        const source = sourceArr.join('.');
        if (source) {
          imports.push({
            source: isWildcard ? `${source}.*` : source,
            specifiers: isWildcard
              ? ['*']
              : [source.split('.').pop() || source],
            loc: {
              start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
              },
              end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
              },
            },
          });
        }
      }
    }

    return imports;
  }

  private extractExportsAST(rootNode: Parser.Node, code: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const node of rootNode.children) {
      if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration' ||
        node.type === 'enum_declaration'
      ) {
        // tree-sitter-java doesn't always use named fields reliably,
        // so we find the first identifier as the name
        const nameNode = node.children.find((c) => c.type === 'identifier');
        if (nameNode) {
          const modifiers = this.getModifiers(node);
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: node.type === 'class_declaration' ? 'class' : 'interface',
            loc: {
              start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
              },
              end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
              },
            },
            visibility: modifiers.includes('public') ? 'public' : 'private',
            ...metadata,
          });

          this.extractSubExports(node, nameNode.text, exports, code);
        }
      }
    }

    return exports;
  }

  private getModifiers(node: Parser.Node): string[] {
    const modifiersNode = node.children.find((c) => c.type === 'modifiers');
    if (!modifiersNode) return [];
    return modifiersNode.children.map((c) => c.text);
  }

  private extractSubExports(
    parentNode: Parser.Node,
    parentName: string,
    exports: ExportInfo[],
    code: string
  ): void {
    const bodyNode = parentNode.children.find((c) => c.type === 'class_body');
    if (!bodyNode) return;

    for (const node of bodyNode.children) {
      if (node.type === 'method_declaration') {
        const nameNode = node.children.find((c) => c.type === 'identifier');
        const modifiers = this.getModifiers(node);

        if (nameNode && modifiers.includes('public')) {
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: 'function',
            parentClass: parentName,
            visibility: 'public',
            loc: {
              start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
              },
              end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
              },
            },
            parameters: this.extractParameters(node),
            ...metadata,
          });
        }
      }
    }
  }

  private extractParameters(node: Parser.Node): string[] {
    return extractParameterNames(node);
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-z][a-zA-Z0-9]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      exceptions: ['main', 'serialVersionUID'],
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.java');
  }
}
