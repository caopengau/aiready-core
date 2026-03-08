import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import {
  Language,
  LanguageParser,
  ParseResult,
  ExportInfo,
  ImportInfo,
  NamingConvention,
  ParseError,
} from '../types/language';

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

    try {
      if (typeof Parser.Parser.init === 'function') {
        await Parser.Parser.init();
      }
      this.parser = new Parser.Parser();

      // Try to find the wasm file in several common locations
      // Using tree-sitter-wasms package
      const possiblePaths = [
        path.join(
          process.cwd(),
          'node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm'
        ),
        path.join(
          __dirname,
          '../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm'
        ),
        path.join(
          __dirname,
          '../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm'
        ),
        path.join(
          __dirname,
          '../../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm'
        ),
        path.join(
          process.cwd(),
          'node_modules/tree-sitter-wasms/out/tree-sitter-java.wasm'
        ),
      ];

      let wasmPath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          wasmPath = p;
          break;
        }
      }

      if (!wasmPath) {
        console.warn(
          `Java WASM not found. Tried paths: ${possiblePaths.join(', ')}`
        );
        return;
      }

      const Java = await Parser.Language.load(wasmPath);
      this.parser.setLanguage(Java);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize tree-sitter-java:', error);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  async getAST(code: string, filePath: string): Promise<Parser.Tree | null> {
    if (!this.initialized) await this.initialize();
    if (!this.parser) return null;
    return this.parser.parse(code);
  }

  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    const metadata: Partial<ExportInfo> = {
      isPure: true,
      hasSideEffects: false,
    };

    // Extract Javadoc
    // In Java tree-sitter, comments often precede the declaration
    let prev = node.previousSibling;
    while (prev && (prev.type === 'comment' || prev.type === 'line_comment')) {
      if (prev.text.startsWith('/**')) {
        metadata.documentation = {
          content: prev.text.replace(/[/*]/g, '').trim(),
          type: 'xml-doc', // Using xml-doc as a catch-all for structured or we can add 'javadoc'
        };
        break;
      }
      prev = prev.previousSibling;
    }

    // Heuristics for purity/side-effects in Java
    const walk = (n: Parser.Node) => {
      // Look for assignments to fields (member_access or identifier in expression_statement)
      if (n.type === 'assignment_expression') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }

      // Look for side-effectful method calls
      if (n.type === 'method_invocation') {
        const text = n.text;
        if (
          text.includes('System.out.print') ||
          text.includes('System.err.print') ||
          text.includes('Files.write')
        ) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
        }
      }

      if (n.type === 'throw_statement') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }

      for (const child of n.children) {
        walk(child);
      }
    };

    const body = node.children.find(
      (c) => c.type === 'block' || c.type === 'class_body'
    );
    if (body) walk(body);

    return metadata;
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
        let sourceArr: string[] = [];
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
    const paramsNode = node.children.find(
      (c) => c.type === 'formal_parameters'
    );
    if (!paramsNode) return [];

    return paramsNode.children
      .filter((c) => c.type === 'formal_parameter')
      .map((c) => {
        const idNode = c.children.find((child) => child.type === 'identifier');
        return idNode ? idNode.text : 'unknown';
      });
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
