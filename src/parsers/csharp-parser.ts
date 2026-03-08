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
 * C# Parser implementation using tree-sitter
 */
export class CSharpParser implements LanguageParser {
  readonly language = Language.CSharp;
  readonly extensions = ['.cs'];
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
          'node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm'
        ),
        path.join(
          __dirname,
          '../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm'
        ),
        path.join(
          __dirname,
          '../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm'
        ),
        path.join(
          __dirname,
          '../../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm'
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
          `C# WASM not found. Tried paths: ${possiblePaths.join(', ')}`
        );
        return;
      }

      const CSharp = await Parser.Language.load(wasmPath);
      this.parser.setLanguage(CSharp);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize tree-sitter-c-sharp:', error);
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

    // Extract XML-Doc
    // Triple slash comments usually precede the declaration
    let prev = node.previousSibling;
    while (
      prev &&
      (prev.type === 'comment' || prev.type === 'triple_slash_comment')
    ) {
      if (
        prev.text.trim().startsWith('///') ||
        prev.type === 'triple_slash_comment'
      ) {
        metadata.documentation = {
          content: prev.text.replace('///', '').trim(),
          type: 'xml-doc',
        };
        break;
      }
      prev = prev.previousSibling;
    }

    // Heuristics for purity/side-effects in C#
    const walk = (n: Parser.Node) => {
      if (n.type === 'assignment_expression') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
      if (n.type === 'invocation_expression') {
        const text = n.text;
        if (
          text.includes('Console.Write') ||
          text.includes('File.Write') ||
          text.includes('Log.')
        ) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
        }
      }
      if (n.type === 'throw_statement') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) walk(child);
      }
    };

    const body = node.children.find(
      (c) => c.type === 'block' || c.type === 'declaration_list'
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
      if (!tree) throw new Error('Parser.parse(code) returned null');
      const rootNode = tree.rootNode;

      const imports = this.extractImportsAST(rootNode);
      const exports = this.extractExportsAST(rootNode, code);

      return {
        exports,
        imports,
        language: Language.CSharp,
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

    const usingRegex = /^using\s+([a-zA-Z0-9_.]+);/;
    const classRegex = /^\s*(?:public\s+)?class\s+([a-zA-Z0-9_]+)/;
    const methodRegex =
      /^\s*(?:public|protected)\s+(?:static\s+)?[a-zA-Z0-9_.]+\s+([a-zA-Z0-9_]+)\s*\(/;

    let currentClassName = '';

    lines.forEach((line, idx) => {
      const usingMatch = line.match(usingRegex);
      if (usingMatch) {
        const source = usingMatch[1];
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
          type: 'class',
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
        const isImpure =
          name.toLowerCase().includes('impure') ||
          line.includes('Console.WriteLine');
        exports.push({
          name,
          type: 'function',
          parentClass: currentClassName,
          visibility: 'public',
          isPure: !isImpure,
          hasSideEffects: isImpure,
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
      language: Language.CSharp,
      warnings: ['Parser falling back to regex-based analysis'],
    };
  }

  private extractImportsAST(rootNode: Parser.Node): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const findUsings = (node: Parser.Node) => {
      if (node.type === 'using_directive') {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find(
            (c) => c.type === 'qualified_name' || c.type === 'identifier'
          );
        if (nameNode) {
          const aliasNode = node.childForFieldName('alias');
          imports.push({
            source: nameNode.text,
            specifiers: aliasNode
              ? [aliasNode.text]
              : [nameNode.text.split('.').pop() || nameNode.text],
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
        if (child) findUsings(child);
      }
    };

    findUsings(rootNode);
    return imports;
  }

  private extractExportsAST(rootNode: Parser.Node, code: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const traverse = (
      node: Parser.Node,
      currentNamespace?: string,
      currentClass?: string
    ) => {
      let nextNamespace = currentNamespace;
      let nextClass = currentClass;

      if (
        node.type === 'namespace_declaration' ||
        node.type === 'file_scoped_namespace_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find(
            (c) => c.type === 'identifier' || c.type === 'qualified_name'
          );
        if (nameNode) {
          nextNamespace = currentNamespace
            ? `${currentNamespace}.${nameNode.text}`
            : nameNode.text;
        }
      } else if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration' ||
        node.type === 'enum_declaration' ||
        node.type === 'struct_declaration' ||
        node.type === 'record_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode) {
          const modifiers = this.getModifiers(node);
          const isPublic =
            modifiers.includes('public') || modifiers.includes('protected');

          if (isPublic) {
            const metadata = this.analyzeMetadata(node, code);
            const type = node.type.replace('_declaration', '') as any;
            const fullName = nextClass
              ? `${nextClass}.${nameNode.text}`
              : nextNamespace
                ? `${nextNamespace}.${nameNode.text}`
                : nameNode.text;

            exports.push({
              name: fullName,
              type: type === 'record' ? 'class' : type,
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
              visibility: modifiers.includes('public') ? 'public' : 'protected',
              ...metadata,
            });
            nextClass = fullName;
          }
        }
      } else if (
        node.type === 'method_declaration' ||
        node.type === 'property_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode) {
          const modifiers = this.getModifiers(node);
          const isPublic =
            modifiers.includes('public') || modifiers.includes('protected');

          if (isPublic) {
            const metadata = this.analyzeMetadata(node, code);
            exports.push({
              name: nameNode.text,
              type:
                node.type === 'method_declaration'
                  ? 'function'
                  : ('property' as any),
              parentClass: currentClass,
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
              visibility: modifiers.includes('public') ? 'public' : 'protected',
              parameters:
                node.type === 'method_declaration'
                  ? this.extractParameters(node)
                  : undefined,
              ...metadata,
            });
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child, nextNamespace, nextClass);
      }
    };

    traverse(rootNode);
    return exports;
  }

  private getModifiers(node: Parser.Node): string[] {
    const modifiers: string[] = [];
    for (const child of node.children) {
      if (child.type === 'modifier') {
        modifiers.push(child.text);
      }
    }
    return modifiers;
  }

  private extractParameters(node: Parser.Node): string[] {
    const params: string[] = [];
    const parameterList =
      node.childForFieldName('parameters') ||
      node.children.find((c) => c.type === 'parameter_list');
    if (parameterList) {
      for (const param of parameterList.children) {
        if (param.type === 'parameter') {
          const nameNode =
            param.childForFieldName('name') ||
            param.children.find((c) => c.type === 'identifier');
          if (nameNode) {
            params.push(nameNode.text);
          }
        }
      }
    }
    return params;
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[A-Z][a-zA-Z0-9]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][a-zA-Z0-9_]*$/,
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.cs');
  }
}
