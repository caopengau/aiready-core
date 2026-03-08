# @aiready/core

> Shared utilities, types, and scoring logic for all AIReady analysis tools.

## 🏛️ Architecture

```
                    🎯 USER
                      │
                      ▼
         🎛️  @aiready/cli (orchestrator)
          │     │     │     │     │     │     │     │     │
          ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
        [PAT] [CTX] [CON] [AMP] [DEP] [DOC] [SIG] [AGT] [TST]
          │     │     │     │     │     │     │     │     │
          └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                               │
                               ▼
                      🏢 @aiready/core  ← YOU ARE HERE

Legend:
  PAT = pattern-detect        CTX = context-analyzer
  CON = consistency           AMP = change-amplification
  DEP = deps-health           DOC = doc-drift
  SIG = ai-signal-clarity     AGT = agent-grounding
  TST = testability
```

## Overview

This package provides common utilities, type definitions, and the multi-language parser factory used across all AIReady tools. It's designed as a foundational library for building code analysis tools focused on AI-readiness.

### Language Support

Supports **TypeScript, JavaScript, Python, Java, Go, and C#**.

## License

MIT
// ping
// ping
// ping 2
