/**
 * Python Parser using tree-sitter
 * 
 * Parses Python files using tree-sitter-python for accurate AST parsing
 */

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
 * Python Parser implementation
 * 
 * Note: This implementation will use tree-sitter-python for parsing.
 * For now, it provides a skeleton that can be filled in once web-tree-sitter
 * is properly configured.
 */
export class PythonParser implements LanguageParser {
  readonly language = Language.Python;
  readonly extensions = ['.py'];
  private parser: any = null;
  private initialized = false;

  /**
   * Initialize the tree-sitter parser
   * This is async because tree-sitter WASM needs to be loaded
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // TODO: Initialize tree-sitter-python
      // const Parser = await import('web-tree-sitter');
      // await Parser.init();
      // this.parser = new Parser();
      // const Python = await Parser.Language.load('tree-sitter-python.wasm');
      // this.parser.setLanguage(Python);
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Python parser: ${(error as Error).message}`);
    }
  }

  parse(code: string, filePath: string): ParseResult {
    // TODO: Implement when tree-sitter is configured
    // For now, return a basic parse with regex-based extraction
    
    try {
      const imports = this.extractImportsRegex(code, filePath);
      const exports = this.extractExportsRegex(code, filePath);

      return {
        exports,
        imports,
        language: Language.Python,
        warnings: ['Python parsing is currently using regex-based extraction. Tree-sitter support coming soon.'],
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Python file ${filePath}: ${(error as Error).message}`,
        filePath
      );
    }
  }

  getNamingConventions(): NamingConvention {
    // PEP 8 naming conventions
    return {
      // snake_case for variables and functions
      variablePattern: /^[a-z_][a-z0-9_]*$/,
      functionPattern: /^[a-z_][a-z0-9_]*$/,
      // PascalCase for classes
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      // UPPER_CASE for constants
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      // Python special methods and common exceptions
      exceptions: [
        '__init__',
        '__str__',
        '__repr__',
        '__name__',
        '__main__',
        '__file__',
        '__doc__',
        '__all__',
        '__version__',
        '__author__',
        '__dict__',
        '__class__',
        '__module__',
        '__bases__',
      ],
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.py');
  }

  /**
   * Regex-based import extraction (temporary implementation)
   */
  private extractImportsRegex(code: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = code.split('\n');

    // Match: import module
    // Match: import module as alias
    // Match: from module import name
    // Match: from module import name1, name2
    // Match: from module import *

    const importRegex = /^\s*import\s+([a-zA-Z0-9_., ]+)/;
    const fromImportRegex = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)/;

    lines.forEach((line, idx) => {
      // Skip comments
      if (line.trim().startsWith('#')) return;

      // Handle "import module"
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const modules = importMatch[1].split(',').map(m => m.trim().split(' as ')[0]);
        modules.forEach(module => {
          imports.push({
            source: module,
            specifiers: [module],
            loc: {
              start: { line: idx + 1, column: 0 },
              end: { line: idx + 1, column: line.length },
            },
          });
        });
        return;
      }

      // Handle "from module import ..."
      const fromMatch = line.match(fromImportRegex);
      if (fromMatch) {
        const module = fromMatch[1];
        const imports_str = fromMatch[2];
        
        // Handle "from module import *"
        if (imports_str.trim() === '*') {
          imports.push({
            source: module,
            specifiers: ['*'],
            loc: {
              start: { line: idx + 1, column: 0 },
              end: { line: idx + 1, column: line.length },
            },
          });
          return;
        }

        // Handle "from module import name1, name2"
        const specifiers = imports_str
          .split(',')
          .map(s => s.trim().split(' as ')[0]);

        imports.push({
          source: module,
          specifiers,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
    });

    return imports;
  }

  /**
   * Regex-based export extraction (temporary implementation)
   * 
   * Python doesn't have explicit exports like JavaScript.
   * We extract:
   * - Functions defined at module level (def)
   * - Classes defined at module level (class)
   * - Variables in __all__ list
   */
  private extractExportsRegex(code: string, filePath: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = code.split('\n');

    // Extract functions: def function_name(
    const functionRegex = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
    
    // Extract classes: class ClassName
    const classRegex = /^class\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    
    // Extract from __all__
    const allRegex = /__all__\s*=\s*\[([^\]]+)\]/;

    let inClass = false;
    let classIndent = 0;

    lines.forEach((line, idx) => {
      const indent = line.search(/\S/);
      
      // Track if we're inside a class (for filtering out methods)
      if (line.match(classRegex)) {
        inClass = true;
        classIndent = indent;
      } else if (inClass && indent <= classIndent && line.trim()) {
        inClass = false;
      }

      // Skip if inside a class (methods are not module-level exports)
      if (inClass) {
        // But do extract the class itself
        const classMatch = line.match(classRegex);
        if (classMatch) {
          exports.push({
            name: classMatch[1],
            type: 'class',
            loc: {
              start: { line: idx + 1, column: indent },
              end: { line: idx + 1, column: line.length },
            },
          });
        }
        return;
      }

      // Extract functions (only at module level)
      const funcMatch = line.match(functionRegex);
      if (funcMatch && indent === 0) {
        const name = funcMatch[1];
        // Skip private functions (starting with _) unless in __all__
        if (!name.startsWith('_') || name.startsWith('__')) {
          exports.push({
            name,
            type: 'function',
            loc: {
              start: { line: idx + 1, column: 0 },
              end: { line: idx + 1, column: line.length },
            },
          });
        }
      }

      // Extract from __all__
      const allMatch = line.match(allRegex);
      if (allMatch) {
        const names = allMatch[1]
          .split(',')
          .map(n => n.trim().replace(/['"]/g, ''));
        
        names.forEach(name => {
          if (name && !exports.find(e => e.name === name)) {
            exports.push({
              name,
              type: 'variable',
              loc: {
                start: { line: idx + 1, column: 0 },
                end: { line: idx + 1, column: line.length },
              },
            });
          }
        });
      }
    });

    return exports;
  }
}
