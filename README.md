# @aiready/context-analyzer

> **AI context window cost analysis - Detect fragmented code, deep import chains, and expensive context budgets**

When AI tools try to help with your code, they need to load files into their context window. Fragmented code structures make this expensive and sometimes impossible. This tool analyzes your codebase to identify:

## 🏛️ Architecture

```
                    🎯 USER
                      │
                      ▼
            🎛️  CLI (orchestrator)
                      │
    ┌─────────────────┴─────────────────┐
    │                                   │
    ▼                                   ▼
┌────────┐                        ┌────────┐
│🎨 VIS- │                        │ ANALY- │
│UALIZER │                        │  SIS   │
│✅ Ready│                        │ SPOKES │
└────────┘                        └───┬────┘
    │                                 │
    │           ┌─────────────────────┼─────────────────────┐
    │           ▼                     ▼                     ▼
    │     ┌────────┐           ┌────────┐           ┌────────┐
    │     │📊 PAT- │           │📦 CON- │           │🔧 CON- │
    │     │TERN    │           │TEXT    │           │SISTENCY│
    │     │DETECT  │           │ANALYZER│           │        │
    │     │        │           │        │           │        │
    │     │✅ Ready│           │✅ Ready│           │✅ Ready│
    │     └────────┘           └────────┘           └────────┘
    │                                 │                     │
    │                    ← YOU ARE HERE                    │
    │                                                       │
    └───────────────────────────────────────────────────────┘
                            │
                            ▼
                  🏢 HUB (@aiready/core)
```

## 🌍 Language Support

**Currently Supported (64% market coverage):**

- ✅ **TypeScript** (`.ts`, `.tsx`) - Import chains, context budget, cohesion
- ✅ **JavaScript** (`.js`, `.jsx`) - Import chains, context budget, cohesion
- ✅ **Python** (`.py`) - Import chains, context budget, circular deps, cohesion

**Roadmap:**

- 🔜 **Java** (Q3 2026) - Package dependencies, Maven/Gradle analysis
- 🔜 **Go** (Q4 2026) - Module dependencies, package cohesion
- 🔜 **Rust** (Q4 2026) - Crate dependencies, module structure
- 🔜 **C#** (Q1 2027) - Namespace dependencies, project references

## 🎯 Why This Tool?

When AI tools try to help with your code, they need to load files into their context window. Fragmented code structures make this expensive and sometimes impossible. This tool analyzes your codebase to identify:

- 📦 **High Context Budget**: Files that cost too many AI tokens to understand (file + dependencies)
- 🔗 **Deep Import Chains**: Cascading dependencies that force AI to load many files
- 🎯 **Low Cohesion**: Files mixing unrelated concerns (God objects)
- 🗂️ **High Fragmentation**: Domains scattered across many directories

## 🚀 Quick Start

**Zero config, works out of the box:**

```bash
# Run without installation (recommended)
npx @aiready/context-analyzer ./src

# Or use the unified CLI (includes all AIReady tools)
npx @aiready/cli scan ./src

# Or install globally for simpler command and faster runs
npm install -g @aiready/context-analyzer
aiready-context ./src
```

### 🎯 Input & Output

**Input:** Path to your source code directory

```bash
aiready-context ./src
```

**Output:** Terminal report + optional JSON file (saved to `.aiready/` directory)

```
📊 Context Analysis Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Files analyzed: 47
⚠️  Issues found: 8 files with problems

CRITICAL (3 files)
  src/services/user.ts
    • Context budget: 15,234 tokens (HIGH)
    • Import depth: 8 levels (DEEP)
    • Cohesion: 0.23 (LOW)
```

### ✨ Smart Defaults (Zero Config)

- ✅ **Auto-excludes** test files (`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`)
- ✅ **Auto-excludes** build outputs (`dist/`, `build/`, `.next/`, `cdk.out/`)
- ✅ **Auto-excludes** dependencies (`node_modules/`)
- ✅ **Auto-detects** frameworks (Next.js, AWS CDK) and adjusts analysis
- ✅ **Adaptive thresholds**: Adjusts issue detection based on project complexity

