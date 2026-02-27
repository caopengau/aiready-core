/**
 * Example: Using Multi-Language Parser
 *
 * This example demonstrates how to use the new multi-language parser
 * infrastructure to analyze TypeScript, JavaScript, and Python files.
 */

import { getParser, getSupportedLanguages, Language } from '@aiready/core';

// Example 1: Check supported languages
console.log('Supported languages:', getSupportedLanguages());
// Output: ['typescript', 'python']

// Example 2: Parse a TypeScript file
const tsParser = getParser('src/index.ts');
if (tsParser) {
  const tsCode = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
`;

  const tsResult = tsParser.parse(tsCode, 'src/index.ts');
  console.log(
    'TypeScript exports:',
    tsResult.exports.map((e) => e.name)
  );
  // Output: ['greet', 'Calculator']
}

// Example 3: Parse a Python file
const pyParser = getParser('src/main.py');
if (pyParser) {
  const pyCode = `
from typing import List

def greet(name: str) -> str:
    return f"Hello, {name}!"

class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

def _private_helper():
    pass
`;

  const pyResult = pyParser.parse(pyCode, 'src/main.py');
  console.log(
    'Python exports:',
    pyResult.exports.map((e) => e.name)
  );
  // Output: ['greet', 'Calculator']
  // Note: _private_helper is not exported

  console.log(
    'Python imports:',
    pyResult.imports.map((i) => `${i.source}: ${i.specifiers.join(', ')}`)
  );
  // Output: ['typing: List']
}

// Example 4: Get naming conventions for a language
const tsNaming = tsParser?.getNamingConventions();
if (tsNaming) {
  console.log('TypeScript naming conventions:');
  console.log('- Variables:', tsNaming.variablePattern); // camelCase
  console.log('- Classes:', tsNaming.classPattern); // PascalCase
}

const pyNaming = pyParser?.getNamingConventions();
if (pyNaming) {
  console.log('Python naming conventions (PEP 8):');
  console.log('- Variables:', pyNaming.variablePattern); // snake_case
  console.log('- Classes:', pyNaming.classPattern); // PascalCase
}

// Example 5: Analyze a mixed codebase
const filesToAnalyze = [
  'src/components/Button.tsx',
  'src/utils/helpers.ts',
  'scripts/build.py',
  'scripts/deploy.py',
];

const results = new Map<Language, number>();

for (const file of filesToAnalyze) {
  const parser = getParser(file);
  if (parser) {
    results.set(parser.language, (results.get(parser.language) || 0) + 1);
  }
}

console.log('Codebase composition:');
for (const [lang, count] of results) {
  console.log(`- ${lang}: ${count} files`);
}
// Output:
// - typescript: 2 files
// - python: 2 files
