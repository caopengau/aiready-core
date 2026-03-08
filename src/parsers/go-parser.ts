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
 * Go Parser implementation using tree-sitter
 */
export class GoParser implements LanguageParser {
  readonly language = Language.Go;
  readonly extensions = ['.go'];
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

      const possiblePaths = [
        path.join(
          process.cwd(),
          'node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm'
        ),
        path.join(
          __dirname,
          '../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm'
        ),
        path.join(
          __dirname,
          '../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm'
        ),
        path.join(
          __dirname,
          '../../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm'
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
          `Go WASM not found. Tried paths: ${possiblePaths.join(', ')}`
        );
        return;
      }

      const Go = await Parser.Language.load(wasmPath);
      this.parser.setLanguage(Go);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize tree-sitter-go:', error);
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

    // Extract Go comments
    // Comments usually precede the declaration
    let prev = node.previousSibling;
    // Go comments can be block or line, usually look for those immediately above
    while (prev && prev.type === 'comment') {
      metadata.documentation = {
        content: prev.text.replace(/\/\/|\/\*|\*\//g, '').trim(),
        type: 'comment',
      };
      // For now just take the immediate one
      break;
    }

    // Heuristics for purity/side-effects in Go
    const walk = (n: Parser.Node) => {
      // Look for channel sends/receives
      if (
        n.type === 'send_statement' ||
        (n.type === 'expression_statement' && n.text.includes('<-'))
      ) {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }

      // Look for assignments
      if (
        n.type === 'assignment_statement' ||
        n.type === 'short_var_declaration'
      ) {
        // Technically pure if it's local, but we'll flag any for now or refined later
        // In Go, package level assignments are always impure.
      }

      // Look for side-effectful calls
      if (n.type === 'call_expression') {
        const text = n.text;
        if (
          text.includes('fmt.Print') ||
          text.includes('os.Exit') ||
          text.includes('panic(') ||
          text.includes('log.')
        ) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) walk(child);
      }
    };

    const body = node.childForFieldName('body');
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
        language: Language.Go,
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

    const importRegex = /^import\s+"([^"]+)"/;
    const funcRegex = /^func\s+([A-Z][a-zA-Z0-9_]*)\s*\(/;
    const typeRegex = /^type\s+([A-Z][a-zA-Z0-9_]*)\s+(struct|interface)/;

    lines.forEach((line, idx) => {
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const source = importMatch[1];
        imports.push({
          source,
          specifiers: [source.split('/').pop() || source],
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        const name = funcMatch[1];
        const isPublic = /^[A-Z]/.test(name);

        // Look back for comment
        let docContent: string | undefined;
        const prevLines = lines.slice(Math.max(0, idx - 3), idx);
        for (let i = prevLines.length - 1; i >= 0; i--) {
          const prevLine = prevLines[i].trim();
          if (prevLine.startsWith('//')) {
            const content = prevLine.slice(2).trim();
            docContent = docContent ? content + '\n' + docContent : content;
          } else if (prevLine.endsWith('*/')) {
            // Basic block comment support
            const blockMatch = prevLine.match(/\/\*([\s\S]*)\*\//);
            if (blockMatch) docContent = blockMatch[1].trim();
            break;
          } else if (!prevLine) {
            if (docContent) break;
          } else {
            break;
          }
        }

        const isImpure =
          name.toLowerCase().includes('impure') || line.includes('fmt.Print');
        exports.push({
          name,
          type: 'function',
          visibility: isPublic ? 'public' : 'private',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          documentation: docContent
            ? { content: docContent, type: 'comment' }
            : undefined,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
      const typeMatch = line.match(typeRegex);
      if (typeMatch) {
        exports.push({
          name: typeMatch[1],
          type: typeMatch[2] === 'struct' ? 'class' : 'interface',
          visibility: 'public',
          isPure: true,
          hasSideEffects: false,
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
      language: Language.Go,
      warnings: ['Parser falling back to regex-based analysis'],
    };
  }

  private extractImportsAST(rootNode: Parser.Node): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const findImports = (node: Parser.Node) => {
      if (node.type === 'import_spec') {
        const pathNode = node.children.find(
          (c) => c.type === 'interpreted_string_literal'
        );
        if (pathNode) {
          const source = pathNode.text.replace(/"/g, '');
          imports.push({
            source,
            specifiers: [source.split('/').pop() || source],
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

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) findImports(child);
      }
    };

    findImports(rootNode);
    return imports;
  }

  private extractExportsAST(rootNode: Parser.Node, code: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const isExported = (name: string) => {
      return /^[A-Z]/.test(name);
    };

    const traverse = (node: Parser.Node) => {
      if (
        node.type === 'function_declaration' ||
        node.type === 'method_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode && isExported(nameNode.text)) {
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: 'function',
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
            visibility: 'public',
            parameters: this.extractParameters(node),
            ...metadata,
          });
        }
      } else if (node.type === 'type_spec') {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'type_identifier');
        if (nameNode && isExported(nameNode.text)) {
          const metadata = this.analyzeMetadata(node.parent || node, code);
          const type = node.children.some((c) => c.type === 'struct_type')
            ? 'class'
            : 'interface';
          exports.push({
            name: nameNode.text,
            type: type as any,
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
            visibility: 'public',
            ...metadata,
          });
        }
      } else if (node.type === 'var_spec' || node.type === 'const_spec') {
        // var ( a, B = 1, 2 ) -> multiple identifiers possible
        const identifiers = node.children.filter(
          (c) => c.type === 'identifier'
        );
        for (const idNode of identifiers) {
          if (isExported(idNode.text)) {
            const metadata = this.analyzeMetadata(node, code);
            exports.push({
              name: idNode.text,
              type: 'variable',
              loc: {
                start: {
                  line: idNode.startPosition.row + 1,
                  column: idNode.startPosition.column,
                },
                end: {
                  line: idNode.endPosition.row + 1,
                  column: idNode.endPosition.column,
                },
              },
              visibility: 'public',
              ...metadata,
            });
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child);
      }
    };

    traverse(rootNode);
    return exports;
  }

  private extractParameters(node: Parser.Node): string[] {
    const params: string[] = [];
    const parameterList =
      node.childForFieldName('parameters') ||
      node.children.find((c) => c.type === 'parameter_list');
    if (parameterList) {
      for (const param of parameterList.children) {
        if (param.type === 'parameter_declaration') {
          const names = param.children.filter((c) => c.type === 'identifier');
          names.forEach((n) => params.push(n.text));
        }
      }
    }
    return params;
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      classPattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.go');
  }
}