> Override defaults with `--include-tests` or `--exclude <patterns>` as needed

## 🎯 Why This Tool?

### The AI Context Cost Problem

AI coding assistants are limited by context windows, but teams unknowingly structure code in ways that maximize context consumption:

```typescript
// Scattered user management across 8 files = 12,450 tokens
src/user/get.ts          // 850 tokens
src/api/user.ts          // 1,200 tokens  
src/services/user.ts     // 2,100 tokens
src/helpers/user.ts      // 900 tokens
src/utils/user.ts        // 750 tokens
src/lib/user-validation.ts   // 1,800 tokens
src/models/user.ts       // 2,100 tokens
src/types/user.ts        // 2,750 tokens

Result: AI hits context limit, gives incomplete answers ❌

// Consolidated into 2 cohesive files = 2,100 tokens  
src/user/user.ts         // 1,400 tokens (core logic)
src/user/types.ts        // 700 tokens (types)

Result: AI sees everything, gives complete answers ✅
```

### What Makes Us Different?

| Feature | madge | dependency-cruiser | @aiready/context-analyzer |
|---------|-------|-------------------|--------------------------|
| Focus | Circular dependencies | Dependency rules | AI context cost |
| Metrics | Graph visualization | Rule violations | Token cost, fragmentation |
| AI-Specific | ❌ No | ❌ No | ✅ Yes - quantifies AI impact |
| Cohesion Analysis | ❌ No | ❌ No | ✅ Yes - detects mixed concerns |
| Recommendations | Generic | Rule-based | AI context optimization |

**Recommended Workflow:**

- Use **dependency-cruiser** to enforce architecture rules (blocking)
- Use **@aiready/context-analyzer** to optimize for AI tools (advisory)
- Track improvements over time with SaaS tier

**Related AIReady Tools:**

