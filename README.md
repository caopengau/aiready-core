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

**Part of the [AIReady](https://github.com/caopengau/aiready) toolkit** | Docs: see the monorepo [README](https://github.com/caopengau/aiready#readme) | Status: website not live yet
