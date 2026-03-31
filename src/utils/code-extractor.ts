import { estimateTokens } from './metrics';
import { CodeBlock } from '../types/code-block';

// Re-export for backward compatibility
export type { CodeBlock };

/**
 * Infer the type of code pattern based on keywords and naming conventions.
 */
export function inferPatternType(keyword: string, name: string): string {
  const n = name.toLowerCase();
  if (
    keyword === 'handler' ||
    n.includes('handler') ||
    n.includes('controller') ||
    n.startsWith('app.')
  ) {
    return 'api-handler';
  }
  if (n.includes('validate') || n.includes('schema')) return 'validator';
  if (n.includes('util') || n.includes('helper')) return 'utility';
  if (keyword === 'class') return 'class-method';
  if (n.match(/^[A-Z]/)) return 'component';
  if (keyword === 'function' || keyword === 'def') return 'function';
  return 'unknown';
}

/**
 * Split file content into logical blocks (functions, classes, methods)
 * Handles TS/JS, Java, C#, Go, and Python (via indentation)
 */
export function extractCodeBlocks(file: string, content: string): CodeBlock[] {
  const isPython = file.toLowerCase().endsWith('.py');
  if (isPython) {
    return extractBlocksPython(file, content);
  }

  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');

  // Regex to match declarations
  const blockRegex =
    /^\s*(?:export\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|static\s+|readonly\s+|virtual\s+|abstract\s+|override\s+)*(function|class|interface|type|enum|record|struct|void|func|[a-zA-Z0-9_<>[]]+)\s+([a-zA-Z0-9_]+)(?:\s*\(|(?:\s+extends|\s+implements|\s+where)?\s*\{)|^\s*(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*[a-zA-Z0-9_.]+\.object\(|^\s*(app\.(?:get|post|put|delete|patch|use))\(/gm;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const startLine = content.substring(0, match.index).split('\n').length;

    let type: string;
    let name: string;

    if (match[1]) {
      type = match[1];
      name = match[2];
    } else if (match[3]) {
      type = 'const';
      name = match[3];
    } else {
      type = 'handler';
      name = match[4];
    }

    // Find end of block (matching braces heuristic)
    let endLine = -1;
    let openBraces = 0;
    let foundStart = false;

    // Heuristic: check if it's a single-line block or multi-line
    const lineEnd = content.indexOf('\n', match.index);
    const lineText = content.substring(
      match.index,
      lineEnd === -1 ? content.length : lineEnd
    );

    if (lineText.includes('{') && lineText.includes('}')) {
      // Single line block
      endLine = startLine;
    } else {
      for (let i = match.index; i < content.length; i++) {
        if (content[i] === '{') {
          openBraces++;
          foundStart = true;
        } else if (content[i] === '}') {
          openBraces--;
        }

        if (foundStart && openBraces === 0) {
          endLine = content.substring(0, i + 1).split('\n').length;
          break;
        }
      }
    }

    if (endLine === -1) {
      endLine = startLine; // Fallback
    }

    endLine = Math.max(startLine, endLine);
    const blockCode = lines.slice(startLine - 1, endLine).join('\n');
    const tokens = estimateTokens(blockCode);

    blocks.push({
      file,
      startLine,
      endLine,
      code: blockCode,
      tokens,
      patternType: inferPatternType(type, name),
    });
  }

  // Filter out re-export blocks that are not true logic duplication
  return blocks.filter((block) => {
    const code = block.code.trim();
    // Skip re-export patterns: export { X } from './Y' or export { X, Y } from './Z'
    if (/^export\s+\{[^}]+\}\s*(from\s+['"][^'"]+['"])?\s*;?\s*$/.test(code))
      return false;
    // Skip barrel re-exports: export * from './Y'
    if (/^export\s+\*\s+from\s+/.test(code)) return false;
    // Skip namespace re-exports: export * as X from './Y'
    if (/^export\s+\*\s+as\s+\w+\s+from\s+/.test(code)) return false;
    return true;
  });
}

/**
 * Python-specific block extraction based on indentation
 */
function extractBlocksPython(file: string, content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');
  const blockRegex = /^\s*(?:async\s+)?(def|class)\s+([a-zA-Z0-9_]+)/gm;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const startLinePos = content.substring(0, match.index).split('\n').length;
    const startLineIdx = startLinePos - 1;
    const initialIndent = lines[startLineIdx].search(/\S/);

    let endLineIdx = startLineIdx;

    for (let i = startLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) {
        endLineIdx = i;
        continue;
      }

      const currentIndent = line.search(/\S/);
      if (currentIndent <= initialIndent) {
        break;
      }
      endLineIdx = i;
    }

    while (endLineIdx > startLineIdx && lines[endLineIdx].trim().length === 0) {
      endLineIdx--;
    }

    const blockCode = lines.slice(startLineIdx, endLineIdx + 1).join('\n');
    const tokens = estimateTokens(blockCode);

    blocks.push({
      file,
      startLine: startLinePos,
      endLine: endLineIdx + 1,
      code: blockCode,
      tokens,
      patternType: inferPatternType(match[1], match[2]),
    });
  }

  return blocks;
}
