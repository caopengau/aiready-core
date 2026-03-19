# @aiready/platform

AIReady Platform Dashboard - Web application for monitoring and improving codebase AI readiness.

## Development

### Prerequisites

- Node.js 24+
- pnpm
- AWS account with SST configured
- GitHub OAuth apps (3 required - one per environment)
- Google OAuth app (1 with multiple redirect URIs)

### Environment Setup

SST uses stage-specific environment files:

| File         | Stage | Purpose                            |
| ------------ | ----- | ---------------------------------- |
| `.env.local` | local | Local development (localhost:8888) |
| `.env.dev`   | dev   | Deployed dev environment           |
| `.env.prod`  | prod  | Production environment             |

Copy `.env.example` to the appropriate `.env.{stage}` file and fill in values.

### OAuth Setup

#### GitHub OAuth (3 separate apps required)

GitHub only allows 1 callback URL per OAuth app, so you need 3 apps:

| Environment | Callback URL                                                   |
| ----------- | -------------------------------------------------------------- |
| Local       | `http://localhost:8888/api/auth/callback/github`               |
| Dev         | `https://dev.platform.getaiready.dev/api/auth/callback/github` |
| Prod        | `https://platform.getaiready.dev/api/auth/callback/github`     |

#### Google OAuth (1 app with multiple URIs)

Google allows multiple redirect URIs per app:

- `http://localhost:8888/api/auth/callback/google`
- `https://dev.platform.getaiready.dev/api/auth/callback/google`
- `https://platform.getaiready.dev/api/auth/callback/google`

### Commands

```bash
# Local development (uses .env.local)
pnpm dev
# OR
make dev-platform

# Deploy to dev (uses .env.dev)
pnpm run deploy
# OR
make deploy-platform

# Deploy to production (uses .env.prod)
pnpm run deploy:prod
# OR
make deploy-platform-prod
```

### Architecture

- **Framework**: Next.js 16 with App Router
- **Auth**: NextAuth v5 (Auth.js)
- **Database**: DynamoDB (Single Table Design)
- **Storage**: S3
- **Deployment**: SST v3 on AWS with CloudFront
- **DNS**: Cloudflare

### Project Structure

```
platform/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # NextAuth handlers
│   │   │   ├── analysis/       # Analysis upload
│   │   │   ├── billing/        # Stripe webhooks
│   │   │   ├── keys/           # API key management
│   │   │   └── repos/          # Repository management
│   │   ├── dashboard/          # Dashboard page
│   │   └── login/              # Login page
│   ├── components/             # React components
│   └── lib/                    # Utilities
│       ├── auth.ts             # NextAuth config
│       ├── auth.config.ts      # Auth providers
│       └── db.ts               # DynamoDB operations
├── sst.config.ts               # SST configuration
└── package.json
```

### SST Configuration

The `sst.config.ts` handles:

- **Local stage** (`--stage local`): No custom domain, localhost URLs
- **Dev stage** (`--stage dev`): `dev.platform.getaiready.dev` domain
- **Prod stage** (`--stage prod`): `platform.getaiready.dev` domain

### Authentication Flow

1. User clicks "Sign in with GitHub" or "Sign in with Google"
2. OAuth provider authenticates user
3. Callback received at `/api/auth/callback/{provider}`
4. NextAuth creates session with JWT
5. User redirected to dashboard

### Database Schema (DynamoDB Single Table)

| Entity   | PK              | SK                     | GSI1             | GSI2            |
| -------- | --------------- | ---------------------- | ---------------- | --------------- |
| User     | `USER#{id}`     | `USER#{id}`            | `EMAIL#{email}`  | -               |
| Repo     | `USER#{userId}` | `REPO#{repoId}`        | `REPO#{url}`     | -               |
| Analysis | `REPO#{repoId}` | `ANALYSIS#{timestamp}` | -                | `USER#{userId}` |
| ApiKey   | `USER#{userId}` | `KEY#{id}`             | `HASH#{keyHash}` | -               |

### Stripe Integration

- Subscription management via Stripe Billing
- Webhook endpoint: `/api/billing/webhook`
- Customer Portal: `/api/billing/portal`

### Remediation Agent System

The platform includes an automated code remediation system that improves AI-readiness of customer repositories.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REMEDIATION FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Analysis Spokes]                                                  │
│  pattern-detect, context-analyzer, consistency                      │
│         │                                                           │
│         ▼                                                           │
│  [RemediationRequest] ──► DynamoDB (status: pending)               │
│         │                                                           │
│         ▼                                                           │
│  [User Approves in UI] ──► POST /api/remediate                      │
│         │                                                           │
│         ▼                                                           │
│  [SQS Queue] ──► RemediationWorker (Lambda)                         │
│         │                                                           │
│         │  ┌────────────────────────────────────────────────────┐   │
│         │  │  1. Clone repo to /tmp                             │   │
│         │  │  2. Load RemediationSwarm from @aiready/agents    │   │
│         │  │  3. Execute Mastra agent with MCP tools:          │   │
│         │  │     - GitHub: create branch, commit, PR            │   │
│         │  │     - Filesystem: read/write files                │   │
│         │  │  4. Create Pull Request for expert review         │   │
│         │  └────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  [Status: reviewing] ──► PR URL stored in DynamoDB                  │
│         │                                                           │
│         ▼                                                           │
│  [Expert Review in GitHub] ──► Approve/Reject                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Key Components

| Component              | Location                         | Purpose                                        |
| ---------------------- | -------------------------------- | ---------------------------------------------- |
| `RemediationQueue.tsx` | `src/app/.../components/`        | UI for viewing/managing remediation queue      |
| `RemediationWorker`    | `src/worker/remediation.ts`      | AWS Lambda handler for processing remediations |
| `RemediationSwarm`     | `packages/agents/src/workflows/` | Mastra AI agent workflow                       |
| `github.ts`            | `packages/agents/src/tools/`     | GitHub MCP tools (branch, commit, PR)          |
| `fs.ts`                | `packages/agents/src/tools/`     | Filesystem MCP tools (read/write files)        |

#### Remediation Types

- **consolidation**: Merge duplicate code patterns
- **rename**: Fix naming convention issues
- **restructure**: Reorganize file/folder structure
- **refactor**: General code improvements

#### Safety Features

1. **Human-in-the-loop**: All remediations require explicit user approval
2. **PR-based**: Changes are submitted as Pull Requests for review
3. **In-progress blocking**: UI prevents approving new remediations while one is running
4. **Single-threaded**: SQS processes messages sequentially

#### Database Schema

| Entity      | PK              | SK                 |
| ----------- | --------------- | ------------------ |
| Remediation | `REPO#{repoId}` | `REMEDIATION#{id}` |

GSI1: `REMEDIATION#{id}` - For looking up remediation by ID
GSI2: `REPO#{repoId}` - For listing remediations by repo
GSI3: `TEAM#{teamId}` - For listing remediations by team

#### Future Enhancements

- SQS FIFO with `MessageGroupId = repoId` for ordered processing
- DynamoDB repo-level locking for concurrent safety
- File overlap detection before execution
- Autonomous mode with auto-approve for trusted repos

## License

MIT
