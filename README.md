# @aiready/pattern-detect

> **Semantic duplicate pattern detection for AI-generated code**

Finds semantically similar but syntactically different code patterns that waste AI context and confuse models.

## 🚀 Quick Start

**Recommended: Use the unified CLI** (includes pattern detection + more tools):

```bash
npm install -g @aiready/cli
aiready patterns ./src
```

**Or use this package directly:**

```bash
npm install -g @aiready/pattern-detect
aiready-patterns ./src
```

## 🎯 What It Does

AI tools generate similar code in different ways because they lack awareness of your codebase patterns. This tool:

- **Semantic detection**: Finds functionally similar code (not just copy-paste) using Jaccard similarity on AST tokens
- **Pattern classification**: Groups duplicates by type (API handlers, validators, utilities, etc.)
- **Token cost analysis**: Shows wasted AI context budget
- **Refactoring guidance**: Suggests specific fixes per pattern type

### How It Works

The tool uses **Jaccard similarity** to compare code semantically:
1. Parses TypeScript/JavaScript files into Abstract Syntax Trees (AST)
2. Extracts semantic tokens (identifiers, operators, keywords) from each function
3. Calculates Jaccard similarity between token sets: `|A ∩ B| / |A ∪ B|`
4. Groups similar functions above the similarity threshold

This approach catches duplicates even when variable names or minor logic differs.

### Example Output

```
📁 Files analyzed: 47
⚠  Duplicate patterns found: 23
💰 Token cost (wasted): 8,450

🌐 api-handler      12 patterns
✓  validator        8 patterns
🔧 utility          3 patterns

1. 87% 🌐 api-handler
   src/api/users.ts:15 ↔ src/api/posts.ts:22
   432 tokens wasted
   → Create generic handler function
```

## ⚙️ Key Options

```bash
# Basic usage
aiready patterns ./src

# Focus on obvious duplicates
aiready patterns ./src --similarity 0.9

# Include smaller patterns
aiready patterns ./src --min-lines 3

# Export results (saved to .aiready/ by default)
aiready patterns ./src --output json

# Or specify custom path
aiready patterns ./src --output json --output-file custom-report.json
```

> **📁 Output Files:** By default, all output files are saved to the `.aiready/` directory in your project root. You can override this with `--output-file`.

## 🎛️ Tuning Guide

### Main Parameters

| Parameter | Default | Effect | Use When |
|-----------|---------|--------|----------|
| `--similarity` | `0.4` | Similarity threshold (0-1) | Want more/less sensitive detection |
| `--min-lines` | `5` | Minimum lines per pattern | Include/exclude small functions |
| `--min-shared-tokens` | `8` | Tokens that must match | Control comparison strictness |

### Quick Tuning Scenarios

**Want more results?** (catch subtle duplicates)
```bash
# Lower similarity threshold
aiready patterns ./src --similarity 0.3

# Include smaller functions  
aiready patterns ./src --min-lines 3

# Both together
aiready patterns ./src --similarity 0.3 --min-lines 3
```

**Want fewer but higher quality results?** (focus on obvious duplicates)
```bash
# Higher similarity threshold
aiready patterns ./src --similarity 0.8

# Larger patterns only
aiready patterns ./src --min-lines 10
```

**Analysis too slow?** (optimize for speed)
```bash
# Focus on substantial functions
aiready patterns ./src --min-lines 10

# Reduce comparison candidates
aiready patterns ./src --min-shared-tokens 12
```

### Parameter Tradeoffs

| Adjustment | More Results | Faster | Higher Quality | Tradeoff |
|------------|--------------|--------|----------------|----------|
| Lower `--similarity` | ✅ | ❌ | ❌ | More false positives |
| Lower `--min-lines` | ✅ | ❌ | ❌ | Includes trivial duplicates |
| Higher `--similarity` | ❌ | ✅ | ✅ | Misses subtle duplicates |
| Higher `--min-lines` | ❌ | ✅ | ✅ | Misses small but important patterns |

### Common Workflows

**First run** (broad discovery):
```bash
aiready patterns ./src  # Default settings
```

**Focus on critical issues** (production ready):
```bash
aiready patterns ./src --similarity 0.8 --min-lines 8
```

**Catch everything** (comprehensive audit):
```bash
aiready patterns ./src --similarity 0.3 --min-lines 3
```

**Performance optimization** (large codebases):
```bash
aiready patterns ./src --min-lines 10 --min-shared-tokens 10
```

## 📁 Configuration File

Create an `aiready.json` or `aiready.config.json` file in your project root:

```json
{
  "scan": {
    "include": ["src/**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/*.test.*", "**/dist/**"]
  },
  "tools": {
    "pattern-detect": {
      "minSimilarity": 0.6,
      "minLines": 8,
      "maxResults": 20,
      "minSharedTokens": 10,
      "maxCandidatesPerBlock": 100
    }
  },
  "output": {
    "format": "console",
    "file": ".aiready/pattern-report.json"
  }
}
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minSimilarity` | number | `0.4` | Similarity threshold (0-1) |
| `minLines` | number | `5` | Minimum lines to consider |
| `maxResults` | number | `10` | Max results to display in console |
| `minSharedTokens` | number | `8` | Min tokens that must match |
| `maxCandidatesPerBlock` | number | `100` | Performance tuning limit |
| `approx` | boolean | `true` | Use approximate candidate selection |
| `severity` | string | `'all'` | Filter: `'critical'`, `'high'`, `'medium'`, `'all'` |

**Use the unified CLI** for all AIReady tools:

```bash
npm install -g @aiready/cli

# Pattern detection
aiready patterns ./src

# Context analysis (token costs, fragmentation)
aiready context ./src

# Consistency checking (naming, patterns)
aiready consistency ./src

# Full codebase analysis
aiready scan ./src
```

**Related packages:**
- [**@aiready/cli**](https://www.npmjs.com/package/@aiready/cli) - Unified CLI with all tools
- [**@aiready/context-analyzer**](https://www.npmjs.com/package/@aiready/context-analyzer) - Context window cost analysis
- [**@aiready/consistency**](https://www.npmjs.com/package/@aiready/consistency) - Consistency checking

---

**Made with 💙 by the AIReady team** | [GitHub](https://github.com/caopengau/aiready)