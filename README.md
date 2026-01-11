# @aiready/core

> **Shared utilities and types for AIReady analysis tools**

This package provides common utilities, type definitions, and helper functions used across all AIReady tools. It's designed as a foundational library for building code analysis tools focused on AI-readiness.

## 📦 Installation

```bash
npm install @aiready/core
# or
pnpm add @aiready/core
```

## 🔧 Usage

### File Scanning

```typescript
import { scanFiles } from '@aiready/core';

const files = await scanFiles({
  rootDir: './src',
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['**/*.test.ts', '**/node_modules/**'],
  maxDepth: 10,
});

console.log(`Found ${files.length} files`);
```

### Token Estimation

```typescript
import { estimateTokens } from '@aiready/core';

const code = `
function hello() {
  return "world";
}
`;

const tokenCount = estimateTokens(code);
console.log(`Estimated tokens: ${tokenCount}`);
```

### Similarity Detection

```typescript
import { similarityScore, levenshteinDistance } from '@aiready/core';

const code1 = 'function handleUser(user) { ... }';
const code2 = 'function handlePost(post) { ... }';

const similarity = similarityScore(code1, code2);
console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);

const distance = levenshteinDistance(code1, code2);
console.log(`Edit distance: ${distance}`);
```

### TypeScript Types

```typescript
import type {
  AnalysisResult,
  Issue,
  IssueType,
  Location,
  Metrics,
  ScanOptions,
  Report,
} from '@aiready/core';

const result: AnalysisResult = {
  fileName: 'src/utils/helper.ts',
  issues: [
    {
      type: 'duplicate-pattern',
      severity: 'major',
      message: 'Similar pattern found',
      location: {
        file: 'src/utils/helper.ts',
        line: 15,
        column: 5,
      },
      suggestion: 'Extract to shared utility',
    },
  ],
  metrics: {
    tokenCost: 250,
    consistencyScore: 0.85,
  },
};
```

## 📚 API Reference

### File Operations

- **`scanFiles(options: ScanOptions): Promise<string[]>`** - Scan directory for files matching patterns
- **`readFileContent(filePath: string): Promise<string>`** - Read file contents

### Metrics

- **`estimateTokens(text: string): number`** - Estimate token count (~4 chars = 1 token)
- **`levenshteinDistance(str1: string, str2: string): number`** - Calculate edit distance
- **`similarityScore(str1: string, str2: string): number`** - Calculate similarity (0-1)

### AST Parsing

- **`parseTypeScript(code: string): SourceFile`** - Parse TypeScript/JavaScript code to AST
- **`extractFunctions(ast: SourceFile): FunctionNode[]`** - Extract function declarations

### Types

All shared TypeScript interfaces and types for analysis results, issues, metrics, and configuration options.

## 🔗 Related Packages

- **[@aiready/pattern-detect](https://www.npmjs.com/package/@aiready/pattern-detect)** - Semantic duplicate pattern detection
- **@aiready/context-analyzer** - Token cost and context fragmentation analysis _(coming soon)_
- **@aiready/doc-drift** - Documentation freshness tracking _(coming soon)_

## 📝 License

MIT - See [LICENSE](./LICENSE)

---

**Part of the [AIReady](https://github.com/aiready) toolkit** | [Documentation](https://aiready.dev) | [GitHub](https://github.com/caopengau/aiready-core)