- [**@aiready/cli**](https://www.npmjs.com/package/@aiready/cli) - Unified CLI with all analysis tools
- [**@aiready/pattern-detect**](https://www.npmjs.com/package/@aiready/pattern-detect) - Semantic duplicate detection
- [**@aiready/consistency**](https://www.npmjs.com/package/@aiready/consistency) - Consistency checking

## 🧠 Understanding the Metrics

This tool measures four key dimensions that affect how much context AI tools need to load:

### 📊 Context Budget (Tokens)

**What it measures:** Total AI tokens needed to understand a file (file content + all dependencies)

**Why it matters:** AI tools have limited context windows (e.g., 128K tokens). Large context budgets mean:

- AI needs to load more files to understand your code
- Risk of hitting context limits → incomplete/wrong answers
- Slower AI responses (more processing time)

**Example:**

```typescript
// High context budget (15,000 tokens)
import { A, B, C } from './deeply/nested/utils'  // +5,000 tokens
import { X, Y, Z } from './another/chain'       // +8,000 tokens
// Your file: 2,000 tokens
// Total: 15,000 tokens just to understand this one file!

// Low context budget (2,500 tokens)  
// No deep imports, self-contained logic
// Total: 2,500 tokens
```

**🎯 Recommendation:** Files with high context budgets should be **split into smaller, more focused modules**.

---

### 🔗 Import Depth

**What it measures:** How many layers deep your import chains go

**Why it matters:** Deep import chains create cascading context loads:

```
app.ts → service.ts → helper.ts → util.ts → core.ts → base.ts
```

AI must load all 6 files just to understand app.ts!

**Example:**

```typescript
// Deep chain (depth 8) = AI loads 8+ files
import { validate } from '../../../utils/validators/user/schema'

// Shallow (depth 2) = AI loads 2 files  
import { validate } from './validators'
```

**🎯 Recommendation:** Flatten dependency trees or use **facade patterns** to reduce depth.

---

### 🎯 Cohesion Score (0-1)

**What it measures:** How related the exports in a file are to each other

**How it's calculated:** Uses Shannon entropy of inferred domains

- 1.0 = Perfect cohesion (all exports are related)
- 0.0 = Zero cohesion (completely unrelated exports)

**Why it matters:** Low cohesion = "God object" pattern = AI confusion

```typescript
// Low cohesion (0.3) - mixing unrelated concerns
export function validateUser() { }      // User domain
export function formatDate() { }        // Date domain  
export function sendEmail() { }         // Email domain
export class DatabasePool { }          // Database domain
// AI thinks: "What does this file actually do?"

// High cohesion (0.9) - focused responsibility
export function validateUser() { }
export function createUser() { }
export function updateUser() { }
export interface User { }
// AI thinks: "Clear! This is user management."
```

**🎯 Recommendation:** Files with low cohesion should be **split by domain** into separate, focused files.

---

### 🗂️ Fragmentation Score (0-1)

**What it measures:** How scattered a domain/concept is across different directories

**How it's calculated:** `(unique directories - 1) / (total files - 1)`

- 0.0 = No fragmentation (all files in same directory)
- 1.0 = Maximum fragmentation (each file in different directory)

**Why it matters:** Scattered domains force AI to load many unrelated paths

```typescript
// High fragmentation (0.8) - User domain scattered
src/api/user-routes.ts           // 800 tokens
src/services/user-service.ts     // 1,200 tokens
src/helpers/user-helpers.ts      // 600 tokens
src/utils/user-utils.ts          // 500 tokens
src/validators/user-validator.ts // 700 tokens
src/models/user-model.ts         // 900 tokens
// Total: 4,700 tokens spread across 6 directories!
// AI must navigate entire codebase to understand "User"

// Low fragmentation (0.0) - consolidated
src/user/user.ts                 // 2,800 tokens  
src/user/types.ts                // 600 tokens
// Total: 3,400 tokens in one place (29% savings!)
// AI finds everything in one logical location
```

**🎯 Recommendation:** Domains with high fragmentation should be **consolidated** into cohesive modules.

### 🔎 Additional Fragmentation Signals (new)

- **Path Entropy:** A normalized Shannon-entropy over directory distribution. Distinguishes "9 files in one folder + 1 outlier" from "5 and 5" — higher entropy means more evenly spread (worse).
- **Directory Distance:** Measures how deep the common ancestor is across file pairs. Files sharing a deep common ancestor are considered "closer" (lower distance) than files only sharing the repo root.
- **Import Cohesion (coupling discount):** If fragmented files actively import each other, the analyzer reduces the fragmentation penalty (up to 20%). This rewards intentional modularization where cross-folder imports are a natural design instead of accidental scattering.

These signals are included in the JSON summary (`fragmentedModules` entries) so you can prioritize consolidation efforts with more context: `fragmentationScore`, `pathEntropy`, `directoryDistance`, and `importCohesion`.

---

### 🏷️ File Classification (Reducing False Positives)

**What it measures:** The tool now classifies files into categories to distinguish real issues from acceptable patterns:

| Classification | Description | Fragmentation Treatment |
|---------------|-------------|------------------------|
| **barrel-export** | Re-exports from other modules (index.ts) | 0% (expected behavior) |
| **type-definition** | Primarily type/interface definitions | 0% (centralized types are good) |
| **cohesive-module** | Single domain, high cohesion (≥70%) | 30% of original (large but focused is OK) |
| **mixed-concerns** | Multiple domains, low cohesion | 100% (real issue) |
| **unknown** | Doesn't fit other categories | 70% of original (benefit of doubt) |

**Why it matters:** Previous versions could flag files that were actually well-designed:

```typescript
// ❌ Old behavior: Flagged as "high fragmentation (99%)"
// shared/src/index.ts - barrel export with 6 domains
export * from './user';
export * from './order';
export * from './product';
// ... more re-exports

// ✅ New behavior: Classified as "barrel-export"
// Fragmentation score: 0% (this is what barrel files DO)
// Recommendation: "Barrel export file detected - multiple domains are expected here"
```

```typescript
// ❌ Old behavior: Flagged as "high fragmentation (98%)"
// gst-calculator/client.tsx - 346 lines, 7 dependencies, 1 domain

// ✅ New behavior: Classified as "cohesive-module"
// Fragmentation score: 29% (reduced from 98%)
// Recommendation: "Module has good cohesion despite its size"
```

**🎯 Benefit:** Focus on real issues while accepting legitimate patterns.

**JSON Output includes classification:**

```json
{
  "file": "src/index.ts",
  "fileClassification": "barrel-export",
  "fragmentationScore": 0,
  "severity": "info"
}
```

---

### ⚖️ The Tradeoff: Splitting vs. Consolidating

**Important:** These metrics can pull in opposite directions!

| Action | Context Budget ⬇️ | Fragmentation ⬇️ | Cohesion ⬆️ |
|--------|------------------|------------------|-------------|
| **Split large file** | ✅ Reduces | ⚠️ May increase | ✅ Can improve |
| **Consolidate scattered files** | ⚠️ May increase | ✅ Reduces | ⚠️ May decrease |

**Best Practice:** Optimize for your use case:

- **Large files with mixed concerns** → Split by domain (improves cohesion + reduces budget)
- **Scattered single-domain files** → Consolidate (reduces fragmentation)
- **Large files with high cohesion** → May be OK if under context budget threshold
- **Small scattered files** → Consolidate into domain modules

**The tool helps you identify the right balance!**

### 📋 Quick Reference Table

| Metric | Good ✅ | Bad ❌ | Fix |
|--------|---------|--------|-----|
| **Context Budget** | < 10K tokens | > 25K tokens | Split large files |
| **Import Depth** | ≤ 5 levels | ≥ 8 levels | Flatten dependencies |
| **Cohesion** | > 0.6 (60%) | < 0.4 (40%) | Split by domain |
| **Fragmentation** | < 0.5 (50%) | > 0.7 (70%) | Consolidate domain |

**Rule of thumb:** The tool flags files that make AI's job harder (expensive to load, confusing to understand, scattered to find).

## 🚀 Installation

```bash
npm install -g @aiready/context-analyzer

# Or use directly with npx
npx @aiready/context-analyzer ./src
```

## 📊 Usage

### CLI

```bash
# Basic usage
aiready-context ./src

# Show more results in console (default: 10)
aiready-context ./src --max-results 25

# Focus on specific concerns
aiready-context ./src --focus fragmentation
aiready-context ./src --focus cohesion  
aiready-context ./src --focus depth

# Set thresholds
aiready-context ./src --max-depth 5 --max-context 10000 --min-cohesion 0.6

# Export to JSON for full details (saved to .aiready/ by default)
aiready-context ./src --output json

# Or specify custom path
aiready-context ./src --output json --output-file custom-report.json
```

> **📁 Output Files:** By default, all output files are saved to the `.aiready/` directory in your project root. You can override this with `--output-file`.

## 🎛️ Tuning Guide

**Smart defaults automatically adjust based on your repository size** to show ~10 most serious issues.

> **💡 Tip:** By default, console output shows the top 10 results per category. Use `--max-results <number>` to see more, or use `--output json` to get complete details of all issues.

### Understanding Threshold Tuning

Each parameter controls **when the tool flags a file as problematic**. Think of them as sensitivity dials:

- **Lower values** = More strict = More issues reported = More sensitive
- **Higher values** = More lenient = Fewer issues reported = Less sensitive

### Getting More/Fewer Results

**Want to catch MORE potential issues?** (More sensitive, shows smaller problems)

```bash
# Lower thresholds to be more strict:
aiready-context ./src --max-depth 3 --max-context 5000 --min-cohesion 0.7 --max-fragmentation 0.4
#                                 ↓                  ↓                   ↑                      ↓
#                         Catches depth≥4    Catches 5K+ tokens  Requires 70%+ cohesion  Catches 40%+ fragmentation
```

**What this means:**

- `--max-depth 3`: Flag files with import depth ≥4 (stricter than default 5-7)
- `--max-context 5000`: Flag files needing 5K+ tokens (catches smaller files)
- `--min-cohesion 0.7`: Require 70%+ cohesion (stricter about mixed concerns)
- `--max-fragmentation 0.4`: Flag domains with 40%+ scatter (catches less severe fragmentation)

**Want to see FEWER issues?** (Less noise, focus on critical problems only)

```bash
# Raise thresholds to be more lenient:
aiready-context ./src --max-depth 10 --max-context 30000 --min-cohesion 0.4 --max-fragmentation 0.8
#                                  ↑                   ↑                   ↓                      ↑
#                         Only depth≥11      Only 30K+ tokens      Allows 40%+ cohesion    Only 80%+ fragmentation
```

**What this means:**

- `--max-depth 10`: Only flag import depth ≥11 (very deep chains)
- `--max-context 30000`: Only flag files needing 30K+ tokens (only huge files)
- `--min-cohesion 0.4`: Accept 40%+ cohesion (more lenient about mixed concerns)
- `--max-fragmentation 0.8`: Only flag 80%+ scatter (only severely fragmented)

### Threshold Parameters Explained

| Parameter | Default (Auto) | Lower = More Strict | Higher = Less Strict | Impact |
|-----------|---------------|-------------------|---------------------|--------|
| `--max-depth` | 4-10* | Catches shallower imports | Only very deep chains | More splits → flatter structure |
| `--max-context` | 8k-40k* | Catches smaller files | Only huge files | More splits → smaller modules |
| `--min-cohesion` | 0.35-0.5* | Stricter about mixed concerns | More lenient | More splits → focused files |
| `--max-fragmentation` | 0.5-0.8* | Catches less scattered code | Only severely scattered | More consolidation → domain modules |

\* Auto-adjusted based on your repository size (100 files vs 2000+ files)

### Common Tuning Scenarios

**Small codebase getting too many warnings?**

```bash
aiready-context ./src --max-depth 6 --min-cohesion 0.5
# Explanation: Allow slightly deeper imports and more mixed concerns
# Use when: Your codebase is naturally small and warnings feel excessive
```

**Large codebase showing too few issues?**

```bash
aiready-context ./src --max-depth 5 --max-context 15000
# Explanation: Be stricter about depth and context to catch more problems
# Use when: You know there are issues but they're not being detected
```

**Focus on critical issues only:**

```bash
aiready-context ./src --max-depth 8 --max-context 25000 --min-cohesion 0.3
# Explanation: Very lenient - only show the worst offenders
# Use when: Fixing warnings in stages, start with critical issues first
```

**Preparing for AI refactoring sprint:**

```bash
aiready-context ./src --max-depth 4 --max-context 8000 --min-cohesion 0.6 --max-fragmentation 0.5
# Explanation: Strict on all dimensions to get comprehensive issue list
# Use when: Planning a major refactoring effort, need complete audit
```

**Microservices architecture (naturally fragmented):**

```bash
aiready-context ./src --max-fragmentation 0.9
# Explanation: Very lenient on fragmentation (services are meant to be separate)
# Use when: Analyzing microservices where fragmentation is intentional
```

## 📤 Output Options

### Console Output (Default)

Shows a summary with top 10 results per category:

```bash
# Default - shows top 10 items
aiready-context ./src

# Show more items (e.g., top 25)
aiready-context ./src --max-results 25

# Show all items (use a large number)
aiready-context ./src --max-results 999
```

### JSON Output

Get complete details of **all** issues (not limited to 10):

```bash
# Generate JSON with all issues
aiready-context ./src --output json

# Custom output path
aiready-context ./src --output json --output-file reports/analysis.json
```

### HTML Report

Visual report with charts and detailed breakdown:

```bash
# Generate HTML report
aiready-context ./src --output html --output-file report.html
```

### Include/Exclude Patterns

```bash
# Include/exclude patterns
aiready-context ./src --exclude "**/test/**,**/*.test.ts"
```

### Configuration

Create an `aiready.json` or `aiready.config.json` file in your project root:

```json
{
  "scan": {
    "include": ["**/*.{ts,tsx,js,jsx}"],
    "exclude": ["**/test/**", "**/*.test.*"]
  },
  "tools": {
    "context-analyzer": {
      "maxDepth": 4,
      "maxContextBudget": 8000,
      "minCohesion": 0.7,
      "maxFragmentation": 0.6,
      "focus": "all",
      "maxResults": 10
    }
  },
  "output": {
    "format": "console"
  }
}
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDepth` | number | `5` | Max acceptable import depth |
| `maxContextBudget` | number | `10000` | Max acceptable token budget |
| `minCohesion` | number | `0.6` | Min acceptable cohesion score (0-1) |
| `maxFragmentation` | number | `0.5` | Max acceptable fragmentation (0-1) |
| `focus` | string | `'all'` | Focus: `'fragmentation'`, `'cohesion'`, `'depth'`, `'all'` |
| `maxResults` | number | `10` | Max results per category in console |
| `includeNodeModules` | boolean | `false` | Include node_modules in analysis |

> **Note:** Domain detection is now fully automatic using semantic analysis (co-usage patterns + type dependencies). No domain configuration needed!

### Sample Output

```bash
🔍 Analyzing context window costs...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONTEXT ANALYSIS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Files analyzed: 127
📊 Total tokens: 145,680
💰 Avg context budget: 1,147 tokens/file
⏱  Analysis time: 0.52s

⚠️  Issues Found:

   🔴 Critical: 3
   🟡 Major: 12
   🔵 Minor: 8

   💡 Potential savings: 28,450 tokens

📏 Deep Import Chains:

   Average depth: 3.2
   Maximum depth: 8

   → src/services/order.ts (depth: 8)
   → src/api/payment.ts (depth: 7)
   → src/lib/validation.ts (depth: 6)

🧩 Fragmented Modules:

   Average fragmentation: 42%

   ● user-management - 8 files, 67% scattered
     Token cost: 12,450, Cohesion: 45%
   ● order-processing - 12 files, 58% scattered
     Token cost: 18,200, Cohesion: 52%

🔀 Low Cohesion Files:

   Average cohesion: 68%

   ○ src/utils/helpers.ts (35% cohesion)
   ○ src/lib/shared.ts (42% cohesion)

💸 Most Expensive Files (Context Budget):

   ● src/services/order.ts - 8,450 tokens
   ● src/api/payment.ts - 6,200 tokens
   ● src/utils/helpers.ts - 5,100 tokens

💡 Top Recommendations:

   1. src/services/order.ts
      • Flatten dependency tree or use facade pattern
      • Split file by domain - separate unrelated functionality

   2. src/utils/helpers.ts
      • Very low cohesion (35%) - mixed concerns
      • Split file by domain - separate unrelated functionality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💎 Roadmap: Historical trends and guided refactoring (planned)
💼 Roadmap: CI/CD integration and team benchmarks (planned)
```

### Programmatic API

```typescript
import { analyzeContext, generateSummary } from '@aiready/context-analyzer';

// Analyze entire project
const results = await analyzeContext({
  rootDir: './src',
  maxDepth: 5,
  maxContextBudget: 10000,
  minCohesion: 0.6,
  maxFragmentation: 0.5,
});

// Generate summary
const summary = generateSummary(results);

console.log(`Total files: ${summary.totalFiles}`);
console.log(`Total tokens: ${summary.totalTokens}`);
console.log(`Avg context budget: ${summary.avgContextBudget}`);
console.log(`Critical issues: ${summary.criticalIssues}`);

// Find high-cost files
const expensiveFiles = results.filter(r => r.contextBudget > 5000);
console.log(`Files with >5000 token budgets: ${expensiveFiles.length}`);

// Find fragmented modules
const fragmented = summary.fragmentedModules.filter(m => m.fragmentationScore > 0.5);
console.log(`Highly fragmented modules: ${fragmented.length}`);

// Get refactoring recommendations
for (const result of results) {
  if (result.severity === 'critical') {
    console.log(`${result.file}:`);
    result.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
}
```

## 📊 Metrics Explained

### Import Depth

**What:** Maximum chain length of transitive dependencies  
**Impact:** Deeper chains = more files to load = higher context cost  
**Threshold:** >5 is concerning, >8 is critical  
**Fix:** Flatten dependency tree, use facade pattern, break circular deps

### Context Budget

**What:** Total tokens AI needs to load to understand this file  
**Impact:** Higher budget = more expensive AI assistance  
**Threshold:** >10,000 tokens often hits context limits  
**Fix:** Split files, reduce dependencies, extract interfaces

### Fragmentation Score

**What:** How scattered related code is across directories (0-100%)  
**Impact:** Higher = more files to load for domain understanding  
**Threshold:** >50% indicates poor organization  
**Fix:** Consolidate related code into cohesive modules

### Cohesion Score

**What:** How related exports are within a file (0-100%)  
**Impact:** Lower = mixed concerns = wasted context  
**Threshold:** <60% indicates low cohesion  
**Fix:** Split by domain, separate unrelated functionality

## 🎯 Configuration

### CLI Options

```bash
--max-depth <number>           # Maximum acceptable import depth (default: 5)
--max-context <number>         # Maximum acceptable context budget in tokens (default: 10000)
--min-cohesion <number>        # Minimum acceptable cohesion score 0-1 (default: 0.6)
--max-fragmentation <number>   # Maximum acceptable fragmentation 0-1 (default: 0.5)
--focus <type>                 # Analysis focus: fragmentation|cohesion|depth|all (default: all)
--include-node-modules         # Include node_modules in analysis (default: false)
--include <patterns>           # File patterns to include (comma-separated)
--exclude <patterns>           # File patterns to exclude (comma-separated)
-o, --output <format>          # Output format: console|json|html (default: console)
--output-file <path>           # Output file path (for json/html)
```

### Default Exclusions

By default, these patterns are excluded (unless `--include-node-modules` is used):

```bash
# Dependencies (excluded by default, override with --include-node-modules)
**/node_modules/**

# Build outputs
**/dist/**, **/build/**, **/out/**, **/output/**, **/target/**, **/bin/**, **/obj/**, **/cdk.out/**

# Framework-specific build dirs
**/.next/**, **/.nuxt/**, **/.vuepress/**, **/.cache/**, **/.turbo/**

# Test and coverage
**/coverage/**, **/.nyc_output/**, **/.jest/**

# Version control and IDE
**/.git/**, **/.svn/**, **/.hg/**, **/.vscode/**, **/.idea/**, **/*.swp, **/*.swo

# Build artifacts and minified files
**/*.min.js, **/*.min.css, **/*.bundle.js, **/*.tsbuildinfo

# Logs and temporary files
**/logs/**, **/*.log, **/.DS_Store
```

### API Options

```typescript
interface ContextAnalyzerOptions {
  rootDir: string;                    // Root directory to analyze
  maxDepth?: number;                  // Maximum acceptable import depth (default: 5)
  maxContextBudget?: number;          // Maximum acceptable token budget (default: 10000)
  minCohesion?: number;               // Minimum acceptable cohesion score (default: 0.6)
  maxFragmentation?: number;          // Maximum acceptable fragmentation (default: 0.5)
  focus?: 'fragmentation' | 'cohesion' | 'depth' | 'all'; // Analysis focus (default: 'all')
  includeNodeModules?: boolean;       // Include node_modules (default: false)
  include?: string[];                 // File patterns to include
  exclude?: string[];                 // File patterns to exclude
}
```

## 🔬 How It Works

### 1. Dependency Graph Builder

Parses imports and exports to build a complete dependency graph of your codebase.

### 2. Depth Calculator

Calculates maximum import chain depth using graph traversal, identifying circular dependencies.

### 3. Semantic Domain Detection

Uses **co-usage patterns** (files imported together) and **type dependencies** (shared types) to automatically identify semantic domains. No configuration needed - the tool discovers relationships from actual code usage.

### 4. Fragmentation Detector

Groups files by semantic domain and calculates how scattered they are across directories.

### 5. Cohesion Analyzer

Uses entropy to measure how related exports are within each file (low entropy = high cohesion).

### 6. Context Budget Calculator

Sums tokens across entire dependency tree to estimate AI context cost for each file.

## 🎨 Output Formats

### Console (Default)

Rich formatted output with colors, emojis, and actionable recommendations.

### JSON

Machine-readable output for CI/CD integration:

```json
{
  "summary": {
    "totalFiles": 127,
    "totalTokens": 145680,
    "avgContextBudget": 1147,
    "criticalIssues": 3,
    "majorIssues": 12,
    "totalPotentialSavings": 28450
  },
  "results": [
    {
      "file": "src/services/order.ts",
      "tokenCost": 2100,
      "importDepth": 8,
      "contextBudget": 8450,
      "severity": "critical",
      "recommendations": ["Flatten dependency tree"]
    }
  ]
}
```

### HTML

Shareable report with tables and visualizations. Perfect for stakeholders:

```bash
aiready-context ./src --output html --output-file context-report.html
```

## 🧭 Interactive Mode

For first-time users, enable interactive guidance to apply smart defaults and focus areas:

```bash
# Suggest excludes for common frameworks (Next.js, AWS CDK) and choose focus
aiready-context ./src --interactive
```

Interactive mode:

- Detects frameworks and recommends excludes (e.g., .next, cdk.out)
- Lets you choose focus areas: frontend, backend, or both
- Applies configuration without modifying your files

## 🔗 Integration

### CI/CD

```yaml
# .github/workflows/code-quality.yml
- name: Analyze context costs
  run: npx @aiready/context-analyzer ./src --output json --output-file context-report.json
  
- name: Check critical issues
  run: |
    CRITICAL=$(jq '.summary.criticalIssues' context-report.json)
    if [ $CRITICAL -gt 0 ]; then
      echo "❌ $CRITICAL critical context issues found"
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx @aiready/context-analyzer ./src --max-depth 6 --max-context 8000 --output json > /tmp/context.json
CRITICAL=$(jq '.summary.criticalIssues' /tmp/context.json)
if [ $CRITICAL -gt 0 ]; then
  echo "❌ Critical context issues detected. Fix before committing."
  exit 1
fi
```

### With Other Tools

```bash
# Run all quality checks
npm run lint                    # ESLint for code quality
npm run type-check             # TypeScript for type safety
dependency-cruiser src         # Architecture rules
aiready-context src            # AI context optimization
aiready-patterns src           # Duplicate pattern detection
```

## 💰 SaaS Features (Coming Soon)

### Free Tier (CLI)

✅ One-time snapshot analysis  
✅ All metrics and recommendations  
✅ JSON/HTML export

## 🚧 Project Status

The SaaS and hosted features are not live yet. Today, this package ships as a CLI/tool-only module focused on local analysis. Future SaaS features will include:

- Historical trend tracking and team benchmarks
- Automated refactoring plans
- CI/CD integration and export APIs

Follow progress in the monorepo and release notes.

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/caopengau/aiready-context-analyzer.git
cd aiready-context-analyzer
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Dev mode (watch)
pnpm --filter @aiready/context-analyzer dev
```

## 📝 License

MIT © AIReady Team

## 🔗 Related Tools

- **[@aiready/pattern-detect](https://www.npmjs.com/package/@aiready/pattern-detect)** - Find semantic duplicate patterns
- **@aiready/doc-drift** - Detect stale documentation (coming soon)
- **[@aiready/consistency](https://www.npmjs.com/package/@aiready/consistency)** - Check naming consistency

---

## 🌐 Visit Our Website

**Try AIReady tools online and optimize your AI context:** [getaiready.dev](https://getaiready.dev)

**Made with ❤️ for AI-assisted development**

*Stop wasting context tokens on fragmented code.*
