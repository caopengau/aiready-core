# 🔄 Two-Way Sync Architecture: Evolution-as-a-Service (EaaS)

**Goal:** To establish a robust, reliable, and automated infrastructure that allows the Hub (Mother Repo) to push innovations to Spokes (Client Repos) while absorbing client-specific optimizations back into the Hub.

---

## 🏗️ 1. Core Mechanism: Subtree-as-a-Service

While `git subtree` is the primitive, our architecture wraps it in a governance layer.

### **Hub (Mother): `serverlessclaw`**

- **Location**: `serverlessclaw/` (Internal to Monorepo)
- Contains the "Canonical Blueprint".
- Master source of truth for all "Agentic Ready" infra.
- **Upstream Updates**: When a core feature is improved here, it prepares for "Broadcast" to client repositories.

### **Orchestrator (Management Plane): `clawmore`**

- **Location**: `packages/aiready/clawmore`
- Acts as the "Brain" that manages the sync logic.
- Maintains the `sync-rules.json` and registry of client repos.
- Executes the `sync-orchestrator.ts` logic.

### **Spoke (Client): `clawmore-client-{id}`**

- Standalone standalone repositories containing the managed stack for each client.
- **Downstream Absorption**: Periodically unified with Hub updates via `clawmore` orchestration.

---

## 🔄 2. The Two-Way Flow

### **A. Hub → Spoke (The Broadcast)**

1.  **Tagging**: Hub creates a release tag (e.g., `v1.2.0`).
2.  **Staging**: A Sync Agent creates a `feature/sync-hub-v1.2.0` branch in the Spoke repo.
3.  **Subtree Pull**: `git subtree pull --prefix=. hub main --squash`.
4.  **Validation**: CI/CD runs Spoke-specific tests.
5.  **Auto-Merge**: If tests pass, the sync branch is merged to `main`.

### **B. Spoke → Hub (The Contribution)**

1.  **Optimization Detection**: An "Observation Agent" identifies a successful refactor in a Spoke (e.g., a better Lambda warm-up strategy).
2.  **Back-Porting**: The agent triggers `make sync-from-spoke` in the Hub's context.
3.  **Pruning**: Hub filters out client-specific secrets or branding.
4.  **Proposal**: A PR is raised in the Hub: `feat(spoke-absorb): optimization from client-X`.

---

## 🛡️ 3. Reliability & Robustness

### **Conflict Resolution Strategy**

- **Priority Rules**: Hub always wins for "Core" files (defined in `.sync-rules`). Spoke wins for "Configuration" files.
- **Agentic Mediation**: If a conflict occurs, a `ResolutionAgent` analyzes the semantic difference and proposes a fix rather than failing the build.

### **Atomic Syncs**

- Every sync must be **idempotent**.
- **Rollback Mechanism**: If a deploy fails post-sync, the Spoke repo automatically reverts to the pre-sync tag.

### **Validation Gates**

- **The "Evolution Sandbox"**: Updates are first applied to a `sandbox` spoke to verify no breaking changes occur in the "Vending" logic.
- **Contract Testing**: Ensuring API interfaces between Hub and Spoke remain compatible.

---

## 🚀 4. Automation: The Sync Swarm

We shift from manual Makefiles to an **Autonomous Sync Swarm**:

| Agent Role      | Responsibility                                                |
| :-------------- | :------------------------------------------------------------ |
| **Broadcaster** | Monitors Hub commits and initiates Spoke syncs.               |
| **Validator**   | Runs test suites in Spokes post-sync.                         |
| **Harvester**   | Scans Spokes for valuable mutations to bring back to the Hub. |
| **Janitor**     | Cleans up sync branches and monitors repo health.             |

---

## 📅 5. Implementation Roadmap

- [ ] **Phase 1**: Formalize `.sync-rules.json` to define file ownership.
- [ ] **Phase 2**: Implement the `Broadcaster` Lambda to trigger GitHub Actions via Repository Dispatch.
- [ ] **Phase 3**: Build the "Contribution Dashboard" for the Hub owner to approve incoming Spoke refactors.

---

**Status:** `DRAFT_FOR_REVIEW`  
**Owner:** ClawMore Engineering
