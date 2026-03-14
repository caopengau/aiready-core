import * as Parser from 'web-tree-sitter';
import { ExportInfo } from '../types/language';

/**
 * Common regex patterns and keywords for metadata analysis across languages
 */
export const ASYNC_KEYWORDS = [
  'async',
  'await',
  'task',
  'promise',
  'go ',
  'defer',
];
export const SIDE_EFFECT_KEYWORDS = [
  'print(',
  'console.',
  'System.out',
  'System.err',
  'fmt.',
  'File.Write',
  'Files.write',
  'os.Exit',
  'panic(',
  'throw ',
  'Logging.',
  'log.',
];

/**
 * Common metadata analysis for tree-sitter nodes.
 * Consolidates purity, side-effect heuristics, and documentation extraction.
 */
export function analyzeGeneralMetadata(
  node: Parser.Node,
  code: string,
  options: { sideEffectSignatures?: string[] } = {}
): Partial<ExportInfo> {
  const metadata: Partial<ExportInfo> = {
    isPure: true,
    hasSideEffects: false,
  };

  // 1. Documentation extraction (heuristic-based)
  try {
    let prev: Parser.Node | null = (node as any).previousSibling || null;
    while (prev && /comment/i.test(prev.type)) {
      const text = prev.text || '';
      // Prefer structured doc comments (/** ... */)
      if (text.trim().startsWith('/**')) {
        metadata.documentation = {
          content: text.replace(/^[/*]+|[/*]+$/g, '').trim(),
          type: 'jsdoc',
        };
        break;
      }
      // Triple-slash comments (/// ...)
      if (text.trim().startsWith('///')) {
        metadata.documentation = {
          content: text.replace(/^\/\/\//, '').trim(),
          type: 'xml-doc',
        };
        break;
      }
      // Standard comments (// ...)
      if (text.trim().startsWith('//')) {
        metadata.documentation = {
          content: text.replace(/^\/\//, '').trim(),
          type: 'comment',
        };
        break;
      }
      prev = prev.previousSibling;
    }
  } catch {
    // best-effort
  }

  // 2. Side-effect and purity analysis via AST walk
  const signatures = [
    ...SIDE_EFFECT_KEYWORDS,
    ...(options.sideEffectSignatures || []),
  ];

  const walk = (n: Parser.Node) => {
    // Assignments/state changes
    if (
      /assign|assignment|assignment_statement|assignment_expression/i.test(
        n.type
      )
    ) {
      metadata.isPure = false;
      metadata.hasSideEffects = true;
    }

    // Known side-effect signatures (printed/logged/thrown/file-io)
    const text = n.text;
    for (const sig of signatures) {
      if (text.includes(sig)) {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
        break;
      }
    }

    if (!metadata.hasSideEffects) {
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) walk(child);
      }
    }
  };

  walk(node);
  return metadata;
}

/**
 * Extract parameter names from a variety of tree-sitter AST shapes.
 * This helper consolidates similar logic used across language parsers.
 */
export function extractParameterNames(node: Parser.Node): string[] {
  const params: string[] = [];

  const candidates: (Parser.Node | null)[] = [
    // common field name
    (node as any).childForFieldName
      ? (node as any).childForFieldName('parameters')
      : null,
    (node as any).childForFieldName
      ? (node as any).childForFieldName('parameter_list')
      : null,
    node.children.find((c) => c.type === 'parameter_list') || null,
    node.children.find((c) => c.type === 'parameters') || null,
    node.children.find((c) => c.type === 'formal_parameters') || null,
    node.children.find((c) => c.type === 'formal_parameter') || null,
  ];

  const list = candidates.find(Boolean) as Parser.Node | undefined;
  if (!list) return params;

  for (const child of list.children) {
    if (!child) continue;

    // Try common identifier positions
    const id =
      (child as any).childForFieldName?.('name') ||
      child.children.find((c) =>
        [
          'identifier',
          'variable_name',
          'name',
          'parameter',
          'formal_parameter',
        ].includes(c.type)
      ) ||
      (child.type === 'identifier' ? child : undefined);

    if (id && typeof id.text === 'string') params.push(id.text);
  }

  return params;
}
