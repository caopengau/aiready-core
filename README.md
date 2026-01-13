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

- **Semantic detection**: Finds functionally similar code (not just copy-paste)
- **Pattern classification**: Groups duplicates by type (API handlers, validators, utilities, etc.)
- **Token cost analysis**: Shows wasted AI context budget
- **Refactoring guidance**: Suggests specific fixes per pattern type

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

# Export results
aiready patterns ./src --output json --output-file report.json
```

## 🔗 Related Tools

**Use the unified CLI** for all AIReady tools:

```bash
npm install -g @aiready/cli

# Pattern detection
aiready patterns ./src

# Context analysis (token costs, fragmentation)
aiready context ./src

# Full codebase analysis
aiready scan ./src
```

**Individual packages:**
- [**@aiready/cli**](https://www.npmjs.com/package/@aiready/cli) - Unified CLI with all tools
- [**@aiready/context-analyzer**](https://www.npmjs.com/package/@aiready/context-analyzer) - Context window cost analysis

---

**Made with 💙 by the AIReady team** | [GitHub](https://github.com/caopengau/aiready)