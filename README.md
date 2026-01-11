# @aiready/pattern-detect

> **Semantic duplicate pattern detection for AI-generated code**

When AI tools generate code without awareness of existing patterns in your codebase, you end up with semantically similar but syntactically different implementations. This tool finds those patterns and quantifies their cost.

## 🎯 Why This Tool?

### The AI Code Problem

AI coding assistants (GitHub Copilot, ChatGPT, Claude) generate functionally similar code in different ways because:
- No awareness of existing patterns in your codebase
- Different AI models have different coding styles
- Team members use AI tools with varying contexts
- AI can't see your full codebase (context window limits)

### What Makes Us Different?

| Feature | jscpd | @aiready/pattern-detect |
|---------|-------|------------------------|
| Detection Method | Byte-level exact matching | Semantic similarity |
| Pattern Types | Generic blocks | Categorized (API, validators, utils, etc.) |
| Token Cost | ❌ No | ✅ Yes - shows AI context waste |
| Refactoring Suggestions | ❌ Generic | ✅ Specific to pattern type |
| Output Formats | Text/JSON | Console/JSON/HTML with rich formatting |

## 🚀 Installation

```bash
npm install -g @aiready/pattern-detect

# Or use directly with npx
npx @aiready/pattern-detect ./src
```

## 📊 Usage

### CLI

```bash
# Basic usage
aiready-patterns ./src

# Adjust sensitivity
aiready-patterns ./src --similarity 0.9

# Only look at larger patterns
aiready-patterns ./src --min-lines 10

# Export to JSON
aiready-patterns ./src --output json --output-file report.json

# Generate HTML report
aiready-patterns ./src --output html
```

### Programmatic API

```typescript
import { analyzePatterns, generateSummary } from '@aiready/pattern-detect';

const results = await analyzePatterns({
  rootDir: './src',
  minSimilarity: 0.85, // 85% similar
  minLines: 5,
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['**/*.test.ts', '**/node_modules/**'],
});

const summary = generateSummary(results);

console.log(`Found ${summary.totalPatterns} duplicate patterns`);
console.log(`Token cost: ${summary.totalTokenCost} tokens wasted`);
console.log(`Pattern breakdown:`, summary.patternsByType);
```

## 🔍 Real-World Example

### Before Analysis

Two API handlers that were written by AI on different days:

```typescript
// File: src/api/users.ts
app.get('/api/users/:id', async (request, response) => {
  const user = await db.users.findOne({ id: request.params.id });
  if (!user) {
    return response.status(404).json({ error: 'User not found' });
  }
  response.json(user);
});

// File: src/api/posts.ts
router.get('/posts/:id', async (req, res) => {
  const post = await database.posts.findOne({ id: req.params.id });
  if (!post) {
    res.status(404).send({ message: 'Post not found' });
    return;
  }
  res.json(post);
});
```

### Analysis Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATTERN ANALYSIS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Files analyzed: 47
⚠  Duplicate patterns found: 23
💰 Token cost (wasted): 8,450

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATTERNS BY TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 api-handler      12
✓  validator        8
🔧 utility          3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOP DUPLICATE PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 87% 🌐 api-handler
   src/api/users.ts:15
   ↔ src/api/posts.ts:22
   432 tokens wasted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CRITICAL ISSUES (>95% similar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● src/utils/validators.ts:15
  validator pattern 97% similar to src/utils/checks.ts (125 tokens wasted)
  → Consolidate validation logic into shared schema validators (Zod/Yup) (CRITICAL: Nearly identical code)
```

### Suggested Refactoring

Create a generic handler:

```typescript
// utils/apiHandler.ts
export const createResourceHandler = (resourceName: string, findFn: Function) => {
  return async (req: Request, res: Response) => {
    const item = await findFn({ id: req.params.id });
    if (!item) {
      return res.status(404).json({ error: `${resourceName} not found` });
    }
    res.json(item);
  };
};

// src/api/users.ts
app.get('/api/users/:id', createResourceHandler('User', db.users.findOne));

// src/api/posts.ts
router.get('/posts/:id', createResourceHandler('Post', database.posts.findOne));
```

**Result:** Reduced from 432 tokens to ~100 tokens in AI context.

## ⚙️ Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `minSimilarity` | Similarity threshold (0-1) | `0.85` |
| `minLines` | Minimum lines to consider a pattern | `5` |
| `include` | File patterns to include | `['**/*.ts', '**/*.js']` |
| `exclude` | File patterns to exclude | `['**/node_modules/**', '**/*.test.*']` |

## 📈 Understanding the Output

### Severity Levels

- **CRITICAL (>95% similar)**: Nearly identical code - refactor immediately
- **MAJOR (>90% similar)**: Very similar - refactor soon
- **MINOR (>85% similar)**: Similar - consider refactoring

### Pattern Types

- **🌐 api-handler**: REST API endpoints, route handlers
- **✓ validator**: Input validation, schema checks
- **🔧 utility**: Pure utility functions
- **📦 class-method**: Class methods with similar logic
- **⚛️ component**: UI components (React, Vue, etc.)
- **ƒ function**: Generic functions

### Token Cost

Estimated tokens wasted when AI tools process duplicate code:
- Increases context window usage
- Higher API costs for AI-powered tools
- Slower analysis and generation
- More potential for AI confusion

## 🎓 Best Practices

1. **Run regularly**: Integrate into CI/CD to catch new duplicates early
2. **Start with high similarity**: Use `--similarity 0.9` to find obvious wins
3. **Focus on critical issues**: Fix >95% similar patterns first
4. **Use pattern types**: Prioritize refactoring by category (API handlers → validators → utilities)
5. **Export reports**: Generate HTML reports for team reviews

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Pattern Detection

on: [pull_request]

jobs:
  detect-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npx @aiready/pattern-detect ./src --output json --output-file patterns.json
      - name: Check for critical issues
        run: |
          CRITICAL=$(jq '.summary.topDuplicates | map(select(.similarity > 0.95)) | length' patterns.json)
          if [ "$CRITICAL" -gt "0" ]; then
            echo "Found $CRITICAL critical duplicate patterns"
            exit 1
          fi
```

## 🤝 Contributing

We welcome contributions! This tool is part of the [AIReady](https://github.com/aiready/aiready) ecosystem.

## 📝 License

MIT - See LICENSE file

## 🔗 Related Tools (Coming Soon)

- **@aiready/context-analyzer** - Analyze token costs and context fragmentation
- **@aiready/doc-drift** - Track documentation freshness
- **@aiready/consistency** - Check naming pattern consistency

---

**Made with 💙 by the AIReady team** | [Docs](https://aiready.dev/docs) | [GitHub](https://github.com/aiready/aiready)
